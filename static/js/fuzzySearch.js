// Fuzzy search utility for clergy and lineage visualization
// Usage: window.fuzzySearch(list, query) => [{item, score}, ...]

function normalizeString(str) {
    if (!str) return '';
    // De-accented version
    const deAccented = str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s\-'.]/g, '')
        .toLowerCase()
        .trim();
    // Accented version (keeps Latin-1 Supplement and Extended-A)
    const accented = str
        .normalize('NFD')
        .replace(/[^\w\s\-'.\u00C0-\u017F]/g, '')
        .toLowerCase()
        .trim();
    return { deAccented, accented };
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
    keyFn = keyFn || (x => x);
    const qNorm = normalizeString(query);
    // Normalize all candidates once for efficiency
    const normalizedList = list.map(item => {
        const original = keyFn(item);
        const norm = normalizeString(original);
        return {
            item,
            deAccented: norm.deAccented,
            accented: norm.accented,
            original: original.toLowerCase()
        };
    });
    // Try all combinations for exact and substring matches
    let exactMatches = normalizedList.filter(obj =>
        obj.original.includes(query.toLowerCase()) ||
        obj.deAccented.includes(qNorm.deAccented) ||
        obj.accented.includes(qNorm.accented)
    );
    if (exactMatches.length > 0) {
        return exactMatches.map(obj => ({ item: obj.item, score: 0 }));
    }
    // Try normalized substring matches
    let normalizedMatches = normalizedList.filter(obj =>
        obj.deAccented.includes(qNorm.deAccented) ||
        obj.accented.includes(qNorm.accented)
    );
    if (normalizedMatches.length > 0) {
        return normalizedMatches.map(obj => ({ item: obj.item, score: 1 }));
    }
    // Fuzzy Levenshtein on all forms
    const scored = normalizedList.map(obj => ({
        item: obj.item,
        score: Math.min(
            levenshtein(obj.deAccented, qNorm.deAccented),
            levenshtein(obj.accented, qNorm.accented),
            levenshtein(obj.original, query.toLowerCase())
        )
    }));
    const goodMatches = scored.filter(result => result.score <= 5);
    if (goodMatches.length > 0) {
        goodMatches.sort((a, b) => a.score - b.score);
        return goodMatches;
    }
    scored.sort((a, b) => a.score - b.score);
    return scored;
}

/**
 * Attach a fuzzy-search-powered autocomplete dropdown to an input.
 * @param {HTMLInputElement} input - The text input element.
 * @param {HTMLInputElement} hidden - The hidden input to store the selected ID.
 * @param {HTMLElement} dropdown - The dropdown container for suggestions.
 * @param {Array} dataList - The array of objects to search.
 * @param {function} labelFn - Function to get display label from item.
 * @param {function} idFn - Function to get ID from item.
 */
function attachAutocomplete(input, hidden, dropdown, dataList, labelFn, idFn) {
    input.setAttribute('autocomplete', 'off');
    input.addEventListener('input', function() {
        const val = this.value.trim();
        dropdown.innerHTML = '';
        if (!val) {
            dropdown.style.display = 'none';
            hidden.value = '';
            return;
        }
        const results = window.fuzzySearch(dataList, val, labelFn);
        if (results.length === 0) {
            dropdown.style.display = 'none';
            hidden.value = '';
            return;
        }
        results.forEach(result => {
            const item = result.item;
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            div.textContent = labelFn(item);
            div.style.cursor = 'pointer';
            div.style.padding = '4px 8px';
            div.addEventListener('mousedown', function(e) {
                e.preventDefault();
                input.value = labelFn(item);
                hidden.value = idFn(item);
                dropdown.style.display = 'none';
            });
            dropdown.appendChild(div);
        });
        dropdown.style.display = 'block';
    });
    input.addEventListener('blur', function() {
        setTimeout(() => { dropdown.style.display = 'none'; }, 150);
    });
    input.addEventListener('focus', function() {
        if (this.value.trim()) {
            this.dispatchEvent(new Event('input'));
        }
    });
}
window.attachAutocomplete = attachAutocomplete;

window.fuzzySearch = fuzzySearch; 