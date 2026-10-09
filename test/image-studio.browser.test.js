const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');
const browser = process.env.ADMIN_IMAGE_STUDIO_BROWSER_PATH;

// Runs the real Image Studio JavaScript against local API fixtures only.
// This is UI verification, not live authentication/provider verification.
test('Image Studio browser readiness, preview, consent, duplicates and sandbox review', { skip: !browser, timeout: 90000 }, async () => {
  // Load this optional local harness only when explicitly running the browser
  // check; ordinary Admin tests must also work in a standalone checkout.
  const express = createRequire(path.resolve(__dirname, '../../naijago_backend/package.json'))('express');
  const app = express(); app.use(express.json());
  const id = '111111111111111111111111', productId = '222222222222222222222222';
  const counts = { batches: 0, reviews: 0 }; let state = 'pending_review';
  const row = () => ({ id, productId, productName: 'Local studio fixture', state, storedState: state,
    generation: 1, revision: state === 'pending_review' ? 0 : 1, profile: 'standard', sandbox: true, history: [], canRegenerate: false });
  const mode = req => new URL(req.headers.referer || 'http://127.0.0.1/?mode=ready').searchParams.get('mode');
  app.get('/studio', (_req, res) => res.type('html').send(`<!doctype html><html><head><title>Local Image Studio verification</title></head><body>
    <section class="card"><div id="productModerationList"></div></section>
    <script>const currentPage='product-moderation',adminToken='local-fixture',BASE_URL=window.location.origin;
    function handleAdminSessionExpiry(){return false;}</script>
    <script src="/image-refinements.js"></script><script src="/checks.js"></script></body></html>`));
  app.get('/image-refinements.js', (_req, res) => res.sendFile(path.resolve(__dirname, '../js/admin/image-refinements.js')));
  app.get('/checks.js', (_req, res) => res.type('js').send('(' + checks.toString() + ')();'));
  app.get('/api/products/admin/catalog', (_req, res) => res.json({ products: [{ _id: productId, name: 'Local studio fixture', productStatus: 'active' }], total: 1 }));
  app.get('/api/image-refinements/config', (req, res) => res.json({ enabled: true, processingEnabled: mode(req) !== 'blocked', sandbox: true,
    databaseReady: mode(req) !== 'blocked', missingConfiguration: [], databaseChecks: mode(req) === 'blocked'
      ? [{ collection: 'imagerefinements', status: 'collection_missing' }] : [] }));
  app.get('/api/image-refinements', (req, res) => mode(req) === 'blocked'
    ? res.status(503).json({ message: 'Image refinement is not enabled or is still preparing.' }) : res.json({ images: [row()], nextCursor: null }));
  app.post('/api/image-refinements/preview', (_req, res) => res.json({ newImages: 1, products: [{ productId,
    productName: 'Local studio fixture', newImages: 1, skippedImages: 0, state: 'eligible', images: [{ eligible: true }] }], message: 'Local preview fixture' }));
  app.post('/api/image-refinements/batch', (_req, res) => { counts.batches++; setTimeout(() => res.status(202).json({ results: [{ productId, state: 'scheduled' }] }), 100); });
  app.put('/api/image-refinements/:id', (req, res) => {
    assert.equal(req.body.action, 'reject'); assert.equal(req.body.reason, 'Local rejection');
    counts.reviews++; state = 'rejected'; setTimeout(() => res.json(row()), 100);
  });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  try {
    for (const selectedMode of ['blocked', 'ready']) {
      const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'naijago-image-browser-'));
      const child = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-background-networking',
        '--user-data-dir=' + profile, '--dump-dom', '--virtual-time-budget=20000',
        `http://127.0.0.1:${server.address().port}/studio?mode=${selectedMode}`], { windowsHide: true });
      let stdout = ''; child.stdout.on('data', data => { stdout += data; }); child.stderr.resume();
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { child.kill(); reject(new Error('Local browser timed out')); }, 40000);
        child.once('error', error => { clearTimeout(timer); reject(error); });
        child.once('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error('Browser exited ' + code)); });
      });
      const result = stdout.match(/<pre id="studio-check-result" data-status="(pass|fail)">([^<]*)<\/pre>/);
      assert.ok(result, 'Browser did not complete ' + selectedMode + ' checks');
      assert.equal(result[1], 'pass', selectedMode + ': ' + result[2]);
    }
    assert.equal(counts.batches, 1); assert.equal(counts.reviews, 1);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

async function checks() {
  let phase = 'panel initialization';
  const wait = async condition => { for (let n = 0; n < 500; n++) { if (condition()) return; await new Promise(resolve => setTimeout(resolve, 20)); } throw new Error('UI condition timed out'); };
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const button = label => [...document.querySelectorAll('button')].find(node => node.textContent === label);
  try {
    await wait(() => document.getElementById('imageRefinements'));
    phase = 'product search';
    button('Search products').click();
    const productLabel = () => [...document.querySelectorAll('label')].find(node => node.textContent.startsWith('Local studio fixture |'));
    await wait(() => productLabel());
    const selected = productLabel().querySelector('input'); selected.click();
    const queue = button('Queue selected images');
    if (new URL(location.href).searchParams.get('mode') === 'blocked') {
      await wait(() => document.getElementById('imageRefinements').textContent.includes('collection_missing'));
      assert(queue.disabled && button('Preview selected photos').disabled, 'Unready processing controls enabled');
      selected.click();
      assert(document.getElementById('imageRefinements').textContent.includes('collection_missing'), 'Product selection hid readiness error');
    } else {
      phase = 'processing readiness';
      await wait(() => !button('Preview selected photos').disabled);
      assert(queue.disabled, 'Queue allowed without preview/consent'); button('Preview selected photos').click();
      phase = 'preview response';
      await wait(() => document.getElementById('imageRefinements').textContent.includes('1 new photos selected'));
      assert(queue.disabled, 'Queue allowed without consent');
      [...document.querySelectorAll('label')].find(node => node.textContent.includes('I have permission')).querySelector('input').click();
      assert(!queue.disabled, 'Preview and consent did not allow queueing'); queue.click(); queue.click();
      phase = 'batch response';
      await wait(() => !selected.checked && !document.querySelector('label input:disabled')); assert(queue.disabled, 'Completed batch retained queue eligibility');
      await wait(() => button('Reject')); assert(!button('Approve and publish'), 'Sandbox candidate allowed publication');
      button('Reject').click(); assert(document.body.textContent.includes('Enter a review reason.'), 'Missing rejection reason accepted');
      document.querySelector('textarea[aria-label="Image review reason"]').value = 'Local rejection';
      button('Reject').click(); button('Reject').click();
      phase = 'rejection response';
      await wait(() => document.querySelector('#imageRefinements article')?.textContent.includes('rejected'));
    }
    const result = document.createElement('pre'); result.id = 'studio-check-result'; result.dataset.status = 'pass'; result.textContent = 'Local browser checks passed'; document.body.append(result);
  } catch (error) { const result = document.createElement('pre'); result.id = 'studio-check-result'; result.dataset.status = 'fail'; result.textContent = phase + ': ' + error.message + ' | ' + document.getElementById('imageRefinements')?.textContent; document.body.append(result); }
}
