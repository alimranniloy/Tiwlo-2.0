import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { TPanelDB } from './tpanelDb.js';
import router from './tpanelRoutes.js';

async function withTPanelServer(run) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (req.headers.authorization === 'Bearer valid-test-session') {
      req.activeUser = { id: 'session-user' };
    }
    next();
  });
  app.use('/api/tpanel', router);

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('TPanel rejects a caller-supplied user ID without an authenticated session', async () => {
  await withTPanelServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/tpanel/account?userId=victim-user`);
    assert.equal(response.status, 401);
  });
});

test('TPanel ignores caller-supplied IDs and scopes account access to the session', async () => {
  const originalGetAccount = TPanelDB.getAccount;
  TPanelDB.getAccount = async (userId) => ({ userId });
  try {
    await withTPanelServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/tpanel/account?userId=victim-user`, {
        headers: { Authorization: 'Bearer valid-test-session' }
      });
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.account.userId, 'session-user');
    });
  } finally {
    TPanelDB.getAccount = originalGetAccount;
  }
});
