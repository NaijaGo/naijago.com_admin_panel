const productModerationList = document.getElementById("productModerationList");
const refreshProductModerationBtn = document.getElementById(
  "refreshProductModerationBtn",
);

function productImage(product) {
  return Array.isArray(product.imageUrls) && product.imageUrls.length
    ? product.imageUrls[0]
    : "https://placehold.co/300x220/0f172a/e2e8f0?text=Product";
}

function productVendorName(product) {
  return product.vendor?.businessName || "Vendor unavailable";
}

function renderModerationProducts(products = []) {
  if (!productModerationList) return;
  if (!products.length) {
    productModerationList.innerHTML =
      '<p class="text-light-gray">No pending restaurant or pharmacy listings.</p>';
    return;
  }

  productModerationList.innerHTML = products
    .map(
      (product) => `
        <div class="rounded-xl border border-cyan-400 border-opacity-15 bg-blue-950 bg-opacity-30 p-4">
          <div class="grid gap-4 lg:grid-cols-[170px_1fr_auto]">
            <img src="${escapeHtml(productImage(product))}" class="h-36 w-full rounded-lg object-cover" alt="${escapeHtml(product.name || "Product")}" />
            <div>
              <p class="text-xs font-bold uppercase tracking-[0.25em] text-accent-cyan">${escapeHtml(product.category || "Uncategorized")}</p>
              <h3 class="mt-2 text-2xl font-bold text-light-slate">${escapeHtml(product.name || "Unnamed product")}</h3>
              <p class="mt-1 text-light-gray">${escapeHtml(product.description || "")}</p>
              <p class="mt-3 text-sm text-light-gray">Vendor: <span class="text-light-slate">${escapeHtml(productVendorName(product))}</span></p>
              <p class="mt-1 text-sm text-light-gray">Price: ₦${Number(product.price || 0).toFixed(0)} • Stock: ${Number(product.stockQuantity || 0)}</p>
              ${product.restaurantName ? `<p class="mt-1 text-sm text-light-gray">Restaurant: ${escapeHtml(product.restaurantName)}</p>` : ""}
              ${product.medicineAccess ? `<p class="mt-1 text-sm text-light-gray">Medicine access: ${escapeHtml(product.medicineAccess)}</p>` : ""}
            </div>
            <div class="flex flex-col gap-2 lg:w-36">
              <button class="approve-product-btn btn btn-success px-4 py-2 text-sm" data-id="${escapeHtml(product._id || product.id || "")}">Approve</button>
              <button class="reject-product-btn btn btn-danger px-4 py-2 text-sm" data-id="${escapeHtml(product._id || product.id || "")}">Reject</button>
            </div>
          </div>
        </div>
      `,
    )
    .join("");

  document.querySelectorAll(".approve-product-btn").forEach((button) => {
    button.addEventListener("click", () =>
      updateProductModeration(button.dataset.id, "approved"),
    );
  });
  document.querySelectorAll(".reject-product-btn").forEach((button) => {
    button.addEventListener("click", () =>
      updateProductModeration(button.dataset.id, "rejected"),
    );
  });
}

async function fetchProductModerationQueue() {
  if (!adminToken || !productModerationList) return;
  productModerationList.innerHTML =
    '<p class="text-light-gray">Loading moderation queue...</p>';

  try {
    const response = await fetch(
      `${BASE_URL}/api/admin/product-moderation?status=pending`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    const data = await response.json();
    if (handleAdminSessionExpiry(response.status)) return;
    if (!response.ok) {
      throw new Error(data.message || "Failed to load moderation queue.");
    }
    renderModerationProducts(data);
  } catch (error) {
    productModerationList.innerHTML = `<p class="text-red-400">${escapeHtml(error.message)}</p>`;
  }
}

async function updateProductModeration(productId, status) {
  if (!productId) return;
  const note =
    status === "rejected" ? prompt("Reason for rejection?") || "" : "";

  try {
    const response = await fetch(
      `${BASE_URL}/api/admin/product-moderation/${productId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status, note }),
      },
    );
    const data = await response.json();
    if (handleAdminSessionExpiry(response.status)) return;
    if (!response.ok) throw new Error(data.message || "Update failed.");
    displayMessage(data.message || "Product updated.", "success");
    fetchProductModerationQueue();
  } catch (error) {
    displayMessage(`Error: ${error.message}`, "error");
  }
}

refreshProductModerationBtn?.addEventListener(
  "click",
  fetchProductModerationQueue,
);

if (currentPage === "product-moderation") {
  fetchProductModerationQueue();
}
