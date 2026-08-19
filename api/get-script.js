const { verifyToken } = require('./verify');

// Import secured game scripts (no longer on Jnkie or raw GitHub)
const SpeedKeyboardScript = require('./games/speed_keyboard');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, User-Agent, X-Hub-Key, X-Place-Id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const userAgent = req.headers['user-agent'] || '';
  const key = req.query.key || req.headers['x-hub-key'];
  const placeId = req.query.placeId || req.headers['x-place-id'] || req.query.gameId;
  const gameName = (req.query.game || '').toLowerCase();

  // 1. Anti-Bot / Anti-Scraper Protection
  const uaLower = userAgent.toLowerCase();
  if (
    uaLower.includes('discordbot') || 
    uaLower.includes('curl') || 
    uaLower.includes('python-requests') || 
    uaLower.includes('aiohttp') ||
    uaLower.includes('wget') ||
    uaLower.includes('postman')
  ) {
    return res.status(403).send('-- [403 Forbidden] Automated bots are prohibited.');
  }

  // 2. Require Valid Key
  if (!key) {
    return res.status(401).send('-- [401 Unauthorized] Missing key parameter.');
  }

  const verifyResult = verifyToken(key);
  if (!verifyResult.valid) {
    return res.status(403).send(`-- [403 Forbidden] ${verifyResult.message || 'Invalid or expired key.'}`);
  }

  // 3. Return target game script directly from secure server
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');

  // Speed Keyboard Escape (PlaceId: 95082159892680 or game=keyboard)
  if (placeId === '95082159892680' || gameName === 'keyboard' || gameName === 'speed_keyboard' || !placeId) {
    return res.status(200).send(SpeedKeyboardScript);
  }

  return res.status(200).send(SpeedKeyboardScript);
};
