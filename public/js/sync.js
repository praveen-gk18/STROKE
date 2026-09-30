/**
 * sync.js – optional cloud sync with private recovery key.
 * Uses same-origin relative /api calls, no localhost.
 * Stores only hash server-side; client generates cryptographically random key.
 */

const LS_KEY = 'stroke_sync_key';
const LS_REVISION = 'stroke_sync_revision';
const LS_LAST_SYNC = 'stroke_sync_last';
const LS_ENABLED = 'stroke_sync_enabled';

function generateRecoveryKey() {
  // 32 bytes = 256-bit, base64url encoded ~43 chars
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // base64url
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'');
  // Add prefix for readability but still random
  return `stroke_${b64}`;
}

async function apiGetProgress(key) {
  const res = await fetch('/api/progress', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Accept': 'application/json'
    },
    cache: 'no-store'
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GET /api/progress failed ${res.status}: ${txt}`);
  }
  return res.json(); // { data, revision, updatedAt }
}

async function apiPutProgress(key, data, revision) {
  const res = await fetch('/api/progress', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ data, revision }),
    cache: 'no-store'
  });
  if (res.status === 409) {
    const body = await res.json().catch(()=>({}));
    const err = new Error('Conflict – stale revision');
    err.status = 409;
    err.currentRevision = body.currentRevision;
    err.currentData = body.currentData;
    throw err;
  }
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PUT /api/progress failed ${res.status}: ${txt}`);
  }
  return res.json(); // { ok, revision }
}

function getStoredKey() {
  try { return localStorage.getItem(LS_KEY); } catch { return null; }
}
function setStoredKey(k) {
  try {
    if (k) localStorage.setItem(LS_KEY, k);
    else localStorage.removeItem(LS_KEY);
  } catch {}
}
function getStoredRevision() {
  try {
    const v = localStorage.getItem(LS_REVISION);
    return v ? parseInt(v,10) : 0;
  } catch { return 0; }
}
function setStoredRevision(r) {
  try { localStorage.setItem(LS_REVISION, String(r)); } catch {}
}
function isEnabled() {
  try { return localStorage.getItem(LS_ENABLED) === '1'; } catch { return false; }
}
function setEnabled(v) {
  try { localStorage.setItem(LS_ENABLED, v ? '1' : '0'); } catch {}
}

export const Sync = {
  generateRecoveryKey,
  getStoredKey,
  getStoredRevision,
  setStoredRevision,
  isEnabled,
  setEnabled,
  apiGetProgress,
  apiPutProgress,
  async enableNew() {
    const key = generateRecoveryKey();
    setStoredKey(key);
    setStoredRevision(0);
    setEnabled(true);
    localStorage.setItem(LS_LAST_SYNC, new Date().toISOString());
    return key;
  },
  async disable() {
    setEnabled(false);
    // keep key for re-enable? but clear revision? We keep key but disabled
    localStorage.removeItem(LS_LAST_SYNC);
  },
  async push(localData) {
    const key = getStoredKey();
    if (!key) throw new Error('No recovery key stored');
    const rev = getStoredRevision();
    const result = await apiPutProgress(key, localData, rev);
    setStoredRevision(result.revision);
    localStorage.setItem(LS_LAST_SYNC, new Date().toISOString());
    return result;
  },
  async pull() {
    const key = getStoredKey();
    if (!key) throw new Error('No recovery key stored');
    const remote = await apiGetProgress(key);
    if (!remote) return null;
    // Do not silently overwrite newer cloud progress – caller must decide
    setStoredRevision(remote.revision);
    localStorage.setItem(LS_LAST_SYNC, new Date().toISOString());
    return remote;
  },
  async restoreFromKey(key, localRevision) {
    if (!key) throw new Error('Key required');
    const remote = await apiGetProgress(key);
    if (!remote) throw new Error('No progress found for that key');
    // Save key locally
    setStoredKey(key);
    setStoredRevision(remote.revision);
    setEnabled(true);
    localStorage.setItem(LS_LAST_SYNC, new Date().toISOString());
    return remote;
  }
};

