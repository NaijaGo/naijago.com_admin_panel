const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../js/admin/rider-partnership.js'), 'utf8');
class Element {
  constructor() { this.value = ''; this.textContent = ''; this.children = []; this.listeners = {}; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(event, fn) { this.listeners[event] = fn; }
  setAttribute(name, value) { this[name] = value; }
  focus() { this.focused = true; }
  trigger(event) { return this.listeners[event]?.({ preventDefault() {} }); }
}
const id = 'a'.repeat(24);
function harness({ token = 'fixture', confirmed = true, published = false, required = false, empty = false, setup, fail = false,
  contacts = [{ id, source: 'individual', name: 'Fixture rider', phoneNumber: '+2348000000000', email: 'fixture@example.invalid', plateNumber: 'FIXTURE-1' }],
  pages = 1, history = { status: { accepted: true }, acceptances: [{ _id: id, version: '1.0', contentHash: 'b'.repeat(64), acceptedAt: '2026-10-13T10:00:00Z' }] },
  respond } = {}) {
  const nodes = new Map(), calls = []; let failures = fail;
  const state = { agreements: empty ? [] : [{ _id: id, version: '1.0', content: '<script>fixture only</script> Full agreement', contentHash: 'b'.repeat(64), status: published ? 'published' : 'draft', effectiveAt: '2026-01-01', __v: 0 }], policy: { revision: 0, history: [], agreementId: required ? id : null }, ...(setup ? { setup } : {}) };
  const get = key => { if (!nodes.has(key)) nodes.set(key, new Element()); return nodes.get(key); };
  vm.runInNewContext(source, { document: { getElementById: get, createElement: () => new Element() },
    adminToken: token, BASE_URL: 'https://fixture.invalid', AbortSignal, Date, URLSearchParams,
    window: { confirm: () => confirmed }, clearAdminSession() {}, redirectToLogin() {}, handleAdminSessionExpiry: code => code === 401,
    async fetch(url, options) {
      calls.push({ url, options }); if (failures) throw new Error('Fixture unavailable');
      if (respond) {
        const response = await respond(url, options, state);
        if (response) return response;
      }
      let response = state;
      if (url.includes('/contacts/riders?')) response = { contacts, pagination: { pages } };
      else if (url.endsWith('/bonuses')) response = { bonuses: [{ _id: 'c'.repeat(24), riderId: { fullName: 'Fixture rider' }, day: '2026-10-13', amount: 10000, completedOrderIds: Array(20).fill(id) }] };
      else if (options.method !== 'GET') {
        const body = JSON.parse(options.body);
        let agreement = state.agreements.find(a => url.includes(a._id));
        if (url.endsWith('/agreements') && options.method === 'POST') {
          agreement = { _id: 'e'.repeat(24), version: body.version, content: body.content.replace(/\r\n?/g, '\n').normalize('NFC'), status: 'draft', __v: 0 };
          state.agreements.push(agreement);
        } else if (url.endsWith('/publish')) Object.assign(agreement, { status: 'published', effectiveAt: '2026-01-01', __v: agreement.__v + 1 });
        else if (agreement && options.method === 'PUT') Object.assign(agreement, { content: body.content.replace(/\r\n?/g, '\n').normalize('NFC'), __v: agreement.__v + 1 });
        else if (url.endsWith('/required')) {
          state.policy.agreementId = body.agreementId; state.policy.revision++;
          state.policy.history.push({ agreementId: body.agreementId, reason: body.reason, changedAt: '2026-10-13', changedBy: 'fixture-admin' });
        }
        response = { agreement, policy: state.policy, bonus: {} };
      }
      else if (url.includes('/acceptances?')) response = history;
      return { ok: true, status: 200, json: async () => structuredClone(response) };
    },
  });
  const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); };
  return { get, nodes, calls, state, settle, fail: () => failures = true };
}
test('dashboard exposes partnership management using existing authentication runtime', () => {
  assert.match(fs.readFileSync(require.resolve('../index.html'), 'utf8'), /href="rider-partnership.html"/);
  const page = fs.readFileSync(require.resolve('../rider-partnership.html'), 'utf8');
  assert.match(page, /runtime.js/); assert.match(page, /id="draftFields" disabled/);
});
test('no admin session causes no API calls and disables writes', async () => {
  const h = harness({ token: '' }); await h.settle(); assert.equal(h.calls.length, 0); assert.equal(h.get('draftFields').disabled, true);
});
test('content uses textarea values and textContent without executing injected markup', async () => {
  const h = harness(); await h.settle(); h.get('agreementSelect').value = id; h.get('agreementSelect').trigger('change');
  assert.match(h.get('agreementContent').value, /<script>/); assert.doesNotMatch(source, /innerHTML/);
  assert.equal(h.get('publishAgreement').disabled, false); assert.equal(h.get('saveDraft').disabled, false);
});
test('published documents are read only and never editable from controls', async () => {
  const h = harness({ published: true }); await h.settle(); h.get('agreementSelect').value = id; h.get('agreementSelect').trigger('change');
  assert.equal(h.get('agreementContent').readOnly, true); assert.equal(h.get('saveDraft').disabled, true); assert.equal(h.get('publishAgreement').disabled, true);
});
test('draft save sends full content and revision without changing required policy', async () => {
  const h = harness(); await h.settle(); h.get('agreementSelect').value = id; h.get('agreementSelect').trigger('change'); h.get('agreementContent').value = 'Updated complete text';
  h.get('draftForm').trigger('submit'); await h.settle(); const write = h.calls.find(c => c.options.method === 'PUT');
  assert.deepEqual(JSON.parse(write.options.body), { revision: 0, content: 'Updated complete text' });
  assert.equal(h.calls.some(c => c.url.endsWith('/required') && c.options.method === 'PUT'), false);
  assert.equal(write.options.headers.Authorization, 'Bearer fixture');
});
test('cancelled publication sends no write', async () => {
  const h = harness({ confirmed: false }); await h.settle(); h.get('agreementSelect').value = id; h.get('agreementSelect').trigger('change');
  h.get('publishAgreement').trigger('click'); await h.settle(); assert.equal(h.calls.some(c => c.options.method === 'POST'), false);
  assert.match(h.get('partnershipStatus').textContent, /Cancelled/);
});

