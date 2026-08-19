const crypto = require('crypto');
const { blacklistKey, unblacklistKey, isKeyBlacklisted, setNukeTimestamp, getNukeTimestamp, saveKey, getAllKeys, hashToken } = require('./storage');

const SECRET = process.env.KEY_SECRET || 'HajraToroczkai719Laszlo99IstenVAGY';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Fasszoporomangutanok265hitlerfasza99';

function hashHwid(rawHwid) {
  if (!rawHwid) return null;
  return crypto.createHash('sha256').update(String(rawHwid).trim()).digest('hex').substring(0, 16);
}

function decodeKeyInfo(token, nukeTime = 0) {
  try {
    if (!token || !token.startsWith('KEY_')) return null;
    const parts = token.slice(4).split('.');
    if (parts.length !== 2) return null;
    const jsonStr = Buffer.from(parts[0], 'base64url').toString('utf8');
    const payload = JSON.parse(jsonStr);

    const now = Date.now();
    const isLifetime = payload.isLifetime === true;
    const expired = !isLifetime && now > payload.exp;
    const nuked = nukeTime > 0 && payload.iat && payload.iat <= nukeTime;

    let dur = payload.durationLabel || '8 Hours';
    if (!payload.durationLabel && payload.exp && payload.iat) {
      const h = Math.round((payload.exp - payload.iat) / (3600 * 1000));
      dur = `${h} Hours`;
    }

    return {
      key: token,
      note: payload.note || (payload.adminGen ? 'Owner Minted' : 'LootLabs Key'),
      source: payload.adminGen ? 'Admin Minted' : 'LootLabs Gateway',
      isLifetime: isLifetime,
      durationLabel: isLifetime ? 'Lifetime' : dur,
      createdAt: payload.iat || now,
      formattedCreated: new Date(payload.iat || now).toLocaleString(),
      expiresAt: payload.exp,
      formattedExpires: isLifetime ? 'Never (Lifetime)' : new Date(payload.exp).toLocaleString(),
      boundHwid: payload.hwid ? payload.hwid : 'Unbound (Auto-locks on first device)',
      revoked: nuked,
      expired: expired,
      status: nuked ? 'revoked' : (expired ? 'expired' : 'active')
    };
  } catch (e) {
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
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

    const action = (req.query && req.query.action) || (req.body && req.body.action) || 'list-keys';

    // ══════════════════════════════════════════════════════
    // ACTION: GENERATE CUSTOM KEYS (Any Hours / Days / Lifetime)
    // ══════════════════════════════════════════════════════
    if (action === 'generate') {
      let customValue = parseFloat((req.query && req.query.customValue) || (req.body && req.body.customValue) || 0);
      const customUnit = ((req.query && req.query.customUnit) || (req.body && req.body.customUnit) || 'hours').toLowerCase();
      let hours = parseFloat((req.query && req.query.hours) || (req.body && req.body.hours) || 0);
      const isLifetime = (req.query && req.query.lifetime === 'true') || (req.body && req.body.lifetime === true);
      const targetHwid = (req.query && req.query.hwid) || (req.body && req.body.hwid) || null;
      const note = (req.query && req.query.note) || (req.body && req.body.note) || 'Owner Generated Key';

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
        source: 'Admin Minted',
        isLifetime: isLifetime,
        durationLabel: durationLabel,
        createdAt: now,
        formattedCreated: new Date(now).toLocaleString(),
        expiresAt: expiresAt,
        formattedExpires: isLifetime ? 'Never (Lifetime)' : new Date(expiresAt).toLocaleString(),
        boundHwid: targetHwid ? targetHwid : 'Unbound (Auto-locks on first device)',
        revoked: false,
        expired: false,
        status: 'active'
      };

      await saveKey(keyRecord);

      return res.status(200).json({
        success: true,
        action: 'generate',
        record: keyRecord,
        key: generatedKey
      });
    }

    // ══════════════════════════════════════════════════════
    // ACTION: LIST ALL KEYS (Admin + LootLabs Keys)
    // ══════════════════════════════════════════════════════
    if (action === 'list-keys' || action === 'dashboard') {
      const allRecords = await getAllKeys();
      const nukeTime = await getNukeTimestamp();
      const now = Date.now();
      const keys = [];

      for (const item of allRecords) {
        const isRevoked = await isKeyBlacklisted(item.key);
        const nuked = nukeTime > 0 && item.createdAt && item.createdAt <= nukeTime;
        const expired = !item.isLifetime && now > item.expiresAt;
        let status = 'active';
        if (isRevoked || nuked) status = 'revoked';
        else if (expired) status = 'expired';

        keys.push({
          ...item,
          revoked: !!isRevoked || nuked,
          expired: expired,
          status: status
        });
      }

      keys.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      return res.status(200).json({
        success: true,
        action: 'list-keys',
        total: keys.length,
        nukeTimestamp: nukeTime,
        keys: keys
      });
    }

    // ══════════════════════════════════════════════════════
    // ACTION: SYNC CLIENT SAVED KEYS
    // ══════════════════════════════════════════════════════
    if (action === 'sync-keys') {
      const clientKeys = (req.body && req.body.keys) || [];
      for (const item of clientKeys) {
        if (item && item.key) {
          await saveKey(item);
        }
      }
      return res.status(200).json({ success: true });
    }

    // ══════════════════════════════════════════════════════
    // ACTION: IMPORT ANY KEY STRING
    // ══════════════════════════════════════════════════════
    if (action === 'import-key') {
      const keyStr = (req.query && req.query.key) || (req.body && req.body.key);
      if (!keyStr) {
        return res.status(400).json({ success: false, message: 'Missing key string to import.' });
      }

      const nukeTime = await getNukeTimestamp();
      const decoded = decodeKeyInfo(keyStr, nukeTime);
      if (!decoded) {
        return res.status(400).json({ success: false, message: 'Invalid or malformed key.' });
      }

      await saveKey(decoded);

      return res.status(200).json({
        success: true,
        action: 'import-key',
        record: decoded,
        message: 'Key successfully imported and verified!'
      });
    }

    // ══════════════════════════════════════════════════════
    // ACTION: REVOKE / DELETE SINGLE KEY
    // ══════════════════════════════════════════════════════
    if (action === 'revoke' || action === 'delete') {
      const targetKey = (req.query && req.query.key) || (req.body && req.body.key);
      const reason = (req.query && req.query.reason) || (req.body && req.body.reason) || 'Revoked by owner';

      if (!targetKey) {
        return res.status(400).json({ success: false, message: 'Missing target key to revoke.' });
      }

      await blacklistKey(targetKey, reason);

      return res.status(200).json({
        success: true,
        action: 'revoke',
        message: 'Key successfully revoked and blacklisted globally.',
        revokedKey: targetKey
      });
    }

    // ══════════════════════════════════════════════════════
    // ACTION: UNREVOKE KEY
    // ══════════════════════════════════════════════════════
    if (action === 'unrevoke') {
      const targetKey = (req.query && req.query.key) || (req.body && req.body.key);
      if (!targetKey) {
        return res.status(400).json({ success: false, message: 'Missing target key to unrevoke.' });
      }

      await unblacklistKey(targetKey);

      return res.status(200).json({
        success: true,
        action: 'unrevoke',
        message: 'Key un-revoked successfully.'
      });
    }

    // ══════════════════════════════════════════════════════
    // ACTION: NUKE / DELETE ALL EXISTING KEYS
    // ══════════════════════════════════════════════════════
    if (action === 'nuke-all' || action === 'delete-all') {
      const now = Date.now();
      await setNukeTimestamp(now);

      return res.status(200).json({
        success: true,
        action: 'nuke-all',
        nukeTimestamp: now,
        message: 'Successfully nuked and invalidated ALL existing keys globally!'
      });
    }

    return res.status(400).json({ success: false, message: 'Unknown admin action.' });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Admin error: ' + err.message
    });
  }
};
