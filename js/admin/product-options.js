(function (root) {
  'use strict';
  function labels(value) {
    const entries = String(value || '').split(',').map(label => label.trim()).filter(Boolean);
    if (entries.length > 32 || entries.some(label => label.length > 40 || /[\u0000-\u001f]/.test(label))) throw new Error('Use up to 32 options, with names up to 40 characters.');
    const seen = new Set();
    return entries.filter(label => { const key = label.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; });
  }
  const controls = () => ({ colors: document.getElementById('catalogColors'), sizes: document.getElementById('catalogSizes'), type: document.getElementById('catalogSizeType') });
  let originalSizes = '', originalType = '';
  function fill(product = {}) {
    const { colors, sizes, type } = controls();
    if (!colors || !sizes || !type) return;
    colors.value = (product.availableColors || []).join(', ');
    const data = product.sizeData;
    sizes.value = (data?.sizes || []).map(size => size.value ?? size).join(', ');
    type.value = ['clothing','shoes','watches','baby','pet'].includes(data?.type) ? data.type : '';
    originalSizes = sizes.value;
    originalType = type.value;
  }
  function append(data) {
    const { colors, sizes, type } = controls();
    if (!colors || !sizes || !type) return;
    data.append('availableColors', JSON.stringify(labels(colors.value)));
    // Preserve saved custom dimensions and untouched legacy sizes.
    if (sizes.value !== originalSizes || type.value !== originalType) {
      const values = labels(sizes.value);
      if (values.length && !type.value) throw new Error('Choose the size type for your available sizes.');
      data.append('size_data', JSON.stringify({ type: values.length ? type.value : null, sizes: values, multiple: values.length > 1 }));
    }
  }
  root.NaijaGoProductOptions = { labels, fill, append };
  if (typeof module !== 'undefined') module.exports = root.NaijaGoProductOptions;
})(typeof window !== 'undefined' ? window : globalThis);
