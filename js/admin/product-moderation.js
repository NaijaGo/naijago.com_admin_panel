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

const catalogField = (id) => document.getElementById(id);
const productImage = (product) =>
  Array.isArray(product.imageUrls) && product.imageUrls.length
    ? product.imageUrls[0]
    : "https://placehold.co/300x220/0f172a/e2e8f0?text=Product";
const productSellerName = (product) =>
  product.sellerName ||
  (product.sellerType === "naijago" ? "NaijaGo" : product.vendor?.businessName || "Vendor unavailable");

function toggleVendorField() {
  const vendorSelected = catalogSellerType?.value === "vendor";
  catalogVendorField?.classList.toggle("hidden", !vendorSelected);
  if (catalogSellerId) catalogSellerId.required = vendorSelected;
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

function resetCatalogForm() {
  catalogProductForm?.reset();
  catalogField("catalogProductId").value = "";
  catalogField("catalogFormTitle").textContent = "Add a real product";
  catalogField("saveCatalogProductBtn").textContent = "Create product";
  catalogField("mainImageRequiredLabel").textContent = "*";
  cancelProductEditBtn?.classList.add("hidden");
  if (catalogSellerType) catalogSellerType.value = "naijago";
  if (catalogField("catalogStatus")) catalogField("catalogStatus").value = "active";
  toggleVendorField();
}

function editCatalogProduct(productId) {
  const product = catalogProducts.find((entry) => String(entry._id || entry.id) === String(productId));
  if (!product) return;
  catalogField("catalogProductId").value = product._id || product.id;
  catalogField("catalogName").value = product.name || "";
  catalogField("catalogBrand").value = product.brand || "";
  catalogField("catalogSku").value = product.sku || "";
  catalogField("catalogCategory").value = product.category || "";
  catalogField("catalogSubcategory").value = product.subcategory || "";
  catalogField("catalogTags").value = (product.searchTags || []).join(", ");
  catalogField("catalogPrice").value = product.price ?? "";
  catalogField("catalogDiscountPrice").value = product.discountPrice ?? "";
  catalogField("catalogStock").value = product.stockQuantity ?? 0;
  catalogField("catalogStatus").value = product.productStatus || (product.isActive ? "active" : "disabled");
  catalogField("catalogDescription").value = product.description || "";
  catalogField("catalogLocationAddress").value = product.productLocation?.formattedAddress || "";
  catalogField("catalogLatitude").value = product.productLocation?.latitude ?? "";
  catalogField("catalogLongitude").value = product.productLocation?.longitude ?? "";
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
  if (!productId && !catalogField("catalogMainImage").files[0]) {
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

catalogSellerType?.addEventListener("change", toggleVendorField);
catalogProductForm?.addEventListener("submit", saveCatalogProduct);
cancelProductEditBtn?.addEventListener("click", resetCatalogForm);
catalogField("refreshCatalogBtn")?.addEventListener("click", fetchCatalogProducts);
catalogField("catalogSearch")?.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); fetchCatalogProducts(); } });
refreshProductModerationBtn?.addEventListener("click", fetchProductModerationQueue);

if (currentPage === "product-moderation") {
  toggleVendorField();
  Promise.all([loadApprovedVendors(), fetchCatalogProducts(), fetchProductModerationQueue()]);
}
