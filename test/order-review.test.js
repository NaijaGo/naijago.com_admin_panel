'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function fixture() {
  const cards = [];
  const context = vm.createContext({
    window: { addEventListener() {} }, setInterval() {},
    document: { querySelectorAll: () => [], createElement: () => ({ classList: { add() {} }, innerHTML: '' }) },
    ordersList: { innerHTML: '', appendChild: card => cards.push(card) },
    currentFilter: 'all', allOrders: [],
    escapeHtml: value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])),
    formatStatusLabel: value => value,
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/admin/orders.js'), 'utf8'), context);
  return { context, cards };
}
const order = extra => ({ _id: 'synthetic-order', isPaid: true, mainOrderStatus: 'processing', shipments: [], totalPrice: 1000, createdAt: '2026-09-21T10:00:00Z', ...extra });

test('review filter includes all backend review markers', () => {
  const { context } = fixture();
  context.currentFilter = 'payment_review';
  const rows = [order({ mainOrderStatus: 'payment_review' }), order({ paymentResult: { fulfillmentStatus: 'needs_attention' } }), order({ schedule: { state: 'needs_attention' } }), order({})];
  assert.equal(context.applyFilter(rows).length, 3);
});
test('review cards explain the hold and disable every status action', () => {
  const { context, cards } = fixture();
  context.renderOrders([order({ mainOrderStatus: 'payment_review', paymentResult: { reviewMessage: '<script>untrusted</script>' } })]);
  const html = cards[0].innerHTML;
  assert.match(html, /Payment received/);
  assert.match(html, /Do not collect another payment/);
  assert.doesNotMatch(html, /<script>|assign-rider-btn/);
  const buttons = [...html.matchAll(/<button[^>]*data-status=[^>]*>/g)].map(match => match[0]);
  assert.equal(buttons.length, 8);
  for (const button of buttons) assert.match(button, /disabled/);
});
test('unpaid orders do not offer preparation or rider assignment', () => {
  const { context, cards } = fixture();
  context.renderOrders([order({ isPaid: false, mainOrderStatus: 'pending_payment' })]);
  assert.match(cards[0].innerHTML, /Waiting for verified payment/);
  assert.match(cards[0].innerHTML, /<button[^>]*disabled[^>]*data-status="processing"/);
  assert.doesNotMatch(cards[0].innerHTML, /assign-rider-btn/);
});
test('future and expired scheduled orders cannot offer dispatch controls', () => {
  const { context } = fixture();
  for (const schedule of [
    { mode: 'scheduled', state: 'confirmed', dispatchAt: '2100-01-01T10:00:00Z', endAt: '2100-01-01T12:00:00Z' },
    { mode: 'scheduled', state: 'confirmed', dispatchAt: '2000-01-01T10:00:00Z', endAt: '2000-01-01T12:00:00Z' },
    { mode: 'scheduled', state: 'held' },
  ]) {
    assert.ok(context.orderDispatchHoldReason(order({ schedule })));
    assert.doesNotMatch(context.renderRiderAssignControls(order({ schedule })), /assign-rider-btn/);
  }
  assert.equal(context.orderDispatchHoldReason(order({})), null);
});
