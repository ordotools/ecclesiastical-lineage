// Fuzzy search utility for clergy and lineage visualization
// Usage: window.fuzzySearch(list, query, keyFn) => [{item, score}, ...]
//
// Special characters: Apostrophes and hyphens are preserved so "O'Brien" and "Saint-Martin"
// match when typed with punctuation. They are also matched when omitted (e.g. "obrien", "saintmartin")
// via a no-punctuation normalized form. Diacritics are normalized (NFD + strip combining marks)
// so "jose" matches "José" and "José" matches "José".

function normalizeString(str) {
    if (!str) return '';
    // De-accented version (keeps apostrophe, hyphen, period for "O'Brien", "Saint-Martin")
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
    // Punctuation stripped so "obrien" matches "O'Brien", "saintmartin" matches "Saint-Martin"
    const noPunct = deAccented.replace(/['\-.]/g, '');
    return { deAccented, accented, noPunct };
}

// Split into words (e.g. "Saint-Martin" → ["saint", "martin"], "John Sanborn" → ["john", "sanborn"])
// for word-level typo tolerance ("sanbron" → "Sanborn").
function tokenize(str) {
    if (!str) return [];
    return str
        .split(/[\s\-']+/)
        .filter(Boolean)
        .map(part => normalizeString(part).noPunct);
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
            noPunct: norm.noPunct,
            original: original.toLowerCase()
        };
    });
    // Try all combinations for exact and substring matches (noPunct: "obrien" matches "O'Brien")
    let exactMatches = normalizedList.filter(obj =>
        obj.original.includes(query.toLowerCase()) ||
        obj.deAccented.includes(qNorm.deAccented) ||
        obj.accented.includes(qNorm.accented) ||
        (qNorm.noPunct && obj.noPunct.includes(qNorm.noPunct))
    );
    if (exactMatches.length > 0) {
        return exactMatches.map(obj => ({ item: obj.item, score: 0 }));
    }
    // Try normalized substring matches
    let normalizedMatches = normalizedList.filter(obj =>
        obj.deAccented.includes(qNorm.deAccented) ||
        obj.accented.includes(qNorm.accented) ||
        (qNorm.noPunct && obj.noPunct.includes(qNorm.noPunct))
    );
    if (normalizedMatches.length > 0) {
        return normalizedMatches.map(obj => ({ item: obj.item, score: 1 }));
    }
    // Fuzzy Levenshtein: use best of full-string and word-level score for typo tolerance
    // (e.g. "sanbron" matches "Sanborn" via word score lev("sanborn","sanbron") = 2).
    const qLen = (qNorm.noPunct || query).length;
    const scored = normalizedList.map(obj => {
        const fullStringScore = Math.min(
            levenshtein(obj.deAccented, qNorm.deAccented),
            levenshtein(obj.accented, qNorm.accented),
            levenshtein(obj.noPunct, qNorm.noPunct),
            levenshtein(obj.original, query.toLowerCase())
        );
        const tokens = tokenize(obj.deAccented);
        let wordScore = Infinity;
        for (const token of tokens) {
            if (Math.abs(token.length - qLen) <= 3) {
                const d = levenshtein(token, qNorm.noPunct);
                if (d < wordScore) wordScore = d;
            }
        }
        const score = Math.min(fullStringScore, wordScore);
        return { item: obj.item, score };
    });
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
window.normalizeString = normalizeString; 