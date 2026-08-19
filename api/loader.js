const fs = require('fs');
const path = require('path');

const keyGuiCode = fs.readFileSync(path.join(__dirname, '../KeyGUI.lua'), 'utf8');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).send(keyGuiCode);
};
