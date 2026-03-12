/**
 * Editor v2: Cmd/Ctrl+F clergy search overlay.
 * Uses window.EDITOR_V2_FORM.all_clergy (or GET /editor-v2/api/clergy-list),
 * fuzzySearchV2.js for Fuse-based search, and HTMX to load selected clergy.
 */
import { createClergyFuseIndex, searchClergy } from '/static/js/fuzzySearchV2.js';

const DEBOUNCE_MS = 150;
const SEARCH_LIMIT = 30;

const overlay = () => document.getElementById('search-overlay');
const inputEl = () => document.getElementById('search-overlay-input');
const resultsEl = () => document.getElementById('search-overlay-results');

function isSearchOverlayVisible() {
  const el = overlay();
  return el && !el.classList.contains('search-overlay--hidden');
}

function setOverlayVisible(visible) {
  const el = overlay();
  if (!el) return;
  if (visible) {
    el.removeAttribute('inert');
    el.classList.remove('search-overlay--hidden');
    const inp = inputEl();
    if (inp) {
      inp.value = '';
      inp.focus();
    }
    renderResults([]);
  } else {
    const inp = inputEl();
    if (inp) inp.blur();
    el.classList.add('search-overlay--hidden');
    el.setAttribute('inert', '');
  }
}

function getClergyList() {
  const form = window.EDITOR_V2_FORM;
  if (form && Array.isArray(form.all_clergy) && form.all_clergy.length > 0) {
    return form.all_clergy;
  }
  return null;
}

let cachedList = null;

function fetchClergyList() {
  if (cachedList) return Promise.resolve(cachedList);
  return fetch('/editor-v2/api/clergy-list')
    .then((r) => (r.ok ? r.json() : []))
    .then((list) => {
      cachedList = list;
      return list;
    })
    .catch(() => []);
}

function renderResults(items) {
  const el = resultsEl();
  if (!el) return;
  el.textContent = '';
  items.forEach((item) => {
    const node = document.createElement('div');
    node.className = 'search-overlay-result-item';
    node.dataset.clergyId = String(item.id);
    const name = item.name || '';
    const rank = item.rank || '';
    const org = item.organization || '';
    node.textContent = [name, rank, org].filter(Boolean).join(' · ');
    el.appendChild(node);
  });
}

function selectClergy(id) {
  if (!window.htmx) return;
  window.htmx.ajax('GET', '/editor-v2/panel/center?clergy_id=' + encodeURIComponent(id), {
    target: '#editor-panel-center',
    swap: 'innerHTML',
  });
  setOverlayVisible(false);
}

function runSearch(fuse, query) {
  const items = searchClergy(fuse, query, SEARCH_LIMIT);
  renderResults(items);
}

function init() {
  let fuseIndex = null;
  let debounceTimer = null;

  function ensureFuse() {
    const list = getClergyList();
    if (list && list.length > 0) {
      fuseIndex = createClergyFuseIndex(list);
      return fuseIndex;
    }
    return null;
  }

  function onInput() {
    const inp = inputEl();
    const query = inp ? inp.value : '';
    if (debounceTimer) clearTimeout(debounceTimer);
    if (!query.trim()) {
      renderResults([]);
      return;
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (!fuseIndex) {
        const list = getClergyList();
        if (list && list.length > 0) {
          fuseIndex = createClergyFuseIndex(list);
        }
      }
      if (fuseIndex) {
        runSearch(fuseIndex.fuse, query);
      } else {
        renderResults([]);
      }
    }, DEBOUNCE_MS);
  }

  function openOverlay() {
    const list = getClergyList();
    if (list && list.length > 0) {
      fuseIndex = createClergyFuseIndex(list);
    } else {
      fuseIndex = null;
      fetchClergyList().then((list) => {
        cachedList = list;
        if (list && list.length > 0) {
          fuseIndex = createClergyFuseIndex(list);
          const inp = inputEl();
          if (inp && inp.value.trim()) {
            runSearch(fuseIndex.fuse, inp.value);
          }
        }
      });
    }
    setOverlayVisible(true);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isSearchOverlayVisible()) {
      e.preventDefault();
      setOverlayVisible(false);
      return;
    }
    const isMod = e.metaKey || e.ctrlKey;
    if (isMod && e.key === 'f') {
      e.preventDefault();
      openOverlay();
    }
  });

  const inp = inputEl();
  if (inp) inp.addEventListener('input', onInput);

  resultsEl()?.addEventListener('click', (e) => {
    const item = e.target?.closest?.('.search-overlay-result-item');
    if (item && item.dataset.clergyId) {
      selectClergy(item.dataset.clergyId);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
