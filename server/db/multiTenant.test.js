import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { getPgPool, initPgSchema } from './postgres.js';
import { readState, saveState } from './stateDocuments.js';
import { MasterDB, TenantDB } from './multiTenant.js';
import { readData, writeData, tenantContext } from './storeDataAdapter.js';
import { SupportDB } from './supportDb.js';
import { TPanelDB } from '../../service/TPanel/server/tpanelDb.js';

test('PostgreSQL domain persistence and tenant isolation', async t => {
  const db = new PGlite();
  t.mock.method(getPgPool(), 'query', async (sql, params) => params?.length ? db.query(sql, params) : (await db.exec(sql)).at(-1));
  t.after(async () => { await db.close(); await getPgPool().end(); });
  await initPgSchema();
  await t.test('tenant documents and registry survive a fresh module instance', async () => {
    await TenantDB.provisionStore('TIW-TEST-1', 'Store One');
    await TenantDB.addProduct('TIW-TEST-1', { id: 'p1', name: 'Live product', stock: 4 });
    const master = await MasterDB.getMasterData();
    master.stores.push({ tiwiId: 'TIW-TEST-1', ownerId: 'owner1' });
    await MasterDB.saveMasterData(master);
    const restarted = await import('./multiTenant.js?restart');
    const stores = await restarted.TenantDB.getAllStoreData();
    assert.equal(stores[0].products[0].name, 'Live product');
    assert.equal(stores[0].ownerId, 'owner1');
    assert.deepEqual(await restarted.TenantDB.getProducts('TIW-OTHER'), []);
  });
  await t.test('stale snapshots cannot overwrite concurrent changes', async () => {
    const one = await TenantDB.getStoreDb('TIW-TEST-1');
    const two = await TenantDB.getStoreDb('TIW-TEST-1');
    one.products[0].stock = 8; await TenantDB.saveStoreDb('TIW-TEST-1', one);
    two.products[0].stock = 1;
    await assert.rejects(TenantDB.saveStoreDb('TIW-TEST-1', two), { code: 'STATE_CONFLICT' });
    assert.equal((await TenantDB.getProducts('TIW-TEST-1'))[0].stock, 8);
    const absent1 = await readState('test', 'new'); const absent2 = await readState('test', 'new');
    await saveState('test', 'new', absent1);
    await assert.rejects(saveState('test', 'new', absent2), { code: 'STATE_CONFLICT' });
  });
  await t.test('request adapter writes await durable storage and isolate tenants', async () => {
    await Promise.all(['A', 'B'].map(id => tenantContext.run({ tiwiId: id }, async () => {
      await writeData('products', [{ id }]);
      assert.deepEqual(await readData('products'), [{ id }]);
    })));
    assert.equal((await TenantDB.getProducts('A'))[0].id, 'A');
    assert.equal((await TenantDB.getProducts('B'))[0].id, 'B');
    await assert.rejects(writeData('products', []), /tenant/);
  });
  await t.test('support and hosting updates survive reads', async () => {
    await SupportDB.createTicket({ id: 't1', userId: 'owner1', subject: 'Help' });
    await SupportDB.updateTicket('t1', { status: 'Resolved' });
    assert.equal((await SupportDB.getTicketById('t1')).status, 'Resolved');
    assert.deepEqual(await SupportDB.getTickets('other'), []);
    await SupportDB.saveConversation({ id: 'c1', userId: 'owner1', messages: ['hello'] });
    assert.deepEqual((await SupportDB.getConversation('c1')).messages, ['hello']);
    await TPanelDB.getAccount('owner1');
    await TPanelDB.createFile('owner1', { name: 'test.txt', content: 'durable' });
    assert.equal((await TPanelDB.listFiles('owner1','/public_html')).files.find(f => f.name === 'test.txt').content, 'durable');
  });
  await t.test('database failure propagates without a volatile success', async () => {
    const mock = t.mock.method(getPgPool(), 'query', async () => { throw new Error('offline'); });
    await assert.rejects(TenantDB.getProducts('A'), /offline/);
    await assert.rejects(SupportDB.createTicket({ subject: 'Fail' }), /offline/);
    mock.mock.restore();
  });
});
