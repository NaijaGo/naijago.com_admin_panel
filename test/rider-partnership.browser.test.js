'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const browser = [process.env.NAIJAGO_UI_TEST_BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(file => file && fs.existsSync(file));
const first = 'a'.repeat(24), second = 'b'.repeat(24);

async function checks(flow) {
  const wait = async predicate => {
    for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 25)); }
    throw new Error('Local rider UI did not finish loading');
  };
  try {
    if (flow) {
      const el = id => document.getElementById(id);
      window.confirm = () => true;
      await wait(() => !el('draftFields').disabled);
      if (!el('saveRequired').disabled || !el('requiredStepStatus').textContent.includes('step 1')) throw new Error('Empty requirement must explain publishing first');
      el('agreementContent').value = 'Complete fixture agreement\nAll paragraphs remain visible.';
      el('saveDraft').click();
      await wait(() => el('agreementStepStatus').textContent.includes('Enter a version'));
      if (!el('agreementContent').value.includes('All paragraphs')) throw new Error('Missing version lost the draft text');
      el('agreementVersion').value = '1.0'; el('saveDraft').click();
      await wait(() => el('partnershipStatus').textContent.includes('Draft saved and confirmed'));
      if (el('publishAgreement').disabled || !el('saveRequired').disabled) throw new Error('Saved draft must allow publication but not requirement');
      el('publishAgreement').click();
      await wait(() => el('partnershipStatus').textContent.includes('published and locked'));
      if (!el('agreementContent').readOnly || !el('saveRequired').disabled) throw new Error('Publication must lock text and require a reason');
      el('requiredReason').value = 'Initial approved fixture terms'; el('requiredReason').dispatchEvent(new Event('input'));
      if (el('saveRequired').disabled) throw new Error('Published selected version and reason must enable the button');
      el('saveRequired').click();
      await wait(() => el('partnershipStatus').textContent.includes('Required agreement confirmed'));
      if (!el('requiredStatus').textContent.includes('Required version: 1.0') || !el('saveRequired').disabled) throw new Error('Confirmed requirement must be visible and avoid duplicate changes');
      const bounds = [el('agreementVersion'), el('agreementContent'), el('requiredAgreement'), el('requiredReason')].map(element => element.getBoundingClientRect());
      el('browser-result').textContent = JSON.stringify({ width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth,
        controlsFit: bounds.every(rect => rect.left >= 0 && rect.right <= innerWidth), required: el('requiredAgreement').value });
      return;
    }
    const select = document.getElementById('historyRider');
    await wait(() => select.options.length === 3 && !select.disabled);
    if (select.value) throw new Error('A rider was selected without admin input');
    if (!select.options[2].textContent.includes('08000000002')) throw new Error('Duplicate rider names must show their contact details');
    select.focus(); select.value = 'b'.repeat(24); select.dispatchEvent(new Event('change'));
    await wait(() => document.getElementById('acceptanceStatus').textContent.includes('Current version accepted'));
    if (!document.getElementById('historyRiderIdentity').textContent.includes('08000000002')) throw new Error('Selected rider identity is missing');
    const record = document.getElementById('acceptanceRecords').textContent;
    if (!record.includes('2.0') || !record.includes('SHA-256')) throw new Error('Saved acceptance audit fields must be visible');
    if (window.fixtureInjected) throw new Error('Rider names must remain inert text');
    const input = document.getElementById('riderLookupSearch');
    const bounds = [input, select].map(element => element.getBoundingClientRect());
    const result = { width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth,
      controlsFit: bounds.every(rect => rect.left >= 0 && rect.right <= innerWidth),
      selected: select.value, background: getComputedStyle(select).backgroundColor };
    document.getElementById('browser-result').textContent = JSON.stringify(result);
  } catch (error) { document.getElementById('browser-result').textContent = JSON.stringify({ error: error.message }); }
}

