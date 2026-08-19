const { verifyToken } = require('./verify');

const RAW_LOADER_CODE = `-- CiganyHUB Protected Loader
local Games = {
    [73504898027860] = "https://api.jnkie.com/api/v1/luascripts/public/0e045edf83c65b67d9a950a1bd43d9f8a3f9b3a6b1410778b343b119d1f168c7/download",
    [97598239454123] = "https://api.jnkie.com/api/v1/luascripts/public/0e045edf83c65b67d9a950a1bd43d9f8a3f9b3a6b1410778b343b119d1f168c7/download",
    [10200395747] = "https://api.jnkie.com/api/v1/luascripts/public/0e045edf83c65b67d9a950a1bd43d9f8a3f9b3a6b1410778b343b119d1f168c7/download",
    [95082159892680] = "https://api.jnkie.com/api/v1/luascripts/public/adafc581f903ddfc9b4dac904fefa064ac46dca3dff1a715fa422f2c6b46ac1a/download",
    [2753915549] = "https://api.jnkie.com/api/v1/luascripts/public/e2a5950b80692182d602f67aea8ff7c901261ceb418a260cd5623a1745ad9521/download",
    [4442272183] = "https://api.jnkie.com/api/v1/luascripts/public/e2a5950b80692182d602f67aea8ff7c901261ceb418a260cd5623a1745ad9521/download",
    [7449423635] = "https://api.jnkie.com/api/v1/luascripts/public/e2a5950b80692182d602f67aea8ff7c901261ceb418a260cd5623a1745ad9521/download",
    [142823291] = "https://raw.githubusercontent.com/eternitydev1/ciganyhub/refs/heads/main/mm2",
    [13772392152] = "https://raw.githubusercontent.com/razerrey/CiganyHUB1/refs/heads/main/lua",
    [14732610542] = "https://raw.githubusercontent.com/razerrey/CiganyHUB1/refs/heads/main/lua",
    [15131053470] = "https://raw.githubusercontent.com/razerrey/CiganyHUB1/refs/heads/main/lua",
}

local url = Games[game.PlaceId] or Games[game.GameId]
if url then
    loadstring(game:HttpGet(url))()
else
    warn("[CiganyHUB] Unsupported game! PlaceId: " .. tostring(game.PlaceId))
end
`;

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, User-Agent, X-Hub-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const userAgent = req.headers['user-agent'] || '';
  const key = req.query.key;

  if (userAgent.toLowerCase().includes('discordbot') || userAgent.toLowerCase().includes('curl')) {
    return res.status(403).send('-- [403 Forbidden] Automated bots are not allowed.');
  }

  if (!key) {
    return res.status(401).send('-- [401 Unauthorized] Missing key.');
  }

  const result = verifyToken(key);
  if (!result.valid) {
    return res.status(403).send(`-- [403 Forbidden] Invalid or expired key.`);
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.status(200).send(RAW_LOADER_CODE);
};
