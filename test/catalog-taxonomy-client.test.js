const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../js/admin/catalog-taxonomy.fallback.json'), 'utf8'));
const source = fs.readFileSync(path.join(__dirname, '../js/admin/catalog-taxonomy.js'), 'utf8');
function client(handler) {
  const writes = [], calls = [];
  const context = vm.createContext({ BASE_URL: 'http://fixture.invalid', AbortController, setTimeout, clearTimeout,
    crypto: require('node:crypto').webcrypto, TextEncoder,
    localStorage: { getItem: () => null, setItem: (key, value) => writes.push(JSON.parse(value)) },
    fetch: async (url) => { calls.push(url); return handler(url); }, data,
  });
  vm.runInContext(source, context);
  return { context, writes, calls, run: expression => vm.runInContext(expression, context) };
}
const response = (body, status = 200) => ({ ok: status === 200, json: async () => structuredClone(body) });
test('API and generated fallback preserve all categories, order and relationships', async () => {
  const c = client(url => response({ ...data, referencesReady: url.startsWith('http') }));
  await c.run('loadCatalogTaxonomy()');
  assert.equal(c.run('Object.keys(NAIJAGO_CATALOG_TAXONOMY).length'), 23);
  assert.equal(c.run('Object.values(NAIJAGO_CATALOG_TAXONOMY).flat().length'), 186);
  assert.equal(c.run('NAIJAGO_CATALOG_HIERARCHY.referencesReady'), true);
  assert.deepEqual(c.calls, ['js/admin/catalog-taxonomy.fallback.json', 'http://fixture.invalid/api/categories']);
  assert.equal(c.writes[0].referencesReady, false);
});
test('older servers and corrupt responses keep fallback labels and disable reference writes', async () => {
  for (const bad of [response({}, 404), response({ ...data, categories: [] }), response({ ...data, checksum: 'f'.repeat(64) })]) {
    const c = client(url => url.startsWith('http') ? bad : response(data));
    await c.run('loadCatalogTaxonomy()');
    assert.equal(c.run('NAIJAGO_CATALOG_HIERARCHY.referencesReady'), false);
    assert.equal(c.run('NAIJAGO_CATALOG_TAXONOMY.Photography.length'), 6);
    assert.equal(c.run('Object.keys(catalogCategoryReferences("Fashion", "Footwear")).length'), 0);
  }
});
test('stable references honor scoped aliases and reject unknown or conflicting paths', () => {
  const c = client(() => response(data)); c.run('applyCatalogHierarchy(data, true)');
  const medicine = data.categories.find(entry => entry.label === 'Cosmetics & Beauty');
  assert.equal(c.run('catalogCategoryReferences("Health & Beauty", "Medicine").categoryId'), medicine.id);
  assert.equal(c.run('catalogCategoryReferences("Health & Beauty > Medicine").subcategoryId'), medicine.children.find(entry => entry.label === 'Medicine').id);
  assert.equal(c.run('catalogCategoryReferences("Fashion > Men", "Men\'s Fashion").subcategoryId'), c.run('catalogCategoryReferences("Fashion", "Men").subcategoryId'));
  for (const expr of ['catalogCategoryReferences("Fashion", "Unknown")', 'catalogCategoryReferences("Fashion > Footwear", "Watches")', 'catalogCategoryReferences("Photography > Camera > Lens")']) {
    assert.equal(c.run(`Object.keys(${expr}).length`), 0);
  }
});
test('legacy form options stay selectable, and unrelated edits retain the original category representation', () => {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, { value: '', checked: false, files: [], options: [], addEventListener() {},
      classList: { toggle() {}, add() {}, remove() {} }, appendChild(option) { this.options.push(option); } });
    return elements.get(id);
  }
  const c = client(() => response(data));
  Object.assign(c.context, { document: { getElementById: element, createElement: () => ({}) }, currentPage: 'fixture',
    escapeHtml: value => value, FormData, window: { scrollTo() {} } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/admin/product-moderation.js'), 'utf8'), c.context);
  c.run('catalogProducts = [{_id:"fixture", category:"Health & Beauty > Medicine", subcategory:"", name:"legacy", imageUrls:[]}]; editCatalogProduct("fixture")');
  c.run('applyCatalogHierarchy(data, true)');
  assert.equal(element('catalogCategory').value, 'Health & Beauty');
  assert.equal(element('catalogSubcategory').value, 'Medicine');
  const form = c.run('buildProductFormData()');
  assert.equal(form.get('category'), 'Health & Beauty > Medicine');
  assert.equal(form.get('subcategory'), '');
  assert.equal(form.has('categoryId'), false);
  assert.equal(form.has('subcategoryId'), false);
  c.run('preserveCatalogOption(catalogField("catalogCategory"), "Legacy Parent"); populateSubcategorySelect("catalogCategory", "catalogSubcategory", "Legacy Child")');
  assert.equal(element('catalogSubcategory').value, 'Legacy Child');
});
test('corrupt payload cannot enable reference writes when fallback is unavailable', async () => {
  const bad = structuredClone(data);
  bad.categories[0].label = 'Unexpected renamed category';
  const c = client(url => url.startsWith('http') ? response({ ...bad, referencesReady: true }) : response({}, 404));
  await c.run('loadCatalogTaxonomy()');
  assert.equal(c.run('NAIJAGO_CATALOG_HIERARCHY'), null);
  assert.equal(c.writes.length, 0);
});
