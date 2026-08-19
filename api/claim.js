const crypto = require('crypto');

const SECRET = process.env.KEY_SECRET || 'CIGANYHUB_SECURE_SECRET_CHANGE_ME_987654321';
const EXPIRATION_HOURS = 8;

module.exports = (req, res) => {
  const session = req.query.session;
  const step = parseInt(req.query.step || '1', 10);
  
  if (!session) {
    return res.redirect('/?error=missing_session');
  }

  const parts = session.split('.');
  if (parts.length !== 2) {
    return res.redirect('/?error=invalid_session');
  }

  const [payloadB64, providedSig] = parts;
  const hmac = crypto.createHmac('sha256', SECRET);
  hmac.update(payloadB64);
  const signature = hmac.digest('base64url');

  const providedBuf = Buffer.from(providedSig);
  const expectedBuf = Buffer.from(expectedSig);

  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return res.redirect('/?error=tampered_session');
  }

  if (step === 1) {
    return res.redirect('/?step=2');
  }

  const now = Date.now();
  const expiresAt = now + EXPIRATION_HOURS * 60 * 60 * 1000;

  const keyPayload = {
    v: 1,
    iat: now,
    exp: expiresAt,
    nonce: crypto.randomBytes(6).toString('hex')
  };

  const keyPayloadB64 = Buffer.from(JSON.stringify(keyPayload)).toString('base64url');
  const keyHmac = crypto.createHmac('sha256', SECRET);
  keyHmac.update(keyPayloadB64);
  const keySig = keyHmac.digest('base64url');

  const key = `KEY_${keyPayloadB64}.${keySig}`;

  return res.redirect(`/?claimed=true&key=${encodeURIComponent(key)}&exp=${expiresAt}`);
};
