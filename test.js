const gen = require('./api/generate.js');
const ver = require('./api/verify.js');
const getScript = require('./api/get-script.js');

console.log("--- 1. Testing Key Generation ---");
let generatedKey = "";
const mockResGen = {
  setHeader: () => {},
  status: (code) => ({
    json: (data) => {
      console.log(`[Status ${code}] Key generated successfully:`, data);
      generatedKey = data.key;
    }
  })
};
gen({ method: 'POST' }, mockResGen);

console.log("\n--- 2. Testing Key Verification ---");
const mockResVer = {
  setHeader: () => {},
  status: (code) => ({
    json: (data) => {
      console.log(`[Status ${code}] Verification result:`, data);
    }
  })
};
ver({ method: 'GET', query: { key: generatedKey } }, mockResVer);

console.log("\n--- 3. Testing Protected Script Access with Key ---");
const mockResScript = {
  setHeader: () => {},
  status: (code) => ({
    send: (body) => {
      console.log(`[Status ${code}] Script payload response (first 100 chars):`, body.substring(0, 100) + "...");
    }
  })
};
getScript({ method: 'GET', query: { key: generatedKey }, headers: { 'user-agent': 'RobloxClient' } }, mockResScript);

console.log("\n--- 4. Testing Bot Blocking ---");
getScript({ method: 'GET', query: { key: generatedKey }, headers: { 'user-agent': 'DiscordBot (compatible)' } }, mockResScript);
