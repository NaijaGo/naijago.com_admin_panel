(() => {
  const tags = document.getElementById('catalogTags');
  if (!tags) return;
  const panel = document.createElement('fieldset');
  panel.className = 'grid grid-cols-1 md:grid-cols-3 gap-4 md:col-span-3';
  const legend = document.createElement('legend');
  legend.textContent = 'Search attributes - identify who and what this product is for';
  legend.className = 'text-light-gray mb-3';
  panel.append(legend);
  function field(id, label, options) {
    const wrapper = document.createElement('label');
    wrapper.className = 'block text-sm text-light-gray';
    wrapper.append(document.createTextNode(label));
    const input = document.createElement(options ? 'select' : 'input');
    input.id = id;
    input.className = 'input-field mt-2 w-full';
    if (options) for (const [value, title] of options) input.add(new Option(title, value));
    wrapper.append(input);
    panel.append(wrapper);
    return input;
  }
  field('catalogGender', 'Audience', [['', 'Infer from category and tags'], ['female', 'Women / female'], ['male', 'Men / male'], ['unisex', 'Unisex'], ['unspecified', 'Not specified']]);
  field('catalogAgeGroup', 'Age group', [['', 'Infer from category and tags'], ['adult', 'Adults'], ['child', 'Children'], ['all', 'All ages']]);
  const type = field('catalogProductType', 'Product type');
  type.maxLength = 60;
  type.placeholder = 'dress, shirt, shoes, phone...';
  type.setAttribute('list', 'catalogProductTypes');
  const choices = document.createElement('datalist');
  choices.id = 'catalogProductTypes';
  panel.append(choices);
  tags.closest('label').after(panel);
  fetch(`${BASE_URL}/api/products/search/attributes`)
    .then((response) => response.ok ? response.json() : null)
    .then((data) => {
      for (const item of data?.productTypes || []) {
        const option = document.createElement('option');
        option.value = item.key;
        option.label = item.label;
        choices.append(option);
      }
    }).catch(() => {}); // Free text stays available when metadata is offline.
})();
