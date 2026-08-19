const crypto = require('crypto');
const { isKeyBlacklisted, getNukeTimestamp, blacklistKey, unblacklistKey, saveKey, getAllKeys, hashToken } = require('./storage');

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
      revoked: true,
      message: `This key has been deleted/revoked by the administrator (${revokedInfo.reason || 'Revoked'}).`
    };
  }

  const tokenBody = cleanToken.slice(4);
  const parts = tokenBody.split('.');
  if (parts.length !== 2) {
    return { valid: false, message: 'Malformed key structure.' };
  }

  const [payloadB64, providedSig] = parts;

  // 2. Verify HMAC signature
  const hmac = crypto.createHmac('sha256', SECRET);
  hmac.update(payloadB64);
  const expectedSig = hmac.digest('base64url');

  const providedBuf = Buffer.from(providedSig);
  const expectedBuf = Buffer.from(expectedSig);

  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return { valid: false, message: 'Invalid key signature (tampered key).' };
  }

  // 3. Parse payload
  let payload;
  try {
    const jsonStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
    payload = JSON.parse(jsonStr);
  } catch (e) {
    return { valid: false, message: 'Failed to parse key payload.' };
  }

  const now = Date.now();

  // 4. Master Global Nuke Check
  const nukeTimestamp = await getNukeTimestamp();
  if (nukeTimestamp > 0 && payload.iat && payload.iat <= nukeTimestamp) {
    return {
      valid: false,
      revoked: true,
      message: 'All keys created prior to the recent master wipe have been invalidated. Please claim a new key.'
    };
  }

  const isLifetime = payload.isLifetime === true;
  const isExpired = !isLifetime && now > payload.exp;

  if (isExpired) {
    const expiredAgoSec = Math.floor((now - payload.exp) / 1000);
    return { 
      valid: false, 
      expired: true, 
      message: `Key expired ${Math.floor(expiredAgoSec / 60)} minutes ago.`,
      expiresAt: payload.exp
    };
  }

  // 5. HWID Lock Check
  const incomingHwidHash = clientHwid ? hashHwid(clientHwid) : null;
  let boundKey = cleanToken;

  if (payload.hwid) {
    if (incomingHwidHash && payload.hwid !== incomingHwidHash) {
      return {
        valid: false,
        message: 'This key is already locked to a different Hardware ID (HWID).'
      };
    }
  } else if (incomingHwidHash) {
    const boundPayload = { ...payload, hwid: incomingHwidHash };
    const boundB64 = Buffer.from(JSON.stringify(boundPayload)).toString('base64url');
    const boundHmac = crypto.createHmac('sha256', SECRET);
    boundHmac.update(boundB64);
    const boundSig = boundHmac.digest('base64url');
    boundKey = `KEY_${boundB64}.${boundSig}`;
  }

  let formattedRemaining = 'Lifetime Access';
  let remainingSeconds = 99999999;

  if (!isLifetime) {
    const remainingMs = payload.exp - now;
    remainingSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;
    formattedRemaining = `${hours}h ${minutes}m ${seconds}s`;
  }

  return {
    valid: true,
    boundKey: boundKey,
    isLifetime: isLifetime,
    createdAt: payload.iat,
    expiresAt: payload.exp,
    remainingSeconds: remainingSeconds,
    formattedRemaining: formattedRemaining,
    message: isLifetime ? 'Lifetime Key Verified!' : `Key is valid! (${formattedRemaining} remaining)`
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, User-Agent, X-Hub-Key, X-HWID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const key = req.query.key || (req.body && req.body.key) || req.headers['x-hub-key'];
  const hwid = req.query.hwid || (req.body && req.body.hwid) || req.headers['x-hwid'];

  const result = await verifyToken(key, hwid);

  if (!result.valid) {
    return res.status(result.expired ? 410 : (result.revoked ? 403 : 400)).json(result);
  }

  return res.status(200).json(result);
};

module.exports.verifyToken = verifyToken;
module.exports.hashHwid = hashHwid;
