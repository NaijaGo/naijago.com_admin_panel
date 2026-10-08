(() => {
  if (currentPage !== 'deals' || !adminToken) return;
  const field = id => document.getElementById(id);
  const statuses = new Set(['draft', 'pending', 'approved', 'rejected', 'paused']);
  const money = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const id = value => typeof value === 'object' && value ? String(value._id || '') : String(value || '');
  const validId = value => /^[a-f\d]{24}$/i.test(id(value));
  const date = value => { const parsed = value ? new Date(value) : null; return parsed && Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : 'Unavailable'; };
  const price = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? money.format(value) : 'Unavailable';
  const element = (tag, text = '', cls = '') => { const node = document.createElement(tag); node.textContent = String(text); node.className = cls; return node; };
  const title = value => value[0].toUpperCase() + value.slice(1);
  let rows = [], views = new Map(), page = 1, requestedPage = 1, total = 0, hasMore = false;
  let loading = false, changing = false, generation = 0, activeModal = null;
  const products = new Map();

  async function request(path, { method = 'GET', body, optional = false } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        method, cache: 'no-store', signal: controller.signal,
        headers: { Authorization: `Bearer ${adminToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (handleAdminSessionExpiry(response.status)) throw new Error('Please sign in again.');
      if (optional && response.status === 404) return null;
      if (response.status === 404) throw new Error('Deals are not available on this server yet, or this Deal no longer exists.');
      if (response.status >= 500) throw new Error('Deals are temporarily unavailable. Please try again.');
      let data;
      try { data = await response.json(); } catch (_) { throw new Error('The server response could not be confirmed. Refresh before retrying.'); }
      if (!response.ok) throw new Error(typeof data?.message === 'string' && data.message.length <= 500 ? data.message : 'Could not update this Deal. Refresh and try again.');
      return data;
    } catch (error) {
      if (error instanceof TypeError || error.name === 'AbortError') throw new Error(method === 'GET' ? 'Connection interrupted. Please try again.' : 'Update could not be confirmed. Refresh Deals before retrying.');
      throw error;
    } finally { clearTimeout(timer); }
  }

  function validateDeal(deal) {
    if (!deal || !validId(deal._id) || !validId(deal.productId) || !validId(deal.vendorId) ||
        (deal.productOfferId != null && !validId(deal.productOfferId)) || !statuses.has(deal.status) ||
        !['percentage', 'fixed'].includes(deal.discountType) || !Number.isFinite(deal.discountValue) || deal.discountValue <= 0) {
      throw new Error('The Deals response was invalid. Please refresh.');
    }
    return deal;
  }

  async function resolveView(deal) {
    const productId = id(deal.productId);
    if (!products.has(productId)) products.set(productId, request(`/api/products/${productId}`, { optional: true }).catch(() => null));
    const [product, active] = await Promise.all([
      products.get(productId),
      deal.status === 'approved' ? request(`/api/deals/${id(deal._id)}`, { optional: true }).catch(() => null) : null,
    ]);
    const safeProduct = product && id(product._id) === productId ? product : null;
    const offer = deal.productOfferId && Array.isArray(safeProduct?.offers) ? safeProduct.offers.find(row => id(row._id) === id(deal.productOfferId)) : null;
    const seller = offer?.sellerId || safeProduct?.vendor;
    const vendor = typeof seller === 'object' && id(seller) === id(deal.vendorId) ? seller : null;
    const snapshot = active?.deal;
    const pricing = snapshot && id(snapshot._id) === id(deal._id) && id(snapshot.productId) === productId &&
      id(snapshot.productOfferId) === id(deal.productOfferId) && id(snapshot.vendorId) === id(deal.vendorId) &&
      [snapshot.originalPrice, snapshot.finalPrice, snapshot.savingsAmount].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0) &&
      snapshot.finalPrice <= snapshot.originalPrice ? snapshot : null;
    return { product: safeProduct, vendor, pricing,
      originalPrice: pricing?.originalPrice ?? (deal.productOfferId ? offer?.originalPrice ?? offer?.price : safeProduct?.originalPrice ?? safeProduct?.price) };
  }

  function controls() {
    const busy = loading || changing;
    ['dealsRefresh', 'dealsStatus', 'dealsLimit', 'dealsRetry'].forEach(key => { field(key).disabled = busy; });
    field('dealsPrevious').disabled = busy || page <= 1;
    field('dealsNext').disabled = busy || !hasMore || page >= 1000;
    field('dealsTableContainer').setAttribute('aria-busy', String(loading));
    field('dealsRows').querySelectorAll('button').forEach(button => { button.disabled = busy; });
  }

  function actions(deal) {
    return [
      ...(deal.status === 'pending' ? ['approve'] : []),
      ...(deal.status !== 'rejected' ? ['reject'] : []),
      ...(deal.status === 'approved' ? ['pause', deal.featured ? 'unfeature' : 'feature'] : []),
      ...(deal.status === 'paused' && deal.approvedAt ? ['unpause'] : []),
    ];
  }

  function image(product) {
    const node = element('div', 'No image', 'w-16 h-16 rounded-lg bg-gray-800 text-xs flex items-center justify-center shrink-0');
    const source = product?.imageUrls?.[0];
    try {
      const url = new URL(source);
      if (url.protocol !== 'https:') return node;
      const img = document.createElement('img'); img.src = url.href; img.alt = product.name || 'Product';
      img.loading = 'lazy'; img.className = 'w-16 h-16 rounded-lg object-cover';
      img.addEventListener('error', () => { img.replaceWith(element('span', 'Image unavailable')); });
      node.replaceChildren(img);
    } catch (_) { /* Missing media has a visible placeholder. */ }
    return node;
  }

  function render() {
    const body = field('dealsRows'); body.replaceChildren();
    for (const deal of rows) {
      const view = views.get(id(deal._id)) || {};
      const tr = document.createElement('tr'); tr.className = 'border-b border-gray-700 align-top';
      const cells = Array.from({ length: 8 }, () => element('td', '', 'p-3')); tr.append(...cells);
      const productCell = element('div', '', 'flex gap-3 min-w-[230px]'); productCell.append(image(view.product));
      const names = element('div'); names.append(element('p', view.product?.name || 'Product information unavailable', 'font-semibold'),
        element('p', view.vendor?.businessName || `Vendor unavailable (${id(deal.vendorId)})`, 'text-light-gray'),
        element('p', deal.productOfferId ? `Offer: ${id(deal.productOfferId)}` : 'Product stock', 'text-xs text-light-gray break-all'));
      productCell.append(names); cells[0].append(productCell);
      cells[1].append(element('p', `Original: ${price(view.originalPrice)}`), element('p', `Deal: ${view.pricing ? price(view.pricing.finalPrice) : 'No active backend price'}`), element('p', 'Current backend pricing', 'text-xs text-light-gray'));
      cells[2].append(element('p', title(deal.discountType)), element('p', deal.discountType === 'percentage' ? `${deal.discountValue}%` : price(deal.discountValue)));
      cells[3].append(element('p', `Start: ${date(deal.startAt)}`), element('p', `End: ${date(deal.endAt)}`));
      cells[4].append(element('span', title(deal.status), 'status-badge')); cells[5].textContent = deal.featured ? 'Featured' : 'Not featured'; cells[6].textContent = date(deal.createdAt);
      const buttons = element('div', '', 'flex flex-wrap gap-2 min-w-[170px]');
      const details = element('button', 'Details', 'btn btn-primary-alt px-3 py-2'); details.type = 'button'; details.addEventListener('click', () => showDetails(deal)); buttons.append(details);
      for (const action of actions(deal)) {
        const button = element('button', title(action), `btn ${action === 'reject' ? 'btn-danger' : action === 'approve' ? 'btn-success' : 'btn-primary-alt'} px-3 py-2`);
        button.type = 'button'; button.addEventListener('click', () => showModeration(deal, action)); buttons.append(button);
      }
      cells[7].append(buttons); body.append(tr);
    }
    field('dealsPageInfo').textContent = `Page ${page} of ${Math.max(1, Math.ceil(total / Number(field('dealsLimit').value)))} · ${total} Deals`;
    controls();
  }

  async function load(next = 1) {
    if (loading || changing || !Number.isInteger(next) || next < 1 || next > 1000) return;
    requestedPage = next; loading = true; const version = ++generation; products.clear(); controls();
    field('dealsState').textContent = 'Loading Deals…'; field('dealsRetry').hidden = true;
    let correctedPage = null;
    try {
      const query = new URLSearchParams({ page: String(next), limit: field('dealsLimit').value });
      if (field('dealsStatus').value) query.set('status', field('dealsStatus').value);
      const result = await request(`/api/admin/deals?${query}`);
      if (!Array.isArray(result?.deals) || result.page !== next || result.limit !== Number(field('dealsLimit').value) || !Number.isSafeInteger(result.total) || result.total < 0 || typeof result.hasMore !== 'boolean') throw new Error('The Deals page response was invalid.');
      const lastPage = Math.max(1, Math.ceil(result.total / result.limit));
      if (next > lastPage) { correctedPage = lastPage; return; }
      const nextRows = result.deals.map(validateDeal); const nextViews = new Map();
      for (let start = 0; start < nextRows.length; start += 4) await Promise.all(nextRows.slice(start, start + 4).map(async deal => { nextViews.set(id(deal._id), await resolveView(deal)); }));
      if (version !== generation) return;
      rows = nextRows; views = nextViews; page = result.page; total = result.total; hasMore = result.hasMore;
      field('dealsState').textContent = rows.length ? `${rows.length} Deals loaded. All prices shown were returned by the backend.` : 'No Deals match this status.';
      render();
    } catch (error) {
      field('dealsState').textContent = error.message; field('dealsRetry').hidden = false;
    } finally {
      loading = false; controls();
      if (correctedPage != null) await load(correctedPage);
    }
  }

  function modal(label) {
    if (activeModal) activeModal.close();
    const previous = document.activeElement;
    const overlay = element('div', '', 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4');
    const panel = element('div', '', 'bg-secondary-blue rounded-lg p-6 max-w-4xl w-full max-h-[85vh] overflow-y-auto');
    panel.style.backgroundColor = 'var(--secondary-blue)';
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'dealModalTitle'); panel.tabIndex = -1;
    const header = element('div', '', 'flex justify-between items-center gap-4 mb-4'); const heading = element('h2', label, 'text-xl font-bold text-accent-cyan'); heading.id = 'dealModalTitle';
    const close = element('button', 'Close', 'btn btn-primary-alt px-4 py-2'); close.type = 'button'; header.append(heading, close); panel.append(header); overlay.append(panel); document.body.append(overlay);
    const originalOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const keyboard = event => {
      if (event.key === 'Escape' && !changing) { event.preventDefault(); closeModal(); }
      if (event.key === 'Tab') {
        const nodes = [...panel.querySelectorAll('button:not(:disabled), textarea:not(:disabled), a[href]')];
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    function closeModal() { if(changing) return; overlay.remove(); document.removeEventListener('keydown', keyboard); document.body.style.overflow = originalOverflow; activeModal = null; if(previous?.isConnected) previous.focus(); }
    close.addEventListener('click', closeModal); overlay.addEventListener('click', event => { if(event.target === overlay) closeModal(); }); document.addEventListener('keydown', keyboard); close.focus();
    activeModal = { panel, close: closeModal, button: close }; return activeModal;
  }

  function showDetails(deal) {
    const { panel } = modal('Deal details'); const view = views.get(id(deal._id)) || {};
    const info = element('dl', '', 'grid grid-cols-1 md:grid-cols-2 gap-3');
    const pairs = [ ['Deal ID', id(deal._id)], ['Product', view.product?.name || 'Unavailable'], ['Product ID', id(deal.productId)], ['Offer ID', id(deal.productOfferId) || 'Product stock'],
      ['Vendor', view.vendor?.businessName || 'Unavailable'], ['Vendor ID', id(deal.vendorId)], ['Original price', price(view.originalPrice)],
      ['Deal price', view.pricing ? price(view.pricing.finalPrice) : 'No active backend price provided'], ['Savings', view.pricing ? price(view.pricing.savingsAmount) : 'Not provided by backend'],
      ['Discount type', title(deal.discountType)], ['Discount value', deal.discountType === 'percentage' ? `${deal.discountValue}%` : price(deal.discountValue)],
      ['Starts', date(deal.startAt)], ['Ends', date(deal.endAt)], ['Status', title(deal.status)], ['Featured', deal.featured ? 'Yes' : 'No'],
      ['Created', date(deal.createdAt)], ['Updated', date(deal.updatedAt)], ['Approved', date(deal.approvedAt)], ['Approved by', id(deal.approvedBy) || 'Not approved'], ['Paused', date(deal.pausedAt)], ['Paused by', id(deal.pausedBy) || 'Not paused'], ['Admin feedback', deal.moderationReason || 'None'] ];
    panel.append(image(view.product));
    for (const [label, value] of pairs) { const item = element('div', '', 'break-words'); item.append(element('dt', label, 'text-light-gray text-sm'), element('dd', value)); info.append(item); } panel.append(info);
    panel.append(element('p', 'Prices are current backend values, not historical order prices. Inactive Deals have no resolved Deal price in this API.', 'text-light-gray text-sm mt-4'));
    panel.append(element('h3', 'Moderation history', 'font-bold text-accent-cyan mt-5 mb-2'));
    const history = element('ul', '', 'space-y-2');
    for (const entry of Array.isArray(deal.history) ? deal.history : []) history.append(element('li', `${date(entry.at)} · ${entry.action || 'Unknown action'} · Actor ${id(entry.actor) || 'Unavailable'}${entry.reason ? ` · ${entry.reason}` : ''}`, 'text-sm break-words'));
    if (!history.children.length) history.append(element('li', 'No history returned.')); panel.append(history);
  }

  function showModeration(deal, action) {
    const { panel, button: close, close: closeModal } = modal(`${title(action)} Deal`);
    const product = views.get(id(deal._id))?.product;
    panel.append(element('p', `${title(action)} “${product?.name || id(deal.productId)}”? The backend will revalidate eligibility and current status.`));
    if (action === 'unpause') panel.append(element('p', 'Only a previously approved, unedited paused Deal can be restored.', 'text-light-gray mt-2'));
    const form = document.createElement('form'); form.className = 'mt-4';
    const label = element('label', action === 'reject' ? 'Rejection reason (required)' : 'Admin feedback (optional)', 'block text-light-gray');
    const reason = document.createElement('textarea'); reason.maxLength = 500; reason.required = action === 'reject'; reason.rows = 3; reason.className = 'input-field w-full mt-2'; label.append(reason);
    const error = element('p', '', 'text-red-400 my-3'); error.setAttribute('role', 'alert');
    const submit = element('button', `Confirm ${action}`, `btn ${action === 'reject' ? 'btn-danger' : 'btn-success'} px-5 py-3`); submit.type = 'submit'; form.append(label, error, submit); panel.append(form);
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (changing || loading) return;
      const text = reason.value.trim(); if ((action === 'reject' && !text) || text.length > 500) { error.textContent = 'Enter a rejection reason of up to 500 characters.'; reason.focus(); return; }
      changing = true; submit.disabled = true; close.disabled = true; reason.disabled = true; controls(); error.textContent = 'Saving…';
      let saved = false;
      try {
        const result = await request(`/api/admin/deals/${id(deal._id)}/moderation`, { method: 'PATCH', body: { action, ...(text ? { reason: text } : {}) } });
        const updated = validateDeal(result?.deal); if (id(updated._id) !== id(deal._id)) throw new Error('Unexpected response. Refresh before retrying.');
        rows = rows.map(row => id(row._id) === id(updated._id) ? updated : row); views.delete(id(updated._id)); render();
        saved = true; displayMessage(escapeHtml(`Deal ${action} action saved.`), 'success');
      } catch (failure) { error.textContent = failure.message; }
      finally { changing = false; submit.disabled = false; close.disabled = false; reason.disabled = false; controls(); }
      if(saved) { closeModal(); await load(page); }
    });
  }

  function resetFilter() { rows = []; views.clear(); hasMore = false; page = 1; total = 0; render(); load(1); }
  field('dealsStatus').addEventListener('change', resetFilter);
  field('dealsLimit').addEventListener('change', resetFilter);
  field('dealsRefresh').addEventListener('click', () => load(page));
  field('dealsRetry').addEventListener('click', () => load(requestedPage));
  field('dealsPrevious').addEventListener('click', () => load(page - 1));
  field('dealsNext').addEventListener('click', () => load(page + 1));
  field('logoutAdminBtn')?.addEventListener('click', () => { clearAdminSession(); redirectToLogin('logout'); });
  load(1);
})();
