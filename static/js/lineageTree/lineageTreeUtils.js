/**
 * Pure utilities for lineage tree data handling (parsing, IDs, status).
 */

/**
 * @param {*} id - Raw node/link ID (string or number)
 * @returns {string|null} Stable string ID or null
 */
export function toStableId(id) {
  return id != null ? String(id) : null;
}

/** @param {object} link - D3 link with source (object or id) */
export function getLinkSourceId(link) {
  const s = link?.source;
  return typeof s === 'object' ? s?.id : s;
}

/** @param {object} link - D3 link with target (object or id) */
export function getLinkTargetId(link) {
  const t = link?.target;
  return typeof t === 'object' ? t?.id : t;
}

/** @param {object} d - D3 hierarchy node (d.data.data or d.data) */
export function getNodeId(d) {
  return (d?.data?.data ?? d?.data)?.id ?? d?.data?.id;
}

export function isBishopRank(rankValue) {
  if (!rankValue) return false;
  const lowerRank = rankValue.toLowerCase();
  return lowerRank.includes('bishop') ||
    lowerRank.includes('pope') ||
    lowerRank.includes('archbishop') ||
    lowerRank.includes('cardinal') ||
    lowerRank.includes('patriarch');
}

/** @param {string|Date|null} dateValue */
export function parseYearFromDate(dateValue) {
  if (!dateValue) return null;
  const year = parseInt(String(dateValue).slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Format date as (MonthShortName, day, YYYY) e.g. (Jan 15, 1990). Handles YYYY-MM-DD, YYYY, or Date unknown. */
export function formatConsecrationDate(dateValue) {
  if (!dateValue) return null;
  const s = String(dateValue).trim();
  if (s === 'Date unknown') return null;
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const monthIdx = parseInt(m[2], 10) - 1;
    return `(${MONTH_SHORT[monthIdx] ?? m[2]} ${parseInt(m[3], 10)}, ${m[1]})`;
  }
  const year = s.match(/^\d{4}$/);
  if (year) return `(${year[0]})`;
  return null;
}

export function yearToDecade(year) {
  if (year == null || !Number.isFinite(year)) return null;
  const mod = year % 10;
  return mod < 5 ? Math.floor(year / 10) * 10 : Math.ceil(year / 10) * 10;
}

export function useSquareNode(d) {
  return d.is_pre_1968_consecration || !!d.is_lineage_root;
}

/** @param {object} d - Link with validity flags (is_invalid, is_doubtful, etc.) */
export function getLinkStatus(d) {
  if (d.is_invalid) return 'invalid';
  if (d.is_doubtfully_valid || d.is_doubtful) return 'doubtfully_valid';
  if (d.is_doubtful_event) return 'doubtful_event';
  if (d.is_sub_conditione) return 'sub_conditione';
  return 'valid';
}

export function getStatusIcon(status) {
  switch (status) {
    case 'invalid': return '✕';
    case 'doubtfully_valid': return '?';
    case 'doubtful_event': return '~';
    case 'sub_conditione': return 'SC';
    default: return null;
  }
}

export function getStatusIconColor(status) {
  switch (status) {
    case 'invalid': return '#e74c3c';
    case 'doubtfully_valid': return '#f39c12';
    case 'doubtful_event': return '#e67e22';
    case 'sub_conditione': return '#3498db';
    default: return '#ffffff';
  }
}

export const STATUS_PRIORITY = { invalid: 4, doubtfully_valid: 3, doubtful_event: 2, sub_conditione: 1, valid: 0 };
