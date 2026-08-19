const crypto = require('crypto');
const { verifyToken, isRevoked, revokeKey, unrevokeKey, getRevokedList } = require('./verify');

const SECRET = process.env.KEY_SECRET || 'CIGANYHUB_SECURE_SECRET_CHANGE_ME_987654321';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ciganyhub_admin_2026_supersecret';

function hashHwid(rawHwid) {
  if (!rawHwid) return null;
  return crypto.createHash('sha256').update(String(rawHwid).trim()).digest('hex').substring(0, 16);
}

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Authenticate Owner
  const headers = req.headers || {};
  const providedPassword = (
    headers['x-admin-password'] ||
    (req.query && req.query.password) ||
    (req.body && req.body.password) ||
    ''
  ).trim();

  if (!providedPassword || providedPassword !== ADMIN_PASSWORD) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized: Invalid or missing admin password.'
    });
  }

  const action = req.query.action || (req.body && req.body.action) || 'generate';

  try {
    // ══════════════════════════════════════════════════════
    // ACTION: GENERATE CUSTOM KEYS (1h, 10h, 365d, Lifetime)
    // ══════════════════════════════════════════════════════
    if (action === 'generate') {
      let hours = parseFloat(req.query.hours || (req.body && req.body.hours) || 0);
      const days = parseFloat(req.query.days || (req.body && req.body.days) || 0);
      const isLifetime = req.query.lifetime === 'true' || (req.body && req.body.lifetime === true);
      const targetHwid = req.query.hwid || (req.body && req.body.hwid) || null;
      const note = req.query.note || (req.body && req.body.note) || 'Owner Generated Key';

      if (days > 0) {
        hours = days * 24;
      }

      if (!isLifetime && (!hours || hours <= 0)) {
        hours = 8;
      }

      const now = Date.now();
      let expiresAt = null;

      if (isLifetime) {
        // 100 years
        expiresAt = now + (100 * 365 * 24 * 60 * 60 * 1000);
      } else {
        expiresAt = now + Math.floor(hours * 60 * 60 * 1000);
      }

      const keyPayload = {
        v: 1,
        iat: now,
        exp: expiresAt,
        isLifetime: isLifetime,
        adminGen: true,
        note: note,
        nonce: crypto.randomBytes(6).toString('hex')
      };

      if (targetHwid) {
        keyPayload.hwid = hashHwid(targetHwid);
      }

      const keyPayloadB64 = Buffer.from(JSON.stringify(keyPayload)).toString('base64url');
      const keyHmac = crypto.createHmac('sha256', SECRET);
      keyHmac.update(keyPayloadB64);
      const keySig = keyHmac.digest('base64url');

      const generatedKey = `KEY_${keyPayloadB64}.${keySig}`;

      return res.status(200).json({
        success: true,
        action: 'generate',
        key: generatedKey,
        isLifetime: isLifetime,
        durationHours: isLifetime ? 'Lifetime (100 Years)' : hours,
        createdAt: now,
        expiresAt: expiresAt,
        formattedExpires: isLifetime ? 'Never (Lifetime)' : new Date(expiresAt).toUTCString(),
        boundHwid: targetHwid ? targetHwid : 'Unbound (Locks to first device)'
      });
    }

    // ══════════════════════════════════════════════════════
    // ACTION: REVOKE / DELETE KEY
    // ══════════════════════════════════════════════════════
    if (action === 'revoke' || action === 'delete') {
      const targetKey = req.query.key || (req.body && req.body.key);
      const reason = req.query.reason || (req.body && req.body.reason) || 'Revoked by owner';

      if (!targetKey) {
        return res.status(400).json({ success: false, message: 'Missing target key to revoke.' });
      }

      const result = revokeKey(targetKey, reason);
      return res.status(200).json({
        success: true,
        action: 'revoke',
        message: 'Key successfully revoked and blacklisted.',
        revokedKey: targetKey,
        reason: reason
      });
    }

    // ══════════════════════════════════════════════════════
    // ACTION: UNREVOKE KEY
    // ══════════════════════════════════════════════════════
    if (action === 'unrevoke') {
      const targetKey = req.query.key || (req.body && req.body.key);
      if (!targetKey) {
        return res.status(400).json({ success: false, message: 'Missing target key to unrevoke.' });
      }
      unrevokeKey(targetKey);
      return res.status(200).json({
        success: true,
        action: 'unrevoke',
        message: 'Key un-revoked successfully.'
      });
    }

    // ══════════════════════════════════════════════════════
    // ACTION: LIST REVOKED KEYS
    // ══════════════════════════════════════════════════════
    if (action === 'list-revoked') {
      return res.status(200).json({
        success: true,
        action: 'list-revoked',
        revokedKeys: getRevokedList()
      });
    }

    return res.status(400).json({ success: false, message: 'Unknown admin action.' });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Admin operation failed: ' + err.message
    });
  }
};