test('new agreement walks through saved draft, immutable publication and explicit requirement', async () => {
  const h = harness({ empty: true, setup: { ready: true } }); await h.settle();
  assert.equal(h.get('saveRequired').disabled, true); assert.match(h.get('requiredStepStatus').textContent, /publish it in step 1/);
  h.get('agreementVersion').value = '2.0'; h.get('agreementContent').value = ' Complete fixture agreement\r\nAll paragraphs. ';
  h.get('draftForm').trigger('submit'); await h.settle();
  assert.equal(h.state.agreements.length, 1); assert.equal(h.state.policy.agreementId, null);
  assert.equal(h.get('agreementContent').value, ' Complete fixture agreement\nAll paragraphs. ');
  assert.match(h.get('partnershipStatus').textContent, /Draft saved and confirmed/);
  assert.equal(h.get('publishAgreement').disabled, false); assert.equal(h.get('saveRequired').disabled, true);
  h.get('publishAgreement').trigger('click'); await h.settle();
  assert.equal(h.state.agreements[0].status, 'published'); assert.equal(h.get('agreementContent').readOnly, true);
  assert.equal(h.state.policy.agreementId, null); assert.equal(h.get('requiredAgreement').value, h.state.agreements[0]._id);
  assert.match(h.get('partnershipStatus').textContent, /published and locked/);
  assert.equal(h.get('saveRequired').disabled, true);
  h.get('requiredReason').value = 'Initial approved agreement'; h.get('requiredReason').trigger('input');
  assert.equal(h.get('saveRequired').disabled, false);
  h.get('requiredForm').trigger('submit'); await h.settle();
  assert.equal(h.state.policy.agreementId, h.state.agreements[0]._id); assert.equal(h.state.policy.revision, 1);
  assert.match(h.get('requiredStatus').textContent, /Required version: 2.0/);
  assert.match(h.get('partnershipStatus').textContent, /Required agreement confirmed/);
  assert.equal(h.get('saveRequired').disabled, true); assert.match(h.get('requiredStepStatus').textContent, /already required/);
  assert.deepEqual(h.calls.filter(c => c.options.method !== 'GET').map(c => c.options.method), ['POST', 'POST', 'PUT']);
  assert.equal(h.calls.some(c => c.url.includes('/review')), false);
});

