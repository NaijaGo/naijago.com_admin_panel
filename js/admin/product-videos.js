/* Product-video review extends the existing catalogue moderation screen. */
(() => {
  if (currentPage !== 'product-moderation' || !adminToken) return;
  const anchor = document.getElementById('productModerationList')?.closest('.card');
  if (!anchor) return;

  const element = (tag, text, className = '') => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    node.className = className;
    return node;
  };
  const panel = element('section', '', 'card p-6 mb-8');
  panel.id = 'productVideoReview';
  panel.append(element('h2', 'Product video review', 'text-3xl font-bold text-accent-cyan'));
  panel.append(element('p', 'Watch the full video before approving it. Product appearance, claims, rights and content must follow the upload guidelines.', 'text-light-gray mt-2'));
  const controls = element('div', '', 'flex flex-wrap items-center gap-3 mt-5');
  const filter = element('select', '', 'input-field');
  filter.setAttribute('aria-label', 'Video review status');
  for (const [value, label] of [['pending_review', 'Awaiting review'], ['approved', 'Approved'], ['rejected', 'Rejected']]) {
    const option = element('option', label); option.value = value; filter.append(option);
  }
  const refresh = element('button', 'Refresh videos', 'btn btn-primary px-4 py-2');
  controls.append(filter, refresh);
  const status = element('p', 'Checking video availability...', 'text-light-gray mt-4');
  status.setAttribute('role', 'status');
  const list = element('div', '', 'grid gap-5 mt-5 lg:grid-cols-2');
  const paging = element('div', '', 'flex gap-3 mt-5');
  const previous = element('button', 'Previous', 'btn btn-primary-alt px-4 py-2');
  const next = element('button', 'Next', 'btn btn-primary-alt px-4 py-2');
  paging.append(previous, next);
  panel.append(controls, status, list, paging);
  anchor.before(panel);
  let page = 1;
  let epoch = 0;
  let enabled = false;

  async function request(path, options = {}) {
    const response = await fetch(`${BASE_URL}/api/product-media${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    });
    if (handleAdminSessionExpiry(response.status)) throw new Error('Please sign in again.');
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to load product videos.');
    return data;
  }

  function mediaUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' ? url.href : '';
    } catch { return ''; }
  }

  function renderVideo(asset) {
    const card = element('article', '', 'rounded-xl border border-slate-600 p-4');
    card.append(element('h3', asset.product?.name || 'Product not yet saved', 'text-xl font-semibold text-light-slate'));
    card.append(element('p', `${asset.ownerName} - ${Math.ceil(asset.duration || 0)} seconds`, 'text-light-gray my-2'));
    const player = document.createElement('video');
    player.controls = true;
    player.preload = 'none';
    player.playsInline = true;
    player.className = 'w-full rounded-lg bg-black';
    player.style.maxHeight = '360px';
    player.src = mediaUrl(asset.url);
    player.poster = mediaUrl(asset.posterUrl);
    player.setAttribute('aria-label', 'Product video for moderation');
    card.append(player);
    if (asset.rejectionReason) card.append(element('p', asset.rejectionReason, 'text-rose-300 mt-3'));
    const reason = document.createElement('textarea');
    reason.className = 'input-field w-full mt-3';
    reason.placeholder = 'Reason (required when rejecting)';
    reason.setAttribute('aria-label', 'Moderation reason');
    reason.maxLength = 1000;
    const message = element('p', '', 'text-light-gray my-2');
    message.setAttribute('role', 'status');
    const actions = element('div', '', 'flex gap-3 mt-3');
    const approve = element('button', 'Approve video', 'btn btn-success px-4 py-2');
    const reject = element('button', 'Reject video', 'btn btn-danger px-4 py-2');
    actions.append(approve, reject);
    card.append(reason, message, actions);

    async function review(decision) {
      if (decision === 'rejected' && !reason.value.trim()) {
        message.textContent = 'Explain what needs to change before rejecting this video.';
        reason.focus(); return;
      }
      approve.disabled = true; reject.disabled = true;
      message.textContent = 'Saving review...';
      try {
        await request(`/assets/${encodeURIComponent(asset.id)}/review`, {
          method: 'PUT', body: JSON.stringify({
            status: decision, reason: reason.value.trim(), revision: asset.revision,
          }),
        });
        player.pause();
        await load();
      } catch (error) {
        message.textContent = error.message;
        approve.disabled = false; reject.disabled = false;
      }
    }
    approve.addEventListener('click', () => review('approved'));
    reject.addEventListener('click', () => review('rejected'));
    return card;
  }

  async function load() {
    if (!enabled) return;
    const requestEpoch = ++epoch;
    status.textContent = 'Loading videos...';
    previous.disabled = true; next.disabled = true;
    try {
      const result = await request(`/review?status=${filter.value}&page=${page}`);
      if (requestEpoch !== epoch) return;
      list.querySelectorAll('video').forEach((video) => video.pause());
      list.replaceChildren(...result.videos.map(renderVideo));
      status.textContent = result.videos.length ? `Page ${page} - ${result.videos.length} videos` : 'No videos in this queue.';
      previous.disabled = page <= 1;
      next.disabled = !result.hasMore;
    } catch (error) {
      if (requestEpoch === epoch) status.textContent = error.message;
    }
  }

  refresh.addEventListener('click', load);
  filter.addEventListener('change', () => { page = 1; load(); });
  previous.addEventListener('click', () => { if (page > 1) { page--; load(); } });
  next.addEventListener('click', () => { page++; load(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) list.querySelectorAll('video').forEach((video) => video.pause());
  });
  request('/config').then((config) => {
    enabled = config.enabled === true;
    if (enabled) load();
    else {
      status.textContent = 'Product video uploads are disabled. Enable them after Cloudinary and device verification are complete.';
      previous.disabled = next.disabled = refresh.disabled = true;
    }
  }).catch(() => { status.textContent = 'Video review is unavailable. Deploy the media API, then refresh this page.'; });
})();
