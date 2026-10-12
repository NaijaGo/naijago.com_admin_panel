const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,'../js/admin/carousel-slides.js'),'utf8');
const page = fs.readFileSync(path.join(__dirname,'../carousel-slides.html'),'utf8');
function harness(width = 1198, height = 479) {
  class Image { constructor() { this.naturalWidth=width; this.naturalHeight=height; } set src(value) { queueMicrotask(() => this.onload()); } }
  const context = { Image, URL:{createObjectURL:()=> 'fixture',revokeObjectURL:()=>{}}, Promise, queueMicrotask };
  vm.createContext(context); vm.runInContext(source,context); return context;
}
test('both create forms and existing-card editor expose Deals action', () => {
  assert.equal((page.match(/value="deals"/g)||[]).length,2);
  const h=harness(); assert.match(h.renderActionOptions('deals'),/value="deals" selected/);
  for (const value of ['none','restaurant','pharmacy','category','product','external']) assert.match(h.renderActionOptions(),new RegExp('value="'+value+'"'));
  assert.match(page,/disabling or deleting all Deals slides restores the built-in banner/);
});
test('reference-shaped wide images pass the main upload check', async () => {
  await harness().validateCarouselImageSize({},'main');
  await harness(1300,500).validateCarouselImageSize({},'main');
  await assert.rejects(harness(500,200).validateCarouselImageSize({},'main'),/too small/);
});
test('actual payload builder keeps authenticated upload flow and serializes Deals selection', async () => {
  const h=harness();
  const values={'.carousel-title':{value:'NaijaGo Deals'},'.carousel-image-url':{value:'https://fixture.invalid/banner.png'},
    '.carousel-action-type':{value:'deals'},'.carousel-is-active':{checked:true},'.carousel-sort-order':{value:'2'}};
  const payload=await h.buildCarouselPayload({querySelector:key=>values[key]},'promo');
  assert.equal(payload.actionType,'deals'); assert.equal(payload.placement,'promo'); assert.equal(payload.sortOrder,2);
  assert.equal(payload.isActive,true); assert.match(source,/Authorization: `Bearer \$\{adminToken\}`/);
});
