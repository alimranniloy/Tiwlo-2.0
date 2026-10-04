import crypto from 'crypto';
import { getPgPool } from '../db/postgres.js';

const ENCRYPTION_CONTEXT = Buffer.from('tiwlo-google-drive-service-account-v1');
const MAX_CREDENTIAL_BYTES = 64 * 1024;
const DRIVE_FILE_FIELDS = 'id,name,mimeType,size,md5Checksum,parents,trashed,capabilities(canAddChildren)';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const tokenCache = new Map();
const folderCache = new Map();

function validateFolderId(folderId) {
  const normalized = typeof folderId === 'string' ? folderId.trim() : '';
  if (!normalized || !/^[a-zA-Z0-9_-]{10,200}$/.test(normalized)) {
    throw new TypeError('A valid Google Drive folder ID is required. Paste the ID from the shared folder URL.');
  }
  return normalized;
}

function getEncryptionKey() {
  const secret = process.env.SECURITY_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('A stable SECURITY_SECRET of at least 32 characters is required to encrypt Drive credentials.');
  }
  return Buffer.from(crypto.hkdfSync('sha256', Buffer.from(secret), ENCRYPTION_CONTEXT, ENCRYPTION_CONTEXT, 32));
}

export function validateGoogleDriveServiceAccount(credentials) {
  if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) {
    throw new TypeError('Credential file must contain a JSON object.');
  }

  const requiredFields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email', 'client_id', 'token_uri'];
  if (requiredFields.some((field) => typeof credentials[field] !== 'string' || !credentials[field].trim())) {
    throw new TypeError('JSON is missing required Google service-account credential fields.');
  }
  if (credentials.type !== 'service_account') {
    throw new TypeError('Only Google service-account JSON credentials are supported.');
  }
  if (!/^[a-z0-9][a-z0-9-]{4,61}[a-z0-9]$/.test(credentials.project_id)) {
    throw new TypeError('The service-account project ID is invalid.');
  }
  if (!/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(credentials.client_email)) {
    throw new TypeError('The service-account client email is invalid.');
  }
  if (!/^-----BEGIN PRIVATE KEY-----[\s\S]+-----END PRIVATE KEY-----\s*$/.test(credentials.private_key)) {
    throw new TypeError('The service-account private key is invalid.');
  }
  if (!/^https:\/\/oauth2\.googleapis\.com\/token$/.test(credentials.token_uri)) {
    throw new TypeError('The service-account token endpoint is invalid.');
  }

  const serialized = JSON.stringify(credentials);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_CREDENTIAL_BYTES) {
    throw new RangeError('Credential JSON exceeds the 64 KB limit.');
  }
  return serialized;
}

export function encryptGoogleDriveCredentials(credentials, encryptionKey = getEncryptionKey()) {
  const serialized = validateGoogleDriveServiceAccount(credentials);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  cipher.setAAD(ENCRYPTION_CONTEXT);
  const ciphertext = Buffer.concat([cipher.update(serialized, 'utf8'), cipher.final()]);
  return {
    credentials_ciphertext: ciphertext,
    encryption_iv: iv,
    encryption_auth_tag: cipher.getAuthTag()
  };
}

export function decryptGoogleDriveCredentials(record, encryptionKey = getEncryptionKey()) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, record.encryption_iv);
  decipher.setAAD(ENCRYPTION_CONTEXT);
  decipher.setAuthTag(record.encryption_auth_tag);
  const plaintext = Buffer.concat([
    decipher.update(record.credentials_ciphertext),
    decipher.final()
  ]).toString('utf8');
  return JSON.parse(plaintext);
}

function normalizeDisplayName(name, credentials) {
  const cleanName = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
  return (cleanName || credentials.project_id).slice(0, 120);
}