test('missing version and content produce visible local errors without requests or lost text', async () => {
  for (const [version, content, expected] of [['', 'Keep full text', /Enter a version/], ['bad version!', 'Keep text', /Enter a version/], ['2.0', '', /complete approved/]]) {
    const h = harness(); await h.settle(); const before = h.calls.length;
    h.get('agreementVersion').value = version; h.get('agreementContent').value = content;
    h.get('draftForm').trigger('submit'); await h.settle();
    assert.match(h.get('agreementStepStatus').textContent, expected); assert.equal(h.get('agreementContent').value, content);
    assert.equal(h.calls.length, before); assert.doesNotMatch(h.get('partnershipStatus').textContent, /Server records confirmed/);
  }
  const page = fs.readFileSync(require.resolve('../rider-partnership.html'), 'utf8');
  assert.match(page, /id="draftForm"[^>]*novalidate/); assert.match(page, /id="requiredForm"[^>]*novalidate/);
});

test('backend setup missing disables mutations while preserving input and history access', async () => {
  const h = harness({ setup: { ready: false, code: 'RIDER_AGREEMENT_SETUP_REQUIRED', message: 'Explicit backend setup needed.' } }); await h.settle();
  assert.match(h.get('agreementSetupStatus').textContent, /Explicit backend setup/);
  assert.equal(h.get('saveDraft').disabled, true); assert.equal(h.get('saveRequired').disabled, true);
  h.get('agreementVersion').value = '2.0'; h.get('agreementContent').value = 'Keep original full text';
  h.get('draftForm').trigger('submit'); await h.settle();
  assert.equal(h.get('agreementContent').value, 'Keep original full text'); assert.equal(h.calls.some(c => c.options.method !== 'GET'), false);
  assert.equal(h.get('historyRider').disabled, false);
});

test('empty, draft, future or malformed versions never enable requirement writes', async () => {
  for (const date of [null, 'bad-date', '2099-01-01']) {
    const h = harness({ published: true }); h.state.agreements[0].effectiveAt = date; await h.settle();
    assert.equal(h.get('requiredAgreement').children.length, 1); assert.equal(h.get('saveRequired').disabled, true);
    h.get('requiredAgreement').value = id; h.get('requiredReason').value = 'Approved terms';
    h.get('requiredForm').trigger('submit'); await h.settle();
    assert.equal(h.calls.some(c => c.options.method !== 'GET'), false); assert.match(h.get('requiredStepStatus').textContent, /publish an agreement/);
  }
  const h = harness(); await h.settle(); assert.equal(h.get('saveRequired').disabled, true);
});

test('requirement needs a selected published version and a bounded reason', async () => {
  const h = harness({ published: true }); await h.settle();
  assert.equal(h.get('requiredAgreement').value, ''); assert.equal(h.get('saveRequired').disabled, true);
  h.get('requiredAgreement').value = id; h.get('requiredAgreement').trigger('change');
  for (const reason of ['', 'aa', 'a'.repeat(501)]) {
    h.get('requiredReason').value = reason; h.get('requiredReason').trigger('input');
    assert.equal(h.get('saveRequired').disabled, true); h.get('requiredForm').trigger('submit'); await h.settle();
    assert.match(h.get('requiredStepStatus').textContent, /3 to 500/);
  }
  assert.equal(h.calls.some(c => c.options.method !== 'GET'), false);
});

test('cancelled requirement and already-required version send no writes', async () => {
  for (const required of [false, true]) {
    const h = harness({ published: true, required, confirmed: false }); await h.settle();
    h.get('requiredAgreement').value = id; h.get('requiredReason').value = 'Approved terms';
    h.get('requiredForm').trigger('submit'); await h.settle();
    assert.equal(h.calls.some(c => c.options.method !== 'GET'), false);
    assert.match(h.get('partnershipStatus').textContent, required ? /already required/ : /Cancelled/);
  }
});

