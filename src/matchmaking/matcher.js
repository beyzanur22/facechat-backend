const queue = require('./queue');

function genderMatches(filterGender, actualGender) {
  return !filterGender || filterGender === 'any' || filterGender === actualGender;
}

function regionMatches(filterRegion, actualRegion) {
  return !filterRegion || filterRegion === 'any' || filterRegion === actualRegion;
}

/**
 * candidateEntry ile newEntry karşılıklı filtre uyumlu mu?
 */
function isMutualMatch(a, b) {
  return (
    genderMatches(a.filterGender, b.gender) &&
    genderMatches(b.filterGender, a.gender) &&
    regionMatches(a.filterRegion, b.region) &&
    regionMatches(b.filterRegion, a.region)
  );
}

/**
 * Yeni giren kullanıcı için kuyrukta uygun bir eş arar.
 * isBlockedPair: async (deviceIdA, deviceIdB) => bool — mevcut karşılıklı block kaydı varsa eşleşme atlanır.
 * Dönüş: eşleşen entry veya null.
 */
async function findMatch(newEntry, isBlockedPair) {
  const candidates = queue.waitingExcept(newEntry.socketId);

  for (const candidate of candidates) {
    if (!isMutualMatch(newEntry, candidate)) continue;
    // eslint-disable-next-line no-await-in-loop
    if (isBlockedPair && (await isBlockedPair(newEntry.deviceId, candidate.deviceId))) continue;
    return candidate;
  }

  return null;
}

module.exports = { findMatch, isMutualMatch };
