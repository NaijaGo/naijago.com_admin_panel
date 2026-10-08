const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/admin/deals.js'),'utf8');
const html=fs.readFileSync(require('node:path').join(__dirname,'../deals.html'),'utf8');
const context={Set,Number,String,Error,statuses:new Set(['draft','pending','approved','rejected','paused'])};
vm.createContext(context);
for(const name of ['id','validId']) {const line=source.split(/\r?\n/).find(line=>line.trim().startsWith('const '+name+' ='));assert.ok(line);vm.runInContext(line.replace('const '+name,'var '+name),context);}
for(const name of ['validateDeal','actions']) {const start=source.indexOf('  function '+name+'(');const end=source.indexOf('\n  }',start);assert.ok(start>=0&&end>start);vm.runInContext(source.slice(start,end+4),context);}
const id='507f1f77bcf86cd799439011';const deal={_id:id,productId:id,vendorId:id,productOfferId:null,discountType:'percentage',discountValue:30,status:'pending'};
test('Admin Deals accepts the managed backend shape including populated references',()=>{
 assert.equal(context.validateDeal(deal),deal);assert.ok(context.validateDeal({...deal,productId:{_id:id},vendorId:{_id:id}}));
});
test('Admin Deals rejects malformed identifiers, status and discounts',()=>{
 for(const change of [{_id:'bad'},{productId:null},{vendorId:'bad'},{productOfferId:'bad'},{status:'live'},{discountType:'bogo'},{discountValue:NaN},{discountValue:Infinity},{discountValue:0}])assert.throws(()=>context.validateDeal({...deal,...change}));
});
test('Admin moderation controls match backend-supported lifecycle actions',()=>{
 const actions=status=>Array.from(context.actions({...deal,status}));
 assert.deepEqual(actions('draft'),['reject']);assert.deepEqual(actions('pending'),['approve','reject']);assert.deepEqual(actions('rejected'),[]);
 assert.deepEqual(actions('approved'),['reject','pause','feature']);
 assert.deepEqual(Array.from(context.actions({...deal,status:'approved',featured:true})),['reject','pause','unfeature']);
 assert.deepEqual(actions('paused'),['reject']);assert.deepEqual(Array.from(context.actions({...deal,status:'paused',approvedAt:'2026-10-01T00:00:00Z'})),['reject','unpause']);
});
test('Deals page connects expected controls to existing authenticated API contracts',()=>{
 assert.ok(source.includes('Authorization: '+String.fromCharCode(96)+'Bearer '+String.fromCharCode(36)+'{adminToken}'));
 assert.ok(source.includes('/api/admin/deals?'));assert.ok(source.includes('/moderation'));assert.ok(source.includes("method: 'PATCH'"));assert.ok(source.includes('result.hasMore'));assert.ok(source.includes('handleAdminSessionExpiry'));
 for(const id of ['dealsStatus','dealsLimit','dealsRows','dealsRetry','dealsPrevious','dealsNext','dealsPageInfo'])assert.ok(html.includes('id="'+id+'"'));
 assert.ok(html.includes('js/admin/runtime.js'));assert.ok(html.indexOf('js/admin/runtime.js')<html.indexOf('js/admin/deals.js'));
});
test('Deal text is rendered as text rather than injected markup',()=>{
 assert.ok(source.includes('node.textContent = String(text)'));assert.ok(!source.includes('innerHTML'));assert.ok(source.includes("url.protocol !== 'https:'"));
});
