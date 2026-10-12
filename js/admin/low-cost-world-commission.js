(() => {
  const byId = id => document.getElementById(id);
  let settings = null; let busy = false;
  const money = amount => `₦${Number(amount).toFixed(2)}`;
  const text = (tag, value, className = '') => {
    const element = document.createElement(tag); element.textContent = String(value); element.className = className; return element;
  };
  function changed() {
    return settings && byId('lowCostFeePerItem').value.trim() !== '' && Number(byId('lowCostFeePerItem').value) !== settings.feePerItem;
  }
  function ready() {
    byId('saveLowCostCommission').disabled = busy || !settings?.configured || !changed();
  }
  async function api(options = {}) {
    const response = await fetch(`${BASE_URL}/api/admin/commission-settings/low-cost-world`, {
      ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }, signal: AbortSignal.timeout(15000),
    });
    if (handleAdminSessionExpiry(response.status)) throw new Error('Admin session expired.');
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to load Low Cost World commission.');
    return data;
  }
  function render(data) {
    if (!Number.isSafeInteger(data.revision) || data.revision < 0 || !Number.isFinite(data.feePerItem) || data.feePerItem < 0 ||
        (data.configured && !/^[a-f\d]{24}$/i.test(data.vendorId || ''))) throw new Error('Invalid store commission settings. Refresh before editing.');
    settings = data;
    byId('lowCostFeePerItem').value = String(data.feePerItem);
    byId('lowCostCurrentFee').textContent = `${money(data.feePerItem)}${data.source === 'default' ? ' (default)' : ''}`;
    byId('lowCostCommissionScope').textContent = data.scope;
    byId('lowCostCommissionReason').value = '';
    byId('lowCostCommissionFields').disabled = !data.configured;
    byId('lowCostCommissionStatus').textContent = data.configured ? `Linked store: ${data.vendorName}` : 'Link an approved Low Cost World vendor in Product Moderation to enable fee changes.';
    const history = [...(data.history || [])].reverse();
    byId('lowCostCommissionHistory').replaceChildren(...history.map(entry => {
      const card = text('article', '', 'border border-slate-700 rounded p-4');
      card.append(text('p', new Date(entry.changedAt).toLocaleString(), 'font-semibold'),
        text('p', `${money(entry.previousKoboPerUnit / 100)} → ${money(entry.newKoboPerUnit / 100)} per item`, 'mt-2'),
        text('p', entry.reason, 'text-light-gray mt-2'));
      return card;
    }));
    if (!history.length) byId('lowCostCommissionHistory').append(text('p', 'No store commission changes recorded yet.'));
    ready();
  }
  async function refresh() {
    if (busy || !adminToken) return;
    if (changed() && !window.confirm('Discard the unsaved Low Cost World fee and refresh?')) return;
    busy = true; byId('refreshLowCostCommission').disabled = true; byId('lowCostCommissionFields').disabled = true;
    try { render(await api()); }
    catch (error) { settings = null; byId('lowCostCommissionStatus').textContent = error.message; }
    finally { busy = false; byId('refreshLowCostCommission').disabled = false; ready(); }
  }
  byId('lowCostFeePerItem').addEventListener('input', ready);
  byId('refreshLowCostCommission').addEventListener('click', refresh);
  byId('lowCostCommissionForm').addEventListener('submit', async event => {
    event.preventDefault(); if (busy || !settings?.configured || !changed()) return;
    const feePerItem = Number(byId('lowCostFeePerItem').value);
    if (!Number.isFinite(feePerItem) || feePerItem < 0) { byId('lowCostCommissionStatus').textContent = 'Enter a non-negative fee per item in naira.'; return; }
    busy = true; byId('lowCostCommissionFields').disabled = true; byId('refreshLowCostCommission').disabled = true;
    try {
      const data = await api({ method: 'PUT', body: JSON.stringify({ revision: settings.revision, vendorId: settings.vendorId,
        feePerItem, reason: byId('lowCostCommissionReason').value.trim() }) });
      render(data); byId('lowCostCommissionStatus').textContent = data.message;
    } catch (error) { byId('lowCostCommissionStatus').textContent = `${error.message} Your edits are retained; refresh to verify the current store fee.`; }
    finally { busy = false; byId('lowCostCommissionFields').disabled = !settings?.configured; byId('refreshLowCostCommission').disabled = false; ready(); }
  });
  if (adminToken) refresh();
})();