export async function addGoogleDriveServiceAccount(credentials, name, rootFolderId, { preserveVerified = false } = {}) {
  const serialized = validateGoogleDriveServiceAccount(credentials);
  const normalizedCredentials = JSON.parse(serialized);
  const encrypted = encryptGoogleDriveCredentials(normalizedCredentials);
  const normalizedFolderId = validateFolderId(rootFolderId);
  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL is not available.');

  const { rows } = await pool.query(
    `INSERT INTO system_google_drive_accounts
       (id, display_name, project_id, client_email, root_folder_id, credentials_ciphertext, encryption_iv, encryption_auth_tag)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (client_email) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       project_id = EXCLUDED.project_id,
       root_folder_id = EXCLUDED.root_folder_id,
       credentials_ciphertext = EXCLUDED.credentials_ciphertext,
       encryption_iv = EXCLUDED.encryption_iv,
       encryption_auth_tag = EXCLUDED.encryption_auth_tag,
       status = CASE
         WHEN $9 = TRUE AND system_google_drive_accounts.root_folder_id = EXCLUDED.root_folder_id
           THEN system_google_drive_accounts.status
         ELSE 'configured'
       END,
       last_error = NULL,
       updated_at = CURRENT_TIMESTAMP
     RETURNING id, display_name, project_id, client_email, root_folder_id, status, created_at, updated_at`,
    [
      crypto.randomUUID(),
      normalizeDisplayName(name, normalizedCredentials),
      normalizedCredentials.project_id,
      normalizedCredentials.client_email,
      normalizedFolderId,
      encrypted.credentials_ciphertext,
      encrypted.encryption_iv,
      encrypted.encryption_auth_tag,
      preserveVerified
    ]
  );
  return rows[0];
}

export async function listGoogleDriveAccounts() {
  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL is not available.');
  const { rows } = await pool.query(
    `SELECT a.id, a.display_name, a.project_id, a.client_email, a.root_folder_id, a.status,
            a.last_error, a.created_at, a.updated_at,
            (s.google_drive_account_id = a.id) AS is_active
     FROM system_google_drive_accounts a
     LEFT JOIN system_platform_storage s ON s.id = 'primary'
     ORDER BY a.created_at DESC`
  );
  return rows;
}

async function loadGoogleDriveAccount(accountId) {
  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL is not available.');
  const { rows } = await pool.query(
    `SELECT id, client_email, root_folder_id, credentials_ciphertext, encryption_iv, encryption_auth_tag
     FROM system_google_drive_accounts
     WHERE id = $1 AND status IN ('configured', 'verified')`,
    [accountId]
  );
  if (!rows[0]) throw new Error('Google Drive account is missing or disabled.');
  return { ...rows[0], credentials: decryptGoogleDriveCredentials(rows[0]) };
}

export async function getGoogleDriveAccount(accountId) {
  return loadGoogleDriveAccount(accountId);
}

export async function getDriveAccountsForUpload() {
  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL is not available.');
  const { rows } = await pool.query(
    `SELECT a.id, (s.google_drive_account_id = a.id) AS is_active
     FROM system_google_drive_accounts a
     LEFT JOIN system_platform_storage s ON s.id = 'primary'
     WHERE a.status = 'verified'
     ORDER BY (s.google_drive_account_id = a.id) DESC, a.created_at`
  );
  const accounts = [];
  for (const row of rows) accounts.push(await loadGoogleDriveAccount(row.id));
  return accounts;
}

async function getGoogleAccessToken(account) {
  const cached = tokenCache.get(account.id);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsignedJwt = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: account.credentials.client_email,
    scope: DRIVE_SCOPE,
    aud: account.credentials.token_uri,
    iat: now,
    exp: now + 3600
  })}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedJwt);
  signer.end();
  const assertion = `${unsignedJwt}.${signer.sign(account.credentials.private_key, 'base64url')}`;
  const response = await fetch(account.credentials.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });
  const tokenResponse = await response.json();
  if (!response.ok || typeof tokenResponse.access_token !== 'string') {
    throw new Error(`Google OAuth token request failed (${response.status}): ${tokenResponse.error || 'unknown error'}`);
  }

  tokenCache.set(account.id, {
    token: tokenResponse.access_token,
    expiresAt: Date.now() + Number(tokenResponse.expires_in || 3600) * 1000
  });
  return tokenResponse.access_token;
}

async function driveApiRequest(account, url, options = {}) {
  const accessToken = await getGoogleAccessToken(account);
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers
    }
  });
}