for (const [width, flow] of [[320, false], [1440, false], [320, true], [1440, true]]) test(`actual rider partnership page ${flow ? 'saves, publishes and requires an agreement' : 'searches and selects safely'} at ${width}px`,
  { skip: !browser, timeout: 45000 }, async t => {
    const calls = [], state = { agreements: [], policy: { revision: 0, history: [], agreementId: null }, setup: { ready: true } };
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname.startsWith('/api/')) {
        calls.push({ method: req.method, path: url.pathname, riderId: url.searchParams.get('riderId'), source: url.searchParams.get('source') });
        if (req.method !== 'GET') {
          const chunks = []; for await (const chunk of req) chunks.push(chunk);
          const body = JSON.parse(Buffer.concat(chunks).toString()); let payload;
          if (url.pathname.endsWith('/agreements') && req.method === 'POST') {
            const agreement = { _id: first, version: body.version, content: body.content, status: 'draft', __v: 0 };
            state.agreements.push(agreement); payload = { agreement }; res.statusCode = 201;
          } else if (url.pathname.endsWith('/publish') && req.method === 'POST') {
            Object.assign(state.agreements[0], { status: 'published', __v: 1, effectiveAt: '2026-01-01' }); payload = { agreement: state.agreements[0] };
          } else if (url.pathname.endsWith('/required') && req.method === 'PUT') {
            state.policy.agreementId = body.agreementId; state.policy.revision++;
            state.policy.history.push({ agreementId: body.agreementId, reason: body.reason, changedAt: '2026-10-13', changedBy: second }); payload = { policy: state.policy };
          } else { res.statusCode = 400; payload = { message: 'Unexpected fixture mutation' }; }
          res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(payload)); return;
        }
        const payload = url.pathname.endsWith('/contacts/riders')
          ? { contacts: [{ id: first, source: 'individual', name: '<script>window.fixtureInjected=true</script>', phoneNumber: '08000000001' },
            { id: second, source: 'individual', name: 'Fixture rider', phoneNumber: '08000000002' }], pagination: { pages: 1 } }
          : url.pathname.endsWith('/acceptances') ? { rider: { _id: second }, status: { accepted: true, requiredVersion: '2.0' },
            acceptances: [{ _id: 'c'.repeat(24), version: '2.0', contentHash: 'd'.repeat(64), acceptedAt: '2026-10-13T10:00:00Z' }] }
          : url.pathname.endsWith('/bonuses') ? { bonuses: [] } : state;
        res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(payload)); return;
      }
      if (url.pathname === '/js/admin/runtime.js') {
        res.setHeader('Content-Type', 'text/javascript');
        res.end('const BASE_URL=location.origin;const adminToken="fixture";function handleAdminSessionExpiry(){return false}function clearAdminSession(){}function redirectToLogin(){}'); return;
      }
      if (url.pathname === '/rider-partnership.html') {
        let page = fs.readFileSync(path.join(root, 'rider-partnership.html'), 'utf8');
        // Offline local fixtures: no CDN, production runtime, account or database.
        page = page.replace(/<script\b[^>]*src="https:[^"]*"[^>]*><\/script>/g, '');
        page = page.replace('</head>', '<style>*{box-sizing:border-box}body{margin:0;padding:16px}.container{width:100%}.w-full{width:100%}select{width:100%}.flex{display:flex}.flex-col{flex-direction:column}.gap-3{gap:12px}</style></head>');
        page = page.replace('</body>', `<pre id="browser-result" hidden></pre><script>(${checks.toString()})(${flow});</script></body>`);
        res.setHeader('Content-Type', 'text/html'); res.end(page); return;
      }
      if (url.pathname === '/') {
        res.setHeader('Content-Type', 'text/html');
        res.end(`<iframe style="width:${width}px;height:900px;border:0" src="/rider-partnership.html" onload="const timer=setInterval(()=>{const value=this.contentDocument.getElementById('browser-result').textContent;if(value){document.getElementById('result').textContent=value;clearInterval(timer)}},25)"></iframe><pre id="result"></pre>`); return;
      }
      const assets = ['/css/admin-panel.css', '/css/brand-colors.css', '/js/admin/rider-partnership.js'];
      if (assets.includes(url.pathname)) {
        res.setHeader('Content-Type', url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript');
        res.end(fs.readFileSync(path.join(root, url.pathname.slice(1)))); return;
      }
      res.statusCode = 404; res.end('Local fixture route not found');
    });
    server.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'naijago-rider-history-ui-'));
    const child = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-background-networking',
      '--disable-component-update', '--user-data-dir=' + profile, '--virtual-time-budget=5000', '--dump-dom',
      `http://127.0.0.1:${server.address().port}/`], { windowsHide: true });
    let output = ''; child.stdout.on('data', bytes => output += bytes.toString()); child.stderr.resume();
    t.after(() => { if (child.exitCode === null) child.kill(); });
    const timer = setTimeout(() => child.kill(), 30000);
    await new Promise((resolve, reject) => {
      child.once('error', reject); child.once('close', code => code === 0 ? resolve() : reject(new Error('Local browser failed: ' + code)));
    }).finally(() => clearTimeout(timer));
    const match = output.match(/<pre id="result">([^<]+)<\/pre>/); assert.ok(match, 'Actual local page must complete');
    const result = JSON.parse(match[1]); assert.equal(result.error, undefined); assert.equal(result.width, width);
    assert.equal(result.overflow, false); assert.equal(result.controlsFit, true);
    assert.ok(calls.some(call => call.source === 'individual'));
    if (flow) {
      assert.equal(result.required, first); assert.equal(state.policy.agreementId, first); assert.equal(state.policy.revision, 1);
      assert.deepEqual(calls.filter(call => call.method !== 'GET').map(call => call.method), ['POST', 'POST', 'PUT']);
      assert.equal(calls.some(call => call.path.endsWith('/review')), false);
      return;
    }
    assert.equal(result.selected, second);
    assert.equal(calls.filter(call => call.path.endsWith('/acceptances')).length, 1);
    assert.equal(calls.find(call => call.path.endsWith('/acceptances')).riderId, second);
    assert.ok(calls.every(call => call.method === 'GET'), 'Viewing records must not trigger writes');
  });
