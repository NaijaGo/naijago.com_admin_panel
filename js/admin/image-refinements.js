(() => {
  if (currentPage !== 'product-moderation' || !adminToken) return;
  const anchor = document.getElementById('productModerationList')?.closest('.card');
  if (!anchor) return;
  const el = (tag, text = '', cls = '') => { const node = document.createElement(tag); node.textContent = text; node.className = cls; return node; };
  const button = (text) => { const node = el('button', text, 'btn btn-primary-alt px-4 py-2'); node.type = 'button'; return node; };
  const select = (label, entries) => {
    const node = el('select', '', 'input-field'); node.setAttribute('aria-label', label);
    for (const [value, text] of entries) { const option = el('option', text); option.value = value; node.append(option); } return node;
  };
  const checkbox = (text) => { const label = el('label', '', 'flex items-start gap-3 my-3'); const input = el('input'); input.type = 'checkbox'; label.append(input, el('span', text)); return { label, input }; };
  const panel = el('section', '', 'card p-6 mb-8'); panel.id = 'imageRefinements';
  const status = el('p', 'Checking image processing configuration...', 'text-light-gray my-3'); status.setAttribute('role', 'status');
  panel.append(el('h2', 'Product image studio', 'text-3xl font-bold text-accent-cyan'),
    el('p', 'Originals are retained. Refined candidates stay private until you approve them. Check the exact product, labels, colours and quantity. This never changes stock, prices or product availability.', 'text-light-gray my-3'), status);
  const batch = el('details', '', 'border border-slate-600 rounded-xl p-4 my-4'); batch.append(el('summary', 'Refine existing products in a batch (up to 20)', 'font-bold cursor-pointer'));
  const term = el('input', '', 'input-field my-3'); term.placeholder = 'Product name, brand, SKU or category'; term.maxLength = 200; term.setAttribute('aria-label', 'Find products to refine');
  const find = button('Search products'), previous = button('Previous products'), next = button('More products');
  const choices = el('div', '', 'space-y-2 my-3'); choices.style.maxHeight = '18rem'; choices.style.overflowY = 'auto';
  const profiles = [['standard', 'White background + centering + soft shadow'], ['relight', 'Also improve lighting (check colours carefully)']];
  const profile = select('Batch image style', profiles);
  const rights = checkbox('I have permission to send these product images to Photoroom for refinement.');
  const inspect = button('Preview selected photos');
  const previewList = el('div', '', 'space-y-3 my-4');
  const queue = button('Queue selected images'), batchStatus = el('p', '', 'text-light-gray my-3'); batchStatus.setAttribute('role', 'status');
  queue.disabled = inspect.disabled = true;
  batch.append(term, find, choices, previous, next, profile, inspect, previewList, rights.label, queue, batchStatus); panel.append(batch);
  const controls = el('div', '', 'flex flex-wrap gap-3 my-4');
  const state = select('Image review status', [['', 'All image states'], ...['queued', 'preserving', 'generating', 'pending_review', 'publishing', 'approved', 'rejected', 'failed', 'uncertain', 'obsolete'].map((value) => [value, value.replaceAll('_', ' ')])]);
  const refresh = button('Refresh reviews'), more = button('More reviews'); more.hidden = true;
  const list = el('div', '', 'space-y-5'); controls.append(state, refresh); panel.append(controls, list, more); anchor.before(panel);
  const selected = new Set(), cards = new Map();
  let page = 1, cursor = null, processingEnabled = false, epoch = 0, searchEpoch = 0, busy = false, pollCount = 0, activeState = '';
  let previewKey = '', previewImages = 0, previewEpoch = 0, inspecting = false, queueing = false;
  const selectionKey = () => [...selected].sort().join(',');
  function syncBatch() {
    inspect.disabled = !processingEnabled || !selected.size || inspecting || queueing;
    queue.disabled = !processingEnabled || !rights.input.checked || !selected.size ||
      previewKey !== selectionKey() || !previewImages || inspecting || queueing;
  }
  function invalidatePreview() {
    ++previewEpoch; previewKey = ''; previewImages = 0; inspecting = false;
    previewList.replaceChildren(); syncBatch();
  }
  async function api(path, options = {}, catalog = false) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${BASE_URL}/api/${catalog ? 'products/admin/catalog' : 'image-refinements'}${path}`, {
        ...options, signal: controller.signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      });
      if (handleAdminSessionExpiry(response.status)) throw new Error('Sign in again.');
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.message === 'string' && data.message.length < 300 ? data.message : 'Image review is temporarily unavailable.');
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Connection timed out. Refresh to check whether the request was saved before trying again.');
      if (error instanceof TypeError) throw new Error('Cannot connect. Check your internet and try again.'); throw error;
    } finally { clearTimeout(timer); }
  }
  async function search(reset = false) {
    if (reset) page = 1;
    const version = ++searchEpoch; find.disabled = previous.disabled = next.disabled = true;
    try {
      const data = await api(`?${new URLSearchParams({ q: term.value.trim(), page: String(page), limit: '20' })}`, {}, true);
      if (version !== searchEpoch) return; choices.replaceChildren();
      for (const product of data.products || []) {
        const item = checkbox(`${product.name} | ${product.sellerName || product.vendor?.storeName || 'NaijaGo'} | ${product.productStatus || ''}`);
        item.input.checked = selected.has(product._id);
        item.input.onchange = () => {
          if (queueing) { item.input.checked = selected.has(product._id); return; }
          if (item.input.checked && selected.size >= 20) { item.input.checked = false; batchStatus.textContent = 'Select at most 20 products per batch.'; return; }
          if (item.input.checked) selected.add(product._id); else selected.delete(product._id);
          invalidatePreview();
          batchStatus.textContent = `${selected.size} products selected.`;
        };
        choices.append(item.label);
      }
      previous.hidden = page <= 1; next.hidden = page * 20 >= data.total;
      batchStatus.textContent = `Page ${page} | ${data.total || 0} products | ${selected.size} selected.`;
    } catch (error) { batchStatus.textContent = error.message; }
    finally { if (version === searchEpoch) find.disabled = previous.disabled = next.disabled = false; }
  }
  inspect.onclick = async () => {
    const version = ++previewEpoch, key = selectionKey();
    inspecting = true; previewKey = ''; previewImages = 0; syncBatch();
    batchStatus.textContent = 'Inspecting selected photos. No images are being processed yet.';
    try {
      const data = await api('/preview', { method: 'POST', body: JSON.stringify({ productIds: [...selected] }) });
      if (version !== previewEpoch || key !== selectionKey()) return;
      previewList.replaceChildren();
      for (const product of data.products || []) {
        const group = el('article', '', 'border border-slate-600 rounded-xl p-3');
        group.append(el('h3', product.productName || 'Product unavailable', 'font-bold'),
          el('p', `${product.newImages} new photos | ${product.skippedImages || 0} need re-upload${product.state === 'reupload_required' ? ' | Product requires individual review/re-upload' : ''}`, 'text-light-gray my-2'));
        const photos = el('div', '', 'grid grid-cols-2 md:grid-cols-4 gap-3');
        for (const image of product.images || []) {
          if (!image.eligible) { photos.append(el('p', image.reason, 'text-amber-300 p-3')); continue; }
          photos.append(picture(image.recordedState ? `Existing review: ${image.recordedState.replaceAll('_', ' ')}` : 'Original to process', image.sourceUrl));
        }
        group.append(photos); previewList.append(group);
      }
      previewKey = key; previewImages = data.newImages;
      batchStatus.textContent = `${previewImages} new photos selected for processing. ${data.message}`;
    } catch (error) { if (version === previewEpoch) batchStatus.textContent = error.message; }
    finally { if (version === previewEpoch) { inspecting = false; syncBatch(); } }
  };
  rights.input.onchange = syncBatch;
  function picture(title, address) {
    const figure = el('figure', '', 'rounded-xl border border-slate-600 overflow-hidden'); figure.append(el('figcaption', title, 'font-bold p-3'));
    if (address) {
      const image = el('img'); image.alt = title; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer';
      image.style.cssText = 'width:100%;height:280px;object-fit:contain;background:white;';
      try { if (new URL(address).protocol === 'https:') image.src = address; } catch (_) {}
      image.onerror = () => { image.hidden = true; figure.append(el('p', 'Private link expired or unavailable. Refresh reviews to reload.', 'p-3')); }; figure.append(image);
    } else figure.append(el('p', 'Waiting for processing. The original product image has not been replaced.', 'p-3 text-light-gray'));
    return figure;
  }
  function card(row) {
    const node = el('article', '', 'border border-slate-600 rounded-xl p-5');
    node.append(el('h3', row.productName, 'text-xl font-bold'), el('p', `${row.state.replaceAll('_', ' ')} | Attempt ${row.generation}/3 | ${row.profile}${row.sandbox ? ' | SANDBOX - cannot publish' : ''}`, 'text-light-gray my-2'));
    const pair = el('div', '', 'grid grid-cols-1 md:grid-cols-2 gap-4 my-4'); pair.append(picture('Original (preserved)', row.originalUrl), picture('Refined candidate (review required)', row.candidateUrl)); node.append(pair);
    if (row.code) node.append(el('p', `Processing note: ${row.code.replaceAll('_', ' ')}.`, 'text-amber-300 my-2'));
    const history = el('details', '', 'my-3'); history.append(el('summary', 'Review history'));
    for (const event of row.history || []) history.append(el('p', `${new Date(event.at).toLocaleString()}: ${event.action} - ${event.reason || ''}`, 'text-light-gray text-sm my-2'));
    node.append(history);
    const note = el('textarea', '', 'input-field w-full my-3'); note.placeholder = 'Reason for this decision'; note.maxLength = 1000; note.setAttribute('aria-label', 'Image review reason');
    const confirmed = checkbox('I checked the real product identity, colours, labels, quantity and image rights.');
    const style = select('Regeneration style', profiles); style.value = row.profile;
    const actions = el('div', '', 'flex flex-wrap gap-3'); const feedback = el('p', '', 'text-light-gray my-3'); feedback.setAttribute('role', 'status');
    const available = [];
    if (row.state === 'pending_review') { if (!row.sandbox) available.push(['approve', 'Approve and publish']); available.push(['reject', 'Reject']); }
    if (row.canRegenerate) available.push(['regenerate', 'Regenerate (uses budget)']);
    if (row.state === 'uncertain' && row.storedState === 'publishing') available.push(['retry_publish', 'Retry approved publication']);
    for (const [action, label] of available) {
      const control = button(label); actions.append(control);
      control.onclick = async () => {
        if (!note.value.trim()) { feedback.textContent = 'Enter a review reason.'; note.focus(); return; }
        if (action === 'approve' && !confirmed.input.checked) { feedback.textContent = 'Confirm product accuracy and rights first.'; return; }
        for (const item of actions.children) item.disabled = true;
        try {
          const result = await api(`/${row.id}`, { method: 'PUT', body: JSON.stringify({ action, reason: note.value.trim(), identityConfirmed: confirmed.input.checked, profile: style.value, revision: row.revision }) });
          const updated = card(result); node.replaceWith(updated); cards.set(row.id, { node: updated, row: result }); pollCount = 0;
        } catch (error) { feedback.textContent = error.message; for (const item of actions.children) item.disabled = false; }
      };
    }
    if (available.length) node.append(note, ...(row.state === 'pending_review' && !row.sandbox ? [confirmed.label] : []), ...(row.canRegenerate ? [style] : []), actions, feedback);
    return node;
  }
  const pending = (row) => ['queued', 'preserving', 'generating', 'publishing'].includes(row.state);
  async function load(append = false, background = false) {
    if (busy) return; busy = true; const version = ++epoch;
    if (!background) { activeState = state.value; refresh.disabled = more.disabled = true; status.textContent = 'Loading image reviews...'; pollCount = 0; }
    try {
      const params = new URLSearchParams({ ...(activeState ? { state: activeState } : {}), ...(append && cursor ? { before: cursor } : {}) });
      const data = await api(`?${params}`); if (version !== epoch) return;
      if (!append && !background) { cards.clear(); list.replaceChildren(); }
      for (const row of data.images || []) {
        const existing = cards.get(row.id);
        if (background && (!existing || !pending(existing.row))) continue;
        if (background && existing.row.revision === row.revision && existing.row.state === row.state) continue;
        const node = card(row); if (existing) existing.node.replaceWith(node); else list.append(node); cards.set(row.id, { node, row });
      }
      if (!background) { cursor = data.nextCursor; more.hidden = !cursor; status.textContent = cards.size ? 'Private links expire after five minutes. Refresh reviews to reload them.' : 'No image reviews yet. Select an existing product batch above to start a review.'; }
    } catch (error) { status.textContent = error.message; }
    finally { busy = false; refresh.disabled = more.disabled = false; }
  }
  find.onclick = () => search(true); previous.onclick = () => { page--; search(); }; next.onclick = () => { page++; search(); };
  queue.onclick = async () => {
    if (!selected.size || !rights.input.checked || previewKey !== selectionKey() || !previewImages || inspecting || queueing || !processingEnabled) { batchStatus.textContent = 'Preview the selected photos and confirm image-processing permission first.'; return; }
    queueing = true; syncBatch(); profile.disabled = rights.input.disabled = true;
    try {
      const data = await api('/batch', { method: 'POST', body: JSON.stringify({ productIds: [...selected], profile: profile.value, rightsConfirmed: true }) });
      batchStatus.textContent = data.results.map((item) => `${item.productId}: ${item.state}${item.skipped ? ` (${item.skipped} images need re-upload)` : ''}`).join(' | ');
      selected.clear(); invalidatePreview(); for (const input of choices.querySelectorAll('input')) input.checked = false; await load();
    } catch (error) { batchStatus.textContent = error.message; }
    finally { queueing = false; profile.disabled = rights.input.disabled = false; syncBatch(); }
  };
  refresh.onclick = () => load(); more.onclick = () => load(true); state.onchange = () => load();
  const timer = setInterval(() => { if (!document.hidden && !activeState && pollCount++ < 36 && [...cards.values()].some(({ row }) => pending(row))) load(false, true); }, 10000);
  window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
  api('/config').then((config) => {
    processingEnabled = config.processingEnabled; syncBatch(); batch.hidden = !config.enabled;
    const missing = Array.isArray(config.missingConfiguration) ? config.missingConfiguration.filter(name => /^[A-Z_]+$/.test(name)) : [];
    const setup = missing.length ? `Required environment settings: ${missing.join(', ')}.` : '';
    const mode = config.keyModeMismatch ? 'A sandbox key cannot be used in live mode. Keep PHOTOROOM_SANDBOX=true while testing.' : '';
    const worker = 'Processing needs a separate Render background worker running npm run worker:image-refinements. A web-service deployment alone does not run it.';
    batch.append(el('p', worker, 'text-light-gray my-3'));
    if (!config.enabled) { status.textContent = `Image refinement is disabled. ${setup} ${worker}`; refresh.disabled = true; return; }
    if (!processingEnabled) batchStatus.textContent = [setup, mode, config.databaseReady === false ? 'The image-review database indexes need operator setup before processing can start.' : 'Check processing configuration.'].filter(Boolean).join(' ');
    load();
  }).catch((error) => { status.textContent = error.message; queue.disabled = true; });
})();
