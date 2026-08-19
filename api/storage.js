const https = require('https');
const crypto = require('crypto');

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

function hashToken(token) {
  if (!token) return '';
  return crypto.createHash('sha256').update(String(token).trim()).digest('hex');
}

// Executes standard Upstash Redis commands (e.g. ['SET', key, val], ['GET', key], ['KEYS', pattern])
function redisExec(commandArray) {
  if (!KV_URL || !KV_TOKEN) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      let rawUrl = KV_URL;
      if (!rawUrl.startsWith('http')) {
        rawUrl = 'https://' + rawUrl;
      }
      const u = new URL(rawUrl);
      const postData = JSON.stringify(commandArray);

      const req = https.request({
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname === '/' ? '/' : u.pathname,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${KV_TOKEN}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let resBody = '';
        res.on('data', chunk => resBody += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(resBody);
            resolve(parsed.result !== undefined ? parsed.result : parsed);
          } catch (e) {
            resolve(resBody);
          }
        });
      });

      req.on('error', (err) => {
        console.warn('[Redis Error]', err.message);
        resolve(null);
      });

      req.setTimeout(3500, () => {
        req.destroy();
        resolve(null);
      });

      req.write(postData);
      req.end();
    } catch (e) {
      console.warn('[Redis Global Error]', e.message);
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

  await redisExec(['SET', `blacklist_${hash}`, JSON.stringify(record)]);
  return record;
}

async function unblacklistKey(token) {
  const hash = hashToken(token);
  localRevoked.delete(hash);

  await redisExec(['DEL', `blacklist_${hash}`]);
}

async function isKeyBlacklisted(token) {
  const hash = hashToken(token);
  if (localRevoked.has(hash)) {
    return localRevoked.get(hash);
  }

  const res = await redisExec(['GET', `blacklist_${hash}`]);
  if (res) {
    try {
      const parsed = typeof res === 'string' ? JSON.parse(res) : res;
      localRevoked.set(hash, parsed);
      return parsed;
    } catch (e) {
      return { reason: 'Revoked by administrator' };
    }
  }
  return null;
}

async function setNukeTimestamp(ts) {
  localNukeTimestamp = ts || Date.now();
  localKeys.clear();

  await redisExec(['SET', 'nuke_timestamp', String(localNukeTimestamp)]);
  return localNukeTimestamp;
}

async function getNukeTimestamp() {
  const res = await redisExec(['GET', 'nuke_timestamp']);
  if (res) {
    const parsed = parseInt(res, 10);
    if (!isNaN(parsed) && parsed > localNukeTimestamp) {
      localNukeTimestamp = parsed;
    }
  }
  return localNukeTimestamp;
}

async function saveKey(keyRecord) {
  if (!keyRecord || !keyRecord.key) return;
  localKeys.set(keyRecord.key, keyRecord);

  const hash = hashToken(keyRecord.key).substring(0, 16);
  await redisExec(['SET', `hubkey_${hash}`, JSON.stringify(keyRecord)]);
}

async function getAllKeys() {
  const keys = await redisExec(['KEYS', 'hubkey_*']);
  if (Array.isArray(keys) && keys.length > 0) {
    const records = [];
    for (const k of keys) {
      const val = await redisExec(['GET', k]);
      if (val) {
        try {
          const parsed = typeof val === 'string' ? JSON.parse(val) : val;
          records.push(parsed);
        } catch (e) {}
      }
    }
    return records;
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