test('refresh, bonus load failure and rejected saves preserve unsaved agreement text', async () => {
  const h = harness({ respond: async (url, options) => {
    if (url.endsWith('/bonuses')) throw new Error('Bonus fixture unavailable');
    if (options.method === 'PUT') return { ok: false, status: 409, json: async () => ({ message: 'Draft changed; reload', code: 'AGREEMENT_DRAFT_CHANGED' }) };
  } }); await h.settle();
  assert.equal(h.get('saveDraft').disabled, false); assert.match(h.get('bonusRecords').children[0].textContent, /Unable to load bonus/);
  h.get('agreementSelect').value = id; h.get('agreementSelect').trigger('change'); h.get('agreementContent').value = 'Keep every unsaved paragraph';
  h.get('refreshPartnership').trigger('click'); await h.settle(); assert.equal(h.get('agreementContent').value, 'Keep every unsaved paragraph');
  h.get('draftForm').trigger('submit'); await h.settle(); assert.equal(h.get('agreementContent').value, 'Keep every unsaved paragraph');
  assert.match(h.get('partnershipStatus').textContent, /Draft changed.*No success is assumed/);
  h.get('publishAgreement').trigger('click'); await h.settle();
  assert.match(h.get('agreementStepStatus').textContent, /Save your draft edits/);
  assert.equal(h.calls.filter(c => c.options.method !== 'GET').length, 1);
});

for (const kind of ['save', 'publish', 'required']) test(`lost ${kind} response reconciles a confirmed write without retrying`, async () => {
  const h = harness({ empty: kind === 'save', published: kind === 'required', respond: async (url, options, state) => {
    if (options.method === 'GET') return;
    const body = JSON.parse(options.body);
    if (kind === 'save') state.agreements.push({ _id: id, version: body.version, content: body.content, status: 'draft', __v: 0 });
    if (kind === 'publish') Object.assign(state.agreements[0], { status: 'published', effectiveAt: '2026-01-01', __v: 1 });
    if (kind === 'required') {
      state.policy.agreementId = body.agreementId; state.policy.revision++;
      state.policy.history.push({ agreementId: body.agreementId, reason: body.reason });
    }
    throw new Error('Fixture lost response');
  } }); await h.settle();
  if (kind === 'save') { h.get('agreementVersion').value = '2.0'; h.get('agreementContent').value = 'Full new fixture terms'; h.get('draftForm').trigger('submit'); }
  if (kind === 'publish') { h.get('agreementSelect').value = id; h.get('agreementSelect').trigger('change'); h.get('publishAgreement').trigger('click'); }
  if (kind === 'required') { h.get('requiredAgreement').value = id; h.get('requiredReason').value = 'Approved fixture terms'; h.get('requiredForm').trigger('submit'); }
  await h.settle(); assert.match(h.get('partnershipStatus').textContent, /Confirmed by reloading server records/);
  assert.equal(h.calls.filter(c => c.options.method !== 'GET').length, 1);
  if (kind === 'save') assert.equal(h.get('agreementSelect').value, id);
});

test('explicit 409 conflict is never reported as a successful reconciled mutation', async () => {
  const h = harness({ respond: async (url, options) => options.method === 'PUT'
    ? { ok: false, status: 409, json: async () => ({ message: 'Another administrator changed the draft' }) } : null }); await h.settle();
  h.get('agreementSelect').value = id; h.get('agreementSelect').trigger('change'); h.get('draftForm').trigger('submit'); await h.settle();
  assert.match(h.get('partnershipStatus').textContent, /Another administrator.*No success is assumed/);
  assert.equal(h.calls.filter(c => c.options.method !== 'GET').length, 1);
});

