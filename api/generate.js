const crypto = require('crypto');

const SECRET = process.env.KEY_SECRET || 'CIGANYHUB_SECURE_SECRET_CHANGE_ME_987654321';
const EXPIRATION_HOURS = 8;

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, User-Agent');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const now = Date.now();
    const expiresAt = now + EXPIRATION_HOURS * 60 * 60 * 1000;

    const payload = {
      v: 1,
      iat: now,
      exp: expiresAt,
      nonce: crypto.randomBytes(6).toString('hex')
    };

    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    
    const hmac = crypto.createHmac('sha256', SECRET);
    hmac.update(payloadB64);
    const signature = hmac.digest('base64url');

    const key = `KEY_${payloadB64}.${signature}`;

    return res.status(200).json({
      success: true,
      key: key,
      createdAt: now,
      expiresAt: expiresAt,
      durationHours: EXPIRATION_HOURS,
      formattedExpiry: new Date(expiresAt).toUTCString()
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to generate key: ' + err.message
    });
  }
};
