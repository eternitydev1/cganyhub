const crypto = require('crypto');

const SECRET = process.env.KEY_SECRET || 'CIGANYHUB_SECURE_SECRET_CHANGE_ME_987654321';
const EXPIRATION_HOURS = 8;

function safeRedirect(res, url) {
  try {
    res.setHeader('Location', url);
    res.statusCode = 302;
    res.end();
  } catch (err) {
    if (typeof res.redirect === 'function') {
      res.redirect(url);
    } else {
      res.writeHead(302, { Location: url });
      res.end();
    }
  }
}

module.exports = (req, res) => {
  try {
    const session = req.query.session || '';
    const step = parseInt(req.query.step || '1', 10);
    
    if (!session) {
      return safeRedirect(res, '/?error=missing_session');
    }

    const parts = session.split('.');
    if (parts.length !== 2) {
      return safeRedirect(res, '/?error=invalid_session');
    }

    const [payloadB64, providedSig] = parts;
    const hmac = crypto.createHmac('sha256', SECRET);
    hmac.update(payloadB64);
    const expectedSig = hmac.digest('base64url');

    const providedBuf = Buffer.from(providedSig);
    const expectedBuf = Buffer.from(expectedSig);

    if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
      return safeRedirect(res, '/?error=tampered_session');
    }

    // Step 1 completed -> Redirect to Step 2 (Checkpoint 2 of 2)
    if (step === 1) {
      return safeRedirect(res, '/?step=2');
    }

    // Step 2 completed -> Issue the 8-Hour Key
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

    return safeRedirect(res, `/?claimed=true&key=${encodeURIComponent(key)}&exp=${expiresAt}`);
  } catch (globalErr) {
    console.error('[Claim Error]', globalErr);
    return safeRedirect(res, `/?error=${encodeURIComponent(globalErr.message)}`);
  }
};
