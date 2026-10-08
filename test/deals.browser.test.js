const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');
const backend = createRequire(path.resolve(__dirname, '../../naijago_backend/package.json'));
const browser = process.env.ADMIN_DEALS_BROWSER_PATH;
const uri = process.env.INVENTORY_TEST_MONGO_URI;

// Runs the real page in an isolated browser profile against real test MongoDB.
// Never loads MONGO_URI or modifies the Admin source's production base URL.
test('Admin Deals browser moderation, details, pagination and empty state', {
  skip: !browser || !uri, timeout: 180000,
}, async () => {
  assert.ok(fs.existsSync(browser), 'Configured browser must exist');
  const mongoose = backend('mongoose'); const express = backend('express'); const jwt = backend('jsonwebtoken');
  const User = backend('./models/User'); const Product = backend('./models/Product');
  const Offer = backend('./models/ProductOffer'); const Deal = backend('./models/Deal');
  const service = backend('./services/dealService');
  const database = 'naijago_admin_ui_test_' + Date.now() + '_' + new mongoose.Types.ObjectId();
  const originalSecret = process.env.JWT_SECRET;
  let server, child;
  await mongoose.connect(uri, { dbName: database, serverSelectionTimeoutMS: 15000 });
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    assert.ok(hello.setName || hello.msg === 'isdbgrid', 'Browser tests require a dedicated transaction-capable database');
    await Promise.all([User, Product, Offer, Deal].map(model => model.init()));
    const baseUser = { firstName: 'Local', lastName: 'Browser fixture', password: 'test-only-browser-password' };
    const admin = await User.create({ ...baseUser, email: 'admin@example.invalid', phoneNumber: '08000000001', isAdmin: true });
    const vendor = await User.create({ ...baseUser, email: 'vendor@example.invalid', phoneNumber: '08000000002', isVendor: true, vendorStatus: 'approved', businessName: 'Local Test Vendor' });
    let selected;
    for (let n = 1; n <= 21; n++) {
      const product = await Product.create({ name: 'Browser Deal ' + n, description: 'Dedicated test fixture', category: 'Electronics',
        price: 1000, stockQuantity: 10, sellerId: vendor._id, sellerType: 'vendor', productStatus: 'active', moderationStatus: 'approved' });
      const offer = await Offer.create({ product: product._id, sellerType: 'vendor', sellerId: vendor._id, price: 1000, stockQuantity: 10, status: 'active' });
      selected = await service.create({ productId: String(product._id), productOfferId: String(offer._id), discountType: 'percentage', discountValue: 20,
        startAt: new Date(Date.now() - 60000).toISOString(), endAt: new Date(Date.now() + 3600000).toISOString() }, vendor);
    }
    process.env.JWT_SECRET = require('node:crypto').randomBytes(32).toString('hex');
    const token = jwt.sign({ id: String(admin._id) }, process.env.JWT_SECRET, { expiresIn: '5m' });
    const app = express(); app.use(express.json());
    const routes = backend('./routes/dealRoutes');
    app.use('/api/deals', routes.router); app.use('/api/admin/deals', routes.adminRouter);
    app.use('/api/products', backend('./routes/productRoutes'));
    app.get('/js/admin/runtime.js', (_req, res) => {
      const source = fs.readFileSync(path.resolve(__dirname, '../js/admin/runtime.js'), 'utf8');
      const original = 'const BASE_URL = "https://naijago-backend.onrender.com";';
      assert.ok(source.includes(original));
      res.type('js').send(source.replace(original, 'const BASE_URL = window.location.origin;'));
    });
    app.get('/deals.html', (_req, res) => {
      const html = fs.readFileSync(path.resolve(__dirname, '../deals.html'), 'utf8');
      const bootstrap = '<script>localStorage.setItem("admin_jwt_token",' + JSON.stringify(token) + ');document.currentScript.remove();</script>';
      res.type('html').send(html.replace('<head>', '<head>' + bootstrap).replace('</body>', '<script src="/browser-check.js"></script></body>'));
    });
    app.get('/browser-check.js', (_req, res) => res.type('js').send('(' + browserChecks.toString() + ')();'));
    app.use(express.static(path.resolve(__dirname, '..')));
    app.use((_req, res) => res.status(404).json({ message: 'Local test endpoint not found.' }));
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'naijago-admin-browser-'));
    const url = 'http://127.0.0.1:' + server.address().port + '/deals.html';
    let stdout = '', stderr = '';
    child = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-background-networking', '--disable-component-update',
      '--user-data-dir=' + profile, '--dump-dom', '--virtual-time-budget=60000', url], { windowsHide: true });
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    await new Promise((resolve, reject) => { const timer = setTimeout(() => { child.kill(); reject(new Error('Headless browser timed out')); }, 120000);
      child.once('error', error => { clearTimeout(timer); reject(error); }); child.once('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error('Browser exit ' + code)); }); });
    const match = stdout.match(/<pre id="browser-test-result" data-status="(pass|fail)">([^<]*)<\/pre>/);
    assert.ok(match, 'Browser did not finish the UI checks. Browser diagnostic count: ' + stderr.split('\n').length);
    const result = JSON.parse(match[2].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<'));
    assert.equal(match[1], 'pass', result.error || 'Browser checks failed');
    assert.equal(result.checks.length, 12);
    const stored = await Deal.findById(selected._id).lean(); assert.equal(stored.status, 'rejected'); assert.equal(stored.featured, false);
    for (const action of ['approve', 'feature', 'unfeature', 'pause', 'unpause', 'reject']) assert.equal(stored.history.filter(row => row.action === action).length, 1, 'Duplicate moderation action: ' + action);
    assert.equal(stored.moderationReason, 'Local browser verification');
    const mine = await service.listManaged({ limit: '50' }, vendor); assert.equal(mine.deals.find(row => String(row._id) === String(selected._id)).status, 'rejected');
    console.log('Browser checks passed: ' + result.checks.join(', '));
  } finally {
    if (child && child.exitCode === null) child.kill();
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
    assert.equal(mongoose.connection.name, database); assert.ok(database.startsWith('naijago_admin_ui_test_'));
    try { await mongoose.connection.dropDatabase(); } finally { await mongoose.disconnect(); }
  }
});

async function browserChecks() {
  const checks = [];
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const wait = async (condition, message) => { for (let n = 0; n < 1000; n++) { if (condition()) return; await new Promise(resolve => setTimeout(resolve, 20)); } throw new Error(message); };
  const field = id => document.getElementById(id);
  const row = () => [...field('dealsRows').querySelectorAll('tr')].find(node => node.textContent.includes('Browser Deal 21'));
  const button = (root, text) => [...root.querySelectorAll('button')].find(node => node.textContent.trim() === text);
  const idle = () => !field('dealsRefresh').disabled;
  const settle = async () => { await wait(() => idle() && /Deals loaded|No Deals match/.test(field('dealsState').textContent), 'Deal loading did not finish: ' + field('dealsState').textContent); };
  const action = async name => {
    const title = name[0].toUpperCase() + name.slice(1);
    const control = button(row(), title); assert(control && !control.disabled, 'Missing action: ' + name); control.click();
    await wait(() => document.querySelector('[role="dialog"]'), 'Missing action dialog');
    const dialog = document.querySelector('[role="dialog"]'); const reason = dialog.querySelector('textarea'); reason.value = 'Local browser verification';
    const confirm = button(dialog, 'Confirm ' + name); confirm.click(); confirm.click();
    await wait(() => !document.querySelector('[role="dialog"]'), 'Moderation did not complete: ' + name);
    await settle(); checks.push(name);
  };
  try {
    await settle(); assert(field('dealsRows').children.length === 20, 'Expected first page of 20 Deals'); assert(row(), 'Selected test product missing');
    assert(row().textContent.includes('Local Test Vendor'), 'Vendor name missing'); assert(row().textContent.includes('1,000.00'), 'Original price missing'); checks.push('initial rendering');
    assert(![...document.querySelectorAll('button')].some(node => /create deal|edit deal/i.test(node.textContent)), 'Unsupported Admin creation/edit control');
    button(row(), 'Details').click(); const details = document.querySelector('[role="dialog"]'); assert(details.textContent.includes('Browser Deal 21'), 'Details product mismatch');
    button(details, 'Close').click(); checks.push('details');
    field('dealsNext').click(); await wait(() => idle() && field('dealsPageInfo').textContent.includes('Page 2'), 'Next page failed'); assert(field('dealsRows').children.length === 1, 'Second page count mismatch');
    field('dealsPrevious').click(); await wait(() => idle() && field('dealsPageInfo').textContent.includes('Page 1'), 'Previous page failed'); checks.push('pagination');
    await action('approve'); assert(row().textContent.includes('800.00'), 'Approved backend Deal price missing');
    await action('feature'); assert(row().children[5].textContent === 'Featured', 'Featured state missing');
    await action('unfeature'); await action('pause'); await action('unpause');
    button(row(), 'Reject').click(); const rejectDialog = document.querySelector('[role="dialog"]'); const reason = rejectDialog.querySelector('textarea');
    button(rejectDialog, 'Confirm reject').click(); assert(reason.validity.valueMissing && document.querySelector('[role="dialog"]'), 'Empty rejection was not blocked');
    button(rejectDialog, 'Close').click(); checks.push('required rejection reason'); await action('reject');
    field('dealsStatus').value = 'rejected'; field('dealsStatus').dispatchEvent(new Event('change')); await settle(); assert(field('dealsRows').children.length === 1, 'Rejected status filter failed'); checks.push('status filtering');
    field('dealsStatus').value = 'draft'; field('dealsStatus').dispatchEvent(new Event('change')); await settle(); assert(field('dealsRows').children.length === 0, 'Empty filter retained stale rows'); assert(field('dealsNext').disabled, 'Empty page retained pagination'); checks.push('empty state');
    const result = document.createElement('pre'); result.id = 'browser-test-result'; result.dataset.status = 'pass'; result.textContent = JSON.stringify({ checks }); document.body.append(result);
  } catch (error) { const result = document.createElement('pre'); result.id = 'browser-test-result'; result.dataset.status = 'fail'; result.textContent = JSON.stringify({ checks, error: error.message }); document.body.append(result); }
}
