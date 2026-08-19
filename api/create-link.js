const crypto = require('crypto');

const SECRET = process.env.KEY_SECRET || 'CIGANYHUB_SECURE_SECRET_CHANGE_ME_987654321';
const LOOTLABS_API_KEY = process.env.LOOTLABS_API_KEY || 'cb54636de3e8624f4d07141f8d3475c5664ab8160f2afb857a76c996504f53ee';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, User-Agent');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    
    const now = Date.now();
    const tokenPayload = {
      action: 'claim_key',
      timestamp: now,
      nonce: crypto.randomBytes(8).toString('hex')
    };
    
    const payloadB64 = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
    const hmac = crypto.createHmac('sha256', SECRET);
    hmac.update(payloadB64);
    const signature = hmac.digest('base64url');
    const sessionToken = `${payloadB64}.${signature}`;

    const destinationUrl = `${protocol}://${host}/api/claim?session=${sessionToken}`;

    const lootRes = await fetch('https://creators.lootlabs.gg/api/public/content_locker', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOOTLABS_API_KEY}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        title: 'CiganyHUB Key Generation',
        url: destinationUrl,
        tier_id: 1,
        number_of_tasks: 1,
        theme: 1
      })
    });

    const lootData = await lootRes.json();
    const adUrl = lootData.lootlabs_url || lootData.url || lootData.data?.url || lootData.data?.lootlabs_url;

    return res.status(200).json({
      success: true,
      adUrl: adUrl || destinationUrl
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create LootLabs link: ' + err.message
    });
  }
};
