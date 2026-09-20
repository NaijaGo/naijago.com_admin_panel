(() => {
  if (!['product-moderation', 'carousel-slides'].includes(currentPage) || !adminToken) return;
  const anchor = document.getElementById('productModerationList')?.closest('.card') || document.getElementById('carouselSlidesSection');
  if (!anchor) return;
  const el = (tag, text = '', cls = '') => { const node = document.createElement(tag); node.textContent = text; node.className = cls; return node; };
  const panel = el('section', '', 'card p-6 mb-8');
  panel.append(el('h2', 'Background work', 'text-2xl font-bold text-accent-cyan'),
    el('p', 'Explore notifications and temporary video cleanup. A running backend worker is required. Fix the configuration or provider problem before retrying. Payment jobs are not controlled here.', 'text-light-gray my-3'));
  const filter = el('select', '', 'input-field'); filter.setAttribute('aria-label', 'Job status');
  for (const state of ['failed', 'queued', 'running', 'completed', 'cancelled']) { const option = el('option', state); option.value = state; filter.append(option); }
  const refresh = el('button', 'Refresh jobs', 'btn btn-primary px-4 py-2 ml-3');
  const status = el('p', '', 'text-light-gray my-3'); status.setAttribute('role', 'status');
  const list = el('div', '', 'space-y-3');
  const more = el('button', 'More jobs', 'btn btn-primary-alt px-4 py-2 mt-3'); more.hidden = true;
  panel.append(filter, refresh, status, list, more); anchor.before(panel);
  let cursor = null, epoch = 0;
  async function request(path, options = {}) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${BASE_URL}/api/admin/background-jobs${path}`, { ...options, signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` } });
      if (handleAdminSessionExpiry(response.status)) throw new Error('Please sign in again.');
      const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Jobs are unavailable.'); return data;
    } finally { clearTimeout(timer); }
  }
  function card(job) {
    const item = el('article', '', 'border border-slate-600 rounded-xl p-4');
    item.append(el('h3', `${job.type} - ${job.state}`, 'font-bold'),
      el('p', `Job ${job._id} | Attempts ${job.attempts}/${job.maxAttempts}`, 'text-light-gray text-sm'),
      el('p', job.errorCode ? `Reason: ${job.errorCode}` : `Scheduled: ${new Date(job.runAt).toLocaleString('en-GB', { timeZone: 'Africa/Lagos' })} WAT`, 'text-light-gray my-2'));
    if (job.state === 'failed' && (job.manualRetries || 0) < 3 && Date.now() - Date.parse(job.createdAt) < 7 * 86400000) {
      const reason = el('input', '', 'input-field w-full'); reason.placeholder = 'What did you fix before retrying?'; reason.maxLength = 500; reason.setAttribute('aria-label', 'Retry reason');
      const retry = el('button', 'Queue retry', 'btn btn-primary-alt px-4 py-2 mt-2');
      retry.onclick = async () => {
        if (!reason.value.trim()) { reason.focus(); return; }
        retry.disabled = true;
        try {
          await request(`/${job._id}/retry`, { method: 'POST', body: JSON.stringify({ revision: job.__v || 0, reason: reason.value.trim() }) });
          status.textContent = 'Retry queued; this does not mean delivery has completed.'; await load();
        } catch (error) { status.textContent = error.message; retry.disabled = false; }
      };
      item.append(reason, retry);
    }
    for (const review of job.reviewHistory || []) item.append(el('p', `Retry audit: ${review.reason}`, 'text-xs text-light-gray mt-2'));
    return item;
  }
  async function load(append = false) {
    const version = ++epoch; refresh.disabled = true; more.disabled = true;
    try {
      const data = await request(`?state=${filter.value}${append && cursor ? `&before=${cursor}` : ''}`);
      if (version !== epoch) return;
      if (!append) list.replaceChildren();
      for (const job of data.jobs || []) list.append(card(job));
      cursor = data.nextCursor; more.hidden = !cursor;
      if (!list.children.length) status.textContent = 'No jobs with this status.';
    } catch (error) { if (version === epoch) status.textContent = error.message; }
    finally { if (version === epoch) { refresh.disabled = false; more.disabled = false; } }
  }
  filter.onchange = () => load(); refresh.onclick = () => load(); more.onclick = () => load(true); load();
})();
