(function (root) {
  // Only visual suggestions; price, stock, publication and vendor never merge.
  function merge(current, snapshot, result, hierarchy, editing = false) {
    if (editing) return {};
    const s = result.suggestions || {};
    const candidate = { name: s.name || '', description: s.description || '', brand: s.brand || '',
      tags: (s.searchTags || []).join(', '), specifications: JSON.stringify(s.specifications || {}, null, 2) };
    const match = result.classification;
    const parent = hierarchy?.categories?.find(node => node.id === match?.categoryId);
    const child = parent?.children?.find(node => node.id === match?.subcategoryId);
    if (!result.needsManualCategory && result.taxonomyChecksum === hierarchy?.checksum && parent && child &&
        parent.label === match.category && child.label === match.subcategory &&
        current.category === snapshot.category && current.subcategory === snapshot.subcategory) {
      candidate.category = parent.label; candidate.subcategory = child.label;
    }
    return Object.fromEntries(Object.keys(candidate).filter(key => candidate[key] && current[key] === snapshot[key])
      .map(key => [key, candidate[key]]));
  }
  root.NaijaGoImageSuggestions = { merge };
  if (typeof module !== 'undefined' && module.exports) module.exports = { merge };
})(typeof window === 'undefined' ? globalThis : window);
