(() => {
  if (!['product-moderation', 'carousel-slides'].includes(currentPage) || !adminToken) return;
  const anchor = document.getElementById('productModerationList')?.closest('.card') || document.getElementById('carouselSlidesSection');
  if (!anchor) return;
  const el = (tag, text = '', cls = '') => { const node = document.createElement(tag); node.textContent = text; node.className = cls; return node; };
  const panel = el('section', '', 'card p-6 mb-8');
  panel.append(el('h2', 'Explore safety reports', 'text-3xl font-bold text-accent-cyan'),
    el('p', 'Review reported comments, listings and campaigns. Vendor owners cannot delete customer criticism. Every moderation decision requires a reason.', 'text-light-gray my-3'));
  const controls = el('div', '', 'flex gap-3');
  const filter = el('select', '', 'input-field'); filter.setAttribute('aria-label', 'Report status');
  for (const value of ['open', 'resolved', 'dismissed']) { const option = el('option', value); option.value = value; filter.append(option); }
  const refresh = el('button', 'Refresh reports', 'btn btn-primary px-4 py-2'); controls.append(filter, refresh);
  const status = el('p', '', 'text-light-gray my-4'); status.setAttribute('role', 'status');
  const list = el('div', '', 'space-y-4');
  const next = el('button', 'More reports', 'btn btn-primary-alt px-4 py-2 mt-4'); next.hidden = true;
  panel.append(controls, status, list, next); anchor.before(panel);
  let cursor = null, epoch = 0;
  async function request(path, options = {}) {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${BASE_URL}/api/explore/admin/reports${path}`, { ...options, signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` } });
      if (handleAdminSessionExpiry(response.status)) throw new Error('Sign in again.');
      const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Reports are unavailable.'); return data;
    } finally { clearTimeout(timeout); }
  }
  function card(report) {
    const node = el('article', '', 'border border-slate-600 rounded-xl p-4');
    node.append(el('h3', `${report.targetType}: ${report.reason}`, 'font-bold text-lg'),
      el('p', `Target: ${report.target}`, 'text-xs text-light-gray my-2'),
      el('p', report.details || 'No further details supplied.', 'text-light-gray'));
    if (report.comment) node.append(el('blockquote', report.comment.body, 'border-l-4 border-cyan-400 pl-4 my-4 whitespace-pre-wrap'));
    else {
      const link = el('a', report.targetType === 'campaign' ? 'Review campaign in the editor' : 'Review product in the catalogue', 'block text-accent-cyan my-3');
      link.href = report.targetType === 'campaign' ? 'carousel-slides.html' : 'product-moderation.html'; node.append(link);
    }
    const reason = el('textarea', '', 'input-field w-full mt-3'); reason.placeholder = 'Required review reason'; reason.maxLength = 1000; reason.value = report.resolution || ''; reason.setAttribute('aria-label', 'Moderation reason'); node.append(reason);
    const actions = el('div', '', 'flex flex-wrap gap-3 mt-3');
    for (const [label, state, hideComment] of [
      ['Dismiss report', 'dismissed', false], ['Mark resolved', 'resolved', false],
      ...(report.targetType === 'comment' ? [['Hide comment and resolve', 'resolved', true]] : []),
    ]) {
      const button = el('button', label, 'btn btn-primary-alt px-4 py-2');
      button.onclick = async () => {
        if (!reason.value.trim()) { reason.focus(); status.textContent = 'Enter a review reason.'; return; }
        [...actions.children].forEach((item) => { item.disabled = true; });
        try {
          await request(`/${report._id}`, { method: 'PUT', body: JSON.stringify({ state, hideComment, resolution: reason.value.trim(), revision: report.__v || 0 }) });
          status.textContent = 'Review saved.'; await load();
        } catch (error) { status.textContent = error.message; [...actions.children].forEach((item) => { item.disabled = false; }); }
      };
      actions.append(button);
    }
    node.append(actions); return node;
  }
  async function load(append = false) {
    const version = ++epoch; refresh.disabled = true; next.disabled = true;
    try {
      const data = await request(`?state=${filter.value}${append && cursor ? `&before=${cursor}` : ''}`);
      if (version !== epoch) return;
      if (!append) list.replaceChildren(); for (const report of data.reports || []) list.append(card(report));
      cursor = data.nextCursor; next.hidden = !cursor;
      if (!list.children.length) status.textContent = 'No reports in this queue.';
    } catch (error) { status.textContent = error.message; }
    finally { refresh.disabled = false; next.disabled = false; }
  }
  filter.onchange = () => load(); refresh.onclick = () => load(); next.onclick = () => load(true); load();
})();
