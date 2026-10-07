(() => {
  if (currentPage !== 'explore-videos' || !adminToken) return;
  const field = id => document.getElementById(id);
  const form = field('explorePublishForm');
  const files = field('exploreVideoFile');
  const preview = field('exploreLocalPreview');
  const uploadStatus = field('exploreUploadStatus');
  const listStatus = field('exploreListStatus');
  const list = field('exploreVideoList');
  const more = field('exploreMoreBtn');
  let objectUrl = null, publishing = false, loading = false, changing = false, page = 0;
  let listVersion = 0;
  const element = (tag, value, className = '') => {
    const node = document.createElement(tag); node.textContent = String(value || ''); node.className = className; return node;
  };
  function mediaUrl(value) {
    try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' ? url.href : null; }
    catch (_) { return null; }
  }
  function resetPreview() {
    preview.pause(); preview.removeAttribute('src'); preview.load(); preview.classList.add('hidden');
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
  }
  files.addEventListener('change', () => {
    resetPreview();
    const file = files.files[0];
    if (!file) return;
    if (file.size > 90 * 1024 * 1024) { files.value = ''; uploadStatus.textContent = 'Compress this video to 90 MB or less before uploading.'; return; }
    objectUrl = URL.createObjectURL(file); preview.src = objectUrl; preview.classList.remove('hidden');
    uploadStatus.textContent = 'Preview the video, add a caption and publish.';
  });
  preview.addEventListener('error', () => {
    if (objectUrl) uploadStatus.textContent = 'Your browser cannot preview this format. You can still upload it for video processing.';
  });
  window.addEventListener('beforeunload', () => { if (objectUrl) URL.revokeObjectURL(objectUrl); });
  function responseData(status, text) {
    if (handleAdminSessionExpiry(status)) throw new Error('Please sign in again.');
    let data;
    try { data = JSON.parse(text); } catch (_) { throw new Error('The server response could not be confirmed. Refresh My Videos before retrying.'); }
    if (status < 200 || status >= 300) throw new Error(status < 500 ? data.message || 'Unable to update this video.' : 'Explore is temporarily unavailable. Refresh My Videos before retrying.');
    return data;
  }
  async function request(path, method = 'GET') {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${BASE_URL}/api/explore/${path}`, { method, headers: { Authorization: `Bearer ${adminToken}` }, signal: controller.signal });
      return responseData(response.status, await response.text());
    } finally { clearTimeout(timer); }
  }
  async function loadProducts() {
    const status = field('exploreProductStatus');
    try {
      const response = await fetch(`${BASE_URL}/api/products?limit=100`, { headers: { Authorization: `Bearer ${adminToken}` } });
      const data = responseData(response.status, await response.text());
      const products = Array.isArray(data) ? data : data.products || [];
      for (const product of products) {
        if (!product.isActive || product.productStatus !== 'active' || product.moderationStatus !== 'approved') continue;
        field('exploreProductId').add(new Option(product.name || 'Product', product._id));
      }
      status.textContent = 'Choose a published product, or post without a product link.';
    } catch (_) { status.textContent = 'Products could not be loaded. You can still publish without linking a product.'; }
  }
  function upload(body) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE_URL}/api/explore/videos`);
      xhr.setRequestHeader('Authorization', `Bearer ${adminToken}`);
      xhr.timeout = 240000;
      xhr.upload.onprogress = event => {
        if (!event.lengthComputable) return;
        const percent = Math.round(event.loaded / event.total * 100);
        field('exploreUploadProgress').value = percent;
        uploadStatus.textContent = percent === 100 ? 'Video uploaded. Processing and publishing…' : `Uploading… ${percent}%`;
      };
      xhr.onload = () => { try { resolve(responseData(xhr.status, xhr.responseText)); } catch (error) { reject(error); } };
      xhr.onerror = xhr.ontimeout = () => reject(new Error('Upload could not be confirmed. Refresh My Videos before retrying.'));
      xhr.send(body);
    });
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (publishing || !form.reportValidity()) return;
    const file = files.files[0], caption = field('exploreCaption').value.trim();
    if (!file || !caption || file.size > 90 * 1024 * 1024) { uploadStatus.textContent = 'Choose a video of at most 90 MB and enter a caption.'; return; }
    const body = new FormData(); body.append('video', file); body.append('caption', caption);
    if (field('exploreProductId').value) body.append('productId', field('exploreProductId').value);
    publishing = true;
    for (const input of form.elements) input.disabled = true;
    field('exploreUploadProgress').value = 0; field('exploreUploadProgress').classList.remove('hidden');
    uploadStatus.textContent = 'Uploading video…';
    try {
      const result = await upload(body);
      if (!result.video?.id) throw new Error('Refresh My Videos to confirm this upload.');
      form.reset(); resetPreview();
      uploadStatus.textContent = 'Published successfully. This video is now in the customer Explore feed.';
      await loadVideos(true);
    } catch (error) { uploadStatus.textContent = error.message || 'Upload failed. Refresh My Videos before retrying.'; }
    finally { publishing = false; for (const input of form.elements) input.disabled = false; field('exploreUploadProgress').classList.add('hidden'); }
  });
  async function control(video, remove, button) {
    if (changing) return;
    if (!confirm(remove ? 'Delete this Explore video?' : 'Unpublish this video from the customer Explore feed?')) return;
    const id = video.id || video._id;
    if (!/^[a-f\d]{24}$/i.test(id)) return;
    changing = true; button.disabled = true;
    try { await request(remove ? encodeURIComponent(id) : `videos/${encodeURIComponent(id)}/unpublish`, remove ? 'DELETE' : 'PATCH'); await loadVideos(true); }
    catch (error) { listStatus.textContent = error.message || 'Unable to update this video.'; }
    finally { changing = false; button.disabled = false; }
  }
  function render(video) {
    const card = element('article', '', 'border border-slate-600 rounded-xl p-5');
    const url = mediaUrl(video.videoUrl);
    if (url) {
      const player = document.createElement('video'); player.src = url; player.controls = true; player.preload = 'none'; player.className = 'rounded-lg w-full max-h-80 bg-black';
      const poster = mediaUrl(video.thumbnailUrl); if (poster) player.poster = poster;
      card.append(player);
    }
    card.append(element('p', video.caption, 'text-light-slate mt-3 whitespace-pre-wrap'));
    card.append(element('p', `${video.status || 'published'} · ${video.likesCount || 0} likes · ${video.commentsCount || 0} comments`, 'text-light-gray mt-2'));
    if (video.product?.name) card.append(element('p', `Product: ${video.product.name}`, 'text-light-gray mt-2'));
    const actions = element('div', '', 'flex gap-3 mt-4');
    if (video.status !== 'unpublished') { const button = element('button', 'Unpublish', 'btn btn-primary-alt px-4 py-2'); button.addEventListener('click', () => control(video, false, button)); actions.append(button); }
    const remove = element('button', 'Delete', 'btn btn-danger px-4 py-2'); remove.addEventListener('click', () => control(video, true, remove)); actions.append(remove);
    card.append(actions); list.append(card);
  }
  async function loadVideos(reset = false) {
    if (loading && !reset) return;
    const version = ++listVersion;
    loading = true; listStatus.textContent = 'Loading videos…';
    try {
      const nextPage = reset ? 1 : page + 1;
      const data = await request(`videos/mine?page=${nextPage}&limit=12`);
      if (version !== listVersion) return;
      if (reset) { for (const player of list.querySelectorAll('video')) player.pause(); list.replaceChildren(); }
      for (const video of data.items || []) render(video);
      page = nextPage; more.classList.toggle('hidden', !data.hasMore);
      listStatus.textContent = list.children.length ? 'Your Explore videos are shown below.' : 'No Explore videos yet. Publish your first video above.';
    } catch (error) { if (version === listVersion) listStatus.textContent = error.message || 'Could not load your videos.'; }
    finally { if (version === listVersion) loading = false; }
  }
  field('exploreRefreshBtn').addEventListener('click', () => loadVideos(true));
  more.addEventListener('click', () => loadVideos());
  field('logoutAdminBtn').addEventListener('click', () => { clearAdminSession(); redirectToLogin('logout'); });
  loadProducts(); loadVideos(true);
})();
