import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const FILE_PATH = path.join(DATA_DIR, 'progress.json');

const { Pool } = pg;

let pool = null;
let storageType = null;
let initialized = false;

/**
 * SHA-256 hash of recovery key, hex encoded. Server stores only hash.
 */
export function hashRecoveryKey(key) {
  if (typeof key !== 'string' || key.length < 8) {
    throw new Error('Invalid recovery key');
  }
  return crypto.createHash('sha256').update(key, 'utf8').digest('hex');
}

export function getStorageType() {
  if (storageType) return storageType;
  if (process.env.DATABASE_URL) return 'postgres';
  return 'file';
}

function getPool() {
  if (pool) return pool;
  if (!process.env.DATABASE_URL) return null;
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 5,
  });
  pool.on('error', (err) => {
    console.error('[storage] pg pool error', err);
  });
  return pool;
}

async function ensureFileStorage() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.access(FILE_PATH);
    } catch {
      await fs.writeFile(FILE_PATH, JSON.stringify({}, null, 2), 'utf8');
    }
  } catch (e) {
    console.error('[storage] file storage init failed', e);
    throw e;
  }
}

async function readFileStore() {
  await ensureFileStorage();
  try {
    const raw = await fs.readFile(FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
    return {};
  } catch {
    return {};
  }
}

async function writeFileStore(obj) {
  await ensureFileStorage();
  const tmp = FILE_PATH + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(obj, null, 2), 'utf8');
  await fs.rename(tmp, FILE_PATH);
}

export async function initStorage() {
  if (initialized) return getStorageType();
  const dbUrl = process.env.DATABASE_URL;
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && !dbUrl) {
    throw new Error('DATABASE_URL is required in production – file storage is not persistent on cloud hosts');
  }

  if (dbUrl) {
    storageType = 'postgres';
    const p = getPool();
    // create table
    await p.query(`
      CREATE TABLE IF NOT EXISTS progress (
        key_hash TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        revision INTEGER NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    // ensure index
    await p.query(`CREATE INDEX IF NOT EXISTS idx_progress_updated ON progress(updated_at);`);
  } else {
    storageType = 'file';
    await ensureFileStorage();
  }
  initialized = true;
  console.log(`[storage] initialized as ${storageType}`);
  return storageType;
}

export async function getProgressByHash(keyHash) {
  if (!keyHash || typeof keyHash !== 'string') throw new Error('Invalid key hash');
  await initStorage();
  if (getStorageType() === 'postgres') {
    const p = getPool();
    const res = await p.query('SELECT data, revision, updated_at FROM progress WHERE key_hash=$1', [keyHash]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      data: row.data,
      revision: row.revision,
      updatedAt: row.updated_at,
    };
  } else {
    const store = await readFileStore();
    const entry = store[keyHash];
    if (!entry) return null;
    return {
      data: entry.data,
      revision: entry.revision,
      updatedAt: entry.updated_at ? new Date(entry.updated_at) : new Date(),
    };
  }
}

export class ConflictError extends Error {
  constructor(message, current) {
    super(message);
    this.name = 'ConflictError';
    this.current = current; // { data, revision }
    this.status = 409;
  }
}

export function validateProgressPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload must be an object');
  }
  const { data, revision } = payload;
  if (revision !== undefined && revision !== null) {
    if (!Number.isInteger(revision) || revision < 0) {
      throw new Error('revision must be a non-negative integer');
    }
  }
  if (data === undefined) {
    throw new Error('data field is required');
  }
  if (typeof data !== 'object' || data === null) {
    throw new Error('data must be an object');
  }
  // size check is done via express limit, but also check JSON string length
  const jsonStr = JSON.stringify(data);
  if (jsonStr.length > 250_000) {
    throw new Error('Progress snapshot too large (max ~250KB)');
  }
  // basic shape validation – allow flexible but check some known fields if present
  // must not contain functions, but JSON already ensures.
  // If learner name present, must be string <= 100 chars
  if (data.profile && typeof data.profile === 'object') {
    if (data.profile.name && (typeof data.profile.name !== 'string' || data.profile.name.length > 100)) {
      throw new Error('Invalid profile.name');
    }
  }
  return true;
}

/**
 * Save progress with optimistic concurrency.
 * expectedRevision: integer the client believes is current.
 * If no existing record, expected must be 0 or undefined.
 * On success, returns { revision: newRevision }
 * On stale, throws ConflictError with current.
 */
export async function saveProgressByHash(keyHash, data, expectedRevision) {
  if (!keyHash) throw new Error('keyHash required');
  validateProgressPayload({ data, revision: expectedRevision });
  await initStorage();
  const expRev = expectedRevision === undefined || expectedRevision === null ? 0 : expectedRevision;

  if (getStorageType() === 'postgres') {
    const p = getPool();
    // Use transaction for safety
    const client = await p.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query('SELECT revision, data FROM progress WHERE key_hash=$1 FOR UPDATE', [keyHash]);
      if (existing.rows.length === 0) {
        if (expRev !== 0) {
          await client.query('ROLLBACK');
          const current = { data: null, revision: 0 };
          throw new ConflictError('No existing progress, expected revision must be 0', current);
        }
        const newRev = 1;
        await client.query(
          'INSERT INTO progress(key_hash, data, revision, updated_at) VALUES($1,$2,$3,NOW())',
          [keyHash, JSON.stringify(data), newRev]
        );
        await client.query('COMMIT');
        return { revision: newRev };
      } else {
        const curRev = existing.rows[0].revision;
        const curData = existing.rows[0].data;
        if (curRev !== expRev) {
          await client.query('ROLLBACK');
          throw new ConflictError(`Stale revision: expected ${expRev}, current ${curRev}`, {
            data: curData,
            revision: curRev,
          });
        }
        const newRev = curRev + 1;
        await client.query(
          'UPDATE progress SET data=$2, revision=$3, updated_at=NOW() WHERE key_hash=$1',
          [keyHash, JSON.stringify(data), newRev]
        );
        await client.query('COMMIT');
        return { revision: newRev };
      }
    } catch (e) {
      try {
        await client.query('ROLLBACK');
      } catch {}
      throw e;
    } finally {
      client.release();
    }
  } else {
    // file storage
    const store = await readFileStore();
    const existing = store[keyHash];
    if (!existing) {
      if (expRev !== 0) {
        throw new ConflictError('No existing progress, expected revision must be 0', { data: null, revision: 0 });
      }
      const newRev = 1;
      store[keyHash] = {
        data,
        revision: newRev,
        updated_at: new Date().toISOString(),
      };
      await writeFileStore(store);
      return { revision: newRev };
    } else {
      if (existing.revision !== expRev) {
        throw new ConflictError(`Stale revision: expected ${expRev}, current ${existing.revision}`, {
          data: existing.data,
          revision: existing.revision,
        });
      }
      const newRev = existing.revision + 1;
      store[keyHash] = {
        data,
        revision: newRev,
        updated_at: new Date().toISOString(),
      };
      await writeFileStore(store);
      return { revision: newRev };
    }
  }
}

// For testing: clear all (only file storage or when ALLOW_CLEAR set)
export async function _clearAllForTests() {
  await initStorage();
  if (getStorageType() === 'postgres') {
    const p = getPool();
    await p.query('DELETE FROM progress');
  } else {
    await writeFileStore({});
  }
}

// Reset internal state (for tests)
export function _resetState() {
  initialized = false;
  storageType = null;
  if (pool) {
    try { pool.end(); } catch {}
    pool = null;
  }
}