test('changing requirement or approving a bonus preserves an unrelated unsaved draft', async () => {
  const h = harness({ published: true }); await h.settle();
  h.get('agreementVersion').value = '2.0'; h.get('agreementContent').value = 'Unsaved next version with every paragraph';
  h.get('requiredAgreement').value = id; h.get('requiredReason').value = 'Initial requirement';
  h.get('requiredForm').trigger('submit'); await h.settle();
  assert.equal(h.get('agreementVersion').value, '2.0'); assert.equal(h.get('agreementContent').value, 'Unsaved next version with every paragraph');
  const card = h.get('bonusRecords').children[0]; card.children[1].value = 'Verified fixture orders'; card.children[2].trigger('click'); await h.settle();
  assert.equal(h.get('agreementContent').value, 'Unsaved next version with every paragraph');
  assert.equal(h.calls.filter(c => c.url.endsWith('/agreements') && c.options.method === 'POST').length, 0);
});

test('malformed agreement reads fail closed without crashing controls', async () => {
  const h = harness({ respond: async url => url.endsWith('/agreements')
    ? { ok: true, status: 200, json: async () => ({ agreements: null, policy: { revision: 0 } }) } : null });
  await h.settle(); assert.equal(h.get('saveDraft').disabled, true); assert.equal(h.get('saveRequired').disabled, true);
  assert.match(h.get('partnershipStatus').textContent, /Incomplete agreement records/);
  assert.equal(h.calls.some(c => c.options.method !== 'GET'), false);
});

test('concurrent publication preserves unsaved text as a new draft without mislabeling locked content', async () => {
  const h = harness({ respond: async (url, options, state) => {
    if (options.method !== 'PUT') return;
    state.agreements[0].status = 'published'; state.agreements[0].__v++;
    return { ok: false, status: 409, json: async () => ({ message: 'The draft was published; reload it' }) };
  } }); await h.settle(); h.get('agreementSelect').value = id; h.get('agreementSelect').trigger('change');
  h.get('agreementContent').value = 'Keep my uncommitted edits'; h.get('draftForm').trigger('submit'); await h.settle();
  assert.equal(h.get('agreementContent').value, 'Keep my uncommitted edits'); assert.equal(h.get('agreementSelect').value, '');
  assert.equal(h.get('agreementContent').readOnly, false); assert.equal(h.get('publishAgreement').disabled, true);
  assert.match(h.get('agreementMetadata').textContent, /New draft/);
  assert.equal(h.state.agreements[0].content, '<script>fixture only</script> Full agreement');
  assert.match(h.get('partnershipStatus').textContent, /No success is assumed/);
});
test('required version changes include current revision and an explicit reason', async () => {
  const h = harness({ published: true }); await h.settle(); h.get('requiredAgreement').value = id; h.get('requiredReason').value = 'Full approved terms';
  h.get('requiredForm').trigger('submit'); await h.settle(); const write = h.calls.find(c => c.url.endsWith('/required'));
  assert.deepEqual(JSON.parse(write.options.body), { agreementId: id, revision: 0, reason: 'Full approved terms' });
});
test('bonus approval needs reason and is locked during repeated taps', async () => {
  const h = harness(); await h.settle(); const card = h.get('bonusRecords').children[0]; card.children[1].value = 'Verified completed orders';
  card.children[2].trigger('click'); card.children[2].trigger('click'); await h.settle();
  assert.equal(h.calls.filter(c => c.url.endsWith('/review')).length, 1);
  assert.deepEqual(JSON.parse(h.calls.find(c => c.url.endsWith('/review')).options.body), { state: 'approved', reason: 'Verified completed orders' });
});
test('failed writes never announce success and disable controls when reads also fail', async () => {
  const h = harness(); await h.settle(); h.get('agreementVersion').value = '2.0'; h.get('agreementContent').value = 'Full new terms'; h.fail();
  h.get('draftForm').trigger('submit'); await h.settle(); assert.match(h.get('partnershipStatus').textContent, /No success is assumed/); assert.equal(h.get('draftFields').disabled, true);
});
test('acceptance history reads only the requested rider and never writes', async () => {
  const h = harness(); await h.settle(); h.get('historyRider').value = id; h.get('acceptanceForm').trigger('submit'); await h.settle();
  assert.ok(h.calls.find(c => c.url.includes(`riderId=${id}`))); assert.equal(h.calls.some(c => c.options.method !== 'GET'), false);
  assert.equal(h.get('acceptanceStatus').textContent, 'Current version accepted');
  assert.match(h.get('historyRiderIdentity').textContent, /Fixture rider/);
});

