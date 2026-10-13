const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { labels } = require('../js/admin/product-options');
function fixture() {
  const elements = Object.fromEntries(['catalogColors','catalogSizes','catalogSizeType'].map(id => [id,{value:''}]));
  const context = { window:{}, document:{getElementById:id=>elements[id]} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/admin/product-options.js'),'utf8'),context);
  const data = new Map(); return {elements, api:context.window.NaijaGoProductOptions, data:{append:(k,v)=>data.set(k,v)}, values:data};
}
test('option input validates limits and deduplicates seller labels', () => {
  assert.deepEqual(labels('Black, Blue, black'), ['Black','Blue']);
  assert.throws(()=>labels('x'.repeat(41))); assert.throws(()=>labels(Array(33).fill('a').join(',')));
});
test('admin editing preserves untouched sizes and custom dimensions', () => {
  for(const sizeData of [{type:'custom',customDimensions:[{width:20}]},{type:'clothing',sizes:[{value:'M'}]}]) {
    const h=fixture();h.api.fill({availableColors:['Blue'],sizeData});h.api.append(h.data);
    assert.equal(h.values.get('availableColors'),'["Blue"]'); assert.equal(h.values.has('size_data'),false);
  }
});
test('admin can explicitly replace or clear sizes and colours', () => {
  const h=fixture();h.api.fill({availableColors:['Blue'],sizeData:{type:'clothing',sizes:[{value:'M'}]}});
  h.elements.catalogColors.value='Red, Black';h.elements.catalogSizes.value='L, XL';h.api.append(h.data);
  assert.deepEqual(JSON.parse(h.values.get('size_data')).sizes,['L','XL']);
  h.elements.catalogSizes.value='';h.elements.catalogColors.value='';h.api.append(h.data);
  assert.deepEqual(JSON.parse(h.values.get('size_data')).sizes,[]);assert.equal(h.values.get('availableColors'),'[]');
});
test('new sizes need an explicit type; reset removes previous product options', () => {
  const h=fixture();h.api.fill({availableColors:['Blue']});h.api.fill();
  assert.equal(h.elements.catalogColors.value,'');h.elements.catalogSizes.value='M';assert.throws(()=>h.api.append(h.data),/size type/);
});
test('every admin and login page using shared styles loads the palette after page styles', () => {
  const root=path.join(__dirname,'..');
  for(const file of fs.readdirSync(root).filter(name=>name.endsWith('.html'))) {
    const page=fs.readFileSync(path.join(root,file),'utf8');
    if(page.includes('css/admin-panel.css')||file==='login.html') {
      assert.ok(page.includes('css/brand-colors.css'),file);
      assert.ok(page.indexOf('css/brand-colors.css')>page.lastIndexOf('</style>'),file);
    }
  }
});
