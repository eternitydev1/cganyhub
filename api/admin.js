const crypto = require('crypto');
const { verifyToken, isRevoked, revokeKey, unrevokeKey, getRevokedList } = require('./verify');

const SECRET = process.env.KEY_SECRET || 'CIGANYHUB_SECURE_SECRET_CHANGE_ME_987654321';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ciganyhub_admin_2026_supersecret';

// In-Memory Key Registry for Admin Dashboard Tracking
const registeredKeys = new Map();

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
    // ACTION: GENERATE CUSTOM KEYS (Any Hours / Days / Lifetime)
    // ══════════════════════════════════════════════════════
    if (action === 'generate') {
      let customValue = parseFloat(req.query.customValue || (req.body && req.body.customValue) || 0);
      const customUnit = (req.query.customUnit || (req.body && req.body.customUnit) || 'hours').toLowerCase();
      let hours = parseFloat(req.query.hours || (req.body && req.body.hours) || 0);
      const isLifetime = req.query.lifetime === 'true' || (req.body && req.body.lifetime === true);
      const targetHwid = req.query.hwid || (req.body && req.body.hwid) || null;
      const note = req.query.note || (req.body && req.body.note) || 'Owner Generated Key';

      // Calculate total hours based on unit
      if (customValue > 0) {
        if (customUnit === 'minutes') hours = customValue / 60;
        else if (customUnit === 'hours') hours = customValue;
        else if (customUnit === 'days') hours = customValue * 24;
        else if (customUnit === 'months') hours = customValue * 24 * 30;
        else if (customUnit === 'years') hours = customValue * 24 * 365;
      }

      if (!isLifetime && (!hours || hours <= 0)) {
        hours = 8;
      }

      const now = Date.now();
      let expiresAt = null;
      let durationLabel = `${hours} Hours`;

      if (isLifetime) {
        expiresAt = now + (100 * 365 * 24 * 60 * 60 * 1000);
        durationLabel = 'Lifetime (100 Years)';
      } else {
        expiresAt = now + Math.floor(hours * 60 * 60 * 1000);
        if (hours >= 8760) durationLabel = `${(hours / 8760).toFixed(1)} Year(s)`;
        else if (hours >= 720) durationLabel = `${(hours / 720).toFixed(1)} Month(s)`;
        else if (hours >= 24) durationLabel = `${(hours / 24).toFixed(1)} Day(s)`;
        else durationLabel = `${hours} Hour(s)`;
      }

      const keyPayload = {
        v: 1,
        iat: now,
        exp: expiresAt,
        isLifetime: isLifetime,
        adminGen: true,
        note: note,
        durationLabel: durationLabel,
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

      const keyRecord = {
        key: generatedKey,
        note: note,
        isLifetime: isLifetime,
        durationLabel: durationLabel,
        createdAt: now,
        formattedCreated: new Date(now).toLocaleString(),
        expiresAt: expiresAt,
        formattedExpires: isLifetime ? 'Never (Lifetime)' : new Date(expiresAt).toLocaleString(),
        boundHwid: targetHwid ? targetHwid : 'Unbound (Auto-locks on first device)',
        revoked: false
      };

      registeredKeys.set(generatedKey, keyRecord);

      return res.status(200).json({
        success: true,
        action: 'generate',
        record: keyRecord,
        key: generatedKey
      });
    }

    // ══════════════════════════════════════════════════════
    // ACTION: LIST ALL GENERATED KEYS
    // ══════════════════════════════════════════════════════
    if (action === 'list-keys' || action === 'dashboard') {
      const allKeys = [];
      const now = Date.now();

      for (const [k, record] of registeredKeys.entries()) {
        const revoked = isRevoked(k);
        const expired = !record.isLifetime && now > record.expiresAt;
        let status = 'active';
        if (revoked) status = 'revoked';
        else if (expired) status = 'expired';

        allKeys.push({
          ...record,
          revoked: revoked,
          expired: expired,
          status: status
        });
      }

      // Sort newest first
      allKeys.sort((a, b) => b.createdAt - a.createdAt);

      return res.status(200).json({
        success: true,
        action: 'list-keys',
        total: allKeys.length,
        keys: allKeys
      });
    }

    // ══════════════════════════════════════════════════════
    // ACTION: REGISTER / SYNC CLIENT-SIDE SAVED KEYS
    // ══════════════════════════════════════════════════════
    if (action === 'sync-keys') {
      const clientKeys = (req.body && req.body.keys) || [];
      for (const item of clientKeys) {
        if (item && item.key && !registeredKeys.has(item.key)) {
          registeredKeys.set(item.key, item);
        }
      }
      return res.status(200).json({ success: true, count: registeredKeys.size });
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

      revokeKey(targetKey, reason);

      if (registeredKeys.has(targetKey)) {
        const item = registeredKeys.get(targetKey);
        item.revoked = true;
        registeredKeys.set(targetKey, item);
      }

      return res.status(200).json({
        success: true,
        action: 'revoke',
        message: 'Key successfully revoked and deleted.',
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

      if (registeredKeys.has(targetKey)) {
        const item = registeredKeys.get(targetKey);
        item.revoked = false;
        registeredKeys.set(targetKey, item);
      }

      return res.status(200).json({
        success: true,
        action: 'unrevoke',
        message: 'Key un-revoked successfully.'
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
