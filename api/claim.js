const crypto = require('crypto');
const https = require('https');
const { saveKey } = require('./storage');

const SECRET = process.env.KEY_SECRET || 'HajraToroczkai719Laszlo99IstenVAGY';
const EXPIRATION_HOURS = 8;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || 'https://discord.com/api/webhooks/1526481123973136387/M0MW-HHESq7oC0EokriBr-Dei5yY50wYgtsAC_iM_8oH08MWteyezuDhg8WwzxmwUmZp';

function safeRedirect(res, url) {
  try {
    res.setHeader('Location', url);
    res.statusCode = 302;
    res.end();
  } catch (err) {
    try {
      res.writeHead(302, { Location: url });
      res.end();
    } catch(e) {}
  }
}

// Send Real-Time Notification to Owner Discord (Guaranteed Await)
function notifyDiscord(keyData) {
  if (!DISCORD_WEBHOOK_URL || !DISCORD_WEBHOOK_URL.startsWith('http')) return Promise.resolve();
  return new Promise((resolve) => {
    try {
      const payload = JSON.stringify({
        embeds: [{
          title: "🔑 New LootLabs Key Generated",
          color: 0xff1e27,
          fields: [
            { name: "Key Token", value: `\`\`\`${keyData.key}\`\`\``, inline: false },
            { name: "Duration", value: "8 Hours", inline: true },
            { name: "Created At", value: `<t:${Math.floor(keyData.createdAt / 1000)}:R>`, inline: true },
            { name: "Source", value: "LootLabs Checkpoint (2/2)", inline: true }
          ],
          footer: { text: "CiganyHub Live Tracking" },
          timestamp: new Date().toISOString()
        }]
      });

      const urlObj = new URL(DISCORD_WEBHOOK_URL);
      const req = https.request({
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        resolve();
      });

      req.on('error', () => resolve());
      req.setTimeout(3500, () => {
        req.destroy();
        resolve();
      });

      req.write(payload);
      req.end();
    } catch (e) {
      resolve();
    }
  });
}

module.exports = async (req, res) => {
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
      note: 'LootLabs Checkpoint Key',
      durationLabel: '8 Hours',
      nonce: crypto.randomBytes(6).toString('hex')
    };

    const keyPayloadB64 = Buffer.from(JSON.stringify(keyPayload)).toString('base64url');
    const keyHmac = crypto.createHmac('sha256', SECRET);
    keyHmac.update(keyPayloadB64);
    const keySig = keyHmac.digest('base64url');

    const key = `KEY_${keyPayloadB64}.${keySig}`;

    const keyRecord = {
      key: key,
      note: 'LootLabs Checkpoint Key',
      source: 'LootLabs Gateway',
      isLifetime: false,
      durationLabel: '8 Hours',
      createdAt: now,
      formattedCreated: new Date(now).toLocaleString(),
      expiresAt: expiresAt,
      formattedExpires: new Date(expiresAt).toLocaleString(),
      boundHwid: 'Unbound (Auto-locks on first device)',
      revoked: false
    };

    // 1. Wait for Discord Notification before redirecting
    await notifyDiscord(keyRecord);

    // 2. Save to Persistent Cloud Storage
    await saveKey(keyRecord);

    return safeRedirect(res, `/?claimed=true&key=${encodeURIComponent(key)}&exp=${expiresAt}`);
  } catch (globalErr) {
    console.error('[Claim Error]', globalErr);
    return safeRedirect(res, `/?error=${encodeURIComponent(globalErr.message)}`);
  }
};
