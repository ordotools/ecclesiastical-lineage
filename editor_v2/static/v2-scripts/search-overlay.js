/**
 * Editor v2: Cmd/Ctrl+F clergy search overlay.
 * Uses window.EDITOR_V2_FORM.all_clergy (or GET /editor-v2/api/clergy-list),
 * fuzzySearchV2.js for Fuse-based search, and HTMX to load selected clergy.
 */
import { createClergyFuseIndex, searchClergy } from '/static/js/fuzzySearchV2.js';

const DEBOUNCE_MS = 150;
const SEARCH_LIMIT = 30;

const COMMANDS = [
  {
    type: 'command',
    id: 'tag-management',
    name: 'Tag Management',
    run() {
      if (
        typeof window !== 'undefined' &&
        window.EDITOR_V2_TAGS &&
        typeof window.EDITOR_V2_TAGS.openTagModal === 'function'
      ) {
        window.EDITOR_V2_TAGS.openTagModal();
      }
    },
  },
];

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
    renderResults({
      commands: getMatchingCommands(''),
      items: [],
    });
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('editor-v2:searchOverlayOpened'));
    }
  } else {
    const inp = inputEl();
    if (inp) inp.blur();
    el.classList.add('search-overlay--hidden');
    el.setAttribute('inert', '');
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('editor-v2:searchOverlayClosed'));
    }
  }
}

function normalizeCommandQuery(str) {
  return (str || '').toLowerCase().trim();
}

function getMatchingCommands(query) {
  const q = normalizeCommandQuery(query);
  if (!q) return COMMANDS.slice();
  return COMMANDS.filter((cmd) => normalizeCommandQuery(cmd.name).includes(q));
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

function renderResults(payload) {
  const el = resultsEl();
  if (!el) return;
  el.textContent = '';
  const commands = (payload && Array.isArray(payload.commands) && payload.commands) || [];
  const items = (payload && Array.isArray(payload.items) && payload.items) || [];

  commands.forEach((cmd) => {
    const node = document.createElement('div');
    node.className = 'search-overlay-result-item search-overlay-result-item--command';
    node.dataset.commandId = String(cmd.id);
    node.textContent = `> ${cmd.name}`;
    el.appendChild(node);
  });

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
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(
      new CustomEvent('editor-v2:searchResultsUpdated', {
        detail: {
          items: Array.isArray(items) ? items : [],
          commands: Array.isArray(commands) ? commands : [],
        },
      }),
    );
  }
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
  renderResults({
    commands: getMatchingCommands(query),
    items,
  });
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
      renderResults({
        commands: getMatchingCommands(''),
        items: [],
      });
      return;
    }
    renderResults({
      commands: getMatchingCommands(query),
      items: [],
    });
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
        renderResults({
          commands: getMatchingCommands(query),
          items: [],
        });
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
    const inp = inputEl();
    const query = inp ? inp.value : '';
    renderResults({
      commands: getMatchingCommands(query),
      items: [],
    });
  }

  function moveActiveSelection(delta) {
    const container = resultsEl();
    if (!container) return;
    const items = Array.from(container.querySelectorAll('.search-overlay-result-item'));
    if (!items.length) return;

    const current = container.querySelector('.search-overlay-result-item.is-active');
    let nextIndex = -1;

    if (!current) {
      nextIndex = delta > 0 ? 0 : items.length - 1;
    } else {
      const currentIndex = items.indexOf(current);
      current.classList.remove('is-active');
      nextIndex = (currentIndex + delta + items.length) % items.length;
    }

    const next = items[nextIndex];
    if (next) {
      next.classList.add('is-active');
      if (typeof next.scrollIntoView === 'function') {
        next.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  function handleInputKeydown(e) {
    if (!isSearchOverlayVisible()) {
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveActiveSelection(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveActiveSelection(-1);
    } else if (e.key === 'Enter') {
      const container = resultsEl();
      if (!container) {
        return;
      }
      const active =
        container.querySelector('.search-overlay-result-item.is-active') ||
        container.querySelector('.search-overlay-result-item');
      if (active) {
        e.preventDefault();
        active.click();
      }
    }
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isSearchOverlayVisible()) {
      e.preventDefault();
      setOverlayVisible(false);
      return;
    }
    const isMod = e.metaKey || e.ctrlKey;
    if (isMod && (e.key === 'f' || e.key === 's' || e.key === 'k')) {
      e.preventDefault();
      openOverlay();
    }
  });

  const inp = inputEl();
  if (inp) {
    inp.addEventListener('input', onInput);
    inp.addEventListener('keydown', handleInputKeydown);
  }

  resultsEl()?.addEventListener('click', (e) => {
    const item = e.target?.closest?.('.search-overlay-result-item');
    if (!item) return;
    if (item.dataset.commandId) {
      const command = COMMANDS.find((cmd) => String(cmd.id) === String(item.dataset.commandId));
      if (command && typeof command.run === 'function') {
        command.run();
      }
      setOverlayVisible(false);
      return;
    }
    if (item.dataset.clergyId) {
      selectClergy(item.dataset.clergyId);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
