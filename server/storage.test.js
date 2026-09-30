import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Force file storage for tests
delete process.env.DATABASE_URL;
process.env.NODE_ENV = 'test';

const { initStorage, getStorageType, getProgressByHash, saveProgressByHash, hashRecoveryKey, ConflictError, _clearAllForTests, _resetState } = await import('./storage.js');

describe('storage - file fallback', () => {
  before(async () => {
    _resetState();
    await initStorage();
    assert.equal(getStorageType(), 'file');
    await _clearAllForTests();
  });

  after(async () => {
    await _clearAllForTests();
    _resetState();
  });

  it('hashes recovery key with SHA-256 and not store raw', () => {
    const key = 'test-recovery-key-12345-super-secret';
    const hash = hashRecoveryKey(key);
    assert.equal(typeof hash, 'string');
    assert.equal(hash.length, 64);
    assert.notEqual(hash, key);
    // deterministic
    assert.equal(hashRecoveryKey(key), hash);
  });

  it('returns null for missing progress', async () => {
    const hash = hashRecoveryKey('nonexistent-key-xyz');
    const res = await getProgressByHash(hash);
    assert.equal(res, null);
  });

  it('creates progress at revision 0 -> 1', async () => {
    const key = 'test-key-create-' + Date.now();
    const hash = hashRecoveryKey(key);
    const data = { profile: { name: 'Test Learner' }, xp: 10, version: 1 };
    const saved = await saveProgressByHash(hash, data, 0);
    assert.equal(saved.revision, 1);

    const fetched = await getProgressByHash(hash);
    assert.ok(fetched);
    assert.equal(fetched.revision, 1);
    assert.deepEqual(fetched.data, data);
  });

  it('updates with correct expected revision', async () => {
    const key = 'test-key-update-' + Date.now();
    const hash = hashRecoveryKey(key);
    const data1 = { xp: 1 };
    const s1 = await saveProgressByHash(hash, data1, 0);
    assert.equal(s1.revision, 1);

    const data2 = { xp: 2 };
    const s2 = await saveProgressByHash(hash, data2, 1);
    assert.equal(s2.revision, 2);

    const fetched = await getProgressByHash(hash);
    assert.equal(fetched.revision, 2);
    assert.equal(fetched.data.xp, 2);
  });

  it('throws 409 on stale revision', async () => {
    const key = 'test-key-conflict-' + Date.now();
    const hash = hashRecoveryKey(key);
    await saveProgressByHash(hash, { xp: 5 }, 0); // rev 1
    await saveProgressByHash(hash, { xp: 6 }, 1); // rev 2

    // Try to save with old revision 1 – should conflict
    await assert.rejects(async () => {
      await saveProgressByHash(hash, { xp: 99 }, 1);
    }, (err) => {
      assert.ok(err instanceof ConflictError);
      assert.equal(err.status, 409);
      assert.equal(err.current.revision, 2);
      return true;
    });

    // Ensure data not overwritten
    const fetched = await getProgressByHash(hash);
    assert.equal(fetched.data.xp, 6);
    assert.equal(fetched.revision, 2);
  });

  it('validates payload size and shape', async () => {
    const key = 'test-key-validate-' + Date.now();
    const hash = hashRecoveryKey(key);

    await assert.rejects(async () => {
      await saveProgressByHash(hash, null, 0);
    });

    await assert.rejects(async () => {
      await saveProgressByHash(hash, { ok: true }, -1);
    });

    // large payload should fail validation
    const big = { blob: 'x'.repeat(300_000) };
    await assert.rejects(async () => {
      await saveProgressByHash(hash, big, 0);
    });
  });

  it('allows creation with undefined revision (treated as 0)', async () => {
    const key = 'test-key-undefined-rev-' + Date.now();
    const hash = hashRecoveryKey(key);
    const saved = await saveProgressByHash(hash, { a: 1 }, undefined);
    assert.equal(saved.revision, 1);
  });
});

describe('storage - production requires DATABASE_URL', () => {
  it('should fail init in production without DATABASE_URL', async () => {
    // Save env
    const oldEnv = process.env.NODE_ENV;
    const oldDb = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    process.env.NODE_ENV = 'production';
    _resetState();
    await assert.rejects(async () => {
      await initStorage();
    }, /DATABASE_URL is required/);
    // restore
    process.env.NODE_ENV = oldEnv;
    if (oldDb) process.env.DATABASE_URL = oldDb;
    _resetState();
    process.env.NODE_ENV = 'test';
    await initStorage();
  });
});
