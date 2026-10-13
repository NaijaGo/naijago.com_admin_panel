(() => {
  const el = id => document.getElementById(id);
  let data = null, selected = null, busy = false;
  let riders = [], lookupPage = 1, lookupPages = 1, lookupTerm = '', lookupBusy = false,
    recordsBusy = false, lookupSequence = 0, recordsSequence = 0, sessionUnavailable = false;
  const text = (tag, value) => { const node = document.createElement(tag); node.textContent = String(value ?? ''); return node; };
  async function request(url, method = 'GET', body) {
    const response = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000),
    });
    if (handleAdminSessionExpiry(response.status)) {
      sessionUnavailable = true; controls(); throw new Error('Admin session expired. Sign in again to view rider records.');
    }
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.message || 'Request failed. Refresh to verify the outcome.'), { code: result.code, status: response.status });
    return result;
  }
  const api = (path, method = 'GET', body) => request(`${BASE_URL}/api/admin/rider-partnership${path}`, method, body);
  function controls() {
    el('draftFields').disabled = busy || !data || !adminToken || sessionUnavailable;
    el('requiredFields').disabled = busy || !Number.isInteger(data?.policy?.revision) || !adminToken || sessionUnavailable;
    el('refreshPartnership').disabled = busy;
    el('agreementSelect').disabled = busy || !data;
    el('saveDraft').disabled = busy || selected?.status === 'published';
    el('publishAgreement').disabled = busy || selected?.status !== 'draft';
    riderControls();
  }
  function riderControls() {
    const unavailable = !adminToken || sessionUnavailable;
    el('riderLookupSearch').disabled = unavailable;
    el('searchHistoryRiders').disabled = unavailable;
    el('historyRider').disabled = unavailable || lookupBusy || !riders.length;
    el('historyRiderPrevious').disabled = unavailable || lookupBusy || !riders.length || lookupPage <= 1;
    el('historyRiderNext').disabled = unavailable || lookupBusy || !riders.length || lookupPage >= lookupPages;
    el('viewRiderRecords').disabled = unavailable || recordsBusy || !selectedRider();
  }
  function selectedRider() { return riders.find(rider => rider.id === el('historyRider').value); }
  function clearHistory() {
    recordsSequence++; recordsBusy = false;
    el('acceptanceRecords').replaceChildren(); el('historyRiderIdentity').textContent = '';
    el('acceptanceStatus').textContent = 'Select a rider to view their records.';
  }
  function riderLabel(rider) {
    return [rider.name || 'Unnamed rider', rider.phoneNumber || 'No phone', rider.email || 'No email',
      rider.plateNumber ? `Plate ${rider.plateNumber}` : '', `ID ${rider.id}`].filter(Boolean).join(' | ');
  }
  async function searchRiders(term = '', page = 1) {
    if (!adminToken || sessionUnavailable) return;
    const sequence = ++lookupSequence;
    lookupBusy = true; riders = []; clearHistory();
    el('historyRider').replaceChildren(text('option', 'Choose a rider'));
    el('historyRiderPage').textContent = ''; el('historyRiderStatus').textContent = 'Searching Go-Rider accounts...'; riderControls();
    try {
      if (term.length > 100) throw new Error('Keep the rider search to 100 characters or fewer.');
      // The existing contacts endpoint uses a regex. Escape user text so +234,
      // punctuation and other characters are searched literally.
      const literal = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const params = new URLSearchParams({ source: 'individual', page: String(page), limit: '20' });
      if (term) params.set('search', literal);
      const result = await request(`${BASE_URL}/api/admin/contacts/riders?${params}`);
      if (sequence !== lookupSequence) return;
      if (!Array.isArray(result.contacts)) throw new Error('The rider list is unavailable. Try searching again.');
      riders = result.contacts.filter(rider => rider.source === 'individual' && typeof rider.id === 'string' && /^[a-f0-9]{24}$/i.test(rider.id));
      lookupTerm = term; lookupPage = page; lookupPages = Math.max(page, Number(result.pagination?.pages) || page);
      const placeholder = text('option', riders.length ? 'Choose a rider' : 'No matching riders'); placeholder.value = '';
      el('historyRider').replaceChildren(placeholder, ...riders.map(rider => {
        const option = text('option', riderLabel(rider)); option.value = rider.id; return option;
      }));
      el('historyRider').value = '';
      el('historyRiderPage').textContent = riders.length ? `Page ${lookupPage} of ${lookupPages}` : '';
      el('historyRiderStatus').textContent = riders.length
        ? `${riders.length} rider${riders.length === 1 ? '' : 's'} shown. Select the matching account below.`
        : 'No matching Go-Rider accounts. Try a name, phone, email or plate number.';
    } catch (error) {
      if (sequence === lookupSequence) el('historyRiderStatus').textContent = `Unable to load riders: ${error.message}`;
    } finally { if (sequence === lookupSequence) { lookupBusy = false; riderControls(); } }
  }
  async function loadHistory() {
    if (!adminToken || sessionUnavailable) return;
    const rider = selectedRider(); clearHistory();
    if (!rider) { riderControls(); return; }
    const sequence = ++recordsSequence;
    recordsBusy = true; el('historyRiderIdentity').textContent = riderLabel(rider);
    el('acceptanceStatus').textContent = 'Loading this rider’s acceptance records...'; riderControls();
    try {
      const result = await api(`/acceptances?riderId=${encodeURIComponent(rider.id)}`);
      if (sequence !== recordsSequence || selectedRider()?.id !== rider.id) return;
      if (result.rider && String(result.rider._id) !== rider.id) throw new Error('The server returned a different rider. Search and select the account again.');
      if (!Array.isArray(result.acceptances)) throw new Error('Incomplete acceptance history. Refresh this rider’s records.');
      let statusText;
      if (typeof result.status?.accepted === 'boolean') {
        statusText = result.status.accepted ? 'Current version accepted' : 'Current version not accepted';
        if (result.status.requiredVersion) statusText += ` | Required version ${result.status.requiredVersion}`;
      } else if (result.statusError?.code === 'RIDER_AGREEMENT_NOT_CONFIGURED') {
        statusText = 'Agreement setup is incomplete. Historical records are shown below; current-version acceptance is not verified.';
      } else throw new Error('Current agreement acceptance could not be verified. Refresh this rider’s records.');
      const records = result.acceptances.map(a => text('p', `${a.version} | ${new Date(a.acceptedAt).toLocaleString()} | SHA-256 ${a.contentHash} | Record ${a._id}`));
      el('acceptanceRecords').replaceChildren(...records);
      if (!records.length) el('acceptanceRecords').append(text('p', 'No saved acceptance records for this rider.'));
      el('acceptanceStatus').textContent = statusText;
    } catch (error) {
      if (sequence === recordsSequence) {
        el('acceptanceRecords').replaceChildren();
        el('acceptanceStatus').textContent = `Unable to load acceptance records: ${error.message}`;
      }
    } finally { if (sequence === recordsSequence) { recordsBusy = false; riderControls(); } }
  }
  function choose(id) {
    selected = data?.agreements.find(a => a._id === id) || null;
    el('agreementSelect').value = selected?._id || '';
    el('agreementVersion').value = selected?.version || '';
    el('agreementVersion').readOnly = !!selected;
    el('agreementContent').value = selected?.content || '';
    el('agreementContent').readOnly = selected?.status === 'published';
    el('agreementMetadata').textContent = selected ? `${selected.status} | SHA-256: ${selected.contentHash}` : 'New draft. No legal content is supplied automatically.';
    controls();
  }
  function render() {
    if (!Array.isArray(data?.agreements)) throw new Error('Incomplete agreement records.');
    const option = (value, label) => { const node = text('option', label); node.value = value; return node; };
    el('agreementSelect').replaceChildren(option('', 'New draft'), ...data.agreements.map(a => option(a._id, `${a.version} | ${a.status}`)));
    const effective = data.agreements.filter(a => a.status === 'published' && new Date(a.effectiveAt) <= new Date());
    el('requiredAgreement').replaceChildren(...effective.map(a => option(a._id, a.version)));
    const current = data.agreements.find(a => a._id === data.policy?.agreementId);
    el('requiredStatus').textContent = current ? `Required version: ${current.version}` : 'No agreement is required yet. Delivery work is blocked until setup is completed.';
    el('policyHistory').replaceChildren(...[...(data.policy?.history || [])].reverse().map(h => text('p', `${new Date(h.changedAt).toLocaleString()} | ${h.reason} | Admin ${h.changedBy}`)));
    choose(selected?._id);
  }
  async function refresh() {
    data = await api('/agreements'); render();
    const result = await api('/bonuses');
    if (!Array.isArray(result.bonuses)) throw new Error('Incomplete bonus records.');
    el('bonusRecords').replaceChildren(...result.bonuses.map(b => {
      const card = text('article', ''); card.className = 'rounded border border-slate-600 p-4 space-y-3';
      card.append(text('p', `${b.riderId?.fullName || b.riderId} | ${b.day} | ${b.completedOrderIds?.length || 0} orders | NGN ${b.amount}`));
      const reason = document.createElement('textarea'); reason.className = 'input-field w-full'; reason.maxLength = 500;
      reason.setAttribute('aria-label', 'Bonus review reason'); card.append(reason);
      for (const state of ['approved', 'rejected']) {
        const button = text('button', state === 'approved' ? 'Approve and credit NGN 10,000' : 'Reject bonus'); button.className = 'btn btn-primary-alt px-4 py-2';
        button.addEventListener('click', () => action(async () => {
          if (reason.value.trim().length < 3) throw new Error('Give a review reason of at least three characters.');
          if (!window.confirm(state === 'approved' ? 'Approve this bonus and credit NGN 10,000 to the rider wallet?' : 'Reject this bonus request?')) return;
          await api(`/bonuses/${b._id}/review`, 'POST', { state, reason: reason.value.trim() }); await refresh();
        })); card.append(button);
      }
      return card;
    }));
    if (!result.bonuses.length) el('bonusRecords').append(text('p', 'No bonus requests awaiting approval.'));
  }
  async function action(task) {
    if (busy || !adminToken || sessionUnavailable) return;
    busy = true; controls(); el('partnershipStatus').textContent = 'Checking server confirmation...';
    try { await task(); el('partnershipStatus').textContent = 'Server records confirmed.'; }
    catch (error) {
      el('partnershipStatus').textContent = `${error.message} No success is assumed; refresh before retrying.`;
      // A write may have committed despite a lost response. Reconcile before another write.
      data = null;
      try { await refresh(); } catch (_) { /* controls stay disabled when authoritative reads fail */ }
    } finally { busy = false; controls(); }
  }
  el('logoutAdminBtn').addEventListener('click', () => { clearAdminSession(); redirectToLogin('logout'); });
  el('agreementSelect').addEventListener('change', () => choose(el('agreementSelect').value));
  el('newDraft').addEventListener('click', () => choose(''));
  el('refreshPartnership').addEventListener('click', () => action(refresh));
  el('draftForm').addEventListener('submit', event => { event.preventDefault(); action(async () => {
    const content = el('agreementContent').value, version = el('agreementVersion').value.trim();
    if (!content.trim() || !version) throw new Error('Provide the complete approved text and a version.');
    const result = selected ? await api(`/agreements/${selected._id}`, 'PUT', { content, revision: selected.__v })
      : await api('/agreements', 'POST', { version, content });
    selected = result.agreement; await refresh();
  }); });
  el('publishAgreement').addEventListener('click', () => action(async () => {
    if (!selected || selected.status !== 'draft') return;
    if (el('agreementContent').value !== selected.content) throw new Error('Save your draft edits before publishing.');
    if (!window.confirm('Publish this full agreement permanently? Its content and version cannot be edited or deleted afterwards.')) return;
    const result = await api(`/agreements/${selected._id}/publish`, 'POST', { revision: selected.__v }); selected = result.agreement; await refresh();
  }));
  el('requiredForm').addEventListener('submit', event => { event.preventDefault(); action(async () => {
    if (!data?.policy || !el('requiredAgreement').value) throw new Error('Initialize the policy and publish an effective agreement first.');
    if (el('requiredReason').value.trim().length < 3) throw new Error('Give a reason for the policy change.');
    if (!window.confirm('Require this version now? Affected riders will be taken offline until acceptance; active deliveries remain finishable.')) return;
    await api('/required', 'PUT', { agreementId: el('requiredAgreement').value, revision: data.policy.revision, reason: el('requiredReason').value.trim() }); await refresh();
  }); });
  el('riderLookupForm').addEventListener('submit', event => { event.preventDefault(); searchRiders(el('riderLookupSearch').value.trim()); });
  el('riderLookupSearch').addEventListener('input', () => {
    lookupSequence++; lookupBusy = false; riders = []; clearHistory();
    el('historyRider').replaceChildren(text('option', 'Search to choose a rider')); el('historyRider').value = '';
    el('historyRiderPage').textContent = ''; el('historyRiderStatus').textContent = 'Press Search riders or Enter to find this account.'; riderControls();
  });
  el('historyRiderPrevious').addEventListener('click', () => { if (!el('historyRiderPrevious').disabled) searchRiders(lookupTerm, lookupPage - 1); });
  el('historyRiderNext').addEventListener('click', () => { if (!el('historyRiderNext').disabled) searchRiders(lookupTerm, lookupPage + 1); });
  el('historyRider').addEventListener('change', loadHistory);
  el('acceptanceForm').addEventListener('submit', event => { event.preventDefault(); loadHistory(); });
  controls();
  if (adminToken) { action(refresh); searchRiders(); }
  else { el('historyRiderStatus').textContent = 'Sign in as an admin to find riders.'; }
})();
