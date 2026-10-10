import { GraphQLScalarType, GraphQLObjectType, GraphQLInputObjectType, GraphQLSchema, GraphQLString, GraphQLInt, GraphQLList, graphql, parse, visit, valueFromASTUntyped } from 'graphql';
import { EventEmitter } from 'node:events';
import { InputSanitizer } from '../security/cryptoSecurity.js';

const JSONValue = new GraphQLScalarType({ name: 'ApplicationJSON', serialize: value => value, parseValue: value => value, parseLiteral: node => valueFromASTUntyped(node) });
const Input = new GraphQLInputObjectType({ name: 'ApplicationInput', fields: { params: { type: JSONValue }, query: { type: JSONValue }, body: { type: JSONValue } } });
const Result = new GraphQLObjectType({ name: 'ApplicationResult', fields: { status: { type: GraphQLInt }, body: { type: JSONValue }, headers: { type: JSONValue } } });
const Operation = new GraphQLObjectType({ name: 'ApplicationOperation', fields: { field: { type: GraphQLString }, method: { type: GraphQLString }, path: { type: GraphQLString } } });

export function protectAsyncRouter(router) {
  for (const layer of router.stack || []) {
      for (const handler of layer.route ? layer.route.stack : [layer]) {
        const original = handler.handle;
        if (original.length === 4 || original.graphqlSafe || original.stack) continue;
        const wrapped = (req, res, next) => { try { Promise.resolve(original(req, res, next)).catch(next); } catch (error) { next(error); } };
        wrapped.graphqlSafe = true;
        handler.handle = wrapped;
      }
  }
  return router;
}

function dispatch(router, route, method, input, context, fullPath) {
  return new Promise((resolve, reject) => {
    const req = Object.create(context.req);
    const params = input?.params || {};
    const routePath = route.replace(/:([A-Za-z0-9_]+)/g, (_, name) => {
      if (typeof params[name] !== 'string' && typeof params[name] !== 'number') throw new Error(`Missing route parameter: ${name}`);
      return encodeURIComponent(String(params[name]));
    });
    if (context.req.activeUser?.isBanned && !/^\/api\/auth\/(disabled|appeal|session|logout)(\/|$)/.test(fullPath)) {
      return resolve({ status: 403, body: { error: 'ACCOUNT_DISABLED', banned: true, reason: context.req.activeUser.banReason }, headers: {} });
    }
    Object.assign(req, {
      method, url: routePath, originalUrl: routePath, baseUrl: '',
      params: {}, query: input?.query || {}, body: input?.body || {},
      // Never take authentication, headers, IP or cookies from GraphQL variables.
      activeUser: context.req.activeUser, cookies: context.req.cookies,
      headers: { ...context.req.headers, 'content-type': 'application/json' }
    });
    req.body = InputSanitizer.sanitize(req.body);
    req.query = InputSanitizer.sanitize(req.query);
    const headers = {};
    const res = new EventEmitter();
    let finished = false;
    res.statusCode = 200;
    res.locals = {};
    res.req = req;
    res.app = context.req.app;
    res.getHeader = name => headers[name.toLowerCase()];
    res.setHeader = (name, value) => { headers[name.toLowerCase()] = value; };
    res.removeHeader = name => { delete headers[name.toLowerCase()]; };
    res.status = code => { res.statusCode = code; return res; };
    res.set = res.header = (name, value) => { if (typeof name === 'object') Object.entries(name).forEach(([key, val]) => res.setHeader(key, val)); else res.setHeader(name, value); return res; };
    res.get = res.getHeader;
    res.append = (name, value) => { const old = res.getHeader(name); res.setHeader(name, old ? [].concat(old, value) : value); return res; };
    res.cookie = function (...args) { context.res.cookie(...args); return res; };
    res.clearCookie = function (...args) { context.res.clearCookie(...args); return res; };
    const complete = body => {
      if (finished) return res;
      finished = true;
      res.headersSent = true;
      res.emit('finish');
      resolve({ status: res.statusCode, body: body ?? null, headers });
      return res;
    };
    res.json = res.send = res.end = complete;
    res.sendStatus = code => { res.statusCode = code; return complete(null); };
    req.res = res;
    router.handle(req, res, error => {
      if (error) return resolve({ status: error.status || 500, body: { error: error.status ? error.message : 'Application operation failed' }, headers });
      res.statusCode = 404;
      complete({ error: 'Operation not found' });
    });
  });
}

export function createApplicationGraphQL(groups) {
  const operations = [];
  const queries = {};
  const mutations = {};
  for (const [prefix, router] of groups) {
    protectAsyncRouter(router);
    for (const layer of router.stack || []) {
      const route = layer.route;
      if (!route || typeof route.path !== 'string' || route.path.includes('*')) continue;
      const routePath = `${prefix}${route.path}`;
      // Multipart/binary delivery and infrastructure callbacks keep their native HTTP transport.
      if (/graphql|upload|attachment|download|export|backup|media\/|stream|\/tls\/|webhook|hero-video|hero-bg\.mp4/i.test(routePath)) continue;
      for (const method of (route.methods._all ? ['get', 'post'] : Object.keys(route.methods)).filter(value => ['get', 'post', 'put', 'patch', 'delete'].includes(value))) {
        const field = method + routePath.split('/').filter(Boolean).map(part => part.startsWith(':') ? `By${part.slice(1)}` : part).map(part => part.replace(/[^A-Za-z0-9_]/g, '_')).map(part => part[0].toUpperCase() + part.slice(1)).join('');
        const target = method === 'get' ? queries : mutations;
        if (target[field]) continue;
        operations.push({ field, method: method.toUpperCase(), path: routePath });
        target[field] = { type: Result, args: { input: { type: Input } }, resolve: (_root, { input }, context) => dispatch(router, route.path, method.toUpperCase(), input, context, routePath) };
      }
    }
  }
  queries.applicationOperations = { type: new GraphQLList(Operation), resolve: () => operations };
  const schema = new GraphQLSchema({ query: new GraphQLObjectType({ name: 'ApplicationQuery', fields: queries }), ...(Object.keys(mutations).length ? { mutation: new GraphQLObjectType({ name: 'ApplicationMutation', fields: mutations }) } : {}) });
  return async (req, res) => {
    try {
      const { query, variables, operationName } = req.body || {};
      if (typeof query !== 'string' || query.length > 50000) return res.status(400).json({ errors: [{ message: 'A bounded GraphQL operation is required.' }] });
      const document = parse(query);
      let fields = 0;
      let rootFields = 0;
      visit(document, { Field(_node, _key, _parent, _path, ancestors) { fields++; if (!ancestors.some(value => value?.kind === 'Field')) rootFields++; } });
      // One root operation preserves HTTP middleware/cookie semantics and prevents alias batching of authentication actions.
      if (rootFields !== 1 || fields > 50 || document.definitions.some(def => def.kind === 'FragmentDefinition')) return res.status(400).json({ errors: [{ message: 'Send one application operation per request.' }] });
      const result = await graphql({ schema, source: query, variableValues: variables, operationName, contextValue: { req, res } });
      return res.json(result);
    } catch (error) {
      return res.status(400).json({ errors: [{ message: error.message }] });
    }
  };
}
