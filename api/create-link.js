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
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'cganyhub.vercel.app';
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    
    // Create a temporary signed single-use session token
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

    // Call LootLabs API to create an ad link
    const lootRes = await fetch('https://creators.lootlabs.gg/api/public/content_locker', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOOTLABS_API_KEY}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        title: 'CiganyHUB Key',
        url: destinationUrl,
        tier_id: 1,
        number_of_tasks: 1,
        theme: 1
      })
    });

    const lootData = await lootRes.json();
    console.log('LootLabs Response:', JSON.stringify(lootData));

    // Extract loot_url from LootLabs API response format
    let adUrl = null;
    if (lootData && Array.isArray(lootData.message) && lootData.message.length > 0) {
      adUrl = lootData.message[0].loot_url || lootData.message[0].url;
    } else if (lootData && lootData.loot_url) {
      adUrl = lootData.loot_url;
    }

    if (!adUrl) {
      return res.status(500).json({
        success: false,
        message: 'LootLabs did not return an ad URL: ' + JSON.stringify(lootData)
      });
    }

    return res.status(200).json({
      success: true,
      adUrl: adUrl
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create LootLabs link: ' + err.message
    });
  }
};