function escapeDriveQuery(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function googleDriveError(response, body, operation) {
  const reason = body?.error?.errors?.[0]?.reason;
  const error = new Error(`Google Drive ${operation} failed (${response.status}).`);
  if (reason === 'storageQuotaExceeded') error.code = 'DRIVE_STORAGE_FULL';
  return error;
}

function normalizeDriveFolderName(value) {
  const name = String(value || '').trim();
  if (!name || name === '.' || name === '..' || /[\/\\\u0000-\u001f\u007f]/.test(name)) {
    throw new TypeError('Drive folder names must be non-empty single path segments.');
  }
  return name.slice(0, 255);
}

async function getOrCreateCategoryFolder(account, folderKey, parentFolderId = account.root_folder_id) {
  const normalizedKey = normalizeDriveFolderName(folderKey || 'other');
  const cacheKey = `${account.id}:${parentFolderId}:${normalizedKey}`;
  if (folderCache.has(cacheKey)) return folderCache.get(cacheKey);

  const rootResponse = await driveApiRequest(
    account,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(account.root_folder_id)}?fields=${DRIVE_FILE_FIELDS}&supportsAllDrives=true`
  );
  const root = await rootResponse.json();
  if (!rootResponse.ok || root.mimeType !== 'application/vnd.google-apps.folder' || root.trashed) {
    throw new Error('The configured Google Drive root must be an existing folder shared with this service account.');
  }

  const query = [
    `'${escapeDriveQuery(parentFolderId)}' in parents`,
    `name = '${escapeDriveQuery(normalizedKey)}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    'trashed = false'
  ].join(' and ');
  const listResponse = await driveApiRequest(
    account,
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(${DRIVE_FILE_FIELDS})&pageSize=10&supportsAllDrives=true&includeItemsFromAllDrives=true`
  );
  const listResult = await listResponse.json();
  if (!listResponse.ok) throw new Error(`Google Drive folder lookup failed (${listResponse.status}).`);
  const existingFolder = listResult.files?.find((file) => file.name === normalizedKey);
  if (existingFolder) {
    folderCache.set(cacheKey, existingFolder.id);
    return existingFolder.id;
  }

  const createResponse = await driveApiRequest(
    account,
    'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType&supportsAllDrives=true',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: normalizedKey,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
        appProperties: { tiwloCategory: normalizedKey }
      })
    }
  );
  const createdFolder = await createResponse.json();
  if (!createResponse.ok || !createdFolder.id) {
    throw googleDriveError(createResponse, createdFolder, 'folder creation');
  }
  folderCache.set(cacheKey, createdFolder.id);
  return createdFolder.id;
}

export async function ensureGoogleDriveFolderPath(account, folderPath) {
  let folderId = account.root_folder_id;
  for (const folderName of folderPath) {
    folderId = await getOrCreateCategoryFolder(account, folderName, folderId);
  }
  return folderId;
}

export async function uploadGoogleDriveMedia(account, {
  mediaId,
  filename,
  contentType,
  buffer,
  folderKey,
  folderPath = [folderKey]
}) {
  const parentFolderId = await ensureGoogleDriveFolderPath(account, folderPath);
  const searchQuery = [
    `'${escapeDriveQuery(parentFolderId)}' in parents`,
    `appProperties has { key='tiwloMediaId' and value='${escapeDriveQuery(mediaId)}' }`,
    'trashed = false'
  ].join(' and ');
  const existingResponse = await driveApiRequest(
    account,
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQuery)}&fields=files(${DRIVE_FILE_FIELDS})&pageSize=10&supportsAllDrives=true&includeItemsFromAllDrives=true`
  );
  const existing = await existingResponse.json();
  if (!existingResponse.ok) throw new Error(`Google Drive upload retry lookup failed (${existingResponse.status}).`);
  if (existing.files?.length) return existing.files[0];

  const boundary = `tiwlo_${crypto.randomBytes(18).toString('hex')}`;
  const metadata = {
    name: filename,
    mimeType: contentType,
    parents: [parentFolderId],
    appProperties: { tiwloMediaId: mediaId }
  };
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--`)
  ]);
  const response = await driveApiRequest(
    account,
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=${encodeURIComponent(DRIVE_FILE_FIELDS)}&supportsAllDrives=true`,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body
    }
  );
  const uploadedFile = await response.json();
  if (!response.ok || !uploadedFile.id) {
    throw googleDriveError(response, uploadedFile, 'media upload');
  }
  return uploadedFile;
}

