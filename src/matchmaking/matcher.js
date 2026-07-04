function genderMatches(filterGender, actualGender) {
  return !filterGender || filterGender === 'any' || filterGender === actualGender;
}

function regionMatches(filterRegion, actualRegion) {
  return !filterRegion || filterRegion === 'any' || filterRegion === actualRegion;
}

/** İki aday karşılıklı filtre uyumlu mu? (A, B'yi ister VE B, A'yı ister) */
function isMutualMatch(a, b) {
  return (
    genderMatches(a.filterGender, b.gender) &&
    genderMatches(b.filterGender, a.gender) &&
    regionMatches(a.filterRegion, b.region) &&
    regionMatches(b.filterRegion, a.region)
  );
}

module.exports = { isMutualMatch };
