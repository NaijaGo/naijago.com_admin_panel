'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const vm = require('node:vm');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const browser = [process.env.NAIJAGO_UI_TEST_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(file => file && fs.existsSync(file));
const shared = fs.readFileSync(path.join(root, 'css/admin-panel.css'), 'utf8');
const palette = fs.readFileSync(path.join(root, 'css/brand-colors.css'), 'utf8');

// Render the real order functions with synthetic data. No runtime/auth scripts,
// API requests, sockets, credentials or database connections are loaded.
function orderCards() {
  const cards = [];
  const context = vm.createContext({
    window: { addEventListener() {}, latestOnlineRiders: {
      total: 1, companyRiders: [], individualRiders: [{ riderId: 'fixture-rider',
        fullName: 'Local Fixture Rider With A Long Name', phoneNumber: '08000000000', isAvailable: true }],
    } },
    setInterval() {}, currentFilter: 'all', allOrders: [],
    document: { querySelectorAll: () => [], createElement: () => ({ classList: { add() {} }, innerHTML: '' }) },
    ordersList: { innerHTML: '', appendChild: card => cards.push(card) },
    formatStatusLabel: value => value,
    escapeHtml: value => String(value).replace(/[&<>"']/g, char =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])),
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'js/admin/orders.js'), 'utf8'), context);
  const order = status => ({ _id: 'fixture-order-' + status, mainOrderStatus: status,
    isPaid: true, isDelivered: ['delivered', 'completed'].includes(status),
    totalPrice: 1000, createdAt: '2026-10-01T10:00:00Z',
    user: { firstName: 'Local', lastName: 'Fixture', email: 'fixture@example.invalid' },
    shippingAddress: { address: 'Synthetic test address', city: 'Local fixture' },
    shipments: [{ _id: 'fixture-shipment', vendor: { businessName: 'Fixture vendor' },
      vendorPayout: 900, platformFee: 100, status: 'processing',
      orderItems: [{ name: 'Fixture product', qty: 1, price: 1000 }] }],
  });
  context.renderOrders(['processing', 'payment_review', 'delivered', 'completed'].map(order));
  return cards.map(card => `<article class="card order-card">${card.innerHTML}</article>`).join('');
}

// Representative runtime Tailwind rules deliberately follow the palette.
// This catches the cascade bug behind the unreadable select and yellow text.
const lateUtilities = String.raw`
  *{box-sizing:border-box}html,body{margin:0}body{font-family:Arial,sans-serif}
  .container{width:100%}.flex{display:flex}.flex-col{flex-direction:column}.flex-wrap{flex-wrap:wrap}
  .flex-1{flex:1 1 0%}.gap-2{gap:.5rem}.gap-3{gap:.75rem}.grid{display:grid}.grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}
  .p-3{padding:.75rem}.p-4{padding:1rem}.p-8{padding:2rem}.px-3{padding-inline:.75rem}.px-4{padding-inline:1rem}.px-5{padding-inline:1.25rem}.py-2{padding-block:.5rem}.py-3{padding-block:.75rem}
  .mb-2{margin-bottom:.5rem}.mb-4{margin-bottom:1rem}.my-4{margin-block:1rem}.mt-4{margin-top:1rem}
  .border{border:1px solid}.rounded-lg{border-radius:.5rem}.font-bold,.font-semibold{font-weight:600}
  .text-xs{font-size:.75rem}.text-sm{font-size:.875rem}.text-white{color:white}
  .text-yellow-200{color:#fef08a}.text-yellow-300{color:#fde047}.text-yellow-400{color:#facc15}
  .text-green-200{color:#bbf7d0}.text-green-300{color:#86efac}.text-green-400{color:#4ade80}
  .text-red-300{color:#fca5a5}.text-blue-400{color:#60a5fa}.text-slate-300{color:#cbd5e1}
  .bg-\[\#1C2B47\]{background-color:#1c2b47}.bg-slate-900{background-color:#0f172a}
  .bg-black{background-color:rgb(0 0 0 / .2)}.bg-yellow-900{background-color:rgb(113 63 18 / .2)}
  .bg-green-900{background-color:rgb(20 83 45 / .3)}
  @media(min-width:768px){.md\:flex-row{flex-direction:row}.md\:grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;
const workspace = `<main class="container">
  <h1 class="text-light-slate">NaijaGo Order Management</h1>
  <nav class="flex flex-wrap gap-2"><a class="btn btn-primary-alt px-4 py-3" href="#">Dashboard</a><a class="btn btn-primary px-4 py-3" href="#">Orders</a></nav>
  <div id="ordersSection"><div class="flex"><h2>Orders</h2><div class="filter-controls flex"><label for="orderFilterDropdown">Filter by status:</label><select id="orderFilterDropdown"><option>All orders</option></select></div></div></div>
  ${orderCards()}
  <select class="bg-slate-900 text-white"><option>Legacy monitor filter</option></select>
  <div id="adminActivityPanel" style="background:#0a192f;color:#ccd6f6"><div id="adminActivityItems"><button data-event-id="fixture" style="color:#ccd6f6"><span style="color:#64ffda">Info</span><strong style="color:white">Fixture activity</strong><span style="color:#a8b2d1">Fixture detail</span></button></div></div>
</main>`;
const login = fs.readFileSync(path.join(root, 'login.html'), 'utf8');
const loginStyles = login.match(/<style>([\s\S]*?)<\/style>/)[1];
const loginBody = login.match(/<body[^>]*>([\s\S]*?)<\/body>/)[1].replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');

function inspect() {
  const results = [];
  function background(element) {
    for (let node = element; node; node = node.parentElement) {
      const value = getComputedStyle(node).backgroundColor;
      if (value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') return value;
    }
    return 'rgb(255, 255, 255)';
  }
  for (const selector of ['.assign-rider-select', '.assign-rider-btn', '.text-yellow-200', '.text-yellow-300',
    '.text-green-400', '.btn-primary', '.btn-primary-alt', '.btn-warning', '.btn-danger',
    '.status-btn:disabled', '#adminEmail', '#adminPassword', '.text-slate-300',
    '#adminActivityItems strong', '#adminActivityItems span']) {
    for (const element of document.querySelectorAll(selector)) {
      results.push({ selector, color: getComputedStyle(element).color, background: background(element) });
    }
  }
  const select = document.querySelector('.assign-rider-select');
  if (select) select.focus();
  document.getElementById('result').textContent = JSON.stringify({
    results, width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth,
    body: getComputedStyle(document.body).backgroundColor,
    select: select ? { color: getComputedStyle(select).color, background: getComputedStyle(select).backgroundColor,
      right: select.getBoundingClientRect().right, focus: getComputedStyle(select).borderTopColor } : null,
    options: [...document.querySelectorAll('select option')].map(option =>
      ({ color: getComputedStyle(option).color, background: getComputedStyle(option).backgroundColor })),
    reviewDisabled: [...document.querySelectorAll('[data-order-id="fixture-order-payment_review"][data-status]')].every(button => button.disabled),
    reviewCount: document.querySelectorAll('[data-order-id="fixture-order-payment_review"][data-status]').length,
    reviewAssign: !!document.querySelector('.assign-rider-btn[data-order-id="fixture-order-payment_review"]'),
  });
}
function luminance(rgb) {
  const values = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
    const v = value / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
  });
  return .2126 * values[0] + .7152 * values[1] + .0722 * values[2];
}
function contrast(fg, bg) { const a = luminance(fg), b = luminance(bg); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); }

for (const width of [320, 768, 1440]) for (const screen of ['orders', 'login']) {
  test(`calm admin ${screen}: contrast and local layout at ${width}px`, { skip: !browser, timeout: 45000 }, async t => {
    const body = screen === 'orders' ? workspace : loginBody;
    const markup = `<!doctype html><html><head><style>${screen === 'login' ? loginStyles : shared}\n${palette}\n${lateUtilities}</style></head><body class="p-8">${body}<pre id="result" style="display:none"></pre><script>(${inspect.toString()})()</script></body></html>`;
    const escaped = markup.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    const page = `<!doctype html><html><body><iframe style="width:${width}px;height:900px;border:0" srcdoc="${escaped}" onload="document.getElementById('result').textContent=this.contentDocument.getElementById('result').textContent"></iframe><pre id="result"></pre></body></html>`;
    const server = http.createServer((_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(page); });
    server.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'naijago-calm-admin-'));
    const child = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-background-networking',
      '--disable-component-update', '--user-data-dir=' + profile, '--virtual-time-budget=1500', '--dump-dom',
      `http://127.0.0.1:${server.address().port}`], { windowsHide: true });
    let stdout = ''; child.stdout.on('data', bytes => stdout += bytes.toString()); child.stderr.resume();
    t.after(() => { if (child.exitCode === null) child.kill(); });
    const timer = setTimeout(() => child.kill(), 30000);
    await new Promise((resolve, reject) => {
      child.once('error', reject); child.once('close', code => code === 0 ? resolve() : reject(new Error('Local browser failed: ' + code)));
    }).finally(() => clearTimeout(timer));
    const match = stdout.match(/<pre id="result">([^<]+)<\/pre>/); assert.ok(match, 'Local fixture must complete');
    const result = JSON.parse(match[1]);
    assert.equal(result.body, 'rgb(216, 225, 236)'); assert.equal(result.width, width); assert.equal(result.overflow, false);
    assert.ok(result.results.length > 4);
    for (const pair of result.results) assert.ok(contrast(pair.color, pair.background) >= 4.5,
      `${pair.selector}: ${pair.color} on ${pair.background} must meet 4.5:1`);
    for (const pair of result.options) assert.ok(contrast(pair.color, pair.background) >= 4.5);
    if (screen === 'orders') {
      assert.equal(result.select.color, 'rgb(23, 38, 60)');
      assert.equal(result.select.background, 'rgb(248, 250, 252)');
      assert.ok(result.select.right <= width); assert.equal(result.select.focus, 'rgb(49, 84, 181)');
      assert.equal(result.reviewCount, 8); assert.equal(result.reviewDisabled, true); assert.equal(result.reviewAssign, false);
    }
  });
}
