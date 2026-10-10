import { queryPg } from './postgres.js';

// PostgreSQL JSONB stores flexible domain records; there is no filesystem or
// process-memory fallback. Versions prevent concurrent snapshots overwriting data.
const snapshots = new WeakMap();
export const isPersistedState = data => snapshots.get(data)?.version !== '0' && snapshots.has(data);
export const STATE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS system_state_documents (
    namespace TEXT NOT NULL,
    document_key TEXT NOT NULL,
    data JSONB NOT NULL,
    version BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (namespace, document_key)
  );
`;

export async function readState(namespace, key, initial = {}) {
  const { rows } = await queryPg('SELECT data, version FROM system_state_documents WHERE namespace = $1 AND document_key = $2', [namespace, key]);
  const data = rows[0]?.data || structuredClone(initial);
  snapshots.set(data, { namespace, key, version: String(rows[0]?.version || 0) });
  return data;
}

export async function saveState(namespace, key, data, source = data) {
  const snapshot = snapshots.get(source);
  if (!snapshot || snapshot.namespace !== namespace || snapshot.key !== key) {
    throw new Error('Read the persisted record before updating it.');
  }
  const { rows } = await queryPg(`
    INSERT INTO system_state_documents (namespace, document_key, data)
    VALUES ($1, $2, $3::jsonb)
    ON CONFLICT (namespace, document_key) DO UPDATE SET
      data = EXCLUDED.data, version = system_state_documents.version + 1, updated_at = CURRENT_TIMESTAMP
    WHERE system_state_documents.version = $4::bigint
    RETURNING version`, [namespace, key, JSON.stringify(data), snapshot.version]);
  if (!rows[0]) throw Object.assign(new Error('Data changed in another request. Refresh and try again.'), { code: 'STATE_CONFLICT', status: 409 });
  snapshots.set(source, { ...snapshot, version: String(rows[0].version) });
  return data;
}

export async function listState(namespace) {
  const { rows } = await queryPg('SELECT document_key, data, version FROM system_state_documents WHERE namespace = $1 ORDER BY document_key', [namespace]);
  return rows.map(row => {
    snapshots.set(row.data, { namespace, key: row.document_key, version: String(row.version) });
    return row.data;
  });
}
