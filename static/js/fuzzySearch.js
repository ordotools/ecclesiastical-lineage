// Fuzzy search utility for clergy and lineage visualization
// Usage: window.fuzzySearch(list, query) => [{item, score}, ...]

function normalizeString(str) {
    return str
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^\w\s]/g, '') // Remove other special characters
        .toLowerCase();
}

function levenshtein(a, b) {
    const an = a ? a.length : 0;
    const bn = b ? b.length : 0;
    if (an === 0) return bn;
    if (bn === 0) return an;
    const matrix = [];
    for (let i = 0; i <= bn; ++i) matrix[i] = [i];
    for (let j = 0; j <= an; ++j) matrix[0][j] = j;
    for (let i = 1; i <= bn; ++i) {
        for (let j = 1; j <= an; ++j) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }
    return matrix[bn][an];
}

function fuzzySearch(list, query, keyFn) {
    if (!query || !list) return [];
    const q = normalizeString(query);
    keyFn = keyFn || (x => x);
    // Normalize all candidates once for efficiency
    const normalizedList = list.map(item => ({
        item,
        norm: normalizeString(keyFn(item))
    }));
    let filtered = normalizedList.filter(obj => obj.norm.includes(q));
    if (filtered.length === 0) filtered = normalizedList;
    const scored = filtered.map(obj => ({
        item: obj.item,
        score: levenshtein(obj.norm, q)
    }));
    scored.sort((a, b) => a.score - b.score);
    return scored;
}

window.fuzzySearch = fuzzySearch; 