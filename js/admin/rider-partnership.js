(() => {
  const el = id => document.getElementById(id);
  let data = null, selected = null, busy = false, pendingWrite = null;
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
  const effectiveAgreements = () => (data?.agreements || []).filter(a => a.status === 'published'
    && a.effectiveAt && Number.isFinite(new Date(a.effectiveAt).getTime()) && new Date(a.effectiveAt) <= new Date());
  const setupReady = () => !!data && data.setup?.ready !== false
    && Number.isInteger(data.policy?.revision) && data.policy.revision >= 0;
  function controls() {
    const unavailable = busy || !data || !adminToken || sessionUnavailable;
    const effective = effectiveAgreements(), target = effective.find(a => a._id === el('requiredAgreement').value);
    const reasonLength = el('requiredReason').value.trim().length;
    el('draftFields').disabled = unavailable;
    el('requiredFields').disabled = unavailable || !setupReady() || !effective.length;
    el('refreshPartnership').disabled = busy;
    el('agreementSelect').disabled = busy || !data;
    el('saveDraft').disabled = unavailable || !setupReady() || selected?.status === 'published';
    el('publishAgreement').disabled = unavailable || !setupReady() || selected?.status !== 'draft';
    el('saveRequired').disabled = unavailable || !setupReady() || !target || target._id === data?.policy?.agreementId || reasonLength < 3 || reasonLength > 500;
    el('agreementSetupStatus').textContent = !data ? 'Agreement storage has not been verified.' : !setupReady()
      ? data.setup?.message || 'Backend agreement setup is incomplete. Saving and publishing are unavailable until explicit setup is completed.' : '';
    el('agreementStepStatus').textContent = !data ? 'Refresh records before saving.' : selected?.status === 'published'
      ? `Version ${selected.version} is published and locked. Use step 2 to make it required.`
      : selected ? `Version ${selected.version} is a saved draft. Save any edits before publishing.`
        : 'Enter an agreement version and the complete text, then click Save draft.';
    el('requiredStepStatus').textContent = !setupReady() ? 'Backend setup must be confirmed before requiring an agreement.'
      : !effective.length ? 'Save a draft and publish it in step 1 first. Only published, effective versions appear here.'
        : !target ? 'Choose a published agreement, then enter a reason.'
          : target._id === data.policy.agreementId ? `Version ${target.version} is already required. No change is needed.`
          : reasonLength < 3 || reasonLength > 500 ? 'Enter a reason of 3 to 500 characters to enable Set required version.'
            : `Ready to require version ${target.version}. This needs your confirmation.`;
    riderControls();
  }
  function invalid(message, section, field) {
    if (field) el(field).focus();
    throw Object.assign(new Error(message), { localValidation: true, section });
  }
  function editorSnapshot() {
    return { id: selected?._id || '', version: el('agreementVersion').value, content: el('agreementContent').value,
      reason: el('requiredReason').value, requiredId: el('requiredAgreement').value };
  }
  function restoreEditor(snapshot) {
    // Keep unsaved text as a new draft if another admin published this version.
    // Never display that text as the immutable published document.
    const saved = data?.agreements.find(a => a._id === snapshot.id);
    choose(saved?.status === 'published' && saved.content !== snapshot.content.replace(/\r\n?/g, '\n').normalize('NFC') ? '' : snapshot.id);
    el('agreementVersion').value = snapshot.version; el('agreementContent').value = snapshot.content;
    el('requiredReason').value = snapshot.reason;
    if (effectiveAgreements().some(a => a._id === snapshot.requiredId)) el('requiredAgreement').value = snapshot.requiredId;
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
    const effective = effectiveAgreements(), previous = el('requiredAgreement').value;
    el('requiredAgreement').replaceChildren(option('', effective.length ? 'Choose a published agreement' : 'Publish an agreement in step 1 first'),
      ...effective.map(a => option(a._id, a.version)));
    el('requiredAgreement').value = effective.some(a => a._id === previous) ? previous
      : effective.some(a => a._id === selected?._id) ? selected._id
        : effective.some(a => a._id === data.policy?.agreementId) ? data.policy.agreementId : '';
    const current = data.agreements.find(a => a._id === data.policy?.agreementId);
    el('requiredStatus').textContent = current ? `Required version: ${current.version}` : 'No agreement is required yet. Delivery work is blocked until setup is completed.';
    el('policyHistory').replaceChildren(...[...(data.policy?.history || [])].reverse().map(h => text('p', `${new Date(h.changedAt).toLocaleString()} | ${h.reason} | Admin ${h.changedBy}`)));
    choose(selected?._id);
  }
  async function refresh() {
    const records = await api('/agreements');
    if (!Array.isArray(records?.agreements) || (records.policy?.history && !Array.isArray(records.policy.history))) throw new Error('Incomplete agreement records.');
    data = records; render();
    try {
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
            if (!window.confirm(state === 'approved' ? 'Approve this bonus and credit NGN 10,000 to the rider wallet?' : 'Reject this bonus request?')) return false;
            await api(`/bonuses/${b._id}/review`, 'POST', { state, reason: reason.value.trim() }); await refreshPreservingEditor();
          }, state === 'approved' ? 'Bonus approval confirmed by the server.' : 'Bonus rejection confirmed by the server.')); card.append(button);
        }
        return card;
      }));
      if (!result.bonuses.length) el('bonusRecords').append(text('p', 'No bonus requests awaiting approval.'));
    } catch (error) {
      el('bonusRecords').replaceChildren(text('p', `Unable to load bonus requests: ${error.message}`));
    }
  }
  async function refreshPreservingEditor() {
    const snapshot = editorSnapshot(); await refresh(); restoreEditor(snapshot);
  }
  function reconciledWrite(write) {
    if (!data || !write) return false;
    if (write.kind === 'required') return data.policy?.agreementId === write.id && data.policy.revision > write.revision
      && data.policy.history?.slice(write.historyLength).some(h => String(h.agreementId) === write.id && h.reason === write.reason);
    const agreement = data.agreements.find(a => write.id ? a._id === write.id : a.version === write.version);
    if (!agreement) return false;
    if (agreement.content !== write.content.replace(/\r\n?/g, '\n').normalize('NFC')) return false;
    if (write.kind === 'publish' ? agreement.status !== 'published' || agreement.__v <= write.revision
      : agreement.status !== 'draft') return false;
    choose(agreement._id); return true;
  }
  async function action(task, message = 'Agreement and policy records loaded.', preserve = true) {
    if (busy || !adminToken || sessionUnavailable) return;
    const snapshot = editorSnapshot(); pendingWrite = null;
    busy = true; controls(); el('partnershipStatus').textContent = 'Checking server confirmation...';
    let failure;
    try {
      const result = await task();
      el('partnershipStatus').textContent = result === false ? 'Cancelled. No changes were sent.' : typeof result === 'string' ? result : message;
    }
    catch (error) {
      failure = error;
      if (!error.localValidation) {
        // Re-read after uncertain writes; never automatically retry a mutation.
        data = null;
        try { await refresh(); } catch (_) { /* writes stay disabled when authoritative reads fail */ }
      }
      if ((!error.status || error.status >= 500) && reconciledWrite(pendingWrite)) {
        if (pendingWrite.kind === 'required') restoreEditor(snapshot);
        failure = null; el('partnershipStatus').textContent = `${message} Confirmed by reloading server records after a lost response.`;
      } else {
        if (preserve) restoreEditor(snapshot);
        el('partnershipStatus').textContent = `${error.message} No success is assumed; your entered text is preserved. Refresh before retrying.`;
      }
    } finally {
      pendingWrite = null; busy = false; controls();
      if (failure?.section) el(failure.section).textContent = failure.message;
    }
  }
  el('logoutAdminBtn').addEventListener('click', () => { clearAdminSession(); redirectToLogin('logout'); });
  el('agreementSelect').addEventListener('change', () => choose(el('agreementSelect').value));
  el('newDraft').addEventListener('click', () => choose(''));
  el('refreshPartnership').addEventListener('click', () => action(refreshPreservingEditor, 'Agreement and policy records refreshed. Your entered text is preserved.'));
  for (const id of ['requiredAgreement', 'requiredReason']) el(id).addEventListener(id === 'requiredAgreement' ? 'change' : 'input', controls);
  el('draftForm').addEventListener('submit', event => { event.preventDefault(); action(async () => {
    const content = el('agreementContent').value, version = el('agreementVersion').value.trim();
    if (!setupReady()) invalid('Backend agreement setup is incomplete. No draft was sent.', 'agreementStepStatus');
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(version)) invalid('Enter a version such as 1.0 (letters, numbers, dots, hyphens or underscores; up to 40 characters).', 'agreementStepStatus', 'agreementVersion');
    if (!content.trim() || content.length > 200000 || content.includes('\0')) invalid('Enter the complete approved agreement text (up to 200,000 characters).', 'agreementStepStatus', 'agreementContent');
    if (selected?.status === 'published') invalid('Published text is locked. Start a new draft to change the agreement.', 'agreementStepStatus');
    if (selected && (!Number.isInteger(selected.__v) || selected.__v < 0)) invalid('Reload the draft before saving edits.', 'agreementStepStatus');
    pendingWrite = { kind: 'save', id: selected?._id, version, content };
    const result = selected ? await api(`/agreements/${selected._id}`, 'PUT', { content, revision: selected.__v })
      : await api('/agreements', 'POST', { version, content });
    if (!result.agreement?._id || result.agreement.status !== 'draft') throw new Error('The server did not confirm a saved draft.');
    selected = result.agreement; await refresh();
    if (!reconciledWrite(pendingWrite)) throw new Error('The saved draft could not be verified from server records.');
  }, 'Draft saved and confirmed. Next: click Publish immutable version. The required agreement has not changed.'); });
  el('publishAgreement').addEventListener('click', () => action(async () => {
    if (!setupReady() || !selected || selected.status !== 'draft') invalid('Save a draft before publishing.', 'agreementStepStatus');
    if (el('agreementContent').value !== selected.content) invalid('Save your draft edits before publishing.', 'agreementStepStatus');
    if (!Number.isInteger(selected.__v) || selected.__v < 0) invalid('Reload the draft before publishing.', 'agreementStepStatus');
    if (!window.confirm('Publish this full agreement permanently? Its content and version cannot be edited or deleted afterwards.')) return false;
    pendingWrite = { kind: 'publish', id: selected._id, content: selected.content, revision: selected.__v };
    const result = await api(`/agreements/${selected._id}/publish`, 'POST', { revision: selected.__v }); selected = result.agreement; await refresh();
    if (!reconciledWrite(pendingWrite)) throw new Error('Publication could not be verified from server records.');
  }, 'Agreement published and locked. Next: choose it in step 2 and enter a reason to make it required.'));
  el('requiredForm').addEventListener('submit', event => { event.preventDefault(); action(async () => {
    const target = effectiveAgreements().find(a => a._id === el('requiredAgreement').value), reason = el('requiredReason').value.trim();
    if (!setupReady() || !target) invalid('Save and publish an agreement in step 1, then choose a published effective version.', 'requiredStepStatus');
    if (target._id === data.policy.agreementId) return `Version ${target.version} is already required. No changes were sent.`;
    if (reason.length < 3 || reason.length > 500) invalid('Enter a reason of 3 to 500 characters for the policy change.', 'requiredStepStatus', 'requiredReason');
    if (!window.confirm('Require this version now? Affected riders will be taken offline until acceptance; active deliveries remain finishable.')) return false;
    const revision = data.policy.revision;
    pendingWrite = { kind: 'required', id: target._id, revision, reason, historyLength: data.policy.history?.length || 0 };
    await api('/required', 'PUT', { agreementId: target._id, revision, reason }); await refreshPreservingEditor();
    if (data?.policy?.agreementId !== target._id || data.policy.revision <= revision) throw new Error('The required version could not be verified from server records.');
  }, 'Required agreement confirmed by the server. Riders must accept this version before new delivery work.'); });
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
  if (adminToken) { action(refresh, 'Agreement and policy records loaded.', false); searchRiders(); }
  else { el('historyRiderStatus').textContent = 'Sign in as an admin to find riders.'; }
})();
