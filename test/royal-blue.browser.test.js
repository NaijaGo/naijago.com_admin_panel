const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const candidates = [process.env.NAIJAGO_UI_TEST_BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'];
const browser = candidates.find(file => file && fs.existsSync(file));
const css = fs.readFileSync(path.join(__dirname,'../css/admin-panel.css'),'utf8') + '\n' + fs.readFileSync(path.join(__dirname,'../css/brand-colors.css'),'utf8');

for (const width of [320,1440]) test(`actual shared admin CSS remains Royal Blue and readable at ${width}px`, {skip: !browser, timeout:45000}, async t => {
  const markup = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{box-sizing:border-box}html,body{margin:0}.container{width:100%}${css}</style></head><body>
    <main class="container"><section class="card" style="padding:12px"><h1 class="text-light-slate">NaijaGo product</h1><label>Available colours<input class="input-field" value="Black, Royal Blue"></label><p class="text-light-gray">Review your real product options.</p><button class="btn btn-primary">Save changes</button><p class="message success">Order completed</p></section></main><pre id="result"></pre>
    <script>const card=document.querySelector('.card'),button=document.querySelector('.btn'),input=document.querySelector('input');
    document.getElementById('result').textContent=JSON.stringify({body:getComputedStyle(document.body).backgroundColor,card:getComputedStyle(card).backgroundColor,button:getComputedStyle(button).backgroundColor,label:getComputedStyle(button).color,text:getComputedStyle(document.body).color,success:getComputedStyle(document.querySelector('.success')).color,overflow:document.documentElement.scrollWidth>innerWidth,inputRight:input.getBoundingClientRect().right,width:innerWidth});</script></body></html>`;
  // Chromium clamps small desktop windows. An iframe provides the exact tested
  // mobile viewport, including real CSS media queries and innerWidth.
  const escaped=markup.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const page=`<!doctype html><html><body><iframe style="width:${width}px;height:900px;border:0" srcdoc="${escaped}" onload="document.getElementById('result').textContent=this.contentDocument.getElementById('result').textContent"></iframe><pre id="result"></pre></body></html>`;
  const server=http.createServer((_req,res)=>{res.setHeader('Content-Type','text/html');res.end(page);});
  server.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'naijago-royal-ui-'));
  const child=spawn(browser,['--headless=new','--disable-gpu','--no-first-run',`--user-data-dir=${profile}`,`--window-size=${width},900`,'--virtual-time-budget=1500','--dump-dom',`http://127.0.0.1:${server.address().port}`],{windowsHide:true});
  let output='';child.stdout.on('data',bytes=>output+=bytes.toString());child.stderr.resume();
  t.after(()=>{if(child.exitCode===null)child.kill();});
  const timer=setTimeout(()=>child.kill(),30000);
  await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>code===0?resolve():reject(new Error('Headless browser did not complete.')));}).finally(()=>clearTimeout(timer));
  const match=output.match(/<pre id="result">([^<]+)<\/pre>/);assert.ok(match,'Browser must render local CSS fixture');const result=JSON.parse(match[1]);
  assert.equal(result.body,'rgb(248, 250, 252)');assert.equal(result.card,'rgb(255, 255, 255)');
  assert.equal(result.button,'rgb(65, 105, 225)');assert.equal(result.label,'rgb(255, 255, 255)');
  assert.equal(result.text,'rgb(15, 23, 42)');assert.equal(result.success,'rgb(22, 101, 52)');
  assert.equal(result.width,width,'Headless browser must use the requested viewport width.');
  assert.equal(result.overflow,false);assert.ok(result.inputRight<=result.width);
});
