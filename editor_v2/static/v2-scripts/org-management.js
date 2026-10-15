/**
 * Editor v2: organization management modal (name, abbreviation, color, description).
 * Opened from the Cmd/Ctrl+F command list and the clergy form's "Add" button.
 * Mirrors tag-management.js and reuses its overlay styles.
 */
(() => {
  'use strict';

  let orgs = [];
  let onSaved = null;
  const $ = (id) => document.getElementById(id);

  function textColorForBg(hex) {
    return (window.EDITOR_V2_TAGS && window.EDITOR_V2_TAGS.textColorForBg)
      ? window.EDITOR_V2_TAGS.textColorForBg(hex)
      : '#000000';
  }

  function label(org) {
    return org.abbreviation ? org.abbreviation + ' — ' + org.name : org.name;
  }

  function updatePreview() {
    const preview = $('editorV2OrgPreview');
    const hex = $('editorV2OrgColor').value;
    preview.style.backgroundColor = hex;
    preview.style.color = textColorForBg(hex);
    preview.textContent = $('editorV2OrgAbbr').value.trim() || $('editorV2OrgName').value.trim() || 'Org';
  }

  function fillForm(org) {
    $('editorV2OrgId').value = org ? org.id : '';
    $('editorV2OrgName').value = org ? org.name : '';
    $('editorV2OrgAbbr').value = (org && org.abbreviation) || '';
    $('editorV2OrgColor').value = (org && org.color) || '#27ae60';
    $('editorV2OrgDescription').value = (org && org.description) || '';
    $('editorV2OrgFormTitle').textContent = org ? 'Edit organization' : 'Add organization';
    $('editorV2OrgError').textContent = '';
    updatePreview();
    $('editorV2OrgName').focus();
  }

  function renderOrgs() {
    const list = $('editorV2OrgList');
    list.textContent = '';
    if (!orgs.length) {
      list.textContent = 'No organizations yet.';
      return;
    }
    orgs.forEach((org) => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'editor-tag-pill';
      pill.dataset.orgId = String(org.id);
      pill.style.backgroundColor = org.color || '#ffffff';
      pill.style.color = textColorForBg(org.color);
      pill.textContent = label(org);
      list.appendChild(pill);
    });
  }

  function reloadOrgs() {
    return fetch('/editor/api/organizations', { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
      .then((list) => {
        orgs = Array.isArray(list) ? list : [];
        renderOrgs();
      });
  }

  /** Keep every clergy-form organization <select> in sync after a save (value = org name). */
  function syncSelects(org, oldName) {
    document.querySelectorAll('select#organization').forEach((select) => {
      let option = Array.prototype.find.call(select.options, (o) => o.value === (oldName || org.name));
      if (!option) {
        option = new Option('', org.name);
        select.add(option);
      }
      option.value = org.name;
      option.textContent = org.name + (org.abbreviation ? ' (' + org.abbreviation + ')' : '');
    });
  }

  function save(event) {
    event.preventDefault();
    const id = $('editorV2OrgId').value;
    const oldOrg = orgs.find((o) => String(o.id) === id);
    const button = $('editorV2OrgSave');
    button.disabled = true;
    fetch('/editor/api/organizations' + (id ? '/' + encodeURIComponent(id) : ''), {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        name: $('editorV2OrgName').value,
        abbreviation: $('editorV2OrgAbbr').value,
        color: $('editorV2OrgColor').value,
        description: $('editorV2OrgDescription').value,
      }),
    })
      .then((r) => r.json().catch(() => null))
      .then((body) => {
        if (!body || !body.success) {
          $('editorV2OrgError').textContent = (body && body.message) || 'Failed to save organization.';
          return;
        }
        syncSelects(body.organization, oldOrg && oldOrg.name);
        const callback = onSaved;
        onSaved = null;
        if (callback) callback(body.organization);
        return reloadOrgs().then(() => fillForm(body.organization));
      })
      .catch(() => {
        $('editorV2OrgError').textContent = 'Failed to save organization.';
      })
      .finally(() => {
        button.disabled = false;
      });
  }

  function openOrgModal(options) {
    const overlay = $('editorV2OrgOverlay');
    if (!overlay) return;
    onSaved = (options && options.onSaved) || null;
    overlay.classList.remove('editor-tag-overlay--hidden');
    overlay.setAttribute('aria-hidden', 'false');
    fillForm(null);
    reloadOrgs();
  }

  function closeOrgModal() {
    const overlay = $('editorV2OrgOverlay');
    if (!overlay) return;
    onSaved = null;
    overlay.classList.add('editor-tag-overlay--hidden');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function init() {
    const overlay = $('editorV2OrgOverlay');
    if (!overlay) return;
    $('editorV2OrgForm').addEventListener('submit', save);
    $('editorV2OrgCancel').addEventListener('click', closeOrgModal);
    $('editorV2OrgNew').addEventListener('click', () => fillForm(null));
    ['editorV2OrgColor', 'editorV2OrgName', 'editorV2OrgAbbr'].forEach((id) => {
      $(id).addEventListener('input', updatePreview);
    });
    $('editorV2OrgList').addEventListener('click', (event) => {
      const pill = event.target.closest('[data-org-id]');
      if (pill) fillForm(orgs.find((o) => String(o.id) === pill.dataset.orgId));
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && overlay.getAttribute('aria-hidden') === 'false') closeOrgModal();
    });
  }

  window.EDITOR_V2_ORGS = { openOrgModal, closeOrgModal, reloadOrgs };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
