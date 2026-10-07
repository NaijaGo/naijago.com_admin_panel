(() => {
  if (currentPage !== 'review-moderation' || !adminToken) return;
  const list = document.getElementById('reviewList');
  const status = document.getElementById('reviewStatus');
  const filter = document.getElementById('reviewFilter');
  const more = document.getElementById('reviewMore');
  let page = 0;
  let busy = false;
  const text = (tag, value, className = '') => {
    const element = document.createElement(tag);
    element.textContent = String(value || '');
    element.className = className;
    return element;
  };
  async function request(path, body) {
    const response = await fetch(`${BASE_URL}/api/reviews${path}`, {
      method: body ? 'PUT' : 'GET',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status === 401 || response.status === 403) {
      clearAdminSession(); redirectToLogin('session-expired');
      throw new Error('Admin authorization is required.');
    }
    const data = await response.json();
    if (!response.ok) throw new Error(response.status < 500 ? data.message || 'Unable to update review.' : 'Reviews are temporarily unavailable.');
    return data;
  }
  async function moderate(id, decision, button) {
    const reason = decision === 'rejected' ? prompt('Why is this review being rejected? (required)') : '';
    if (decision === 'rejected' && !reason?.trim()) return;
    button.disabled = true;
    try {
      await request(`/${encodeURIComponent(id)}/moderation`, { status: decision, reason: reason.trim() });
      await load(true);
    } catch (error) { status.textContent = error.message || 'Unable to moderate review.'; }
    finally { button.disabled = false; }
  }
  function render(review) {
    const card = text('article', '', 'border border-slate-600 rounded-xl p-5');
    card.append(text('h2', review.product?.name || 'Product no longer available', 'text-xl font-bold text-light-slate'));
    card.append(text('p', `${review.user?.firstName || 'Customer'} — ${Number(review.rating)} / 5${review.verifiedPurchase ? ' · Verified purchase' : ''}`, 'text-light-gray mt-2'));
    card.append(text('p', review.comment, 'text-light-gray mt-3 whitespace-pre-wrap'));
    const photos = text('div', '', 'flex flex-wrap gap-2 mt-4');
    for (const photo of (review.photos || []).slice(0, 5)) {
      let url;
      try { url = new URL(photo.url); } catch (_) { continue; }
      if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') continue;
      const link = document.createElement('a'); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
      const image = document.createElement('img'); image.src = url.href; image.alt = 'Customer product photo'; image.loading = 'lazy'; image.className = 'w-28 h-28 object-cover rounded-lg';
      link.append(image); photos.append(link);
    }
    card.append(photos);
    for (const report of (review.reports || [])) card.append(text('p', `Report: ${report.reason}`, 'text-amber-300 mt-3'));
    const actions = text('div', '', 'flex gap-3 mt-5');
    for (const [decision, label] of [['approved', 'Approve'], ['rejected', 'Reject']]) {
      const button = text('button', label, `btn ${decision === 'approved' ? 'btn-success' : 'btn-danger'} px-4 py-2`);
      button.addEventListener('click', () => moderate(review._id, decision, button)); actions.append(button);
    }
    card.append(actions); list.append(card);
  }
  async function load(reset = false) {
    if (busy) return;
    busy = true; status.textContent = 'Loading reviews…';
    try {
      const next = reset ? 1 : page + 1;
      const data = await request(`/admin?status=${encodeURIComponent(filter.value)}&page=${next}&limit=20`);
      if (reset) list.replaceChildren();
      for (const review of data.reviews || []) render(review);
      page = next; more.classList.toggle('hidden', !data.hasMore);
      status.textContent = list.children.length ? `${data.total} reviews in this queue.` : 'No reviews in this queue.';
    } catch (error) { status.textContent = error.message || 'Could not load reviews.'; }
    finally { busy = false; }
  }
  filter.addEventListener('change', () => load(true));
  document.getElementById('reviewRefresh').addEventListener('click', () => load(true));
  more.addEventListener('click', () => load());
  document.getElementById('logoutAdminBtn').addEventListener('click', () => { clearAdminSession(); redirectToLogin('logout'); });
  load(true);
})();