test('history uses searchable Go-Rider selection instead of a required database ID input', async () => {
  const page = fs.readFileSync(require.resolve('../rider-partnership.html'), 'utf8');
  assert.match(page, /id="riderLookupSearch"/); assert.match(page, /<select id="historyRider"/);
  assert.doesNotMatch(page, /Rider database ID|pattern="\[a-fA-F0-9\]/);
  const h = harness(); await h.settle();
  const read = h.calls.find(call => call.url.includes('/contacts/riders?'));
  assert.equal(new URL(read.url).searchParams.get('source'), 'individual');
  assert.equal(new URL(read.url).searchParams.get('limit'), '20');
  assert.equal(read.options.headers.Authorization, 'Bearer fixture');
  assert.equal(h.get('historyRider').value, '');
  assert.equal(h.get('viewRiderRecords').disabled, true);
});

test('phone and punctuation searches are literal and safely encoded', async () => {
  const h = harness(); await h.settle(); h.get('riderLookupSearch').value = '+234 (Fixture) [1].';
  h.get('riderLookupForm').trigger('submit'); await h.settle();
  const query = new URL(h.calls.filter(c => c.url.includes('/contacts/riders?')).at(-1).url).searchParams;
  assert.equal(query.get('search'), '\\+234 \\(Fixture\\) \\[1\\]\\.');
  assert.equal(query.get('page'), '1');
});

test('duplicate names require explicit selection and each option shows contact and identity', async () => {
  const second = 'd'.repeat(24);
  const h = harness({ contacts: [{ id, source: 'individual', name: 'Same name', phoneNumber: '08000000001' },
    { id: second, source: 'individual', name: 'Same name', phoneNumber: '08000000002' }] });
  await h.settle();
  assert.equal(h.calls.some(c => c.url.includes('/acceptances?')), false);
  assert.match(h.get('historyRider').children[1].textContent, /08000000001/);
  assert.match(h.get('historyRider').children[2].textContent, /08000000002/);
  h.get('historyRider').value = second; h.get('historyRider').trigger('change'); await h.settle();
  assert.ok(h.calls.find(c => c.url.endsWith(`riderId=${second}`)));
  assert.match(h.get('historyRiderIdentity').textContent, /08000000002/);
});

test('invalid and company-rider choices never load partnership acceptance history', async () => {
  const h = harness({ contacts: [{ id, source: 'company', name: 'Company rider' },
    { id: 'not-a-database-id', source: 'individual', name: 'Invalid rider' }] }); await h.settle();
  assert.equal(h.get('historyRider').disabled, true);
  h.get('historyRider').value = id; h.get('acceptanceForm').trigger('submit'); await h.settle();
  assert.equal(h.calls.some(c => c.url.includes('/acceptances?')), false);
});

test('lookup pagination preserves the search and resets selection and history', async () => {
  const h = harness({ pages: 3 }); await h.settle();
  h.get('riderLookupSearch').value = 'Fixture'; h.get('riderLookupForm').trigger('submit'); await h.settle();
  h.get('historyRider').value = id; h.get('historyRider').trigger('change'); await h.settle();
  assert.ok(h.get('acceptanceRecords').children.length);
  h.get('historyRiderNext').trigger('click'); await h.settle();
  const query = new URL(h.calls.filter(c => c.url.includes('/contacts/riders?')).at(-1).url).searchParams;
  assert.equal(query.get('search'), 'Fixture'); assert.equal(query.get('page'), '2');
  assert.equal(h.get('historyRider').value, ''); assert.equal(h.get('acceptanceRecords').children.length, 0);
  assert.equal(h.get('historyRiderPage').textContent, 'Page 2 of 3');
});

test('no accepted records is distinct from a failed request or unconfigured policy', async () => {
  for (const [history, expected] of [
    [{ status: { accepted: false, requiredVersion: '2.0' }, acceptances: [] }, /Current version not accepted.*2.0/],
    [{ status: null, statusError: { code: 'RIDER_AGREEMENT_NOT_CONFIGURED' }, acceptances: [] }, /setup is incomplete.*not verified/],
  ]) {
    const h = harness({ history }); await h.settle(); h.get('historyRider').value = id; h.get('historyRider').trigger('change'); await h.settle();
    assert.match(h.get('acceptanceStatus').textContent, expected);
    assert.equal(h.get('acceptanceRecords').children[0].textContent, 'No saved acceptance records for this rider.');
    assert.equal(h.calls.some(c => c.options.method !== 'GET'), false);
  }
});

test('lookup and history failures never leave another rider’s records visible or change draft edits', async () => {
  const h = harness(); await h.settle(); h.get('agreementContent').value = 'Keep unsaved draft text';
  h.get('historyRider').value = id; h.get('historyRider').trigger('change'); await h.settle();
  h.fail(); h.get('acceptanceForm').trigger('submit'); await h.settle();
  assert.match(h.get('acceptanceStatus').textContent, /Unable to load acceptance records/);
  assert.equal(h.get('acceptanceRecords').children.length, 0);
  assert.equal(h.get('agreementContent').value, 'Keep unsaved draft text');
  h.get('riderLookupForm').trigger('submit'); await h.settle();
  assert.equal(h.get('historyRider').disabled, true); assert.match(h.get('historyRiderStatus').textContent, /Unable to load riders/);
});

test('malformed or mismatched server records never show accepted status', async () => {
  for (const history of [{ status: {}, acceptances: [] },
    { rider: { _id: 'd'.repeat(24) }, status: { accepted: true }, acceptances: [] },
    { status: { accepted: true }, acceptances: null }]) {
    const h = harness({ history }); await h.settle(); h.get('historyRider').value = id; h.get('historyRider').trigger('change'); await h.settle();
    assert.match(h.get('acceptanceStatus').textContent, /Unable to load acceptance records/);
    assert.equal(h.get('acceptanceRecords').children.length, 0);
  }
});

test('rider data and stored agreement labels remain inert text', async () => {
  const h = harness({ contacts: [{ id, source: 'individual', name: '<script>neverRun()</script>', phoneNumber: '08000000000' }] });
  await h.settle(); assert.match(h.get('historyRider').children[1].textContent, /<script>/);
  assert.doesNotMatch(source, /innerHTML/);
});

test('expired admin sessions disable rider reads and subsequent writes', async () => {
  const h = harness({ respond: async url => url.includes('/contacts/riders?')
    ? { status: 401, ok: false, json: async () => ({ message: 'Expired' }) } : null }); await h.settle();
  const before = h.calls.length;
  assert.equal(h.get('searchHistoryRiders').disabled, true);
  h.get('riderLookupForm').trigger('submit'); h.get('draftForm').trigger('submit'); await h.settle();
  assert.equal(h.calls.length, before);
});

test('late searches and acceptance responses cannot replace the latest selection', async () => {
  let resolveSearch, resolveHistory;
  const second = 'd'.repeat(24);
  const response = body => ({ ok: true, status: 200, json: async () => body });
  const h = harness({ contacts: [{ id, source: 'individual', name: 'First' }, { id: second, source: 'individual', name: 'Second' }],
    respond: async url => {
      if (url.includes('search=old')) return new Promise(resolve => { resolveSearch = resolve; });
      if (url.endsWith(`riderId=${id}`)) return new Promise(resolve => { resolveHistory = resolve; });
      return null;
    } }); await h.settle();
  h.get('riderLookupSearch').value = 'old'; h.get('riderLookupForm').trigger('submit'); await h.settle();
  h.get('riderLookupSearch').value = 'new'; h.get('riderLookupForm').trigger('submit'); await h.settle();
  resolveSearch(response({ contacts: [{ id: 'e'.repeat(24), source: 'individual', name: 'Stale' }] })); await h.settle();
  assert.match(h.get('historyRider').children[1].textContent, /First/);
  h.get('historyRider').value = id; h.get('historyRider').trigger('change'); await h.settle();
  h.get('historyRider').value = second; h.get('historyRider').trigger('change'); await h.settle();
  resolveHistory(response({ status: { accepted: false }, acceptances: [] })); await h.settle();
  assert.match(h.get('historyRiderIdentity').textContent, /Second/);
  assert.equal(h.get('acceptanceStatus').textContent, 'Current version accepted');
});
