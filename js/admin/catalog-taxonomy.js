// Generated fallback data comes from the backend manifest. Cached data never enables reference writes.
let NAIJAGO_CATALOG_TAXONOMY = Object.freeze({});
let NAIJAGO_CATALOG_HIERARCHY = null;
function validateCatalogHierarchy(data) {
  if (data?.version !== 1 || !Array.isArray(data.categories) || data.categories.length !== 23 ||
      !/^[a-f0-9]{64}$/.test(data.checksum || '')) throw new Error('Invalid category hierarchy.');
  const ids = new Set(), keys = new Set(), labels = new Set(); let children = 0;
  function node(value, index, parentId) {
    if (!/^[a-f0-9]{24}$/.test(value?.id || '') || ids.has(value.id) || !value.key || keys.has(value.key) ||
        typeof value.label !== 'string' || !value.label.trim() || value.sortOrder !== index ||
        (parentId && value.parentId !== parentId)) throw new Error('Invalid category identity.');
    ids.add(value.id); keys.add(value.key);
  }
  data.categories.forEach((parent, index) => {
    node(parent, index);
    if (labels.has(parent.label) || !Array.isArray(parent.children)) throw new Error('Invalid category labels.');
    labels.add(parent.label); const childLabels = new Set();
    parent.children.forEach((child, childIndex) => {
      node(child, childIndex, parent.id);
      if (childLabels.has(child.label)) throw new Error('Duplicate subcategory.');
      childLabels.add(child.label); children++;
    });
  });
  if (children !== 186 || !Array.isArray(data.parentAliases) || !data.childAliases) throw new Error('Incomplete category hierarchy.');
  return data;
}
function applyCatalogHierarchy(data, referencesReady = false) {
  validateCatalogHierarchy(data);
  NAIJAGO_CATALOG_HIERARCHY = { ...data, referencesReady: referencesReady === true };
  NAIJAGO_CATALOG_TAXONOMY = Object.freeze(Object.fromEntries(data.categories.map(parent =>
    [parent.label, Object.freeze(parent.children.map(child => child.label))])));
  return NAIJAGO_CATALOG_HIERARCHY;
}
async function verifyCatalogHierarchy(data) {
  validateCatalogHierarchy(data);
  const manifest = { version: data.version, parentAliases: data.parentAliases,
    childAliases: data.childAliases, categories: data.categories };
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(manifest)));
  const checksum = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
  if (checksum !== data.checksum) throw new Error('Category checksum mismatch.');
  return data;
}
async function loadCatalogTaxonomy(onReady = () => {}) {
  const cacheKey = 'naijago.catalog-taxonomy.v1'; let fallback;
  try {
    const response = await fetch('js/admin/catalog-taxonomy.fallback.json');
    if (!response.ok) throw new Error('Category fallback unavailable.');
    fallback = await verifyCatalogHierarchy(await response.json()); applyCatalogHierarchy(fallback); onReady();
  } catch (_) {
    try { fallback = await verifyCatalogHierarchy(JSON.parse(localStorage.getItem(cacheKey)));
      applyCatalogHierarchy(fallback); onReady();
    } catch (_) { /* The backend can still supply the hierarchy. */ }
  }
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(BASE_URL + '/api/categories', { signal: controller.signal });
    if (!response.ok) throw new Error('Category service unavailable.');
    const data = await verifyCatalogHierarchy(await response.json());
    if (fallback && JSON.stringify({ ...data, referencesReady: false }) !==
        JSON.stringify({ ...fallback, referencesReady: false })) throw new Error('Category identities differ from this client version.');
    applyCatalogHierarchy(data, data.referencesReady); onReady();
    try { localStorage.setItem(cacheKey, JSON.stringify({ ...data, referencesReady: false })); } catch (_) {}
  } catch (_) { /* Keep label-based forms available using the fallback. */ }
  finally { clearTimeout(timer); }
  return NAIJAGO_CATALOG_HIERARCHY;
}
function catalogCategoryReferences(category, subcategory = '') {
  const hierarchy = NAIJAGO_CATALOG_HIERARCHY;
  if (!hierarchy?.referencesReady) return {};
  const normalize = value => String(value || '').trim().toLowerCase();
  const parts = String(category || '').split('>').map(value => value.trim());
  if (parts.length > 2) return {};
  const parent = hierarchy.categories.find(entry => normalize(entry.label) === normalize(parts[0]) ||
    hierarchy.parentAliases.some(group => normalize(group[0]) === normalize(entry.label) && group.some(label => normalize(label) === normalize(parts[0]))));
  if (!parent) return {};
  const childLabel = subcategory || parts[1] || '';
  const child = parent.children.find(entry => normalize(entry.label) === normalize(childLabel) ||
    (hierarchy.childAliases[normalize(parent.label)] || []).some(group => normalize(group[0]) === normalize(entry.label) && group.some(label => normalize(label) === normalize(childLabel))));
  if (childLabel && !child) return {};
  if (parts[1] && subcategory && catalogCategoryReferences(parts[0], parts[1]).subcategoryId !== child?.id) return {};
  return { categoryId: parent.id, ...(child ? { subcategoryId: child.id } : {}) };
}
