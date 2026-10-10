import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

for (const [label, file] of [['web', '../../client/src/api/graphqlTransport.js'], ['mobile', '../../Tiwi/src/services/graphqlTransport.js']]) {
  test(`${label} requests use named GraphQL operations, preserving auth and Response semantics`, async t => {
    const source = (await fs.readFile(new URL(file, import.meta.url), 'utf8'))
      .replace(/import \{ PLATFORM_DOMAIN \} from [^;]+;/, "const PLATFORM_DOMAIN = 'tiwlo.com';")
      .replace(/import \{ BASE_URL \} from [^;]+;/, "const BASE_URL = 'https://tiwlo.com';");
    const previousWindow = globalThis.window;
    globalThis.window = { location: { href: 'https://tiwlo.com/dashboard', origin: 'https://tiwlo.com' } };
    t.after(() => { globalThis.window = previousWindow; });
    const calls = [];
    t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
      calls.push({ url: String(url), options });
      if (!String(url).endsWith('/api/graphql')) return new Response('native');
      const body = JSON.parse(options.body);
      if (body.query.includes('applicationOperations')) return Response.json({ data: { applicationOperations: [
        { field: 'postApiRecordsByid', method: 'POST', path: '/api/records/:id' },
        { field: 'getApiRecords', method: 'GET', path: '/api/records' }
      ] } });
      return Response.json({ data: { result: { status: 409, body: { error: 'Conflict' }, headers: { 'Retry-After': '2' } } } });
    });
    const { applicationFetch } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    const response = await applicationFetch('https://tiwlo.com/api/records/a%2Fb?state=active', {
      method: 'POST', headers: { Authorization: 'Bearer token' }, body: JSON.stringify({ title: 'Saved' })
    });
    assert.equal(response.status, 409);
    assert.equal(response.ok, false);
    assert.equal(response.headers.get('retry-after'), '2');
    assert.deepEqual(await response.json(), { error: 'Conflict' });
    assert.equal(calls[1].options.headers.get('Authorization'), 'Bearer token');
    const operation = JSON.parse(calls[1].options.body);
    assert.match(operation.query, /mutation.*postApiRecordsByid/);
    assert.deepEqual(operation.variables.input, { params: { id: 'a/b' }, query: { state: 'active' }, body: { title: 'Saved' } });
    await applicationFetch('https://tiwlo.com/api/records');
    assert.equal(calls.length, 3, 'operation manifest is cached');
    await assert.rejects(applicationFetch('https://tiwlo.com/api/missing'), /No GraphQL operation/);
    assert.equal(await (await applicationFetch('https://tiwlo.com/api/upload/file')).text(), 'native');
    assert.equal(await (await applicationFetch('https://external.example/api/records')).text(), 'native');
  });
}
