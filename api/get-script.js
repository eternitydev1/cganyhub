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

// Stream RC4 Symmetric Cipher for dynamic payload stream encryption
function rc4Encrypt(keyStr, str) {
  const s = [];
  for (let i = 0; i < 256; i++) s[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + keyStr.charCodeAt(i % keyStr.length)) % 256;
    const temp = s[i];
    s[i] = s[j];
    s[j] = temp;
  }
  let i = 0;
  j = 0;
  const res = [];
  for (let y = 0; y < str.length; y++) {
    i = (i + 1) % 256;
    j = (j + s[i]) % 256;
    const temp = s[i];
    s[i] = s[j];
    s[j] = temp;
    const k = s[(s[i] + s[j]) % 256];
    res.push(str.charCodeAt(y) ^ k);
  }
  return Buffer.from(res).toString('base64');
}

module.exports = async (req, res) => {
  // CORS & Security Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, User-Agent, X-Hub-Key, X-HWID, X-Nonce, X-Timestamp, X-Client-Ver, X-Game-Id, X-Game-Name');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Anti-Bot / Anti-Web-Scraper Protection
  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  const isRoblox = userAgent.includes('roblox') || userAgent.includes('synx') || userAgent.includes('executor') || userAgent.includes('fluxus') || userAgent.includes('delta') || userAgent.includes('solara') || userAgent.includes('wave') || userAgent.includes('xeno') || userAgent.includes('krnl') || userAgent.includes('electron') || userAgent.includes('hydrogen') || userAgent.includes('arceus');
  const isBrowserOrBot = userAgent.includes('mozilla') || userAgent.includes('chrome') || userAgent.includes('curl') || userAgent.includes('wget') || userAgent.includes('python') || userAgent.includes('discordbot') || userAgent.includes('telegrambot') || userAgent.includes('http-spy');

  if (!isRoblox && isBrowserOrBot) {
    return res.status(403).send('-- [CiganyHub Security] Execution blocked. Direct browser access prohibited.');
  }

  // 2. Validate Key and Hardware ID
  const key = req.headers['x-hub-key'] || req.query.key || (req.body && req.body.key);
  const hwid = req.headers['x-hwid'] || req.query.hwid || (req.body && req.body.hwid);

  if (!key) {
    return res.status(401).send('-- [CiganyHub] Error: Missing key token. Please get a key at https://cganyhub.vercel.app');
  }

  const verification = await verifyToken(key, hwid);

  if (!verification.valid) {
    if (verification.reason === 'EXPIRED') {
      return res.status(403).send('-- [CiganyHub] Error: Key has expired! Please visit https://cganyhub.vercel.app to get a new 8-hour key.');
    }
    if (verification.reason === 'HWID_MISMATCH') {
      return res.status(403).send('-- [CiganyHub] Error: Key is locked to a different Hardware ID (HWID). Share-lock protection active.');
    }
    if (verification.reason === 'REVOKED' || verification.reason === 'NUKED') {
      return res.status(403).send('-- [CiganyHub] Error: Key has been revoked or banned by administration.');
    }
    return res.status(403).send(`-- [CiganyHub] Error: ${verification.message || 'Invalid or malformed key token.'}`);
  }

  // 3. Prevent Replay Attacks via Nonce Check
  const nonce = req.headers['x-nonce'];
  const timestamp = parseInt(req.headers['x-timestamp'], 10);
  const now = Date.now();

  if (nonce && timestamp) {
    if (Math.abs(now - timestamp) > 90000) {
      return res.status(403).send('-- [CiganyHub Security] Request timestamp out of sync (expired replay window).');
    }
    if (usedNonces.has(nonce)) {
      return res.status(403).send('-- [CiganyHub Security] Replay attack detected. Nonce already consumed.');
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

  // 5. Dynamic Symmetric Session Encryption (Protects Lua code in transit against HttpSpy & sniffers)
  const sessionSalt = crypto.randomBytes(8).toString('hex');
  const sessionKey = crypto.createHash('sha256').update(SECRET + sessionSalt + (hwid || '')).digest('hex');
  const encryptedPayload = rc4Encrypt(sessionKey, selectedScript);

  // In-memory runtime decryptor stub executed by the Roblox client
  const decryptorBootstrap = `
-- [CIGANYHUB PROTECTED IN-MEMORY RUNTIME]
local _k = "${sessionKey}"
local _s = "${sessionSalt}"
local _raw = "${encryptedPayload}"

local function _rc4(keyStr, dataStr)
    local bit = bit or bit32
    local b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    local b64lookup = {}
    for i = 1, #b64chars do
        b64lookup[b64chars:sub(i, i)] = i - 1
    end

    local function b64decode(input)
        input = string.gsub(input, '[^' .. b64chars .. '=]', '')
        local output = {}
        local length = #input
        for i = 1, length, 4 do
            local a = b64lookup[input:sub(i, i)] or 0
            local b = b64lookup[input:sub(i+1, i+1)] or 0
            local c = b64lookup[input:sub(i+2, i+2)] or 0
            local d = b64lookup[input:sub(i+3, i+3)] or 0
            local b1 = bit.bor(bit.lshift(a, 2), bit.rshift(b, 4))
            table.insert(output, string.char(b1))
            if input:sub(i+2, i+2) ~= '=' then
                local b2 = bit.bor(bit.lshift(bit.band(b, 15), 4), bit.rshift(c, 2))
                table.insert(output, string.char(b2))
            end
            if input:sub(i+3, i+3) ~= '=' then
                local b3 = bit.bor(bit.lshift(bit.band(c, 3), 6), d)
                table.insert(output, string.char(b3))
            end
        end
        return table.concat(output)
    end

    local cipher = b64decode(dataStr)
    local s = {}
    for i = 0, 255 do s[i] = i end
    local j = 0
    for i = 0, 255 do
        j = (j + s[i] + string.byte(keyStr, (i % #keyStr) + 1)) % 256
        s[i], s[j] = s[j], s[i]
    end
    local i, j2 = 0, 0
    local res = {}
    for y = 1, #cipher do
        i = (i + 1) % 256
        j2 = (j2 + s[i]) % 256
        s[i], s[j2] = s[j2], s[i]
        local k = s[(s[i] + s[j2]) % 256]
        local byte = bit.bxor(string.byte(cipher, y), k)
        table.insert(res, string.char(byte))
    end
    return table.concat(res)
end

local decryptedCode = _rc4(_k, _raw)
local scriptFunc, compileErr = loadstring(decryptedCode)
if scriptFunc then
    scriptFunc()
else
    warn("[CiganyHub Protected Bootstrap Error] " .. tostring(compileErr))
end
`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.status(200).send(decryptorBootstrap.trim());
};