// UI helpers
export function createSyncUI({ getLocalProgress, setLocalProgress, onStatusChange }) {
  const container = document.createElement('div');
  container.className = 'sync-modal';

  function render() {
    const enabled = Sync.isEnabled();
    const key = Sync.getStoredKey();
    const rev = Sync.getStoredRevision();
    const last = localStorage.getItem(LS_LAST_SYNC);

    container.innerHTML = `
      <div class="sync-modal-section">
        <h3>Cloud Sync</h3>
        <div class="${enabled ? 'sync-status' : 'sync-status off'}">
          <span>${enabled ? '●' : '○'}</span>
          <span>${enabled ? `Enabled – revision ${rev}` : 'Disabled – playing locally only'}</span>
          ${last ? `<span class="muted">last ${new Date(last).toLocaleString()}</span>` : ''}
        </div>
        <p class="muted" style="font-size:.9rem;margin:8px 0">
          Sync is opt-in. Your progress stays in this browser until you enable cloud save.
          We store only a SHA-256 hash of your recovery key, never the key itself.
        </p>
        <div class="sync-warning">
          ⚠️ Anyone with your recovery key can access that learner's progress. Treat it like a password. Do not share it publicly.
        </div>
      </div>

      <div class="sync-modal-section">
        <h4>Your recovery key</h4>
        ${key ? `
          <div class="sync-key-box">
            <code>${key}</code>
            <button class="btn copy" data-action="copy-key">Copy</button>
          </div>
          <div class="sync-actions">
            <button class="btn" data-action="copy-key">Copy key</button>
            <button class="btn" data-action="push">Push local → cloud</button>
            <button class="btn" data-action="pull">Pull cloud → check</button>
            <button class="btn ghost" data-action="disable">Disable sync</button>
            <button class="btn ghost" data-action="clear-key">Forget key on this device</button>
          </div>
          <div class="sync-actions">
            <button class="btn primary" data-action="new-key">Generate NEW key (will overwrite cloud if you push)</button>
          </div>
          <div data-role="sync-log" class="log" style="margin-top:10px;min-height:40px"></div>
        ` : `
          <p class="muted">No key stored on this device.</p>
          <div class="sync-actions">
            <button class="btn primary" data-action="enable-new">Enable cloud save – generate key</button>
          </div>
        `}
      </div>

      <div class="sync-modal-section">
        <h4>Restore on another device</h4>
        <p class="muted">Paste a recovery key you saved earlier. We will fetch that progress from the server.</p>
        <input class="sync-input" data-role="restore-input" placeholder="stroke_... paste key here" />
        <div class="sync-actions">
          <button class="btn" data-action="restore-preview">Preview remote progress</button>
          <button class="btn primary" data-action="restore-apply">Restore that progress (replace local)</button>
        </div>
        <div data-role="restore-log" class="log" style="margin-top:10px;min-height:40px"></div>
        <div data-role="conflict-area"></div>
      </div>

      <div class="sync-modal-section">
        <h4>How it works</h4>
        <ul class="muted" style="font-size:.9rem;line-height:1.5">
          <li>API requests are relative to this site origin (<code>/api/progress</code>), never localhost.</li>
          <li>Server returns <code>409</code> if you try to overwrite newer cloud progress with an old revision.</li>
          <li>If cloud is newer, we show a conflict and ask you to choose – we never silently overwrite newer cloud progress.</li>
          <li>Service worker does NOT cache <code>/api</code> responses.</li>
        </ul>
      </div>
    `;

    // attach handlers
    container.querySelectorAll('[data-action]').forEach(btn=>{
      btn.addEventListener('click', async (e)=>{
        const action = btn.getAttribute('data-action');
        const logEl = container.querySelector('[data-role="sync-log"]');
        const restoreLog = container.querySelector('[data-role="restore-log"]');
        const conflictArea = container.querySelector('[data-role="conflict-area"]');
        try {
          if (action === 'copy-key') {
            const k = Sync.getStoredKey();
            await navigator.clipboard.writeText(k);
            logEl.textContent = 'Copied key to clipboard.';
          } else if (action === 'enable-new' || action === 'new-key') {
            const newKey = await Sync.enableNew();
            logEl.textContent = `Generated new key: ${newKey}\nNow push your local progress to cloud.`;
            if (onStatusChange) onStatusChange();
            setTimeout(render, 100);
          } else if (action === 'push') {
            const local = getLocalProgress();
            logEl.textContent = `Pushing ${JSON.stringify(local).length} bytes with expected revision ${Sync.getStoredRevision()}...`;
            const res = await Sync.push(local);
            logEl.textContent = `Push ok – new revision ${res.revision}`;
            if (onStatusChange) onStatusChange();
            render();
          } else if (action === 'pull') {
            logEl.textContent = 'Pulling from cloud...';
            const remote = await Sync.pull();
            if (!remote) {
              logEl.textContent = 'No cloud progress found (404). Push local first?';
            } else {
              logEl.textContent = `Cloud revision ${remote.revision}, updated ${remote.updatedAt}\nData preview: ${JSON.stringify(remote.data).slice(0,300)}...`;
              // check if remote newer than local
              const localRev = getLocalProgress().__revision || 0;
              if (remote.revision > localRev) {
                conflictArea.innerHTML = `<div class="sync-conflict">
                  <b>Cloud is newer (rev ${remote.revision}) than local (rev ${localRev}).</b><br/>
                  Do you want to replace local with cloud? This will overwrite local progress.
                  <div class="sync-actions">
                    <button class="btn primary" id="conflict-accept">Use cloud version</button>
                    <button class="btn" id="conflict-keep">Keep local</button>
                  </div>
                </div>`;
                conflictArea.querySelector('#conflict-accept').addEventListener('click', ()=>{
                  setLocalProgress(remote.data, remote.revision);
                  logEl.textContent = 'Local replaced with cloud version.';
                  conflictArea.innerHTML='';
                  if (onStatusChange) onStatusChange();
                });
                conflictArea.querySelector('#conflict-keep').addEventListener('click', ()=>{
                  conflictArea.innerHTML='';
                  logEl.textContent = 'Kept local version.';
                });
              }
            }
          } else if (action === 'disable') {
            await Sync.disable();
            logEl.textContent = 'Sync disabled – still local only. Key remains stored until you forget it.';
            if (onStatusChange) onStatusChange();
            render();
          } else if (action === 'clear-key') {
            if (confirm('Forget recovery key on this device? You can still restore with the key elsewhere.')) {
              setStoredKey(null);
              setStoredRevision(0);
              setEnabled(false);
              logEl.textContent = 'Key forgotten on this device.';
              if (onStatusChange) onStatusChange();
              render();
            }
          } else if (action === 'restore-preview') {
            const input = container.querySelector('[data-role="restore-input"]');
            const k = input.value.trim();
            if (!k) { restoreLog.textContent='Paste a key first.'; return; }
            restoreLog.textContent='Fetching...';
            try {
              const remote = await Sync.apiGetProgress(k);
              if (!remote) restoreLog.textContent='No progress for that key (404).';
              else restoreLog.textContent=`Found rev ${remote.revision} updated ${remote.updatedAt}\nPreview: ${JSON.stringify(remote.data).slice(0,400)}...`;
            } catch (err) {
              restoreLog.textContent='Error: '+err.message;
            }
          } else if (action === 'restore-apply') {
            const input = container.querySelector('[data-role="restore-input"]');
            const k = input.value.trim();
            if (!k) { restoreLog.textContent='Paste a key first.'; return; }
            if (!confirm('Replace local progress with cloud progress for that key? This cannot be undone unless you have a backup.')) return;
            restoreLog.textContent='Restoring...';
            try {
              const remote = await Sync.restoreFromKey(k);
              setLocalProgress(remote.data, remote.revision);
              restoreLog.textContent=`Restored rev ${remote.revision}. Local updated.`;
              if (onStatusChange) onStatusChange();
              render();
            } catch (err) {
              restoreLog.textContent='Restore failed: '+err.message;
            }
          }
        } catch (err) {
          if (err.status===409) {
            logEl.textContent=`Conflict 409: server has newer revision ${err.currentRevision}. Fetch first, then decide.`;
            conflictArea.innerHTML = `<div class="sync-conflict">
              Server revision ${err.currentRevision} is newer. Your expected was stale.<br/>
              <pre style="white-space:pre-wrap;max-height:120px;overflow:auto">${JSON.stringify(err.currentData||{}).slice(0,500)}</pre>
              <div class="sync-actions">
                <button class="btn primary" id="force-pull">Pull server version</button>
              </div>
            </div>`;
            conflictArea.querySelector('#force-pull')?.addEventListener('click', async ()=>{
              const remote = await Sync.pull();
              if (remote) {
                setLocalProgress(remote.data, remote.revision);
                logEl.textContent='Pulled server version after conflict.';
                conflictArea.innerHTML='';
                if (onStatusChange) onStatusChange();
              }
            });
          } else {
            logEl.textContent='Error: '+err.message;
            console.error(err);
          }
        }
      });
    });
  }

  render();
  return container;
}
