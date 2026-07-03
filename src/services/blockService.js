const db = require('../db');

async function addBlock(blockerDeviceId, blockedDeviceId) {
  await db('blocks')
    .insert({ blocker_device_id: blockerDeviceId, blocked_device_id: blockedDeviceId })
    .onConflict(['blocker_device_id', 'blocked_device_id'])
    .ignore();
}

async function isPairBlocked(deviceIdA, deviceIdB) {
  const row = await db('blocks')
    .where((builder) => {
      builder
        .where({ blocker_device_id: deviceIdA, blocked_device_id: deviceIdB })
        .orWhere({ blocker_device_id: deviceIdB, blocked_device_id: deviceIdA });
    })
    .first();
  return Boolean(row);
}

module.exports = { addBlock, isPairBlocked };
