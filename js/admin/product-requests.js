(() => {
  if (currentPage !== 'product-moderation' || !adminToken) return;
  const anchor = document.getElementById('productModerationList')?.closest('.card');
  if (!anchor) return;
  const el = (tag, text = '', cls = '') => { const node = document.createElement(tag); node.textContent = text; node.className = cls; return node; };
  const panel = el('section', '', 'card p-6 mb-8'); panel.id = 'productRequests';
  panel.append(el('h2', 'Customer product requests', 'text-3xl font-bold text-accent-cyan'),
    el('p', 'Source real products for customers. AI concepts are private references, not listings or proof of inventory. Link only a verified catalog product; never copy a concept into a live listing without verification.', 'text-light-gray my-3'));
  const controls = el('div', '', 'flex flex-wrap gap-3');
  const state = el('select', '', 'input-field'); state.setAttribute('aria-label', 'Request status');
  for (const value of ['', 'requested', 'sourcing', 'matched', 'unavailable', 'cancelled']) { const option = el('option', value || 'All submitted requests'); option.value = value; state.append(option); }
  const query = el('input', '', 'input-field'); query.placeholder = 'Search customer descriptions'; query.maxLength = 200; query.setAttribute('aria-label', 'Search product requests');
  const refresh = el('button', 'Search / Refresh', 'btn btn-primary px-4 py-2'); refresh.type = 'button'; controls.append(state, query, refresh);
  const status = el('p', '', 'text-light-gray my-3'); status.setAttribute('role', 'status');
  const list = el('div', '', 'space-y-4');
  const more = el('button', 'More requests', 'btn btn-primary-alt px-4 py-2 mt-4'); more.type = 'button'; more.hidden = true;
  panel.append(controls, status, list, more); anchor.before(panel);
  let cursor = null, epoch = 0;
  async function request(path, options = {}, productSearch = false) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(`${BASE_URL}/api/${productSearch ? 'products/search' : 'product-requests/admin'}${path}`, {
        ...options, signal: controller.signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      });
      if (handleAdminSessionExpiry(response.status)) throw new Error('Sign in again.');
      const data = await response.json();
      if (!response.ok) throw new Error(response.status < 500 && typeof data.message === 'string' ? data.message : 'Product requests are temporarily unavailable.');
      return data;
    } catch (error) { if (error.name === 'AbortError') throw new Error('Connection timed out. Refresh to check whether the update was saved.'); throw error; }
    finally { clearTimeout(timer); }
  }
  function card(row) {
    const node = el('article', '', 'border border-slate-600 rounded-xl p-5');
    node.append(el('h3', row.query, 'font-bold text-xl'), el('p', `${row.state} | Request ${row.id}`, 'text-light-gray text-sm my-2'),
      el('p', row.notes || 'No additional requirements.', 'whitespace-pre-wrap'), el('p', Object.entries(row.criteria || {}).map(([key, value]) => `${key}: ${value}`).join(' | '), 'text-light-gray text-sm my-2'));
    if (row.preview?.imageUrl) {
      const image = el('img', '', 'rounded-lg max-w-xs my-3'); image.alt = 'AI-generated concept, not an actual product'; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer';
      try { if (new URL(row.preview.imageUrl).protocol === 'https:') image.src = row.preview.imageUrl; } catch (_) {}
      image.onerror = () => { image.hidden = true; }; node.append(image, el('p', row.preview.label, 'text-amber-300 text-sm'));
    }
    if (row.matchedProduct) node.append(el('p', `Matched listing: ${row.matchedProduct.name} | ${row.matchedProduct.sellerName}`, 'text-green-300 my-3'));
    if (row.matchedUnavailable) node.append(el('p', 'Previously matched listing is unavailable. Re-source or explain the change to the customer.', 'text-amber-300 my-3'));
    const history = el('details', '', 'my-3'); history.append(el('summary', 'Request history'));
    for (const event of row.history || []) history.append(el('p', `${new Date(event.at).toLocaleString()}: ${event.state} - ${event.message || ''}`, 'text-light-gray my-2'));
    node.append(history);
    const allowed = { requested: ['sourcing', 'matched', 'unavailable'], sourcing: ['matched', 'unavailable'], matched: ['sourcing', 'unavailable'], unavailable: ['sourcing', 'matched'] }[row.state];
    if (!allowed) return node;
    const nextState = el('select', '', 'input-field'); nextState.setAttribute('aria-label', 'Next request status');
    for (const value of allowed) { const option = el('option', value); option.value = value; nextState.append(option); }
    const note = el('textarea', '', 'input-field w-full mt-3'); note.maxLength = 1000; note.placeholder = 'Required update the customer will see'; note.setAttribute('aria-label', 'Customer update');
    const lookup = el('div', '', 'my-3');
    const term = el('input', '', 'input-field'); term.value = row.query; term.maxLength = 200; term.setAttribute('aria-label', 'Search real catalog listings');
    const find = el('button', 'Find real listing', 'btn btn-primary-alt px-4 py-2'); find.type = 'button';
    const products = el('select', '', 'input-field w-full mt-3'); products.setAttribute('aria-label', 'Verified catalog product');
    const empty = el('option', 'Select a real catalog listing'); empty.value = ''; products.append(empty);
    const lookupStatus = el('p', '', 'text-light-gray text-sm'); lookupStatus.setAttribute('role', 'status');
    let searchVersion = 0;
    find.onclick = async () => {
      const version = ++searchVersion; find.disabled = true; products.replaceChildren(empty); lookupStatus.textContent = 'Searching real inventory...';
      try {
        const params = new URLSearchParams({ format: 'discovery', q: term.value.trim(), inStock: 'true', ai: 'false', limit: '30' });
        const result = await request(`?${params}`, {}, true); if (version !== searchVersion) return;
        for (const product of result.products || []) { const option = el('option', `${product.name} - ${product.sellerName || 'Seller'} - NGN ${product.effectivePrice ?? product.price}`); option.value = product._id; products.append(option); }
        lookupStatus.textContent = `Showing up to 30 of ${result.total || 0} matches. Refine the name if needed.`;
      } catch (error) { lookupStatus.textContent = error.message; }
      finally { if (version === searchVersion) find.disabled = false; }
    };
    lookup.append(term, find, products, lookupStatus); lookup.hidden = nextState.value !== 'matched';
    nextState.onchange = () => { lookup.hidden = nextState.value !== 'matched'; };
    const save = el('button', 'Update request', 'btn btn-primary px-4 py-2 mt-3'); save.type = 'button';
    const feedback = el('p', '', 'text-light-gray my-2'); feedback.setAttribute('role', 'status');
    save.onclick = async () => {
      if (!note.value.trim()) { note.focus(); feedback.textContent = 'Write a customer-facing update.'; return; }
      if (nextState.value === 'matched' && !products.value) { feedback.textContent = 'Search and select a real available product.'; return; }
      save.disabled = true;
      try {
        const updated = await request(`/${row.id}`, { method: 'PUT', body: JSON.stringify({ state: nextState.value, message: note.value.trim(), productId: products.value || undefined, revision: row.revision }) });
        node.replaceWith(card(updated)); status.textContent = 'Request updated. Customer notification queued.';
      } catch (error) { feedback.textContent = error.message; save.disabled = false; }
    };
    node.append(nextState, note, lookup, save, feedback); return node;
  }
  async function load(append = false) {
    const version = ++epoch; refresh.disabled = true; more.disabled = true; status.textContent = 'Loading requests...';
    try {
      const params = new URLSearchParams({ ...(state.value ? { state: state.value } : {}), ...(query.value.trim() ? { query: query.value.trim() } : {}), ...(append && cursor ? { before: cursor } : {}) });
      const data = await request(`?${params}`); if (version !== epoch) return;
      if (!append) list.replaceChildren(); for (const row of data.requests || []) list.append(card(row));
      cursor = data.nextCursor; more.hidden = !cursor; status.textContent = list.children.length ? 'Submitted requests only; unsent drafts remain private.' : 'No requests match this filter.';
    } catch (error) { if (version === epoch) status.textContent = error.message; }
    finally { if (version === epoch) { refresh.disabled = false; more.disabled = false; } }
  }
  state.onchange = () => load(); refresh.onclick = () => load(); more.onclick = () => load(true);
  load();
})();
