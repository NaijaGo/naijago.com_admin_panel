const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/admin/vendor-commissions.js'), 'utf8');
const hierarchy = JSON.parse(fs.readFileSync(path.join(__dirname, '../js/admin/catalog-taxonomy.fallback.json'), 'utf8'));
class Node {
  constructor(tag) { this.tag = tag; this.children = []; this.listeners = {}; this.value = ''; this.disabled = false; this.checked = false; this.textContent = ''; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(event, callback) { this.listeners[event] = callback; }
  setAttribute(name, value) { this[name] = value; }
  async trigger(event) { return this.listeners[event]?.({ preventDefault() {} }); }
}
const payload = () => ({ revision: 0, scope: 'New orders only; saved orders and Cost Low retain existing fees.', history: [],
  categories: hierarchy.categories.map(parent => ({ categoryId: parent.id, label: parent.label, subcategoryCount: parent.children.length, overridePercentage: null,
    defaultPercentage: 8, defaultRange: { minimum: 8, maximum: 8 } })) });
function harness({ token = 'fixture', response = payload(), error = null } = {}) {
  const ids = new Map(); const calls = [];
  const document = { getElementById(id) { if (!ids.has(id)) ids.set(id, new Node(id)); return ids.get(id); }, createElement(tag) { return new Node(tag); } };
  let nextError = error;
  vm.runInNewContext(source, { document, adminToken: token, BASE_URL: 'http://local-fixture.invalid', AbortSignal, Date, Map, Number, String, JSON,
    window: { confirm: () => true }, clearAdminSession() {}, redirectToLogin() {}, handleAdminSessionExpiry: () => false,
    async fetch(url, options) {
      calls.push({ url, options });
      if (nextError) { const failure = nextError; nextError = null; throw new Error(failure); }
      return { ok: true, status: 200, json: async () => response };
    },
  });
  return { ids, calls, setError: message => { nextError = message; }, settle: () => new Promise(resolve => setImmediate(resolve)) };
}
test('dashboard exposes a dedicated Vendor Commissions page', () => {
  const index = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.match(index, /href="vendor-commissions\.html"[^>]*>Vendor Commissions/);
  const page = fs.readFileSync(path.join(__dirname, '../vendor-commissions.html'), 'utf8');
  assert.match(page, /js\/admin\/runtime\.js/); assert.match(page, /js\/admin\/vendor-commissions\.js/);
  assert.match(page, /id="commissionFields" disabled/);
});
test('all 23 category rows render with labeled controls and no save before changes', async () => {
  const h = harness(); await h.settle();
  assert.equal(h.ids.get('commissionRows').children.length, 23);
  assert.equal(h.ids.get('saveCommissions').disabled, true);
  for (const row of h.ids.get('commissionRows').children) {
    assert.equal(row.children[2].children[0].checked, false);
    assert.equal(row.children[3].children[0].disabled, true);
    assert.ok(row.children[3].children[0]['aria-label']);
  }
});
test('selecting a custom rate sends only changed IDs, revision and reason', async () => {
  const h = harness(); await h.settle();
  const row = h.ids.get('commissionRows').children[0]; const toggle = row.children[2].children[0]; const input = row.children[3].children[0];
  toggle.checked = true; await toggle.trigger('change'); input.value = '0'; await input.trigger('input');
  assert.equal(input.disabled, false); assert.equal(h.ids.get('saveCommissions').disabled, false);
  h.ids.get('commissionReason').value = 'Updated category agreement'; await h.ids.get('commissionForm').trigger('submit');
  const sent = JSON.parse(h.calls[1].options.body);
  assert.deepEqual(sent, { revision: 0, reason: 'Updated category agreement', changes: [{ categoryId: hierarchy.categories[0].id, percentage: 0 }] });
  assert.equal(h.calls[1].options.headers.Authorization, 'Bearer fixture');
});
test('disabling an existing custom rate requests restoration of defaults', async () => {
  const response = payload(); response.categories[0].overridePercentage = 9;
  const h = harness({ response }); await h.settle(); const row = h.ids.get('commissionRows').children[0];
  const toggle = row.children[2].children[0]; toggle.checked = false; await toggle.trigger('change');
  await h.ids.get('commissionForm').trigger('submit');
  assert.equal(JSON.parse(h.calls[1].options.body).changes[0].percentage, null);
});
test('failed save retains edits and does not report success', async () => {
  const h = harness(); await h.settle(); const row = h.ids.get('commissionRows').children[0];
  const toggle = row.children[2].children[0]; const input = row.children[3].children[0];
  toggle.checked = true; await toggle.trigger('change'); input.value = '11'; h.setError('Mocked network failure');
  await h.ids.get('commissionForm').trigger('submit');
  assert.equal(input.value, '11'); assert.equal(toggle.checked, true);
  assert.match(h.ids.get('commissionStatus').textContent, /edits are retained/);
});
test('missing session and unavailable backend never enable commission editing', async () => {
  const noToken = harness({ token: '' }); await noToken.settle(); assert.equal(noToken.calls.length, 0);
  const failure = harness({ error: 'Backend unavailable' }); await failure.settle();
  assert.equal(failure.ids.get('commissionFields').disabled, true);
  assert.match(failure.ids.get('commissionStatus').textContent, /Backend unavailable/);
});
test('unsafe blank or excessive rate is not submitted', async () => {
  const h = harness(); await h.settle(); const row = h.ids.get('commissionRows').children[0];
  const toggle = row.children[2].children[0]; const input = row.children[3].children[0];
  toggle.checked = true; await toggle.trigger('change');
  for (const value of ['', '101', '-1']) { input.value = value; await h.ids.get('commissionForm').trigger('submit'); }
  assert.equal(h.calls.length, 1);
});
test('audit strings use text nodes rather than executable HTML', async () => {
  const response = payload(); response.history = [{ changedAt: new Date().toISOString(), reason: '<img onerror=alert(1)>', changes: [{ label: '<script>', previousPercentage: null, newPercentage: 10 }] }];
  const h = harness({ response }); await h.settle();
  assert.equal(h.ids.get('commissionHistory').children[0].children[1].textContent, '<img onerror=alert(1)>');
  assert.doesNotMatch(source, /innerHTML/);
});
