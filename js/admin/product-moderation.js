const productModerationList = document.getElementById("productModerationList");
const refreshProductModerationBtn = document.getElementById("refreshProductModerationBtn");
const catalogProductForm = document.getElementById("catalogProductForm");
const catalogProductList = document.getElementById("catalogProductList");
const catalogMeta = document.getElementById("catalogMeta");
const catalogSellerType = document.getElementById("catalogSellerType");
const catalogSellerId = document.getElementById("catalogSellerId");
const catalogVendorField = document.getElementById("catalogVendorField");
const cancelProductEditBtn = document.getElementById("cancelProductEditBtn");
const catalogFormStatus = document.getElementById("catalogFormStatus");

let catalogProducts = [];
let aiCatalogDrafts = [];
let defaultNaijagoWarehouse = null;

const catalogField = (id) => document.getElementById(id);
const productImage = (product) =>
  Array.isArray(product.imageUrls) && product.imageUrls.length
    ? product.imageUrls[0]
    : "https://placehold.co/300x220/0f172a/e2e8f0?text=Product";
const productSellerName = (product) =>
  product.sellerName ||
  (product.sellerType === "naijago" ? "NaijaGo" : product.vendor?.businessName || "Vendor unavailable");

function populateCategorySelect(selectId) {
  const select = catalogField(selectId);
  if (!select) return;
  select.innerHTML = '<option value="">Select category</option>' + Object.keys(NAIJAGO_CATALOG_TAXONOMY)
    .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    .join("");
}

function populateSubcategorySelect(categoryId, subcategoryId, selected = "") {
  const category = catalogField(categoryId)?.value || "";
  const select = catalogField(subcategoryId);
  if (!select) return;
  const options = NAIJAGO_CATALOG_TAXONOMY[category] || [];
  select.innerHTML = '<option value="">Select subcategory</option>' + options
    .map((subcategory) => `<option value="${escapeHtml(subcategory)}">${escapeHtml(subcategory)}</option>`)
    .join("");
  select.value = options.includes(selected) ? selected : "";
}

function taxonomyCategory(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return Object.keys(NAIJAGO_CATALOG_TAXONOMY)
    .find((category) => category.toLowerCase() === normalized) || "";
}

function taxonomySubcategory(category, value) {
  const normalized = String(value || "").trim().toLowerCase();
  return (NAIJAGO_CATALOG_TAXONOMY[category] || [])
    .find((subcategory) => subcategory.toLowerCase() === normalized) || "";
}

function toggleVendorField() {
  const vendorSelected = catalogSellerType?.value === "vendor";
  catalogVendorField?.classList.toggle("hidden", !vendorSelected);
  if (catalogSellerId) catalogSellerId.required = vendorSelected;
}

function applyDefaultWarehouse({ overwrite = false } = {}) {
  if (catalogSellerType?.value !== "naijago" || !defaultNaijagoWarehouse) return;
  [["catalogLocationAddress", defaultNaijagoWarehouse.formattedAddress], ["catalogLatitude", defaultNaijagoWarehouse.latitude], ["catalogLongitude", defaultNaijagoWarehouse.longitude]]
    .forEach(([id, value]) => {
      const field = catalogField(id);
      if (field && (overwrite || !field.value)) field.value = value ?? "";
    });
}

