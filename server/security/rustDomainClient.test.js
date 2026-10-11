import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkSubdomainWithRust,
  claimDomainWithRust,
  createDnsRecordWithRust,
  deleteDnsRecordWithRust,
  listDnsRecordsWithRust,
  listUserDomainsWithRust,
  updateDnsRecordWithRust
} from './rustDomainClient.js';

const RUST_ENV_KEYS = [
  'TIWLO_RUST_BACKEND_URL',
  'TIWLO_INTERNAL_IDENTITY_SECRET',
  'ABUSE_HASH_SECRET'
];

function restoreEnvironment(previous) {
  for (const key of RUST_ENV_KEYS) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
}

test('domain and DNS APIs proxy to Rust with signed identity assertions', async t => {
  const previous = Object.fromEntries(RUST_ENV_KEYS.map(key => [key, process.env[key]]));
  process.env.TIWLO_RUST_BACKEND_URL = 'http://rust:7100/';
  process.env.TIWLO_INTERNAL_IDENTITY_SECRET = 'i'.repeat(32);
  process.env.ABUSE_HASH_SECRET = 'a'.repeat(32);
  t.after(() => restoreEnvironment(previous));

  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    const payload = options.method === 'GET' && url.includes('/check?')
      ? { name: 'example', domain: 'example.uids.app', available: true, status: 'available', suggestions: [] }
      : options.method === 'GET' && url.endsWith('/v1/domains')
        ? { domains: [] }
        : options.method === 'POST' && url.endsWith('/claim')
          ? { id: 'sub-1', subdomain: 'example', domain: 'example.uids.app' }
          : { record: { id: 'rec-1' } };
    return new Response(JSON.stringify(payload), {
      status: options.method === 'POST' ? 201 : 200
    });
  });

  const context = {
    user: { id: 'user-1', email: 'user@example.com', email_verified: true },
    request: { ip: '127.0.0.1', cookies: { uids_device: 'device-1' } }
  };
  await checkSubdomainWithRust('example name');
  await claimDomainWithRust({ ...context, name: 'example' });
  await listUserDomainsWithRust(context);
  await listDnsRecordsWithRust({ ...context, subdomainId: 'domain/1' });
  await createDnsRecordWithRust({
    ...context,
    subdomainId: 'domain/1',
    body: { type: 'A', name: '@', value: '192.0.2.1', ttl: 300 }
  });
  await updateDnsRecordWithRust({
    ...context,
    subdomainId: 'domain/1',
    recordId: 'record/1',
    body: { type: 'A', name: '@', value: '192.0.2.2', ttl: 300 }
  });
  await deleteDnsRecordWithRust({
    ...context,
    subdomainId: 'domain/1',
    recordId: 'record/1'
  });

  assert.deepEqual(
    calls.map(call => [call.options.method, call.url]),
    [
      ['GET', 'http://rust:7100/v1/domains/check?name=example%20name'],
      ['POST', 'http://rust:7100/v1/domains/claim'],
      ['GET', 'http://rust:7100/v1/domains'],
      ['GET', 'http://rust:7100/v1/domains/domain%2F1/records'],
      ['POST', 'http://rust:7100/v1/domains/domain%2F1/records'],
      ['PATCH', 'http://rust:7100/v1/domains/domain%2F1/records/record%2F1'],
      ['DELETE', 'http://rust:7100/v1/domains/domain%2F1/records/record%2F1']
    ]
  );
  assert.equal(calls[0].options.headers['x-tiwlo-identity'], undefined);
  for (const call of calls.slice(1)) {
    assert.match(call.options.headers['x-tiwlo-identity'], /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  }
  assert.deepEqual(JSON.parse(calls[4].options.body), {
    type: 'A',
    name: '@',
    value: '192.0.2.1',
    ttl: 300
  });
});

test('Rust domain client preserves downstream status and error details', async t => {
  const previous = Object.fromEntries(RUST_ENV_KEYS.map(key => [key, process.env[key]]));
  process.env.TIWLO_RUST_BACKEND_URL = 'http://rust:7100';
  process.env.TIWLO_INTERNAL_IDENTITY_SECRET = 'i'.repeat(32);
  process.env.ABUSE_HASH_SECRET = 'a'.repeat(32);
  t.after(() => restoreEnvironment(previous));
  t.mock.method(globalThis, 'fetch', async () => new Response(
    JSON.stringify({ error: 'dns_record_already_exists', field: 'value' }),
    { status: 409 }
  ));

  await assert.rejects(
    createDnsRecordWithRust({
      user: { id: 'user-1', email: 'user@example.com' },
      subdomainId: 'domain-1',
      request: { ip: '127.0.0.1' },
      body: { type: 'A', name: '@', value: '192.0.2.1', ttl: 300 }
    }),
    error => {
      assert.equal(error.statusCode, 409);
      assert.deepEqual(error.details, {
        error: 'dns_record_already_exists',
        field: 'value'
      });
      return true;
    }
  );
});
