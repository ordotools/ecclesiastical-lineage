// Fuse.js-based fuzzy search module for clergy search (v2)
// This module is used by the v2 lineage search UI and is kept
// separate from the global window.fuzzySearch implementation.

import Fuse from 'https://cdn.jsdelivr.net/npm/fuse.js@7.1.0/dist/fuse.mjs';

/**
 * Normalize a string for search.
 *
 * - Strips diacritic combining marks so "Ngo" ↔ "Ngô" works.
 * - Preserves apostrophes, hyphens, and periods so names like
 *   "O'Brien" and "Saint-Martin" remain readable.
 * - Appends a punctuation-stripped variant so queries that omit
 *   punctuation ("obrien", "saintmartin") still match reliably.
 */
export function normalizeForSearch(str) {
  if (!str) return '';

  // De-accented version (keeps apostrophe, hyphen, period)
  const deAccented = str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Map Vietnamese đ/Đ to plain d so "d" queries
    // reliably match names written with "đ" as well.
    .replace(/[đĐ]/g, 'd')
    .replace(/[^\w\s\-'.]/g, '')
    .toLowerCase()
    .trim();

  // Punctuation stripped version so "obrien" matches "O'Brien"
  const noPunct = deAccented.replace(/['\-.]/g, '');

  if (!noPunct || noPunct === deAccented.replace(/\s+/g, ' ')) {
    return deAccented;
  }

  // Include both variants so Fuse can match with or without punctuation
  return `${deAccented} ${noPunct}`;
}

/**
 * Build the v2 search index from clergy nodes.
 * Each indexed item mirrors the structure used by search.js today,
 * with an additional normalized field for Fuse-based matching.
 */
function buildV2SearchIndex(nodes) {
  if (!Array.isArray(nodes)) return [];

  return nodes.map((node) => {
    const name = node.name || '';
    const rank = node.rank || '';
    const organization = node.organization || '';

    const combined = `${name} ${rank} ${organization}`.trim();

    return {
      id: node.id,
      name,
      rank,
      organization,
      node,
      searchTextNormalized: normalizeForSearch(combined),
    };
  });
}

/**
 * Create a Fuse.js instance and indexed items for clergy search.
 *
 * @param {Array} nodes - Array of clergy nodes (window.currentNodes).
 * @returns {{ fuse: Fuse, indexedItems: Array }}
 */
export function createClergyFuseIndex(nodes) {
  const indexedItems = buildV2SearchIndex(nodes);

  const fuse = new Fuse(indexedItems, {
    keys: ['searchTextNormalized'],
    includeScore: true,
    shouldSort: true,
    ignoreLocation: true,
    threshold: 0.35, // reasonably strict, typo-tolerant
    minMatchCharLength: 2,
  });

  return { fuse, indexedItems };
}

/**
 * Run a clergy search against an existing Fuse index.
 *
 * @param {Fuse} fuse - Fuse instance created by createClergyFuseIndex.
 * @param {string} query - User query string.
 * @param {number} [limit=10] - Maximum number of results to return.
 * @returns {Array} Array of indexed items (same shape as in buildV2SearchIndex).
 */
export function searchClergy(fuse, query, limit = 10) {
  if (!fuse || !query || !query.trim()) return [];

  const normalizedQuery = normalizeForSearch(query.trim());
  if (!normalizedQuery) return [];

  const results = fuse.search(normalizedQuery);

  return results.slice(0, limit).map((res) => res.item);
}

