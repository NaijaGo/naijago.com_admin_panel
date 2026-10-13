(() => {
  const el = id => document.getElementById(id);
  let data = null, selected = null, busy = false;
  const text = (tag, value) => { const node = document.createElement(tag); node.textContent = String(value ?? ''); return node; };
  async function api(path, method = 'GET', body) {
    const response = await fetch(`${BASE_URL}/api/admin/rider-partnership${path}`, {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000),
    });
    if (handleAdminSessionExpiry(response.status)) throw new Error('Admin session expired.');
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Request failed. Refresh to verify the outcome.');
    return result;
  }
  function controls() {
    el('draftFields').disabled = busy || !data;
    el('requiredFields').disabled = busy || !Number.isInteger(data?.policy?.revision);
    el('refreshPartnership').disabled = busy;
    el('agreementSelect').disabled = busy || !data;
    el('saveDraft').disabled = busy || selected?.status === 'published';
    el('publishAgreement').disabled = busy || selected?.status !== 'draft';
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
    if (busy || !adminToken) return;
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
  el('acceptanceForm').addEventListener('submit', event => { event.preventDefault(); action(async () => {
    const id = el('historyRider').value.trim(); if (!/^[a-f0-9]{24}$/i.test(id)) throw new Error('Enter a valid rider ID.');
    const result = await api(`/acceptances?riderId=${encodeURIComponent(id)}`);
    el('acceptanceRecords').replaceChildren(text('p', result.status.accepted ? 'Current version accepted' : 'Current version not accepted'),
      ...result.acceptances.map(a => text('p', `${a.version} | ${new Date(a.acceptedAt).toLocaleString()} | SHA-256 ${a.contentHash} | Record ${a._id}`)));
  }); });
  controls(); if (adminToken) action(refresh);
})();
