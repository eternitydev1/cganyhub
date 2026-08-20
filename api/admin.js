const crypto = require('crypto');
const { blacklistKey, unblacklistKey, isKeyBlacklisted, setNukeTimestamp, getNukeTimestamp, saveKey, getAllKeys, deleteKey, clearInactiveKeys, hashToken } = require('../lib/storage');

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

    const payloadB64 = parts[0];
    const signature = parts[1];

    const hmac = crypto.createHmac('sha256', SECRET);
    hmac.update(payloadB64);
    const expectedSig = hmac.digest('base64url');
    if (signature !== expectedSig) return null;

    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);
    const now = Date.now();

    const isNuked = nukeTime > 0 && payload.iat <= nukeTime;
    const isExpired = !payload.isLifetime && (now > payload.exp);
    let status = 'active';
    if (isNuked) status = 'revoked';
    else if (isExpired) status = 'expired';

    let durationLabel = '8 Hours';
    if (payload.durationLabel) {
      durationLabel = payload.durationLabel;
    } else if (payload.isLifetime) {
      durationLabel = 'Lifetime Access';
    } else if (payload.exp && payload.iat) {
      const totalHours = Math.round((payload.exp - payload.iat) / (60 * 60 * 1000));
      if (totalHours >= 8760) durationLabel = `${Math.round(totalHours / 8760)} Year(s)`;
      else if (totalHours >= 720) durationLabel = `${Math.round(totalHours / 720)} Month(s)`;
      else if (totalHours >= 24) durationLabel = `${Math.round(totalHours / 24)} Day(s)`;
      else durationLabel = `${totalHours} Hour(s)`;
    }

    return {
      key: token,
      note: payload.note || (payload.adminGen ? 'Owner Minted Key' : 'LootLabs User Key'),
      source: payload.adminGen ? 'Admin Minted' : 'LootLabs',
      isLifetime: !!payload.isLifetime,
      durationLabel: durationLabel,
      createdAt: payload.iat,
      formattedCreated: new Date(payload.iat).toLocaleString(),
      expiresAt: payload.exp,
      formattedExpires: payload.isLifetime ? 'Never (Lifetime)' : new Date(payload.exp).toLocaleString(),
      boundHwid: payload.hwid ? 'Bound to HWID' : 'Unbound (Auto-locks on first device)',
      revoked: isNuked,
      expired: isExpired,
      status: status
    };
  } catch (err) {
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const authHeader = req.headers['x-admin-password'] || (req.body && req.body.password) || req.query.password;
  if (!authHeader || authHeader !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: 'Invalid Admin Password.' });
  }

  const action = (req.body && req.body.action) || req.query.action || 'dashboard';

  try {
    // ══════════════════════════════════════════════════════
    // ACTION: MINT CUSTOM DURATION KEY
    // ══════════════════════════════════════════════════════
    if (action === 'generate' || action === 'create-custom-key') {
      const customValue = parseFloat((req.body && req.body.customValue) || req.query.customValue || 0);
      const customUnit = (req.body && req.body.customUnit) || req.query.customUnit || 'hours';
      const isLifetime = !!((req.body && req.body.lifetime) || req.query.lifetime === 'true');
      const note = (req.body && req.body.note) || req.query.note || 'Owner Minted Key';
      const targetHwid = (req.body && req.body.hwid) || req.query.hwid || null;

      let hours = 8;
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
    // ACTION: DELETE SINGLE KEY FROM DATABASE / DASHBOARD
    // ══════════════════════════════════════════════════════
    if (action === 'delete-key' || action === 'remove-key') {
      const targetKey = (req.query && req.query.key) || (req.body && req.body.key);
      if (!targetKey) {
        return res.status(400).json({ success: false, message: 'Missing target key to delete.' });
      }

      await deleteKey(targetKey);
      await blacklistKey(targetKey, 'Deleted and purged by owner');

      return res.status(200).json({
        success: true,
        action: 'delete-key',
        message: 'Key permanently removed and deleted from database.',
        key: targetKey
      });
    }

    // ══════════════════════════════════════════════════════
    // ACTION: PERMANENTLY REMOVE / PURGE ALL EXPIRED & REVOKED KEYS
    // ══════════════════════════════════════════════════════
    if (action === 'clear-inactive' || action === 'delete-expired' || action === 'purge-inactive') {
      const now = Date.now();
      const nukeTime = await getNukeTimestamp();
      const count = await clearInactiveKeys(now, nukeTime);

      return res.status(200).json({
        success: true,
        action: 'clear-inactive',
        deletedCount: count,
        message: `Successfully purged and removed ${count} expired & revoked keys from the database!`
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
