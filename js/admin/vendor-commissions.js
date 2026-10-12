(() => {
  const byId = id => document.getElementById(id);
  const controls = new Map();
  let settings = null;
  let busy = false;
  const text = (tag, value, className = '') => {
    const node = document.createElement(tag);
    node.textContent = String(value);
    node.className = className;
    return node;
  };
  byId('logoutAdminBtn').addEventListener('click', () => {
    clearAdminSession(); redirectToLogin('logout');
  });
  async function api(options = {}) {
    const response = await fetch(`${BASE_URL}/api/admin/commission-settings`, {
      ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      signal: AbortSignal.timeout(15000),
    });
    if (handleAdminSessionExpiry(response.status)) throw new Error('Admin session expired.');
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to load commission settings.');
    return data;
  }
  function changedRates() {
    if (!settings) return [];
    return settings.categories.flatMap(category => {
      const { toggle, input } = controls.get(category.categoryId);
      const percentage = toggle.checked ? (input.value.trim() ? Number(input.value) : NaN) : null;
      return percentage === category.overridePercentage ? [] : [{ categoryId: category.categoryId, percentage }];
    });
  }
  function updateSummary() {
    const changes = changedRates();
    byId('commissionChanges').textContent = changes.length ? `${changes.length} category rate(s) changed. These will apply to new orders after saving.` : 'No changes selected.';
    byId('saveCommissions').disabled = busy || !changes.length;
  }
  function render(data) {
    if (!Number.isSafeInteger(data.revision) || !Array.isArray(data.categories) || data.categories.length !== 23) {
      throw new Error('Incomplete commission settings. Refresh before editing.');
    }
    settings = data; controls.clear();
    byId('commissionScope').textContent = data.scope;
    byId('commissionRows').replaceChildren(...data.categories.map(category => {
      const row = document.createElement('tr'); row.className = 'border-b border-slate-700';
      const categoryCell = text('td', category.label, 'p-3 font-semibold');
      categoryCell.append(text('p', `${category.subcategoryCount} subcategories`, 'text-sm text-light-gray font-normal'));
      const range = category.defaultRange;
      const defaults = range.minimum === range.maximum ? `${range.minimum}%` : `${range.minimum}% - ${range.maximum}% depending on legacy category text`;
      const toggleCell = document.createElement('td'); toggleCell.className = 'p-3';
      const toggle = document.createElement('input'); toggle.type = 'checkbox';
      toggle.checked = category.overridePercentage !== null;
      toggle.setAttribute('aria-label', `Use a custom commission for ${category.label}`);
      toggleCell.append(toggle);
      const inputCell = document.createElement('td'); inputCell.className = 'p-3';
      const input = document.createElement('input');
      input.type = 'number'; input.min = '0'; input.max = '100'; input.step = '0.01'; input.required = true;
      input.className = 'input-field w-28'; input.value = String(category.overridePercentage ?? category.defaultPercentage);
      input.disabled = !toggle.checked; input.setAttribute('aria-label', `${category.label} commission percentage`);
      inputCell.append(input);
      controls.set(category.categoryId, { toggle, input });
      toggle.addEventListener('change', () => { input.disabled = !toggle.checked; updateSummary(); });
      input.addEventListener('input', updateSummary);
      row.append(categoryCell, text('td', defaults, 'p-3 text-light-gray'), toggleCell, inputCell); return row;
    }));
    const history = [...(data.history || [])].reverse();
    byId('commissionHistory').replaceChildren(...history.map(entry => {
      const card = text('article', '', 'rounded border border-slate-700 p-4');
      card.append(text('p', new Date(entry.changedAt).toLocaleString(), 'font-semibold'), text('p', entry.reason, 'mt-2'));
      for (const change of entry.changes || []) {
        const label = value => value === null ? 'Default rules' : `${value}%`;
        card.append(text('p', `${change.label}: ${label(change.previousPercentage)} → ${label(change.newPercentage)}`, 'text-sm text-light-gray mt-2'));
      }
      return card;
    }));
    if (!history.length) byId('commissionHistory').append(text('p', 'No commission changes have been recorded yet.'));
    byId('commissionReason').value = '';
    byId('commissionFields').disabled = false;
    updateSummary();
  }
  async function refresh() {
    if (busy || !adminToken) return;
    if (changedRates().length && !window.confirm('Discard your unsaved commission changes and refresh?')) return;
    busy = true; byId('refreshCommissions').disabled = true; byId('commissionFields').disabled = true;
    try { render(await api()); byId('commissionStatus').textContent = 'Commission settings are ready.'; }
    catch (error) { byId('commissionStatus').textContent = error.message; }
    finally { busy = false; byId('refreshCommissions').disabled = false; updateSummary(); }
  }
  byId('refreshCommissions').addEventListener('click', refresh);
  byId('commissionForm').addEventListener('submit', async event => {
    event.preventDefault(); if (busy || !settings) return;
    const changes = changedRates();
    if (!changes.length) return;
    if (changes.some(entry => entry.percentage !== null && (!Number.isFinite(entry.percentage) || entry.percentage < 0 || entry.percentage > 100))) {
      byId('commissionStatus').textContent = 'Enter a percentage from 0 to 100.'; return;
    }
    busy = true; byId('commissionFields').disabled = true; byId('refreshCommissions').disabled = true;
    try {
      const data = await api({ method: 'PUT', body: JSON.stringify({ revision: settings.revision, changes, reason: byId('commissionReason').value.trim() }) });
      render(data); byId('commissionStatus').textContent = data.message;
    } catch (error) {
      byId('commissionStatus').textContent = `${error.message} Your edits are retained; refresh to verify the saved rates before retrying.`;
    } finally {
      busy = false; byId('commissionFields').disabled = false; byId('refreshCommissions').disabled = false;
      updateSummary();
    }
  });
  if (adminToken) refresh();
})();
