const crypto = require('crypto');
const { verifyToken, checkIsRevoked } = require('./verify');
const SpeedKeyboardScript = require('./games/speed_keyboard');

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

// RC4 Stream Cipher for Payload Obfuscation over the wire
function rc4Encrypt(keyStr, text) {
  const s = [];
  for (let i = 0; i < 256; i++) s[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + keyStr.charCodeAt(i % keyStr.length)) % 256;
    [s[i], s[j]] = [s[j], s[i]];
  }
  let i = 0;
  j = 0;
  const res = [];
  for (let y = 0; y < text.length; y++) {
    i = (i + 1) % 256;
    j = (j + s[i]) % 256;
    [s[i], s[j]] = [s[j], s[i]];
    const k = s[(s[i] + s[j]) % 256];
    res.push(String.fromCharCode(text.charCodeAt(y) ^ k));
  }
  return Buffer.from(res.join(''), 'binary').toString('base64');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, User-Agent, X-Hub-Key, X-HWID, X-Nonce, X-Timestamp, X-Auth-Sig');

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

  // 2. Validate Key
  if (!key) {
    return res.status(401).send('-- [401 Unauthorized] Missing key parameter.');
  }

  // Check if key is revoked/blacklisted
  const revokedData = await checkIsRevoked(key);
  if (revokedData) {
    return res.status(403).send(`-- [403 Forbidden] This key has been deleted/revoked by the administrator (${revokedData.reason || 'Revoked'}).`);
  }

  const verifyResult = verifyToken(key, hwid);
  if (!verifyResult.valid) {
    return res.status(403).send(`-- [403 Forbidden] ${verifyResult.message || 'Invalid key.'}`);
  }

  // 3. Anti-Replay Nonce Check (Prevents HttpSpy link copying / reuse)
  if (nonce) {
    const now = Date.now();
    // Nonce must be recent (< 30 seconds old)
    if (timestamp && Math.abs(now - timestamp) > 30000) {
      return res.status(403).send('-- [403 Forbidden] Handshake expired. Please request a fresh session.');
    }

    if (usedNonces.has(nonce)) {
      return res.status(403).send('-- [403 Forbidden] Nonce already consumed. Replay detected.');
    }
    usedNonces.set(nonce, now);
  }

  // 4. Encrypt Payload so HttpSpy only sees scrambled ciphertext
  const sessionKey = crypto.createHash('sha256').update(String(key) + String(hwid) + (nonce || 'def')).digest('hex');
  const encryptedPayload = rc4Encrypt(sessionKey, SpeedKeyboardScript);

  // Return decryptor bootstrap stub
  const decryptorBootstrap = `--[=[ CIGANYHUB PROTECTED IN-MEMORY RUNTIME ]=]
local _K = "${sessionKey}"
local _P = "${encryptedPayload}"

local function _D(k, enc)
    local b64 = enc
    local b='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    local function b64d(data)
        data = string.gsub(data, '[^'..b..'=]', '')
        return (data:gsub('..', function(cc)
            local function d(c) return (b:find(c, 1, true) or 1) - 1 end
            local b1, b2 = d(cc:sub(1,1)), d(cc:sub(2,2))
            return string.char(bit32.bor(bit32.lshift(b1, 2), bit32.rshift(b2, 4)))
        end))
    end
    
    local raw = (syn and syn.crypt and syn.crypt.base64 and syn.crypt.base64.decode and syn.crypt.base64.decode(b64))
        or (crypt and crypt.base64 and crypt.base64.decode and crypt.base64.decode(b64))
        or (crypt and crypt.base64decode and crypt.base64decode(b64))
        or (base64_decode and base64_decode(b64))
        or b64d(b64)
        
    local s = {}
    for i = 0, 255 do s[i] = i end
    local j = 0
    for i = 0, 255 do
        j = (j + s[i] + string.byte(k, (i % #k) + 1)) % 256
        s[i], s[j] = s[j], s[i]
    end
    local i, j = 0, 0
    local out = {}
    for y = 1, #raw do
        i = (i + 1) % 256
        j = (j + s[i]) % 256
        s[i], s[j] = s[j], s[i]
        local keyByte = s[(s[i] + s[j]) % 256]
        out[y] = string.char(bit32.bxor(string.byte(raw, y), keyByte))
    end
    return table.concat(out)
end

local _DEC = _D(_K, _P)
local _FN, _ERR = loadstring(_DEC)
if _FN then
    _FN()
else
    warn("[CiganyHub Runtime Error] " .. tostring(_ERR))
end
`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.status(200).send(decryptorBootstrap);
};
