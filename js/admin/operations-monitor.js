// The shared activity renderer expects this page-level date helper.
function formatDate(value) { return formatDateTime(value); }

(() => {
  if (adminToken) {
    initializeSocket();
    initializeAdminActivityCenter();
  }
  document.getElementById('logoutAdminBtn').addEventListener('click', () => {
    clearAdminSession();
    redirectToLogin('logout');
  });
  const byId = (id) => document.getElementById(id);
  const root = '/api/admin/operations-monitor';
  let page = 1;
  let loading = false;
  let version = 0;
  let activityRefresh;
  const text = (tag, value, className = '') => {
    const element = document.createElement(tag);
    element.textContent = String(value);
    element.className = className;
    return element;
  };
  async function api(path, options = {}) {
    const response = await fetch(`${BASE_URL}${root}${path}`, { ...options, headers: {
      'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}`,
    }, signal: AbortSignal.timeout(15000) });
    if (handleAdminSessionExpiry(response.status)) throw new Error('Admin session expired.');
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Monitoring is temporarily unavailable.');
    return data;
  }
  async function loadSettings() {
    const data = await api('/settings');
    for (const key of ['visitorTrackingEnabled', 'updatesEnabled', 'pushEnabled']) byId(key).checked = data.settings[key];
    byId('intervalMinutes').value = String(data.settings.intervalMinutes);
    if (!byId('intervalMinutes').value) {
      const option = text('option', `${data.settings.intervalMinutes} minutes`);
      option.value = String(data.settings.intervalMinutes);
      byId('intervalMinutes').append(option);
      byId('intervalMinutes').value = option.value;
    }
    const missingPush = Array.isArray(data.missingPushConfiguration)
      ? data.missingPushConfiguration.filter(name => /^ADMIN_ONESIGNAL_[A-Z_]+$/.test(name)) : [];
    byId('providerStatus').textContent = data.pushConfigured
      ? 'Admin push provider configured. Enable push in the notification bell and allow browser notifications to subscribe this browser.'
      : `Admin push is not configured.${missingPush.length ? ` Required Render backend settings: ${missingPush.join(', ')}.` : ''} Updates remain available in the notification bell.`;
    byId('saveMonitor').disabled = false;
  }
  async function loadVisitors() {
    const current = ++version;
    const data = await api(`/visitors?days=${byId('visitorDays').value}&page=${page}`);
    if (current !== version) return;
    byId('visitorSummary').textContent = `${data.sessions} guest sessions · ${data.views} page views`;
    byId('visitorSources').textContent = data.sources.map((source) => `${source._id}: ${source.views} views`).join(' · ');
    byId('visitorRows').replaceChildren(...data.recent.map((visit) => {
      const row = document.createElement('tr');
      row.append(...[visit.session, visit.source, visit.page, visit.device, new Date(visit.createdAt).toLocaleString()].map((value) => text('td', value, 'p-2 border-b border-slate-700')));
      return row;
    }));
    byId('visitorPage').textContent = `Page ${data.page}`;
    byId('visitorPrevious').disabled = data.page <= 1;
    byId('visitorNext').disabled = !data.hasMore;
  }
  async function refresh() {
    if (loading || !adminToken) return;
    loading = true;
    byId('monitorStatus').textContent = 'Refreshing…';
    try {
      const data = await api('/overview');
      byId('operationMetrics').replaceChildren(...Object.entries(data.metrics).map(([key, label]) => {
        const card = text('div', '', 'rounded-xl bg-slate-900 p-4');
        card.append(text('p', label, 'text-sm text-light-gray'), text('p', data.snapshot[key], 'text-3xl font-bold mt-2'));
        return card;
      }));
      byId('operationDigests').replaceChildren(...data.digests.map((digest) => {
        const card = text('article', '', 'border border-slate-700 rounded-xl p-4');
        card.append(text('h3', `${new Date(digest.windowStart).toLocaleString()} — ${new Date(digest.windowEnd).toLocaleString()}`),
          text('p', 'Verified database summary · rules-based', 'text-sm text-light-gray'));
        digest.priorities.forEach((key) => card.append(text('p', `${data.metrics[key]}: ${digest.snapshot[key]}`)));
        if (!digest.priorities.length) card.append(text('p', 'No activity recorded in this period.'));
        return card;
      }));
      if (!data.digests.length) byId('operationDigests').append(text('p', 'No scheduled updates yet. Enable updates above to begin.'));
      await loadVisitors();
      byId('monitorStatus').textContent = `Updated ${new Date().toLocaleTimeString()}`;
    } catch (error) { byId('monitorStatus').textContent = error.message; }
    finally { loading = false; }
  }
  byId('monitorSettings').addEventListener('submit', async (event) => {
    event.preventDefault();
    byId('saveMonitor').disabled = true;
    try {
      const settings = { intervalMinutes: Number(byId('intervalMinutes').value) };
      for (const key of ['visitorTrackingEnabled', 'updatesEnabled', 'pushEnabled']) settings[key] = byId(key).checked;
      await api('/settings', { method: 'PUT', body: JSON.stringify(settings) });
      byId('monitorStatus').textContent = 'Monitoring settings saved.';
    } catch (error) { byId('monitorStatus').textContent = error.message; }
    finally { byId('saveMonitor').disabled = false; }
  });
  byId('refreshMonitor').addEventListener('click', refresh);
  byId('visitorDays').addEventListener('change', () => { page = 1; loadVisitors().catch((error) => { byId('monitorStatus').textContent = error.message; }); });
  for (const [id, change] of [['visitorPrevious', -1], ['visitorNext', 1]]) byId(id).addEventListener('click', () => {
    page = Math.max(1, page + change);
    loadVisitors().catch((error) => { byId('monitorStatus').textContent = error.message; });
  });
  setInterval(() => { if (!document.hidden) void refresh(); }, 60000);
  window.addEventListener('admin-activity-received', () => {
    if (document.hidden || activityRefresh) return;
    activityRefresh = setTimeout(() => {
      activityRefresh = null;
      void refresh();
    }, 10000);
  });
  if (adminToken) loadSettings().then(refresh).catch((error) => { byId('monitorStatus').textContent = error.message; });
})();
