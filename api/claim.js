const crypto = require('crypto');
const https = require('https');
const { saveKey } = require('../lib/storage');

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
      const url = new URL(DISCORD_WEBHOOK_URL);
      const postData = JSON.stringify({
        embeds: [{
          title: "🔑 New 8-Hour Key Claimed!",
          description: "A user has successfully completed LootLabs and claimed a key.",
          color: 0xff1e27,
          fields: [
            { name: "Key Token", value: "```" + keyData.key + "```", inline: false },
            { name: "Valid For", value: "8 Hours", inline: true },
            { name: "Expires At", value: new Date(keyData.expiresAt).toLocaleString(), inline: true },
            { name: "HWID Lock", value: keyData.hwid ? "`Bound`" : "`Auto-binds on first run`", inline: true }
          ],
          footer: { text: "CiganyHub Key Gateway • Stateless HMAC-SHA256" },
          timestamp: new Date().toISOString()
        }]
      });

      const req = https.request({
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, () => resolve());

      req.on('error', () => resolve());
      req.setTimeout(2500, () => {
        req.destroy();
        resolve();
      });

      req.write(postData);
      req.end();
    } catch(e) {
      resolve();
    }
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const userHwid = req.query.hwid || (req.body && req.body.hwid) || null;
  const now = Date.now();
  const expiresAt = now + (EXPIRATION_HOURS * 60 * 60 * 1000);

  const payload = {
    v: 1,
    iat: now,
    exp: expiresAt,
    nonce: crypto.randomBytes(8).toString('hex')
  };

  if (userHwid) {
    payload.hwid = crypto.createHash('sha256').update(String(userHwid).trim()).digest('hex').substring(0, 16);
  }

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', SECRET);
  hmac.update(payloadB64);
  const signature = hmac.digest('base64url');

  const fullKey = `KEY_${payloadB64}.${signature}`;

  // Automatically record this key in database for dashboard tracking
  try {
    await saveKey({
      key: fullKey,
      note: 'LootLabs User Generated',
      source: 'LootLabs',
      isLifetime: false,
      durationLabel: '8 Hours',
      createdAt: now,
      formattedCreated: new Date(now).toLocaleString(),
      expiresAt: expiresAt,
      formattedExpires: new Date(expiresAt).toLocaleString(),
      boundHwid: userHwid ? 'Bound to HWID' : 'Unbound (Auto-locks on first device)',
      revoked: false,
      expired: false,
      status: 'active'
    });
  } catch(e) {}

  await notifyDiscord({
    key: fullKey,
    expiresAt: expiresAt,
    hwid: userHwid
  });

  const redirectUrl = `/?claimed_key=${encodeURIComponent(fullKey)}&expires_in=8h`;
  return safeRedirect(res, redirectUrl);
};
