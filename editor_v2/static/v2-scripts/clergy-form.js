/**
 * Editor v2 — clergy form behaviour (rank visibility, event entries,
 * bishop/clergy autocomplete, date-unknown toggles, organization add).
 *
 * Search data comes from <script type="application/json" id="editor-form-data">
 * rendered with the form; app.js calls initClergyFormV2() after each center swap.
 */
(function() {
  function updateRankVisibility(form) {
    var rankSelect = form.querySelector('#rank');
    var papalField = form.querySelector('#papalNameField');
    var consecrationsSection = form.querySelector('.consecrations-section');
    if (!rankSelect) return;
    var selected = rankSelect.options[rankSelect.selectedIndex];
    var rankValue = selected ? selected.value : '';
    var normalizedRank = (rankValue || '').toLowerCase();
    var isBishop = selected && selected.getAttribute('data-is-bishop') === 'true';
    if (papalField) papalField.style.display = (normalizedRank === 'pope') ? 'flex' : 'none';
    if (consecrationsSection) {
      consecrationsSection.hidden = !isBishop;
      if (consecrationsSection.hidden) {
        consecrationsSection.querySelectorAll('input, select, textarea').forEach(function(el) {
          el.removeAttribute('required');
        });
      }
    }
  }

  function reindexEntries(form, kind) {
    var container = form.querySelector('#' + kind + 'sContainer');
    if (!container) return;
    var re = new RegExp('^' + kind + 's\\[\\d+\\]');
    container.querySelectorAll('.' + kind + '-entry').forEach(function(entry, i) {
      entry.querySelectorAll('input, select, textarea').forEach(function(el) {
        var name = el.getAttribute('name');
        if (name && re.test(name)) {
          el.setAttribute('name', name.replace(re, kind + 's[' + i + ']'));
        }
      });
      reindexCoConsecratorsForEntry(entry);
    });
  }

  function setDetailsUnknownForEntry(entry, isUnknown) {
    if (!entry) return;
    var flag = !!isUnknown;
    entry.classList.toggle('is-details-unknown', flag);

    var dateBlock = entry.querySelector('.ordination-date-block, .consecration-date-block');
    var bishopField = entry.querySelector('.ordination-entry__compact-row .bishop-autocomplete-field, .consecration-entry__compact-row .bishop-autocomplete-field');
    var coRow = entry.querySelector('.consecration-entry__co-consecrators-row');

    var inputs = [];
    [dateBlock, bishopField, coRow].forEach(function(el) {
      if (!el) return;
      el.style.display = flag ? 'none' : '';
      inputs = inputs.concat(Array.prototype.slice.call(el.querySelectorAll('input')));
    });

    inputs.forEach(function(input) {
      var name = input.getAttribute('name') || '';
      if (name.indexOf('[details_unknown]') !== -1) {
        return;
      }
      if (flag) {
        input.value = '';
        input.setAttribute('disabled', 'disabled');
      } else {
        input.removeAttribute('disabled');
      }
    });
  }

  function resetClonedInputs(root) {
    root.querySelectorAll('input:not([type="hidden"])').forEach(function(el) {
      el.value = '';
      el.removeAttribute('disabled');
      el.removeAttribute('data-autocomplete-inited');
    });
    root.querySelectorAll('input[type="hidden"]').forEach(function(el) { el.value = ''; });
    root.querySelectorAll('input[type="checkbox"]').forEach(function(el) { el.checked = false; });
    root.querySelectorAll('textarea').forEach(function(el) { el.value = ''; });
    root.querySelectorAll('select').forEach(function(el) { el.selectedIndex = 0; });
    root.querySelectorAll('.autocomplete-dropdown').forEach(function(dd) {
      dd.innerHTML = '';
      dd.style.display = 'none';
    });
  }

  function addEntry(form, kind) {
    var container = form.querySelector('#' + kind + 'sContainer');
    var first = container && container.querySelector('.' + kind + '-entry');
    if (!container || !first) return;
    var clone = first.cloneNode(true);
    clone.querySelectorAll('.co-consecrator-item').forEach(function(item, idx) {
      if (idx > 0) item.remove();
    });
    // Evidence needs a saved event; the new row gets its buttons after the record is saved.
    clone.querySelectorAll('[data-evidence-field]').forEach(function(button) { button.remove(); });
    resetClonedInputs(clone);
    toggleDateUnknown(clone.querySelector('.' + kind + '-date-block'), false);
    setDetailsUnknownForEntry(clone, false);
    container.appendChild(clone);
    reindexEntries(form, kind);
    setupAutocompletes(form);
    syncValidityExtraForEntry(clone);
  }

  function removeEntry(form, kind, entry) {
    var container = form.querySelector('#' + kind + 'sContainer');
    var entries = container && container.querySelectorAll('.' + kind + '-entry');
    if (!entries || entries.length <= 1) return;
    var evidence = 0;
    entry.querySelectorAll('[data-evidence-count]').forEach(function(count) {
      evidence += parseInt(count.textContent, 10) || 0;
    });
    if (evidence && !window.confirm('This ' + kind + ' has ' + evidence + ' evidence item(s). They are deleted when you save. Remove it?')) return;
    entry.remove();
    reindexEntries(form, kind);
  }

  // Lightweight normalization mirroring the Fuse-based v2 search.
  function normalizeForSearchLocal(str) {
    if (!str) return '';
    var deAccented = str
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^\w\s\-'.]/g, '')
      .toLowerCase()
      .trim();
    var noPunct = deAccented.replace(/['\-.]/g, '');
    if (!noPunct || noPunct === deAccented.replace(/\s+/g, ' ')) {
      return deAccented;
    }
    return deAccented + ' ' + noPunct;
  }

  /** Returns search(query, limit) over a list of { id, name, rank, organization }. */
  function makeSearch(list) {
    var fuse = null;
    return function(query, limit) {
      if (!query || !query.trim() || typeof Fuse === 'undefined') return [];
      if (!fuse) {
        fuse = new Fuse(list.map(function(c) {
          var combined = ((c.name || '') + ' ' + (c.rank || '') + ' ' + (c.organization || '')).trim();
          return { source: c, searchTextNormalized: normalizeForSearchLocal(combined) };
        }), {
          keys: ['searchTextNormalized'],
          includeScore: true,
          shouldSort: true,
          ignoreLocation: true,
          threshold: 0.35,
          minMatchCharLength: 2
        });
      }
      var normalizedQuery = normalizeForSearchLocal(query.trim());
      if (!normalizedQuery) return [];
      return fuse.search(normalizedQuery).slice(0, limit || 10).map(function(res) {
        return res.item.source;
      });
    };
  }

  var searchBishops = makeSearch([]);
  var searchClergy = makeSearch([]);

  function loadSearchData() {
    var el = document.getElementById('editor-form-data');
    var data = {};
    try {
      data = el ? JSON.parse(el.textContent) : {};
    } catch (e) {
      data = {};
    }
    window.EDITOR_V2_FORM.all_clergy = data.all_clergy || [];
    searchBishops = makeSearch(data.bishops || []);
    searchClergy = makeSearch(window.EDITOR_V2_FORM.all_clergy);
  }

  /**
   * Keyboard-first autocomplete: ↑/↓ move, Enter or Tab picks the highlighted
   * result, Esc closes. Typing clears the stored id, because the server uses the
   * id first and would otherwise keep a bishop whose name was typed over.
   */
  function attachAutocomplete(textInput, hiddenInput, dropdown, search, showRank) {
    if (textInput.getAttribute('data-autocomplete-inited') === 'true') return;
    textInput.setAttribute('data-autocomplete-inited', 'true');

    var results = [];
    var active = -1;

    function close() {
      dropdown.style.display = 'none';
      results = [];
      active = -1;
    }

    function render() {
      dropdown.innerHTML = '';
      results.forEach(function(clergy, i) {
        var el = document.createElement('div');
        el.className = 'bishop-search-result' + (i === active ? ' is-active' : '');
        el.setAttribute('data-index', String(i));
        var display = clergy.name + (clergy.organization ? ' — ' + clergy.organization : '');
        if (showRank && clergy.rank) display += ' (' + clergy.rank + ')';
        el.textContent = display;
        dropdown.appendChild(el);
      });
      dropdown.style.display = results.length ? 'block' : 'none';
      var current = dropdown.querySelector('.is-active');
      if (current) current.scrollIntoView({ block: 'nearest' });
    }

    function pick(i) {
      var clergy = results[i];
      if (!clergy) return;
      textInput.value = clergy.name || '';
      if (hiddenInput) {
        hiddenInput.value = clergy.id || '';
        hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      close();
    }

    textInput.addEventListener('input', function() {
      if (hiddenInput && hiddenInput.value) {
        hiddenInput.value = '';
        hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      var query = textInput.value.trim();
      results = query.length < 2 ? [] : search(query, 10);
      active = results.length ? 0 : -1;
      render();
    });

    textInput.addEventListener('keydown', function(e) {
      var open = dropdown.style.display === 'block' && results.length > 0;
      if (!open) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
        render();
      } else if (e.key === 'Enter') {
        e.preventDefault(); // pick, don't submit the form
        pick(active);
      } else if (e.key === 'Tab') {
        pick(active); // focus moves on as usual
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    });

    // mousedown + preventDefault keeps focus in the input, so blur cannot close the list first.
    dropdown.addEventListener('mousedown', function(e) {
      var el = e.target.closest('.bishop-search-result');
      e.preventDefault();
      if (el) pick(Number(el.getAttribute('data-index')));
    });

    textInput.addEventListener('blur', close);
  }

  function ensureDropdown(parentEl) {
    var dropdown = parentEl.querySelector('.autocomplete-dropdown');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.className = 'autocomplete-dropdown';
      parentEl.appendChild(dropdown);
    }
    return dropdown;
  }

  function setupAutocompletes(form) {
    [
      ['input[name*="ordaining_bishop_input"]', 'input[name*="ordaining_bishop_id"]', function(q, n) { return searchBishops(q, n); }, false],
      ['input[name*="consecrator_input"]', 'input[name*="consecrator_id"]', function(q, n) { return searchBishops(q, n); }, false],
      ['input[name*="co_consecrators"][name*="[input]"]', 'input[name*="co_consecrators"][name*="[id]"]', function(q, n) { return searchClergy(q, n); }, true]
    ].forEach(function(spec) {
      form.querySelectorAll(spec[0]).forEach(function(input) {
        var parent = input.closest('.bishop-autocomplete-field') || input.closest('.form-field');
        if (!parent) return;
        attachAutocomplete(input, parent.querySelector(spec[1]), ensureDropdown(parent), spec[2], spec[3]);
      });
    });
  }

  function reindexCoConsecratorsForEntry(entry) {
    var list = entry && entry.querySelector('.co-consecrators-list');
    if (!list) return;
    list.querySelectorAll('.co-consecrator-item').forEach(function(item, j) {
      item.querySelectorAll('input').forEach(function(el) {
        var name = el.getAttribute('name');
        if (name) el.setAttribute('name', name.replace(/\[co_consecrators\]\[\d+\]/, '[co_consecrators][' + j + ']'));
      });
    });
  }

  function addCoConsecrator(form, entry) {
    var list = entry.querySelector('.co-consecrators-list');
    var templateItem = list && list.querySelector('.co-consecrator-item');
    if (!templateItem) return;
    var clone = templateItem.cloneNode(true);
    resetClonedInputs(clone);
    list.appendChild(clone);
    reindexCoConsecratorsForEntry(entry);
    setupAutocompletes(form);
  }

  function removeCoConsecrator(entry, item) {
    item.remove();
    reindexCoConsecratorsForEntry(entry);
  }

  function syncValidityExtraForEntry(entry) {
    if (!entry) return;
    var block = entry.querySelector('.validity-extra-block');
    var validitySelect = entry.querySelector('select[name*="[validity]"]');
    var isOther = entry.querySelector('input[name*="[is_other]"]');
    var optionalNotes = entry.querySelector('input[name*="[optional_notes]"]');
    if (!block || !validitySelect) return;
    block.hidden = (validitySelect.value || '').toLowerCase() === 'valid';
    if (optionalNotes) {
      var otherChecked = isOther && isOther.checked;
      optionalNotes.disabled = !otherChecked;
      if (!otherChecked) optionalNotes.value = '';
    }
  }

  function toggleDateUnknown(block, isUnknown) {
    if (!block) return;
    var dateInput = block.querySelector('.date-input-wrapper input[type="date"]');
    var unknownInput = block.querySelector('.date-unknown-wrapper input[name*="[date_unknown]"]');
    var yearInput = block.querySelector('.date-unknown-wrapper input[name*="[year]"]');

    block.classList.toggle('is-unknown-date', !!isUnknown);
    if (dateInput) dateInput.removeAttribute('required');
    if (isUnknown) {
      if (dateInput) dateInput.value = '';
      if (unknownInput) unknownInput.value = '1';
    } else {
      if (unknownInput) unknownInput.value = '';
      if (yearInput) yearInput.value = '';
    }
  }

  /** Opens the organization modal; the saved organization becomes this form's selection. */
  function addOrganization(form) {
    var select = form.querySelector('#organization');
    if (!select || !window.EDITOR_V2_ORGS) return;
    window.EDITOR_V2_ORGS.openOrgModal({
      onSaved: function(org) {
        select.value = org.name;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        form.dataset.dirty = 'true';
      }
    });
  }

  function initClergyFormV2() {
    var form = document.getElementById('clergyForm');
    if (!form || form.getAttribute('data-clergy-form-v2-inited') === 'true') return;
    form.setAttribute('data-clergy-form-v2-inited', 'true');

    loadSearchData();

    if (window.EDITOR_V2_PHOTO && typeof window.EDITOR_V2_PHOTO.initEditorV2Photo === 'function') {
      window.EDITOR_V2_PHOTO.initEditorV2Photo(document);
    }

    var rankSelect = form.querySelector('#rank');
    if (rankSelect) {
      rankSelect.addEventListener('change', function() { updateRankVisibility(form); });
      updateRankVisibility(form);
    }

    setupAutocompletes(form);

    form.querySelectorAll('.ordination-entry, .consecration-entry').forEach(function(entry) {
      syncValidityExtraForEntry(entry);
      var detailsCheckbox = entry.querySelector('input[type="checkbox"][name*="[details_unknown]"]');
      setDetailsUnknownForEntry(entry, !!(detailsCheckbox && detailsCheckbox.checked));
    });

    form.querySelectorAll('.ordination-date-block, .consecration-date-block').forEach(function(block) {
      var dateInput = block.querySelector('.date-input-wrapper input[type="date"]');
      var unknownInput = block.querySelector('.date-unknown-wrapper input[name*="[date_unknown]"]');
      var yearInput = block.querySelector('.date-unknown-wrapper input[name*="[year]"]');
      var hasUnknownFlag = unknownInput && unknownInput.value === '1';
      var hasYearOnly = yearInput && yearInput.value && (!dateInput || !dateInput.value);
      toggleDateUnknown(block, !!(hasUnknownFlag || hasYearOnly));
    });

    form.addEventListener('change', function(e) {
      var target = e.target;
      var name = target && target.getAttribute && target.getAttribute('name');
      if (!name) return;
      var entry = target.closest('.ordination-entry, .consecration-entry');

      if (entry && (name.indexOf('[validity]') !== -1 || name.indexOf('[is_other]') !== -1)) {
        syncValidityExtraForEntry(entry);
      }
      if (entry && name.indexOf('[details_unknown]') !== -1) {
        setDetailsUnknownForEntry(entry, !!target.checked);
      }
    });

    var cancelLink = form.querySelector('.editor-v2-cancel');
    if (cancelLink) {
      cancelLink.addEventListener('click', function(e) {
        e.preventDefault();
        var url = form.getAttribute('data-panel-center-url');
        if (url && typeof htmx !== 'undefined') {
          htmx.ajax('GET', url, { target: '#editor-panel-center', swap: 'innerHTML' });
        }
      });
    }

    form.addEventListener('click', function(e) {
      var target = e.target;
      if (!target || !target.classList) return;
      var entry = target.closest('.ordination-entry, .consecration-entry');
      var kind = entry && entry.classList.contains('consecration-entry') ? 'consecration' : 'ordination';

      if (target.classList.contains('date-unknown-link') || target.classList.contains('specify-date-link')) {
        e.preventDefault();
        if (entry) {
          var block = entry.querySelector('.' + kind + '-date-block');
          var unknown = target.classList.contains('date-unknown-link');
          toggleDateUnknown(block, unknown);
          // The clicked button is now hidden; keep focus on the input that replaced it.
          var next = block && block.querySelector(unknown ? 'input[name*="[year]"]' : 'input[type="date"]');
          if (next) next.focus();
        }
      } else if (target.id === 'addOrdinationBtn') {
        e.preventDefault();
        addEntry(form, 'ordination');
      } else if (target.id === 'addConsecrationBtn') {
        e.preventDefault();
        addEntry(form, 'consecration');
      } else if (entry && (target.classList.contains('remove-ordination') || target.classList.contains('remove-consecration'))) {
        e.preventDefault();
        removeEntry(form, kind, entry);
      } else if (entry && target.classList.contains('add-co-consecrator')) {
        e.preventDefault();
        addCoConsecrator(form, entry);
      } else if (entry && target.classList.contains('remove-co-consecrator')) {
        e.preventDefault();
        var item = target.closest('.co-consecrator-item');
        if (item) removeCoConsecrator(entry, item);
      } else if (target.classList.contains('add-organization')) {
        e.preventDefault();
        addOrganization(form);
      }
    });
  }

  window.EDITOR_V2_FORM = window.EDITOR_V2_FORM || {};
  window.EDITOR_V2_FORM.initClergyFormV2 = initClergyFormV2;

  initClergyFormV2();
})();
