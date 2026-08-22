const crypto = require('crypto');
const { verifyToken } = require('./verify');
const SpeedKeyboardScript = require('../games/speed_keyboard');
const GAG2Script = require('../games/gag2');
const MM2Script = require('../games/mm2');
const BloxFruitsScript = require('../games/bloxfruits');
const BladeBallScript = require('../games/bladeball');
const { blacklistKey, isKeyBlacklisted, getNukeTimestamp } = require('../lib/storage');

const SECRET = process.env.KEY_SECRET || 'HajraToroczkai719Laszlo99IstenVAGY';

// In-memory Nonce Cache to prevent Replay Attacks (consumed nonces cannot be re-used)
const usedNonces = new Map();

// Periodic cleanup of expired nonces (older than 60s)
setInterval(() => {
  const now = Date.now();
  for (const [nonce, timestamp] of usedNonces.entries()) {
    if (now - timestamp > 60000) {
      usedNonces.delete(nonce);
    }
  }
}, 30000);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, User-Agent, X-Hub-Key, X-HWID, X-Nonce, X-Timestamp, X-Auth-Sig, X-Game-Id, X-Game-Name');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  
  // 1. Strict Anti-Browser & Anti-Bot Protection
  const isBrowser = (
    userAgent.includes('mozilla') ||
    userAgent.includes('chrome') ||
    userAgent.includes('safari') ||
    userAgent.includes('firefox') ||
    userAgent.includes('edge')
  ) && !userAgent.includes('roblox');

  if (isBrowser) {
    return res.status(403).send('-- [403 Forbidden] Direct browser inspection is strictly prohibited.');
  }

  // Parse parameters
  let key = req.headers['x-hub-key'];
  let hwid = req.headers['x-hwid'];
  let nonce = req.headers['x-nonce'];
  let timestamp = parseInt(req.headers['x-timestamp'] || '0', 10);
  let authSig = req.headers['x-auth-sig'];

  if (req.body && typeof req.body === 'object') {
    key = key || req.body.key;
    hwid = hwid || req.body.hwid;
    nonce = nonce || req.body.nonce;
    timestamp = timestamp || req.body.timestamp;
    authSig = authSig || req.body.authSig;
  }

  key = key || req.query.key;
  hwid = hwid || req.query.hwid;
  nonce = nonce || req.query.nonce;
  timestamp = timestamp || parseInt(req.query.timestamp || '0', 10);
  authSig = authSig || req.query.authSig;

  // 2. Validate Key & Check Revocation Blacklist
  if (!key) {
    return res.status(401).send('-- [401 Unauthorized] Missing key parameter.');
  }

  const verifyResult = await verifyToken(key, hwid);
  if (!verifyResult.valid) {
    return res.status(403).send(`-- [403 Forbidden] ${verifyResult.message || 'Invalid key.'}`);
  }

  // 3. Anti-Replay Nonce Check (Prevents HttpSpy link copying / reuse)
  if (nonce) {
    const now = Date.now();
    if (timestamp && Math.abs(now - timestamp) > 30000) {
      return res.status(403).send('-- [403 Forbidden] Handshake expired. Please request a fresh session.');
    }

    if (usedNonces.has(nonce)) {
      return res.status(403).send('-- [403 Forbidden] Nonce already consumed. Replay detected.');
    }
    usedNonces.set(nonce, now);
  }

  // 4. Determine Target Game Script (Blade Ball vs Blox Fruits vs MM2 vs GAG2 vs Speed Keyboard)
  const requestedGame = (req.query.game || req.headers['x-game-name'] || (req.body && req.body.game) || '').toLowerCase();
  const placeIdStr = String(req.query.placeId || req.headers['x-game-id'] || (req.body && req.body.placeId) || '');

  let selectedScript = GAG2Script;

  if (
    requestedGame === 'bladeball' ||
    requestedGame === 'blade_ball' ||
    requestedGame === 'blade-ball' ||
    requestedGame.includes('blade') ||
    requestedGame.includes('ball') ||
    placeIdStr === '13772394625' ||
    placeIdStr === '14732610803' ||
    placeIdStr === '15144787463' ||
    placeIdStr === '15264892126'
  ) {
    selectedScript = BladeBallScript;
  } else if (
    requestedGame === 'bloxfruits' ||
    requestedGame === 'blox_fruits' ||
    requestedGame === 'blox-fruits' ||
    requestedGame.includes('blox') ||
    requestedGame.includes('fruit') ||
    placeIdStr === '2753915549' ||
    placeIdStr === '4442272183' ||
    placeIdStr === '7449423635'
  ) {
    selectedScript = BloxFruitsScript;
  } else if (
    requestedGame === 'mm2' ||
    requestedGame === 'murdermystery' ||
    requestedGame === 'murdermystery2' ||
    requestedGame === 'murder_mystery_2' ||
    requestedGame.includes('murder') ||
    requestedGame.includes('mystery') ||
    placeIdStr === '142823291' ||
    placeIdStr === '3351327787' ||
    placeIdStr === '66654135'
  ) {
    selectedScript = MM2Script;
  } else if (
    requestedGame === 'speed_keyboard' ||
    requestedGame === 'keyboard' ||
    requestedGame.includes('speed') ||
    requestedGame.includes('keyboard') ||
    placeIdStr === '10842831818' ||
    placeIdStr === '12519159074'
  ) {
    selectedScript = SpeedKeyboardScript;
  } else {
    selectedScript = GAG2Script;
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.status(200).send(selectedScript);
};
