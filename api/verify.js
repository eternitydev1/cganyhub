const crypto = require('crypto');
const { isKeyBlacklisted, getNukeTimestamp, blacklistKey, unblacklistKey, saveKey, getAllKeys, hashToken } = require('../lib/storage');

const SECRET = process.env.KEY_SECRET || 'HajraToroczkai719Laszlo99IstenVAGY';
const EXPIRATION_HOURS = 8;

function hashHwid(rawHwid) {
  if (!rawHwid) return 'unspecified';
  return crypto.createHash('sha256').update(String(rawHwid).trim()).digest('hex').substring(0, 16);
}

async function verifyToken(token, clientHwid) {
  if (!token || typeof token !== 'string') {
    return { valid: false, message: 'Missing or empty key.' };
  }

  const cleanToken = token.trim();
  if (!cleanToken.startsWith('KEY_')) {
    return { valid: false, message: 'Invalid key format.' };
  }

  // 1. Check Cloud & Local Blacklist
  const revokedInfo = await isKeyBlacklisted(cleanToken);
  if (revokedInfo) {
    return {
      valid: false,
      reason: 'REVOKED',
      message: `This key has been revoked. Reason: ${revokedInfo.reason || 'Revoked by owner'}`
    };
  }

  const parts = cleanToken.slice(4).split('.');
  if (parts.length !== 2) {
    return { valid: false, message: 'Malformed key structure.' };
  }

  const payloadB64 = parts[0];
  const signature = parts[1];

  // 2. Cryptographic HMAC Verification
  const hmac = crypto.createHmac('sha256', SECRET);
  hmac.update(payloadB64);
  const expectedSig = hmac.digest('base64url');

  if (signature !== expectedSig) {
    return { valid: false, message: 'Cryptographic signature mismatch. Forged key.' };
  }

  // 3. Payload Extraction & Expiration Check
  let payload;
  try {
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    payload = JSON.parse(payloadJson);
  } catch (err) {
    return { valid: false, message: 'Corrupt key payload.' };
  }

  const now = Date.now();

  // 4. Check Global Master Nuke Timestamp
  const nukeTime = await getNukeTimestamp();
  if (nukeTime > 0 && payload.iat <= nukeTime) {
    return {
      valid: false,
      reason: 'NUKED',
      message: 'All keys created prior to master revocation have been invalidated.'
    };
  }

  // 5. Expiration Check (Lifetime keys bypass this check)
  if (!payload.isLifetime && now > payload.exp) {
    return {
      valid: false,
      reason: 'EXPIRED',
      message: 'Key has expired (8 hours passed). Please generate a new key.'
    };
  }

  // 6. Strict Hardware ID (HWID) Binding
  if (payload.hwid && clientHwid) {
    const hashedClientHwid = hashHwid(clientHwid);
    if (payload.hwid !== hashedClientHwid) {
      return {
        valid: false,
        reason: 'HWID_MISMATCH',
        message: 'Key is locked to a different Hardware ID (HWID). Key sharing is prohibited.'
      };
    }
  }

  const remainingMs = payload.isLifetime ? Infinity : Math.max(0, payload.exp - now);
  const remainingHours = payload.isLifetime ? 'Lifetime' : (remainingMs / (1000 * 60 * 60)).toFixed(1);

  return {
    valid: true,
    isLifetime: !!payload.isLifetime,
    remainingHours: remainingHours,
    remainingSeconds: payload.isLifetime ? Infinity : Math.floor(remainingMs / 1000),
    createdAt: new Date(payload.iat).toISOString(),
    expiresAt: payload.isLifetime ? 'Never (Lifetime)' : new Date(payload.exp).toISOString()
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, User-Agent, X-Hub-Key, X-HWID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const token = req.headers['x-hub-key'] || req.query.key || (req.body && req.body.key);
  const hwid = req.headers['x-hwid'] || req.query.hwid || (req.body && req.body.hwid);

  if (!token) {
    return res.status(400).json({ valid: false, message: 'Missing key parameter' });
  }

  const result = await verifyToken(token, hwid);

  if (result.valid) {
    return res.status(200).json(result);
  } else {
    return res.status(403).json(result);
  }
};

module.exports.verifyToken = verifyToken;
