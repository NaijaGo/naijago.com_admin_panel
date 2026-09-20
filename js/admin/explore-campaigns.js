/* Explore extends the existing CarouselSlide catalogue and upload endpoints. */
(() => {
  if (currentPage !== 'carousel-slides' || !adminToken) return;
  const anchor = document.getElementById('carouselSlidesSection');
  if (!anchor) return;
  const el = (tag, text = '', cls = '') => { const node = document.createElement(tag); node.textContent = text; node.className = cls; return node; };
  const panel = el('section', '', 'card p-6 mb-8');
  panel.append(el('h2', 'Explore campaigns', 'text-3xl font-bold text-accent-cyan'),
    el('p', 'Sponsored banners and reviewed videos appear in the pinned Explore strip. Start and expiry times are Nigeria time (WAT). Existing home carousels are unchanged.', 'text-light-gray my-3'));
  const status = el('p', '', 'text-light-gray my-3'); status.setAttribute('role', 'status');
  const form = el('form', '', 'grid gap-4 md:grid-cols-2');
  const fields = {};
  function field(name, label, type = 'text', options) {
    const wrapper = el('label', '', 'block text-sm text-light-gray'); wrapper.append(el('span', label, 'block mb-2 font-semibold'));
    const input = el(options ? 'select' : type === 'textarea' ? 'textarea' : 'input', '', 'input-field w-full');
    if (options) for (const [value, title] of options) { const option = el('option', title); option.value = value; input.append(option); }
    else if (type !== 'textarea') input.type = type;
    input.name = name; fields[name] = input; wrapper.append(input); form.append(wrapper); return input;
  }
  field('title', 'Campaign title').required = true; fields.title.maxLength = 160;
  field('advertiserName', 'Advertiser / business name').required = true; fields.advertiserName.maxLength = 140;
  field('subtitle', 'Caption', 'textarea').maxLength = 600;
  const vendorSearch = field('vendorSearch', 'Find a NaijaGo vendor (optional)'); vendorSearch.maxLength = 120;
  const vendorSelect = field('vendor', 'Linked vendor', 'text', [['', 'NaijaGo / external advertiser']]);
  const searchButton = el('button', 'Search vendors', 'btn btn-primary-alt px-4 py-2'); searchButton.type = 'button'; form.append(searchButton);
  field('startsAt', 'Starts at (WAT)', 'datetime-local').required = true;
  field('endsAt', 'Expires at (WAT)', 'datetime-local').required = true;
  field('actionType', 'Open when tapped', 'text', [['product', 'Product'], ['vendor', 'Vendor store'], ['category', 'Category'], ['external', 'HTTPS website'], ['none', 'Conversation only']]);
  field('actionValue', 'Product ID / category / HTTPS URL (vendor uses the selection above)');
  field('sortOrder', 'Position (lower numbers first)', 'number').value = '0';
  field('mediaKind', 'Media type', 'text', [['image', 'Banner image'], ['video', 'Video (maximum 60 seconds)']]);
  field('imageUrl', 'Banner image / generated video poster URL', 'url');
  field('imageFile', 'Upload banner (JPG/PNG/WebP, maximum 10 MB)', 'file').accept = 'image/jpeg,image/png,image/webp';
  field('videoFile', 'Upload MP4 / MOV / WebM (maximum 50 MB)', 'file').accept = 'video/mp4,video/quicktime,video/webm';
  field('imageRightsConfirmed', 'I checked accuracy, advertiser permission and media rights', 'checkbox').className = 'h-5 w-5';
  field('isActive', 'Enable campaign during its scheduled window', 'checkbox').className = 'h-5 w-5';
  const videoActions = el('div', '', 'flex gap-3 flex-wrap items-center md:col-span-2');
  const upload = el('button', 'Upload / retry video', 'btn btn-primary px-4 py-2'); upload.type = 'button';
  const approve = el('button', 'Approve reviewed video', 'btn btn-success px-4 py-2'); approve.type = 'button'; approve.disabled = true;
  const videoStatus = el('span', 'No campaign video uploaded', 'text-light-gray text-sm');
  const player = el('video', '', 'w-full rounded-xl md:col-span-2'); player.controls = true; player.preload = 'none'; player.hidden = true; player.style.maxHeight = '320px';
  videoActions.append(upload, approve, videoStatus); form.append(videoActions, player);
  const actions = el('div', '', 'flex gap-3 md:col-span-2');
  const save = el('button', 'Save campaign', 'btn btn-success px-5 py-3'); save.type = 'submit';
  const reset = el('button', 'New campaign', 'btn btn-primary-alt px-5 py-3'); reset.type = 'button'; actions.append(save, reset); form.append(actions);
  const list = el('div', '', 'grid gap-4 mt-6 md:grid-cols-2');
  const refresh = el('button', 'Refresh campaigns', 'btn btn-primary px-4 py-2 mt-5');
  const more = el('button', 'More campaigns', 'btn btn-primary-alt px-4 py-2 mt-4'); more.hidden = true;
  panel.append(status, form, refresh, list, more); anchor.before(panel);
  let editing = null, asset = null, ticket = null, uploaded = false, busy = false, cursor = null, epoch = 0;
  const safeUrl = (raw) => { try { const url = new URL(raw); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; } };
  const watInput = (value) => { const date = new Date(value); return Number.isFinite(date.getTime()) ? new Date(date.getTime() + 3600000).toISOString().slice(0, 16) : ''; };
  const watDate = (value) => new Date(`${value}+01:00`).toISOString();
  async function request(path, options = {}, milliseconds = 30000) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), milliseconds);
    try {
      const response = await fetch(`${BASE_URL}/api/${path}`, { ...options, signal: controller.signal,
        headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), Authorization: `Bearer ${adminToken}` } });
      if (handleAdminSessionExpiry(response.status)) throw new Error('Please sign in again.');
      const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Request unavailable. Please retry.'); return data;
    } finally { clearTimeout(timer); }
  }
  function setBusy(value) {
    busy = value;
    for (const control of form.querySelectorAll('input, select, textarea, button')) control.disabled = value;
    approve.disabled = value || !asset || asset.status === 'approved' || asset.revocationState === 'pending';
  }
  function showAsset(value) {
    asset = value; videoStatus.textContent = `${asset.status} - ${Math.ceil(asset.duration || 0)} seconds`;
    const previewUrl = safeUrl(asset.url);
    player.src = previewUrl; player.poster = safeUrl(asset.posterUrl); player.hidden = !previewUrl;
    fields.imageUrl.value = safeUrl(asset.posterUrl); approve.disabled = busy || asset.status === 'approved' || asset.revocationState === 'pending';
  }
  function clear() {
    form.reset(); editing = null; asset = null; ticket = null; uploaded = false; player.pause(); player.removeAttribute('src'); player.hidden = true;
    fields.startsAt.value = watInput(new Date()); fields.endsAt.value = watInput(new Date(Date.now() + 7 * 86400000));
    fields.sortOrder.value = '0'; fields.isActive.checked = false; videoStatus.textContent = 'No campaign video uploaded'; approve.disabled = true; save.textContent = 'Save campaign';
  }
  async function vendors() {
    searchButton.disabled = true;
    try {
      const data = await request(`admin/carousel-vendors?search=${encodeURIComponent(vendorSearch.value.trim())}`);
      const selected = vendorSelect.value; const selectedLabel = vendorSelect.selectedOptions[0]?.textContent;
      vendorSelect.replaceChildren(); const empty = el('option', 'NaijaGo / external advertiser'); empty.value = ''; vendorSelect.append(empty);
      for (const vendor of data.vendors || []) { const option = el('option', vendor.businessName || 'Vendor'); option.value = vendor._id; vendorSelect.append(option); }
      if (selected && ![...vendorSelect.options].some((option) => option.value === selected)) { const option = el('option', selectedLabel); option.value = selected; vendorSelect.append(option); }
      vendorSelect.value = selected; status.textContent = data.refineSearch ? 'More than 50 vendors match. Narrow the search to find yours.' : '';
    } catch (error) { status.textContent = error.message; } finally { searchButton.disabled = false; }
  }
  async function videoUpload() {
    if (busy) return;
    const file = fields.videoFile.files[0];
    if (!file) { status.textContent = 'Choose a video first.'; return; }
    setBusy(true); status.textContent = 'Checking video configuration...';
    try {
      const config = await request('product-media/config');
      if (!config.enabled) throw new Error('Enable and configure product video uploads on the backend first.');
      if (!config.mimeTypes.includes(file.type) || file.size > config.maxBytes) throw new Error('Choose an MP4, MOV or WebM no larger than 50 MB.');
      if (!ticket) {
        if (!fields.imageRightsConfirmed.checked) throw new Error('Confirm accuracy and media rights before uploading.');
        ticket = await request('product-media/uploads', { method: 'POST', body: JSON.stringify({ purpose: 'campaign_video', mimeType: file.type, bytes: file.size, policyVersion: config.policyVersion }) });
      }
      if (uploaded) { showAsset(await request(`product-media/assets/${ticket.assetId}/complete`, { method: 'POST' })); return; }
      // A previous upload may have completed despite a lost browser response.
      try { const existing = await request(`product-media/assets/${ticket.assetId}/complete`, { method: 'POST' }); if (existing.status !== 'pending_upload') { showAsset(existing); uploaded = true; return; } } catch (_) { /* Complete verification is retried after upload. */ }
      const endpoint = new URL(ticket.uploadUrl);
      if (endpoint.protocol !== 'https:' || endpoint.hostname !== 'api.cloudinary.com') throw new Error('Invalid video upload destination.');
      const body = new FormData(); for (const [name, value] of Object.entries(ticket.fields)) body.append(name, value); body.append('file', file);
      status.textContent = 'Uploading video. Keep this page open; slow connections can take several minutes.';
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 300000);
      try { const result = await fetch(endpoint.href, { method: 'POST', body, signal: controller.signal }); if (!result.ok) throw new Error('Upload interrupted. Retry to check or resume verification.'); }
      finally { clearTimeout(timer); }
      uploaded = true; showAsset(await request(`product-media/assets/${ticket.assetId}/complete`, { method: 'POST' }));
      status.textContent = 'Watch the complete video and verify its claims before approving it.';
    } catch (error) { status.textContent = error.message || 'Upload failed. Retry when connected.'; }
    finally { setBusy(false); }
  }
  fields.videoFile.addEventListener('change', () => { if (busy) return; ticket = null; uploaded = false; asset = null; player.pause(); player.hidden = true; approve.disabled = true; });
  upload.onclick = videoUpload;
  approve.onclick = async () => {
    if (!asset || busy || !confirm('Have you watched the entire video and verified product accuracy, media rights and appropriate content?')) return;
    setBusy(true);
    try { showAsset(await request(`product-media/assets/${asset.id}/review`, { method: 'PUT', body: JSON.stringify({ status: 'approved', revision: asset.revision, reason: 'Campaign video reviewed by administrator.' }) })); }
    catch (error) { status.textContent = error.message; } finally { setBusy(false); }
  };
  form.onsubmit = async (event) => {
    event.preventDefault(); if (busy) return; setBusy(true);
    try {
      if (!fields.imageRightsConfirmed.checked) throw new Error('Confirm advertiser permission, accuracy and image rights.');
      const startsAt = watDate(fields.startsAt.value), endsAt = watDate(fields.endsAt.value);
      if (endsAt <= startsAt) throw new Error('Expiry must be after the start time.');
      let imageUrl = safeUrl(fields.imageUrl.value);
      if (fields.mediaKind.value === 'image' && fields.imageFile.files[0]) {
        const file = fields.imageFile.files[0]; if (file.size > 10 * 1024 * 1024) throw new Error('Banner must be smaller than 10 MB.');
        const body = new FormData(); body.append('image', file); body.append('placement', 'explore');
        status.textContent = 'Uploading banner...'; imageUrl = (await request('uploads/cloudinary/carousel', { method: 'POST', body }, 120000)).url;
        fields.imageUrl.value = imageUrl; fields.imageFile.value = '';
      }
      if (fields.mediaKind.value === 'video' && asset?.status !== 'approved') throw new Error('Upload, watch and approve the video before saving.');
      if (!imageUrl) throw new Error('Upload a banner or approved video first.');
      const body = { placement: 'explore', title: fields.title.value.trim(), subtitle: fields.subtitle.value.trim(), advertiserName: fields.advertiserName.value.trim(),
        vendor: fields.vendor.value || null, startsAt, endsAt, imageRightsConfirmed: true, imageUrl, mediaKind: fields.mediaKind.value,
        videoAssetId: fields.mediaKind.value === 'video' ? asset.id : null, actionType: fields.actionType.value,
        actionValue: fields.actionType.value === 'vendor' ? fields.vendor.value : fields.actionValue.value.trim(), sortOrder: Number(fields.sortOrder.value), isActive: fields.isActive.checked };
      await request(`admin/carousel-slides${editing ? `/${editing}` : ''}`, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) });
      clear(); status.textContent = 'Campaign saved. Enabled campaigns appear only inside their scheduled window.'; await load();
    } catch (error) { status.textContent = error.message; } finally { setBusy(false); }
  };
  async function edit(campaign) {
    if (busy) return; clear(); editing = campaign.id || campaign._id;
    for (const name of ['title', 'subtitle', 'advertiserName', 'actionType', 'actionValue', 'imageUrl', 'mediaKind', 'sortOrder']) fields[name].value = campaign[name] ?? '';
    if (campaign.vendor && ![...vendorSelect.options].some((option) => option.value === campaign.vendor)) { const option = el('option', `Linked vendor (${campaign.vendor})`); option.value = campaign.vendor; vendorSelect.append(option); }
    fields.vendor.value = campaign.vendor || ''; fields.startsAt.value = watInput(campaign.startsAt); fields.endsAt.value = watInput(campaign.endsAt);
    fields.isActive.checked = campaign.isActive; fields.imageRightsConfirmed.checked = campaign.imageRightsConfirmed;
    save.textContent = 'Update campaign'; form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (campaign.videoAssetId) { setBusy(true); try { showAsset(await request(`product-media/assets/${campaign.videoAssetId}`)); } catch (error) { status.textContent = error.message; } finally { setBusy(false); } }
  }
  async function load(append = false) {
    const version = ++epoch; refresh.disabled = true; more.disabled = true;
    try {
      const data = await request(`admin/carousel-campaigns${append && cursor ? `?before=${cursor}` : ''}`);
      if (version !== epoch) return; if (!append) list.replaceChildren();
      for (const campaign of data.campaigns || []) {
        const card = el('article', '', 'rounded-xl border border-slate-600 p-4'); const image = el('img', '', 'w-full h-40 object-cover rounded-lg'); image.src = safeUrl(campaign.imageUrl); image.alt = campaign.title; image.loading = 'lazy';
        card.append(image, el('h3', campaign.title, 'text-xl font-semibold mt-3'), el('p', `${campaign.advertiserName} - ${campaign.mediaKind}`, 'text-light-gray'),
          el('p', `${campaign.isActive ? 'Enabled' : 'Disabled'} | Ends ${new Date(campaign.endsAt).toLocaleString('en-GB', { timeZone: 'Africa/Lagos' })} WAT`, 'text-sm text-light-gray my-2'));
        const metrics = campaign.engagement;
        if (metrics) {
          const reactions = Object.values(metrics.reactions || {}).reduce((sum, count) => sum + (Number(count) || 0), 0);
          card.append(el('p', `${metrics.views || 0} qualified views | ${reactions} reactions | ${metrics.comments || 0} visible comments`, 'text-sm text-light-gray my-2'));
        }
        const button = el('button', 'Edit / disable', 'btn btn-primary-alt px-3 py-2'); button.onclick = () => edit(campaign); card.append(button); list.append(card);
      }
      cursor = data.nextCursor; more.hidden = !cursor; if (!list.children.length) list.append(el('p', 'No Explore campaigns saved yet.', 'text-light-gray'));
    } catch (error) { status.textContent = error.message; } finally { refresh.disabled = false; more.disabled = false; }
  }
  reset.onclick = () => { if (!busy) clear(); }; refresh.onclick = () => load(); more.onclick = () => load(true); searchButton.onclick = vendors;
  document.addEventListener('visibilitychange', () => { if (document.hidden) player.pause(); });
  clear(); load(); vendors();
})();
