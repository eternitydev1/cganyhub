const https = require('https');
const crypto = require('crypto');

// Cloud KV Configuration (Works out-of-the-box with Vercel KV / Upstash Redis / JSONBin)
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

// Local in-memory cache for speed
const localRevokedCache = new Map();
const localKeysCache = new Map();

function rawHttpRequest(url, method, headers, data) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const req = https.request({
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: method || 'GET',
        headers: headers || {}
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(body) });
          } catch(e) {
            resolve({ status: res.statusCode, body });
          }
        });
      });
      req.on('error', reject);
      if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
      req.end();
    } catch(err) {
      reject(err);
    }
  });
}

// ════════════════════════════════════════════════════════
// REVOCATION BLACKLIST (Cloud Synced)
// ════════════════════════════════════════════════════════
async function addRevokedKey(token, reason) {
  const hash = crypto.createHash('sha256').update(String(token).trim()).digest('hex');
  const record = {
    hash: hash,
    token: token,
    revokedAt: Date.now(),
    reason: reason || 'Revoked by owner'
  };

  localRevokedCache.set(hash, record);

  // Sync to Cloud KV (Upstash / Vercel KV) if available
  if (KV_URL && KV_TOKEN) {
    try {
      await rawHttpRequest(`${KV_URL}/set/revoked_${hash}`, 'POST', {
        'Authorization': `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json'
      }, JSON.stringify(record));
    } catch (e) {
      console.error('[Storage Error - Revoke]', e);
    }
  }

  return true;
}

async function removeRevokedKey(token) {
  const hash = crypto.createHash('sha256').update(String(token).trim()).digest('hex');
  localRevokedCache.delete(hash);

  if (KV_URL && KV_TOKEN) {
    try {
      await rawHttpRequest(`${KV_URL}/del/revoked_${hash}`, 'POST', {
        'Authorization': `Bearer ${KV_TOKEN}`
      });
    } catch (e) {}
  }
}

async function checkIsRevoked(token) {
  const hash = crypto.createHash('sha256').update(String(token).trim()).digest('hex');
  
  if (localRevokedCache.has(hash)) {
    return localRevokedCache.get(hash);
  }

  if (KV_URL && KV_TOKEN) {
    try {
      const res = await rawHttpRequest(`${KV_URL}/get/revoked_${hash}`, 'GET', {
        'Authorization': `Bearer ${KV_TOKEN}`
      });
      if (res.status === 200 && res.body && res.body.result) {
        const data = typeof res.body.result === 'string' ? JSON.parse(res.body.result) : res.body.result;
        localRevokedCache.set(hash, data);
        return data;
      }
    } catch (e) {}
  }

  return null;
}

// ════════════════════════════════════════════════════════
// KEY REGISTRY TRACKING (Cloud Synced)
// ════════════════════════════════════════════════════════
async function saveKeyRecord(keyRecord) {
  if (!keyRecord || !keyRecord.key) return;
  const hash = crypto.createHash('sha256').update(String(keyRecord.key).trim()).digest('hex').substring(0, 16);
  
  localKeysCache.set(keyRecord.key, keyRecord);

  if (KV_URL && KV_TOKEN) {
    try {
      await rawHttpRequest(`${KV_URL}/set/key_${hash}`, 'POST', {
        'Authorization': `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json'
      }, JSON.stringify(keyRecord));
    } catch (e) {}
  }
}

async function fetchAllKeyRecords() {
  const list = Array.from(localKeysCache.values());

  if (KV_URL && KV_TOKEN) {
    try {
      const keysRes = await rawHttpRequest(`${KV_URL}/keys/key_*`, 'GET', {
        'Authorization': `Bearer ${KV_TOKEN}`
      });
      if (keysRes.status === 200 && Array.isArray(keysRes.body.result)) {
        for (const k of keysRes.body.result) {
          const valRes = await rawHttpRequest(`${KV_URL}/get/${k}`, 'GET', {
            'Authorization': `Bearer ${KV_TOKEN}`
          });
          if (valRes.status === 200 && valRes.body && valRes.body.result) {
            const parsed = typeof valRes.body.result === 'string' ? JSON.parse(valRes.body.result) : valRes.body.result;
            if (parsed && parsed.key && !localKeysCache.has(parsed.key)) {
              localKeysCache.set(parsed.key, parsed);
              list.push(parsed);
            }
          }
        }
      }
    } catch (e) {}
  }

  return list;
}

module.exports = {
  addRevokedKey,
  removeRevokedKey,
  checkIsRevoked,
  saveKeyRecord,
  fetchAllKeyRecords,
  localRevokedCache,
  localKeysCache
};
