const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function taxonomy() {
  const source = fs.readFileSync(path.join(__dirname, '../js/admin/catalog-taxonomy.js'), 'utf8');
  const context = vm.createContext({});
  return vm.runInContext(source + '\nNAIJAGO_CATALOG_TAXONOMY;', context);
}

test('admin offers creator equipment under Photography exactly once', () => {
  const categories = taxonomy();
  assert.equal(categories.Photography.filter(item => item === 'Content Creator Equipment').length, 1);
  assert.equal(Object.entries(categories).filter(([, children]) => children.includes('Content Creator Equipment')).length, 1);
});

test('existing Photography categories retain their labels and order', () => {
  assert.deepEqual(Array.from(taxonomy().Photography), [
    'Cameras', 'Lenses', 'Lighting Equipment', 'Camera Bags & Cases',
    'Tripods & Supports', 'Content Creator Equipment',
  ]);
});
