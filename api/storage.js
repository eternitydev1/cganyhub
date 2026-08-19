const https = require('https');
const crypto = require('crypto');

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

function hashToken(token) {
  if (!token) return '';
  return crypto.createHash('sha256').update(String(token).trim()).digest('hex');
}

function kvRequest(path, method = 'GET', data = null) {
  if (!KV_URL || !KV_TOKEN) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const u = new URL(`${KV_URL}${path}`);
      const headers = {
        'Authorization': `Bearer ${KV_TOKEN}`
      };
      let bodyData = null;
      if (data) {
        bodyData = typeof data === 'string' ? data : JSON.stringify(data);
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(bodyData);
      }

      const req = https.request({
        hostname: u.hostname,
        path: u.pathname + (u.search || ''),
        method: method,
        headers: headers
      }, (res) => {
        let resBody = '';
        res.on('data', chunk => resBody += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(resBody);
            resolve(parsed.result !== undefined ? parsed.result : parsed);
          } catch(e) {
            resolve(resBody);
          }
        });
      });

      req.on('error', () => resolve(null));
      req.setTimeout(3000, () => {
        req.destroy();
        resolve(null);
      });

      if (bodyData) req.write(bodyData);
      req.end();
    } catch(e) {
      resolve(null);
    }
  });
}

// Local In-Memory Fallback Cache
const localRevoked = new Map();
const localKeys = new Map();
let localNukeTimestamp = 0;

async function blacklistKey(token, reason = 'Revoked by owner') {
  const hash = hashToken(token);
  const record = {
    token: token,
    hash: hash,
    revokedAt: Date.now(),
    reason: reason
  };
  localRevoked.set(hash, record);

  if (KV_URL && KV_TOKEN) {
    await kvRequest(`/set/blacklist_${hash}`, 'POST', JSON.stringify(record));
  }
  return record;
}

async function unblacklistKey(token) {
  const hash = hashToken(token);
  localRevoked.delete(hash);

  if (KV_URL && KV_TOKEN) {
    await kvRequest(`/del/blacklist_${hash}`, 'POST');
  }
}

async function isKeyBlacklisted(token) {
  const hash = hashToken(token);
  if (localRevoked.has(hash)) {
    return localRevoked.get(hash);
  }

  if (KV_URL && KV_TOKEN) {
    const res = await kvRequest(`/get/blacklist_${hash}`);
    if (res) {
      try {
        const parsed = typeof res === 'string' ? JSON.parse(res) : res;
        localRevoked.set(hash, parsed);
        return parsed;
      } catch(e) {
        return { reason: 'Revoked' };
      }
    }
  }
  return null;
}

async function setNukeTimestamp(ts) {
  localNukeTimestamp = ts || Date.now();
  localKeys.clear();

  if (KV_URL && KV_TOKEN) {
    await kvRequest(`/set/nuke_timestamp`, 'POST', String(localNukeTimestamp));
  }
  return localNukeTimestamp;
}

async function getNukeTimestamp() {
  if (KV_URL && KV_TOKEN) {
    const res = await kvRequest(`/get/nuke_timestamp`);
    if (res) {
      const parsed = parseInt(res, 10);
      if (!isNaN(parsed) && parsed > localNukeTimestamp) {
        localNukeTimestamp = parsed;
      }
    }
  }
  return localNukeTimestamp;
}

async function saveKey(keyRecord) {
  if (!keyRecord || !keyRecord.key) return;
  localKeys.set(keyRecord.key, keyRecord);

  if (KV_URL && KV_TOKEN) {
    const hash = hashToken(keyRecord.key).substring(0, 16);
    await kvRequest(`/set/key_${hash}`, 'POST', JSON.stringify(keyRecord));
  }
}

async function getAllKeys() {
  if (KV_URL && KV_TOKEN) {
    const keys = await kvRequest(`/keys/key_*`);
    if (Array.isArray(keys) && keys.length > 0) {
      const records = [];
      for (const k of keys) {
        const val = await kvRequest(`/get/${k}`);
        if (val) {
          try {
            const parsed = typeof val === 'string' ? JSON.parse(val) : val;
            records.push(parsed);
          } catch(e) {}
        }
      }
      return records;
    }
  }
  return Array.from(localKeys.values());
}

module.exports = {
  blacklistKey,
  unblacklistKey,
  isKeyBlacklisted,
  setNukeTimestamp,
  getNukeTimestamp,
  saveKey,
  getAllKeys,
  hashToken
};
