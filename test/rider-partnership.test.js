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
  trigger(event) { return this.listeners[event]?.({ preventDefault() {} }); }
}
const id = 'a'.repeat(24);
function harness({ token = 'fixture', confirmed = true, published = false, fail = false } = {}) {
  const nodes = new Map(), calls = []; let failures = fail;
  const state = { agreements: [{ _id: id, version: '1.0', content: '<script>fixture only</script> Full agreement', contentHash: 'b'.repeat(64), status: published ? 'published' : 'draft', effectiveAt: '2026-01-01', __v: 0 }], policy: { revision: 0, history: [], agreementId: published ? id : null } };
  const get = key => { if (!nodes.has(key)) nodes.set(key, new Element()); return nodes.get(key); };
  vm.runInNewContext(source, { document: { getElementById: get, createElement: () => new Element() },
    adminToken: token, BASE_URL: 'https://fixture.invalid', AbortSignal, Date,
    window: { confirm: () => confirmed }, clearAdminSession() {}, redirectToLogin() {}, handleAdminSessionExpiry: code => code === 401,
    async fetch(url, options) {
      calls.push({ url, options }); if (failures) throw new Error('Fixture unavailable');
      let response = state;
      if (url.endsWith('/bonuses')) response = { bonuses: [{ _id: 'c'.repeat(24), riderId: { fullName: 'Fixture rider' }, day: '2026-10-13', amount: 10000, completedOrderIds: Array(20).fill(id) }] };
      else if (options.method !== 'GET') response = { agreement: state.agreements[0], policy: state.policy, bonus: {} };
      else if (url.includes('/acceptances?')) response = { status: { accepted: true }, acceptances: [{ _id: id, version: '1.0', contentHash: 'b'.repeat(64), acceptedAt: '2026-10-13T10:00:00Z' }] };
      return { ok: true, status: 200, json: async () => response };
    },
  });
  const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); };
  return { get, nodes, calls, settle, fail: () => failures = true };
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
  assert.equal(h.get('acceptanceRecords').children[0].textContent, 'Current version accepted');
});
