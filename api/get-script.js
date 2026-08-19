const { verifyToken } = require('./verify');

// Import secured obfuscated game script
const SpeedKeyboardScript = require('./games/speed_keyboard');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, User-Agent, X-Hub-Key, X-Place-Id, X-HWID, X-Client-Ver');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  
  // 1. Anti-Browser & Anti-Bot Protection (Blocks Chrome, Firefox, Safari, Edge, Discord bots, curl, scrapers)
  const isBrowser = (
    userAgent.includes('mozilla') ||
    userAgent.includes('chrome') ||
    userAgent.includes('safari') ||
    userAgent.includes('firefox') ||
    userAgent.includes('edge')
  ) && !userAgent.includes('roblox');

  const isScraper = (
    userAgent.includes('discordbot') || 
    userAgent.includes('curl') || 
    userAgent.includes('python') || 
    userAgent.includes('aiohttp') ||
    userAgent.includes('wget') ||
    userAgent.includes('postman') ||
    userAgent.includes('insomnia')
  );

  if (isBrowser || isScraper) {
    return res.status(403).send('-- [403 Forbidden] Direct browser access and automated scraping are strictly prohibited.');
  }

  // Parse parameters from body or query
  let key = req.headers['x-hub-key'];
  let hwid = req.headers['x-hwid'];

  if (req.body && typeof req.body === 'object') {
    key = key || req.body.key;
    hwid = hwid || req.body.hwid;
  } else if (req.body && typeof req.body === 'string') {
    try {
      const parsed = JSON.parse(req.body);
      key = key || parsed.key;
      hwid = hwid || parsed.hwid;
    } catch(e) {}
  }

  key = key || req.query.key;
  hwid = hwid || req.query.hwid;

  // 2. Require Valid Key
  if (!key) {
    return res.status(401).send('-- [401 Unauthorized] Missing key parameter.');
  }

  const verifyResult = verifyToken(key, hwid);
  if (!verifyResult.valid) {
    return res.status(403).send(`-- [403 Forbidden] ${verifyResult.message || 'Invalid or expired key.'}`);
  }

  // 3. Return target game script directly from secure server
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.status(200).send(SpeedKeyboardScript);
};