async function loadWarehouseSettings() {
  const status = catalogField("warehouseSettingsStatus");
  try {
    const response = await fetch(`${BASE_URL}/api/admin/catalog/settings`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const data = await response.json();
    if (handleAdminSessionExpiry(response.status)) return;
    if (!response.ok) throw new Error(data.message || "Unable to load warehouse settings.");
    defaultNaijagoWarehouse = data.warehouse;
    if (defaultNaijagoWarehouse?.formattedAddress) {
      catalogField("warehouseAddress").value = defaultNaijagoWarehouse.formattedAddress;
      catalogField("warehouseLatitude").value = defaultNaijagoWarehouse.latitude ?? "";
      catalogField("warehouseLongitude").value = defaultNaijagoWarehouse.longitude ?? "";
      status.textContent = "Saved and ready";
      applyDefaultWarehouse();
    } else status.textContent = "Not configured yet";
  } catch (error) {
    status.textContent = error.message;
  }
}

async function saveWarehouseSettings(event) {
  event.preventDefault();
  const status = catalogField("warehouseSettingsStatus");
  status.textContent = "Saving…";
  try {
    const response = await fetch(`${BASE_URL}/api/admin/catalog/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ formattedAddress: catalogField("warehouseAddress").value.trim(), latitude: Number(catalogField("warehouseLatitude").value), longitude: Number(catalogField("warehouseLongitude").value) }),
    });
    const data = await response.json();
    if (handleAdminSessionExpiry(response.status)) return;
    if (!response.ok) throw new Error(data.message || "Unable to save warehouse settings.");
    defaultNaijagoWarehouse = data.warehouse;
    applyDefaultWarehouse({ overwrite: true });
    status.textContent = "Saved and ready";
    displayMessage(data.message, "success");
  } catch (error) {
    status.textContent = "Save failed";
    displayMessage(error.message, "error");
  }
}

function useBrowserWarehouseLocation() {
  const status = catalogField("warehouseSettingsStatus");
  if (!navigator.geolocation) return displayMessage("Location is not available in this browser.", "error");
  status.textContent = "Getting location…";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      catalogField("warehouseLatitude").value = position.coords.latitude.toFixed(7);
      catalogField("warehouseLongitude").value = position.coords.longitude.toFixed(7);
      status.textContent = "Location captured—enter the address and save";
    },
    () => { status.textContent = "Location permission was not granted"; displayMessage("Allow location access, or enter the coordinates manually.", "error"); },
    { enableHighAccuracy: true, timeout: 15000 },
  );
}

async function loadApprovedVendors() {
  if (!adminToken || !catalogSellerId) return;
  try {
    const response = await fetch(`${BASE_URL}/api/admin/vendors/operations?status=approved&limit=300`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await response.json();
    if (handleAdminSessionExpiry(response.status)) return;
    if (!response.ok) throw new Error(data.message || "Unable to load vendors.");
    const vendors = data.vendors || [];
    catalogSellerId.innerHTML = '<option value="">Select approved vendor</option>' + vendors
      .map((vendor) => `<option value="${escapeHtml(vendor._id || vendor.id || "")}">${escapeHtml(vendor.businessName || vendor.name || vendor.email || "Vendor")}</option>`)
      .join("");
  } catch (error) {
    displayMessage(`Vendor list: ${error.message}`, "error");
  }
}

let activeAiImageDraftIndex = null;

function showGeneratedImageState(message, imageUrl = "", loading = false) {
  const panel = catalogField("catalogGeneratedImagePanel");
  const preview = catalogField("catalogGeneratedImagePreview");
  panel?.classList.remove("hidden");
  catalogField("catalogGeneratedImageState").textContent = message;
  if (imageUrl) {
    preview.innerHTML = `<img src="${escapeHtml(imageUrl)}" alt="Generated product draft" class="h-full w-full object-contain" />`;
  } else if (loading) {
    preview.innerHTML = `<div class="flex flex-col items-center gap-3"><span class="h-8 w-8 animate-spin rounded-full border-4 border-gray-600 border-t-cyan-400"></span><span>Generating…</span></div>`;
  } else {
    preview.textContent = "No generated image";
  }
  catalogField("retryGeneratedImageBtn").disabled = loading;
  catalogField("removeGeneratedImageBtn").disabled = loading || !imageUrl;
}

function removeGeneratedImage() {
  catalogField("catalogGeneratedImageUrl").value = "";
  catalogField("mainImageRequiredLabel").textContent = "*";
  showGeneratedImageState("Generated image removed. Retry or upload a real product photo.");
}

function resetCatalogForm() {
  catalogProductForm?.reset();
  catalogField("catalogProductId").value = "";
  catalogField("catalogGeneratedImageUrl").value = "";
  activeAiImageDraftIndex = null;
  catalogField("catalogGeneratedImagePanel")?.classList.add("hidden");
  catalogField("catalogSource").value = "admin";
  catalogField("catalogAiMetadata").value = "";
  catalogField("catalogProvenance").value = "";
  catalogField("catalogFormTitle").textContent = "Add a real product";
  catalogField("saveCatalogProductBtn").textContent = "Create product";
  catalogField("mainImageRequiredLabel").textContent = "*";
  cancelProductEditBtn?.classList.add("hidden");
  if (catalogSellerType) catalogSellerType.value = "naijago";
  if (catalogField("catalogStatus")) catalogField("catalogStatus").value = "active";
  toggleVendorField();
  applyDefaultWarehouse();
}

function editCatalogProduct(productId) {
  const product = catalogProducts.find((entry) => String(entry._id || entry.id) === String(productId));
  if (!product) return;
  catalogField("catalogProductId").value = product._id || product.id;
  catalogField("catalogName").value = product.name || "";
  catalogField("catalogBrand").value = product.brand || "";
  catalogField("catalogSku").value = product.sku || "";
  const categoryParts = String(product.category || "").split(">").map((part) => part.trim()).filter(Boolean);
  const productCategory = taxonomyCategory(categoryParts[0]) || categoryParts[0] || "";
  catalogField("catalogCategory").value = productCategory;
  populateSubcategorySelect("catalogCategory", "catalogSubcategory", product.subcategory || categoryParts.slice(1).join(" > "));
  catalogField("catalogTags").value = (product.searchTags || []).join(", ");
  catalogField("catalogPrice").value = product.price ?? "";
  catalogField("catalogDiscountPrice").value = product.discountPrice ?? "";
  catalogField("catalogStock").value = product.stockQuantity ?? 0;
  catalogField("catalogStatus").value = product.productStatus || (product.isActive ? "active" : "disabled");
  catalogField("catalogDescription").value = product.description || "";
  catalogField("catalogSource").value = product.source || "admin";
  catalogField("catalogAiMetadata").value = JSON.stringify(product.aiMetadata || {});
  catalogField("catalogProvenance").value = JSON.stringify(product.provenance || {});
  catalogField("catalogLocationAddress").value = product.productLocation?.formattedAddress || "";
  catalogField("catalogLatitude").value = product.productLocation?.latitude ?? "";
  catalogField("catalogLongitude").value = product.productLocation?.longitude ?? "";
  catalogField("catalogSupplierReference").value = product.provenance?.supplierReference || "";
  catalogField("catalogSourceUrl").value = product.provenance?.sourceUrl || "";
  catalogField("catalogVerified").checked = Boolean(product.provenance?.verifiedAt);
  catalogField("catalogImageRights").checked = product.provenance?.imageRightsConfirmed === true;
  catalogSellerType.value = product.sellerType || (product.vendor ? "vendor" : "naijago");
  toggleVendorField();
  catalogSellerId.value = product.sellerId?._id || product.sellerId || product.vendor?._id || "";
  catalogField("catalogFormTitle").textContent = `Edit ${product.name || "product"}`;
  catalogField("saveCatalogProductBtn").textContent = "Save changes";
  catalogField("mainImageRequiredLabel").textContent = "(optional while editing)";
  cancelProductEditBtn?.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function buildProductFormData() {
  const data = new FormData();
  let savedProvenance = {};
  try { savedProvenance = JSON.parse(catalogField("catalogProvenance").value || "{}"); } catch (_) {}
  const verified = catalogField("catalogVerified").checked;
  const provenance = {
    ...savedProvenance,
    sourceUrl: catalogField("catalogSourceUrl").value.trim(),
    supplierReference: catalogField("catalogSupplierReference").value.trim(),
    imageRightsConfirmed: catalogField("catalogImageRights").checked,
    verifiedAt: verified ? new Date().toISOString() : null,
  };
  const values = {
    name: catalogField("catalogName").value.trim(),
    brand: catalogField("catalogBrand").value.trim(),
    sku: catalogField("catalogSku").value.trim(),
    category: catalogField("catalogCategory").value.trim(),
    subcategory: catalogField("catalogSubcategory").value.trim(),
    searchTags: catalogField("catalogTags").value.trim(),
    price: catalogField("catalogPrice").value,
    discountPrice: catalogField("catalogDiscountPrice").value,
    stockQuantity: catalogField("catalogStock").value,
    productStatus: catalogField("catalogStatus").value,
    description: catalogField("catalogDescription").value.trim(),
    sellerType: catalogSellerType.value,
    sellerId: catalogSellerId.value,
    productLocationAddress: catalogField("catalogLocationAddress").value.trim(),
    productLatitude: catalogField("catalogLatitude").value,
    productLongitude: catalogField("catalogLongitude").value,
    generatedImageUrl: catalogField("catalogGeneratedImageUrl").value,
    source: catalogField("catalogSource").value,
    aiMetadata: catalogField("catalogAiMetadata").value,
    provenance: JSON.stringify(provenance),
  };
  Object.entries(values).forEach(([key, value]) => data.append(key, value));
  const mainImage = catalogField("catalogMainImage").files[0];
  if (mainImage) data.append("mainImage", mainImage);
  Array.from(catalogField("catalogExtraImages").files).slice(0, 10)
    .forEach((file) => data.append("extraImages", file));
  return data;
}

async function saveCatalogProduct(event) {
  event.preventDefault();
  const productId = catalogField("catalogProductId").value;
  if (!productId && !catalogField("catalogMainImage").files[0] && !catalogField("catalogGeneratedImageUrl").value) {
    displayMessage("A main product image is required.", "error");
    return;
  }
  if (catalogSellerType.value === "naijago" &&
      (!catalogField("catalogLatitude").value || !catalogField("catalogLongitude").value)) {
    displayMessage("NaijaGo products require fulfilment latitude and longitude.", "error");
    return;
  }
  catalogFormStatus.textContent = productId ? "Saving changes..." : "Creating product...";
  try {
    const response = await fetch(`${BASE_URL}/api/products${productId ? `/${productId}` : ""}`, {
      method: productId ? "PUT" : "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: buildProductFormData(),
    });
    const data = await response.json();
    if (handleAdminSessionExpiry(response.status)) return;
    if (!response.ok) throw new Error(data.message || "Unable to save product.");

    if (productId) {
      const original = catalogProducts.find((item) => String(item._id || item.id) === productId);
      const nextType = catalogSellerType.value;
      const nextId = nextType === "vendor" ? catalogSellerId.value : null;
      const originalId = original?.sellerId?._id || original?.sellerId || original?.vendor?._id || null;
      if ((original?.sellerType || (original?.vendor ? "vendor" : "naijago")) !== nextType || String(originalId || "") !== String(nextId || "")) {
        const sellerResponse = await fetch(`${BASE_URL}/api/products/${productId}/seller`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({
            sellerType: nextType,
            sellerId: nextId,
            price: Number(catalogField("catalogPrice").value),
            discountPrice: catalogField("catalogDiscountPrice").value || null,
            stockQuantity: Number(catalogField("catalogStock").value),
            productStatus: catalogField("catalogStatus").value,
            reason: "Changed by catalogue admin",
          }),
        });
        const sellerData = await sellerResponse.json();
        if (!sellerResponse.ok) throw new Error(sellerData.message || "Product saved, but seller assignment failed.");
      }
    }
    displayMessage(data.message || "Product saved.", "success");
    resetCatalogForm();
    await fetchCatalogProducts();
  } catch (error) {
    displayMessage(error.message, "error");
  } finally {
    catalogFormStatus.textContent = "";
  }
}

function renderCatalogProducts(products = []) {
  if (!catalogProductList) return;
  if (!products.length) {
    catalogProductList.innerHTML = '<p class="text-light-gray">No products match these filters.</p>';
    return;
  }
  catalogProductList.innerHTML = products.map((product) => {
    const id = product._id || product.id || "";
    const status = product.productStatus || (product.isActive ? "active" : "disabled");
    const ordered = product.hasOrders === true;
    return `<article class="rounded-xl border border-cyan-400 border-opacity-15 bg-blue-950 bg-opacity-30 p-4">
      <div class="grid gap-4 lg:grid-cols-[140px_1fr_auto]">
        <img src="${escapeHtml(productImage(product))}" class="h-32 w-full rounded-lg object-cover" alt="${escapeHtml(product.name || "Product")}" />
        <div>
          <div class="flex flex-wrap gap-2"><span class="status-badge status-approved">${escapeHtml(status)}</span><span class="status-badge">${escapeHtml(product.sellerType || "naijago")}</span></div>
          <h3 class="mt-2 text-xl font-bold text-light-slate">${escapeHtml(product.name || "Unnamed product")}</h3>
          <p class="text-sm text-light-gray">${escapeHtml(product.brand || "Unbranded")} • ${escapeHtml(product.category || "Uncategorized")}${product.subcategory ? ` › ${escapeHtml(product.subcategory)}` : ""}</p>
          <p class="mt-2 text-light-gray">Seller: <span class="text-light-slate">${escapeHtml(productSellerName(product))}</span> • ₦${Number(product.effectivePrice ?? product.price ?? 0).toLocaleString()} • Stock ${Number(product.stockQuantity || 0)}</p>
          <p class="text-xs text-light-gray mt-1">SKU: ${escapeHtml(product.sku || "—")} ${ordered ? "• Has protected order history" : ""}</p>
        </div>
        <div class="flex flex-col gap-2 lg:w-36">
          <button class="edit-catalog-btn btn btn-primary px-4 py-2 text-sm" data-id="${escapeHtml(id)}">Edit</button>
          <button class="archive-catalog-btn btn btn-primary-alt px-4 py-2 text-sm" data-id="${escapeHtml(id)}" data-archived="${status === "disabled"}">${status === "disabled" ? "Enable" : "Disable"}</button>
          <button class="delete-catalog-btn btn btn-danger px-4 py-2 text-sm" data-id="${escapeHtml(id)}" ${ordered ? "disabled title=\"Ordered products must be archived\"" : ""}>Delete</button>
        </div>
      </div>
    </article>`;
  }).join("");
  document.querySelectorAll(".edit-catalog-btn").forEach((button) => button.addEventListener("click", () => editCatalogProduct(button.dataset.id)));
  document.querySelectorAll(".archive-catalog-btn").forEach((button) => button.addEventListener("click", () => archiveCatalogProduct(button.dataset.id, button.dataset.archived !== "true")));
  document.querySelectorAll(".delete-catalog-btn").forEach((button) => button.addEventListener("click", () => deleteCatalogProduct(button.dataset.id)));
}

async function fetchCatalogProducts() {
  if (!adminToken || !catalogProductList) return;
  catalogProductList.innerHTML = '<p class="text-light-gray">Loading catalogue...</p>';
  const params = new URLSearchParams({ limit: "100" });
  const search = catalogField("catalogSearch")?.value.trim();
  const sellerType = catalogField("catalogSellerFilter")?.value;
  const status = catalogField("catalogStatusFilter")?.value;
  if (search) params.set("q", search);
  if (sellerType && sellerType !== "all") params.set("sellerType", sellerType);
  if (status && status !== "all") params.set("status", status);
  try {
    const response = await fetch(`${BASE_URL}/api/products/admin/catalog?${params}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const data = await response.json();
    if (handleAdminSessionExpiry(response.status)) return;
    if (!response.ok) throw new Error(data.message || "Unable to load catalogue.");
    catalogProducts = data.products || [];
    catalogMeta.textContent = `${Number(data.total || catalogProducts.length).toLocaleString()} product records found.`;
    renderCatalogProducts(catalogProducts);
  } catch (error) {
    catalogProductList.innerHTML = `<p class="text-red-400">${escapeHtml(error.message)}</p>`;
  }
}

async function archiveCatalogProduct(productId, archived) {
  try {
    const response = await fetch(`${BASE_URL}/api/products/${productId}/archive`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ archived }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Unable to update product.");
    displayMessage(data.message, "success");
    fetchCatalogProducts();
  } catch (error) { displayMessage(error.message, "error"); }
}

async function deleteCatalogProduct(productId) {
  if (!confirm("Permanently delete this unordered product?")) return;
  try {
    const response = await fetch(`${BASE_URL}/api/products/${productId}`, { method: "DELETE", headers: { Authorization: `Bearer ${adminToken}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Unable to delete product.");
    displayMessage(data.message, "success");
    fetchCatalogProducts();
  } catch (error) { displayMessage(error.message, "error"); }
}

function renderModerationProducts(products = []) {
  if (!productModerationList) return;
  productModerationList.innerHTML = products.length ? products.map((product) => `<div class="rounded-xl border border-cyan-400 border-opacity-15 p-4"><h3 class="text-xl font-bold text-light-slate">${escapeHtml(product.name || "Product")}</h3><p class="text-light-gray">${escapeHtml(product.category || "Uncategorized")} • ${escapeHtml(productSellerName(product))}</p><div class="flex gap-2 mt-3"><button class="approve-product-btn btn btn-success px-4 py-2 text-sm" data-id="${escapeHtml(product._id || "")}">Approve</button><button class="reject-product-btn btn btn-danger px-4 py-2 text-sm" data-id="${escapeHtml(product._id || "")}">Reject</button></div></div>`).join("") : '<p class="text-light-gray">No pending listings.</p>';
  document.querySelectorAll(".approve-product-btn").forEach((button) => button.addEventListener("click", () => updateProductModeration(button.dataset.id, "approved")));
  document.querySelectorAll(".reject-product-btn").forEach((button) => button.addEventListener("click", () => updateProductModeration(button.dataset.id, "rejected")));
}

async function fetchProductModerationQueue() {
  if (!adminToken || !productModerationList) return;
  try {
    const response = await fetch(`${BASE_URL}/api/admin/product-moderation?status=pending`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const data = await response.json();
    if (handleAdminSessionExpiry(response.status)) return;
    if (!response.ok) throw new Error(data.message || "Failed to load moderation queue.");
    renderModerationProducts(data);
  } catch (error) { productModerationList.innerHTML = `<p class="text-red-400">${escapeHtml(error.message)}</p>`; }
}

async function updateProductModeration(productId, status) {
  const note = status === "rejected" ? prompt("Reason for rejection?") || "" : "";
  try {
    const response = await fetch(`${BASE_URL}/api/admin/product-moderation/${productId}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ status, note }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Update failed.");
    displayMessage(data.message, "success");
    await Promise.all([fetchProductModerationQueue(), fetchCatalogProducts()]);
  } catch (error) { displayMessage(error.message, "error"); }
}

async function fetchCatalogAiConfig() {
  const target = catalogField("catalogAiConfig");
  if (!target) return;
  try {
    const response = await fetch(`${BASE_URL}/api/admin/catalog-ai/config`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Configuration unavailable.");
    target.textContent = data.enabled
      ? `Ready • ${data.catalogModel} + ${data.imageModel}`
      : "GEMINI_API_KEY is not configured";
    catalogField("generateCatalogDraftsBtn").disabled = !data.enabled;
  } catch (error) {
    target.textContent = error.message;
  }
}

function useAiCatalogDraft(index) {
  const draft = aiCatalogDrafts[index];
  if (!draft) return;
  resetCatalogForm();
  catalogField("catalogName").value = draft.name || "";
  catalogField("catalogBrand").value = draft.brand || "";
  const draftCategory = taxonomyCategory(draft.category);
  catalogField("catalogCategory").value = draftCategory;
  populateSubcategorySelect(
    "catalogCategory",
    "catalogSubcategory",
    taxonomySubcategory(draftCategory, draft.subcategory),
  );
  catalogField("catalogTags").value = (draft.searchTags || []).join(", ");
  catalogField("catalogDescription").value = draft.description || "";
  catalogField("catalogSourceUrl").value = (draft.sourceUrls || [])[0] || "";
  catalogField("catalogVerified").checked = false;
  catalogField("catalogImageRights").checked = false;
  catalogField("catalogPrice").value = draft.estimatedMarketPriceMin || "";
  catalogField("catalogStock").value = 0;
  catalogField("catalogStatus").value = "draft";
  catalogField("catalogSource").value = "ai_assisted";
  catalogField("catalogAiMetadata").value = JSON.stringify({
    assisted: true,
    provider: "gemini",
    model: draft.aiMetadata?.model || "",
    generatedAt: new Date().toISOString(),
  });
  catalogField("catalogProvenance").value = JSON.stringify({
    sourceName: "Gemini grounded catalogue research",
    sourceUrl: (draft.sourceUrls || [])[0] || "",
    imageRightsConfirmed: false,
  });
  catalogField("catalogFormTitle").textContent = `Review AI draft: ${draft.name || "product"}`;
  catalogField("mainImageRequiredLabel").textContent = "*";
  window.scrollTo({ top: document.getElementById("catalogProductForm")?.offsetTop || 0, behavior: "smooth" });
}

async function generateAiCatalogImage(index) {
  const draft = aiCatalogDrafts[index];
  if (!draft) return;
  useAiCatalogDraft(index);
  activeAiImageDraftIndex = index;
  const status = catalogField("catalogFormStatus");
  status.textContent = "Generating AI product image…";
  showGeneratedImageState("Request sent to Gemini. Keep this page open while the image is created and stored.", "", true);
  try {
    const response = await fetch(`${BASE_URL}/api/admin/catalog-ai/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ prompt: draft.imagePrompt }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Image generation failed.");
    catalogField("catalogGeneratedImageUrl").value = data.imageUrl;
    catalogField("mainImageRequiredLabel").textContent = "AI draft image attached—verify accuracy and rights";
    showGeneratedImageState("Image generated and stored successfully. Review it carefully before saving.", data.imageUrl);
    displayMessage("AI draft image attached. Compare it carefully with the real product before publishing.", "success");
  } catch (error) {
    showGeneratedImageState(error.message || "Image generation failed. Retry once or upload a real product photo.");
    displayMessage(error.message, "error");
  } finally {
    status.textContent = "";
  }
}

function renderAiCatalogDrafts() {
  const target = catalogField("aiCatalogDrafts");
  if (!target) return;
  target.innerHTML = aiCatalogDrafts.map((draft, index) => {
    const sources = (draft.sourceUrls || []).filter((url) => /^https:\/\//i.test(url));
    return `<article class="rounded-xl border border-cyan-400 border-opacity-15 bg-blue-950 bg-opacity-30 p-4">
      <p class="text-xs font-bold uppercase tracking-[0.2em] text-accent-cyan">${escapeHtml(draft.category || "")} › ${escapeHtml(draft.subcategory || "")}</p>
      <h3 class="text-xl font-bold text-light-slate mt-2">${escapeHtml(draft.name || "Product")}</h3>
      <p class="text-sm text-light-gray">${escapeHtml(draft.brand || "Unbranded")} • Confidence ${Math.round(Number(draft.confidence || 0) * 100)}%</p>
      <p class="text-light-gray mt-2">${escapeHtml(draft.description || "")}</p>
      <p class="text-sm text-yellow-200 mt-2">Estimated only: ₦${Number(draft.estimatedMarketPriceMin || 0).toLocaleString()}–₦${Number(draft.estimatedMarketPriceMax || 0).toLocaleString()}</p>
      <p class="text-xs text-light-gray mt-2">${escapeHtml(draft.verificationNotes || "Human verification required.")}</p>
      <div class="flex flex-wrap gap-2 mt-3">${sources.slice(0, 3).map((url, sourceIndex) => `<a class="text-xs text-accent-cyan underline" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Source ${sourceIndex + 1}</a>`).join("")}</div>
      <div class="flex flex-wrap gap-2 mt-4"><button class="use-ai-draft-btn btn btn-primary-alt px-4 py-2 text-sm" data-index="${index}">Use draft</button><button class="image-ai-draft-btn btn btn-primary px-4 py-2 text-sm" data-index="${index}">Use + generate image</button></div>
    </article>`;
  }).join("");
  document.querySelectorAll(".use-ai-draft-btn").forEach((button) => button.addEventListener("click", () => useAiCatalogDraft(Number(button.dataset.index))));
  document.querySelectorAll(".image-ai-draft-btn").forEach((button) => button.addEventListener("click", () => generateAiCatalogImage(Number(button.dataset.index))));
}

async function generateAiCatalogDrafts() {
  const category = catalogField("aiCatalogCategory").value.trim();
  if (!category) return displayMessage("Choose a category for AI research.", "error");
  const status = catalogField("aiCatalogStatus");
  status.textContent = "Gemini is researching real products and sources...";
  try {
    const response = await fetch(`${BASE_URL}/api/admin/catalog-ai/drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        category,
        subcategory: catalogField("aiCatalogSubcategory").value.trim(),
        count: Number(catalogField("aiCatalogCount").value || 5),
        market: "Nigeria",
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Draft generation failed.");
    aiCatalogDrafts = data.products || [];
    status.textContent = `${aiCatalogDrafts.length} drafts generated with ${data.model}. Human verification is mandatory.`;
    renderAiCatalogDrafts();
  } catch (error) {
    status.textContent = error.message;
  }
}

catalogSellerType?.addEventListener("change", () => { toggleVendorField(); applyDefaultWarehouse(); });
catalogField("catalogCategory")?.addEventListener("change", () => populateSubcategorySelect("catalogCategory", "catalogSubcategory"));
catalogField("aiCatalogCategory")?.addEventListener("change", () => populateSubcategorySelect("aiCatalogCategory", "aiCatalogSubcategory"));
catalogProductForm?.addEventListener("submit", saveCatalogProduct);
cancelProductEditBtn?.addEventListener("click", resetCatalogForm);
catalogField("refreshCatalogBtn")?.addEventListener("click", fetchCatalogProducts);
catalogField("catalogSearch")?.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); fetchCatalogProducts(); } });
refreshProductModerationBtn?.addEventListener("click", fetchProductModerationQueue);
catalogField("generateCatalogDraftsBtn")?.addEventListener("click", generateAiCatalogDrafts);
catalogField("retryGeneratedImageBtn")?.addEventListener("click", () => {
  if (activeAiImageDraftIndex !== null) generateAiCatalogImage(activeAiImageDraftIndex);
});
catalogField("removeGeneratedImageBtn")?.addEventListener("click", removeGeneratedImage);
catalogField("warehouseSettingsForm")?.addEventListener("submit", saveWarehouseSettings);
catalogField("useBrowserLocationBtn")?.addEventListener("click", useBrowserWarehouseLocation);

if (currentPage === "product-moderation") {
  loadWarehouseSettings();
  populateCategorySelect("catalogCategory");
  populateCategorySelect("aiCatalogCategory");
  populateSubcategorySelect("catalogCategory", "catalogSubcategory");
  populateSubcategorySelect("aiCatalogCategory", "aiCatalogSubcategory");
  toggleVendorField();
  Promise.all([loadApprovedVendors(), fetchCatalogProducts(), fetchProductModerationQueue(), fetchCatalogAiConfig()]);
}