export async function downloadGoogleDriveMediaRange(account, fileId, start, length) {
  const end = start + length - 1;
  const response = await driveApiRequest(
    account,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    { headers: { Range: `bytes=${start}-${end}` } }
  );
  if (![200, 206].includes(response.status)) {
    const responseBody = await response.text();
    throw new Error(`Google Drive download failed (${response.status}): ${responseBody.slice(0, 200)}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length !== length && response.status !== 200) {
    throw new Error('Google Drive returned an incomplete media range.');
  }
  return response.status === 200 ? buffer.subarray(start, start + length) : buffer;
}

export async function readGoogleDriveMedia(account, fileId) {
  const response = await driveApiRequest(
    account,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`
  );
  if (!response.ok) {
    throw new Error(`Google Drive download failed (${response.status}).`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function deleteGoogleDriveMedia(account, fileId) {
  const response = await driveApiRequest(
    account,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
    { method: 'DELETE' }
  );
  if (!response.ok && response.status !== 404) {
    throw new Error(`Google Drive file removal failed (${response.status}).`);
  }
}

export async function verifyGoogleDriveAccount(accountId) {
  const account = await loadGoogleDriveAccount(accountId);
  const folderResponse = await driveApiRequest(
    account,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(account.root_folder_id)}?fields=${DRIVE_FILE_FIELDS}&supportsAllDrives=true`
  );
  const folder = await folderResponse.json();
  if (!folderResponse.ok || folder.mimeType !== 'application/vnd.google-apps.folder' ||
      folder.trashed || folder.capabilities?.canAddChildren !== true) {
    throw new Error('Could not verify folder access or upload permission; share the root folder with the service account as Editor.');
  }
  return { account, folderName: folder.name };
}

export async function getPlatformStorageSettings() {
  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL is not available.');
  const { rows } = await pool.query(
    `SELECT s.backend, s.google_drive_account_id,
            a.display_name, a.client_email, a.root_folder_id
     FROM system_platform_storage s
     LEFT JOIN system_google_drive_accounts a ON a.id = s.google_drive_account_id
     WHERE s.id = 'primary'`
  );
  return rows[0] || { backend: 'postgres', google_drive_account_id: null };
}

export async function setServerStorageActive(backend) {
  if (!['local', 'postgres'].includes(backend)) {
    throw new TypeError('Server storage backend must be local or postgres.');
  }
  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL is not available.');
  const { rows } = await pool.query(
    `INSERT INTO system_platform_storage (id, backend, google_drive_account_id)
     VALUES ('primary', $1, NULL)
     ON CONFLICT (id) DO UPDATE SET
       backend = EXCLUDED.backend,
       google_drive_account_id = NULL,
       updated_at = CURRENT_TIMESTAMP
     RETURNING backend, google_drive_account_id`,
    [backend]
  );
  return rows[0];
}

export async function setDriveStorageActive(accountId) {
  const { account, folderName } = await verifyGoogleDriveAccount(accountId);
  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL is not available.');
  const { rows } = await pool.query(
    `INSERT INTO system_platform_storage (id, backend, google_drive_account_id)
     VALUES ('primary', 'google_drive', $1)
     ON CONFLICT (id) DO UPDATE SET
       backend = 'google_drive',
       google_drive_account_id = EXCLUDED.google_drive_account_id,
       updated_at = CURRENT_TIMESTAMP
     RETURNING backend, google_drive_account_id`,
    [account.id]
  );
  await pool.query(
    `UPDATE system_google_drive_accounts
     SET status = 'verified', last_error = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [account.id]
  );
  return { ...rows[0], folderName, display_name: account.display_name, client_email: account.client_email };
}

export async function bootstrapGoogleDriveServiceAccountFromEnv() {
  const encodedCredentials = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64;
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!encodedCredentials) return null;
  if (!rootFolderId) {
    console.warn('[GoogleDrive] Service-account bootstrap skipped until GOOGLE_DRIVE_ROOT_FOLDER_ID is configured.');
    return null;
  }

  let credentials;
  try {
    credentials = JSON.parse(Buffer.from(encodedCredentials, 'base64').toString('utf8'));
  } catch {
    throw new Error('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64 is not valid base64-encoded JSON.');
  }

  return addGoogleDriveServiceAccount(
    credentials,
    credentials.project_id,
    rootFolderId,
    { preserveVerified: true }
  );
}
