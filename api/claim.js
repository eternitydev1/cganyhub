const crypto = require('crypto');
const https = require('https');
const { saveKeyRecord } = require('./verify');
const SECRET = process.env.KEY_SECRET || 'HajraToroczkai719Laszlo99IstenVAGY';
const EXPIRATION_HOURS = 8;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';
function safeRedirect(res, url) {
  try {
    res.setHeader('Location', url);
    res.statusCode = 302;
    res.end();
  } catch (err) {
    if (typeof res.redirect === 'function') {
      res.redirect(url);
    } else {
      res.writeHead(302, { Location: url });
      res.end();
    }
  }
}
// Send Real-Time Notification to Owner Discord
function notifyDiscord(keyData) {
  if (!DISCORD_WEBHOOK_URL || !DISCORD_WEBHOOK_URL.startsWith('http')) return;
  try {
    const payload = JSON.stringify({
      embeds: [{
        title: "🔑 New LootLabs Key Generated",
        color: 0xff1e27,
        fields: [
          { name: "Key Token", value: `\`\`\`${keyData.key}\`\`\``, inline: false },
          { name: "Duration", value: "8 Hours", inline: true },
          { name: "Created At", value: `<t:${Math.floor(keyData.createdAt / 1000)}:R>`, inline: true },
          { name: "Source", value: "LootLabs Checkpoint (2/2)", inline: true }
        ],
        footer: { text: "CiganyHub Live Tracking" },
        timestamp: new Date().toISOString()
