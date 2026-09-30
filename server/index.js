import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initStorage, getStorageType, getProgressByHash, saveProgressByHash, hashRecoveryKey, ConflictError, validateProgressPayload } from './storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Middleware
app.disable('x-powered-by');

// Request size limit 300KB as per spec
app.use(express.json({ limit: '300kb' }));

// Simple logger
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    console.log(`[api] ${req.method} ${req.path}`);
  }
  next();
});

// Health endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Ensure storage init for accurate type
    let storage;
    try {
      storage = await initStorage();
    } catch (e) {
      // If init fails due to missing DATABASE_URL in prod, report
      storage = getStorageType();
      return res.status(500).json({
        status: 'error',
        storage,
        error: e.message,
        timestamp: new Date().toISOString(),
      });
    }
    res.set('Cache-Control', 'no-store');
    res.json({
      status: 'ok',
      storage,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
    });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

function extractBearer(req) {
  const auth = req.headers['authorization'] || req.headers['Authorization'];
  if (!auth) return null;
  if (typeof auth !== 'string') return null;
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  return token;
}

function requireAuth(req, res, next) {
  const token = extractBearer(req);
  if (!token) {
    res.set('Cache-Control', 'no-store');
    return res.status(401).json({ error: 'Missing Authorization: Bearer <recovery-key>' });
  }
  if (token.length < 16 || token.length > 512) {
    res.set('Cache-Control', 'no-store');
    return res.status(401).json({ error: 'Invalid recovery key format' });
  }
  try {
    const hash = hashRecoveryKey(token);
    req.recoveryKeyHash = hash;
    req.recoveryKey = token; // keep for hashing verification, but not stored
    next();
  } catch (e) {
    res.set('Cache-Control', 'no-store');
    return res.status(401).json({ error: 'Invalid recovery key' });
  }
}

// GET /api/progress
app.get('/api/progress', requireAuth, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const result = await getProgressByHash(req.recoveryKeyHash);
    if (!result) {
      return res.status(404).json({ error: 'No progress found for this key', revision: 0 });
    }
    res.json({
      data: result.data,
      revision: result.revision,
      updatedAt: result.updatedAt,
    });
  } catch (e) {
    console.error('[api] GET /api/progress error', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// PUT /api/progress
app.put('/api/progress', requireAuth, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const { data, revision } = req.body || {};
    // revision is expected revision
    try {
      validateProgressPayload({ data, revision });
    } catch (ve) {
      return res.status(400).json({ error: ve.message });
    }
    const expectedRev = revision === undefined || revision === null ? 0 : revision;
    try {
      const saved = await saveProgressByHash(req.recoveryKeyHash, data, expectedRev);
      res.json({ ok: true, revision: saved.revision });
    } catch (err) {
      if (err instanceof ConflictError) {
        return res.status(409).json({
          error: 'Stale revision – newer progress exists on server',
          currentRevision: err.current?.revision ?? null,
          currentData: err.current?.data ?? null,
        });
      }
      throw err;
    }
  } catch (e) {
    console.error('[api] PUT /api/progress error', e);
    if (e.status === 409) {
      return res.status(409).json({ error: e.message, currentRevision: e.current?.revision });
    }
    res.status(500).json({ error: 'Internal error' });
  }
});

// Serve static public
app.use(express.static(PUBLIC_DIR, {
  extensions: ['html'],
  setHeaders: (res, filePath) => {
    // Don't cache api (already handled) but for static allow caching
    // For service worker, ensure no-cache? Let browser handle
    if (filePath.endsWith('sw.js')) {
      res.set('Cache-Control', 'no-cache');
    }
  }
}));

// Fallback to index.html for SPA routes (but not /api)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Error handler for JSON limit
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    res.set('Cache-Control', 'no-store');
    return res.status(413).json({ error: 'Payload too large (max 300KB)' });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.set('Cache-Control', 'no-store');
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  console.error('[express] unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    await initStorage();
  } catch (e) {
    console.error('[server] storage init failed:', e.message);
    if (process.env.NODE_ENV === 'production') {
      console.error('[server] refusing to start without DATABASE_URL in production');
      process.exit(1);
    } else {
      console.warn('[server] continuing with file fallback (dev only)');
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] Stroke listening on http://0.0.0.0:${PORT}`);
    console.log(`[server] storage: ${getStorageType()}`);
    console.log(`[server] public dir: ${PUBLIC_DIR}`);
  });
}

// Only auto-start if this file is main
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('server/index.js')) {
  start();
}

export default app;
export { start };
