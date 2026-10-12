const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { merge } = require('../js/admin/product-image-analysis');
const hierarchy = JSON.parse(fs.readFileSync(path.join(__dirname, '../js/admin/catalog-taxonomy.fallback.json')));
const parent = hierarchy.categories.find(row => row.label === 'Photography');
const child = parent.children.find(row => row.label === 'Content Creator Equipment');
const result = { suggestions: { name: 'Ring light', description: 'A black light.', brand: '', searchTags: ['light'], specifications: { colour: 'black' }, price: 99, stock: 999 },
  classification: { categoryId: parent.id, subcategoryId: child.id, category: parent.label, subcategory: child.label },
  needsManualCategory: false, taxonomyChecksum: hierarchy.checksum, warnings: [], reviewRequired: true, possibleDuplicates: [] };
const blank = { name: '', description: '', brand: '', tags: '', specifications: '', category: '', subcategory: '', price: '200', stock: '5' };
test('autofill uses a validated hierarchy and never merges commercial fields', () => {
  const fields = merge(blank, blank, result, hierarchy);
  assert.equal(fields.category, 'Photography'); assert.equal(fields.subcategory, 'Content Creator Equipment');
  assert.equal(fields.name, 'Ring light'); assert.equal(fields.price, undefined); assert.equal(fields.stock, undefined);
});
test('manual edits in flight, including either category field, are preserved', () => {
  const current = { ...blank, name: 'Manual name', category: 'Fashion' };
  const fields = merge(current, blank, result, hierarchy);
  assert.equal(fields.name, undefined); assert.equal(fields.category, undefined); assert.equal(fields.subcategory, undefined);
  assert.equal(fields.description, 'A black light.');
});
test('editing existing listings requires explicit use of suggestions', () => {
  assert.deepEqual(merge(blank, blank, result, hierarchy, true), {});
});
test('unknown, mismatched, stale or uncertain classifications never change categories', () => {
  for (const r of [{ ...result, needsManualCategory: true }, { ...result, taxonomyChecksum: 'stale' },
    { ...result, classification: { ...result.classification, categoryId: 'invalid' } },
    { ...result, classification: { ...result.classification, subcategory: 'Medicine' } }]) {
    assert.equal(merge(blank, blank, r, hierarchy).category, undefined);
  }
});

function fixture(handler = async () => ({ ok: true, json: async () => structuredClone(result) })) {
  const elements = new Map(), calls = [], messages = [];
  function element(id) {
    if (!elements.has(id)) elements.set(id, { value: '', checked: id === 'catalogAnalyzePhoto', files: [], options: [], textContent: '',
      listeners: {}, addEventListener(name, action) { this.listeners[name] = action; },
      classList: { add() {}, remove() {}, toggle() {} }, appendChild(option) { this.options.push(option); }, reset() {} });
    return elements.get(id);
  }
  const context = vm.createContext({ BASE_URL: 'http://fixture.invalid', adminToken: 'fixture-token', currentPage: 'fixture',
    AbortController, FormData, setTimeout, clearTimeout, TextEncoder, crypto: require('node:crypto').webcrypto,
    document: { getElementById: element, createElement: () => ({}) }, window: { scrollTo() {} },
    escapeHtml: value => value, displayMessage: (...args) => messages.push(args),
    fetch: async (url, options) => { calls.push({ url, options }); return handler(url, options); } });
  for (const file of ['catalog-taxonomy.js', 'product-image-analysis.js', 'product-moderation.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/admin', file), 'utf8'), context);
  }
  context.data = hierarchy; vm.runInContext('applyCatalogHierarchy(data, false)', context);
  element('catalogMainImage').files = [new Blob(['fixture'], { type: 'image/jpeg' })];
  element('catalogPrice').value = '200'; element('catalogStock').value = '5'; element('catalogSource').value = 'admin';
  return { elements, element, calls, messages, run: expression => vm.runInContext(expression, context) };
}
test('actual admin change handler autofills and blocks save until reviewed', async () => {
  const f = fixture(); await f.element('catalogMainImage').listeners.change();
  assert.equal(f.element('catalogName').value, 'Ring light'); assert.equal(f.element('catalogCategory').value, 'Photography');
  assert.equal(f.element('catalogPrice').value, '200'); assert.equal(f.element('catalogStock').value, '5');
  assert.equal(f.element('catalogSource').value, 'ai_assisted');
  assert.equal(f.element('catalogAnalysisReviewed').checked, false);
  await f.run('saveCatalogProduct({preventDefault(){}})'); assert.equal(f.calls.length, 1);
  assert.match(f.messages[0][0], /review/);
  f.element('catalogAnalysisReviewed').checked = true;
  const form = f.run('buildProductFormData()'); assert.equal(form.get('price'), '200'); assert.equal(form.get('stockQuantity'), '5');
  assert.equal(form.has('categoryId'), false); // hierarchy reference writes remain disabled
  assert.equal(JSON.parse(form.get('specifications')).colour, 'black');
  f.element('catalogDescription').listeners.input(); assert.equal(f.element('catalogAnalysisReviewed').checked, false);
});
test('existing-product photo analysis only previews until use is explicitly selected', async () => {
  const f = fixture(); f.element('catalogProductId').value = 'existing'; f.element('catalogName').value = 'Original name';
  await f.element('catalogMainImage').listeners.change(); assert.equal(f.element('catalogName').value, 'Original name');
  f.element('catalogUseImageSuggestions').listeners.click(); assert.equal(f.element('catalogName').value, 'Ring light');
});
test('a manual edit during analysis survives the late response', async () => {
  let resolve; const f = fixture(() => new Promise(done => { resolve = done; }));
  const pending = f.element('catalogMainImage').listeners.change(); f.element('catalogName').value = 'Manual';
  resolve({ ok: true, json: async () => result }); await pending; assert.equal(f.element('catalogName').value, 'Manual');
});
test('changing images or resetting the form discards old responses', async () => {
  const resolvers = []; const f = fixture(() => new Promise(resolve => resolvers.push(resolve)));
  const first = f.element('catalogMainImage').listeners.change();
  const second = f.element('catalogMainImage').listeners.change();
  resolvers[1]({ ok: true, json: async () => ({ ...result, suggestions: { ...result.suggestions, name: 'Newest' } }) });
  await second; resolvers[0]({ ok: true, json: async () => result }); await first;
  assert.equal(f.element('catalogName').value, 'Newest');
  const pending = f.element('catalogMainImage').listeners.change(); f.run('resetPhotoAnalysis()');
  resolvers[2]({ ok: true, json: async () => result }); await pending; assert.equal(f.element('catalogName').value, 'Newest');
});
test('older servers and provider failures retain the manual upload workflow', async () => {
  const f = fixture(async () => ({ ok: false, json: async () => ({ message: 'Unavailable' }) }));
  await f.element('catalogMainImage').listeners.change(); assert.equal(f.element('catalogName').value, '');
  assert.equal(f.element('catalogSource').value, 'admin'); assert.equal(f.run('photoAnalysisApplied'), false);
  assert.equal(f.run('photoAnalysisBusy'), false); assert.equal(f.element('catalogAnalysisStatus').textContent, 'Unavailable');
});
