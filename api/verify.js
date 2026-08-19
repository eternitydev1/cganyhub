const crypto = require('crypto');

const SECRET = process.env.KEY_SECRET || 'CIGANYHUB_SECURE_SECRET_CHANGE_ME_987654321';

function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, message: 'Missing or empty key.' };
  }

  const cleanToken = token.trim();
  if (!cleanToken.startsWith('KEY_')) {
    return { valid: false, message: 'Invalid key format.' };
  }

  const tokenBody = cleanToken.slice(4);
  const parts = tokenBody.split('.');
  if (parts.length !== 2) {
    return { valid: false, message: 'Malformed key structure.' };
  }

  const [payloadB64, providedSig] = parts;

  const hmac = crypto.createHmac('sha256', SECRET);
  hmac.update(payloadB64);
  const expectedSig = hmac.digest('base64url');

  const providedBuf = Buffer.from(providedSig);
  const expectedBuf = Buffer.from(expectedSig);

  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return { valid: false, message: 'Invalid key signature.' };
  }

  let payload;
  try {
    const jsonStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
    payload = JSON.parse(jsonStr);
  } catch (e) {
    return { valid: false, message: 'Failed to parse key payload.' };
  }

  const now = Date.now();
  if (now > payload.exp) {
    const expiredAgoSec = Math.floor((now - payload.exp) / 1000);
    return { 
      valid: false, 
      expired: true, 
      message: `Key expired ${Math.floor(expiredAgoSec / 60)} minutes ago.`,
      expiresAt: payload.exp
    };
  }

  const remainingMs = payload.exp - now;
  const remainingSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  return {
    valid: true,
    createdAt: payload.iat,
    expiresAt: payload.exp,
    remainingSeconds: remainingSeconds,
    formattedRemaining: `${hours}h ${minutes}m ${seconds}s`,
    message: `Key is valid! (${hours}h ${minutes}m remaining)`
  };
}

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, User-Agent');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const key = req.query.key || (req.body && req.body.key);
  const result = verifyToken(key);

  if (!result.valid) {
    return res.status(result.expired ? 410 : 400).json(result);
  }

  return res.status(200).json(result);
};

module.exports.verifyToken = verifyToken;
