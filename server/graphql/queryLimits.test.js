import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSchema } from 'graphql';
import { MAX_GRAPHQL_QUERY_DEPTH, MAX_GRAPHQL_QUERY_FIELDS, prepareGraphQLQuery } from './queryLimits.js';

const schema = buildSchema(`
  type Query { item: Item }
  type Item { child: Item, value: String }
`);

test('GraphQL query preparation enforces maximum field depth', () => {
  const nested = depth => `{ item { ${'child { '.repeat(depth - 2)}value${' }'.repeat(depth - 2)} } }`;
  assert.equal(prepareGraphQLQuery(schema, nested(MAX_GRAPHQL_QUERY_DEPTH)).errors, undefined);
  assert.match(
    prepareGraphQLQuery(schema, nested(MAX_GRAPHQL_QUERY_DEPTH + 1)).errors[0].message,
    /maximum query depth/
  );
});

test('production GraphQL validation rejects schema introspection', () => {
  const result = prepareGraphQLQuery(schema, '{ __schema { types { name } } }', { disableIntrospection: true });
  assert.match(result.errors[0].message, /introspection/i);
});

test('GraphQL query preparation limits total field count', () => {
  const query = `{ ${Array.from({ length: MAX_GRAPHQL_QUERY_FIELDS + 1 }, () => 'item { value }').join(' ')} }`;
  const result = prepareGraphQLQuery(schema, query);
  assert.match(result.errors[0].message, /maximum field count/);
});
