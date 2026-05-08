let vendorOperations = [];
let vendorOperationsTotals = {};

const vendorOpsSearchInput = document.getElementById("vendorOpsSearchInput");
const vendorOpsStatusFilter = document.getElementById("vendorOpsStatusFilter");
const refreshVendorOpsBtn = document.getElementById("refreshVendorOpsBtn");
const exportVendorOpsCsvBtn = document.getElementById("exportVendorOpsCsvBtn");
const vendorOperationsList = document.getElementById("vendorOperationsList");
const vendorOpsMeta = document.getElementById("vendorOpsMeta");
const vendorOpsCount = document.getElementById("vendorOpsCount");
const vendorOpsApprovedCount = document.getElementById("vendorOpsApprovedCount");
const vendorOpsProductsCount = document.getElementById("vendorOpsProductsCount");
const vendorOpsSalesTotal = document.getElementById("vendorOpsSalesTotal");
const vendorOpsPayoutDue = document.getElementById("vendorOpsPayoutDue");
const approvedPharmacistsList = document.getElementById("approvedPharmacistsList");
const approvedPharmacistsMeta = document.getElementById("approvedPharmacistsMeta");
const approvedRestaurantsList = document.getElementById("approvedRestaurantsList");
const approvedRestaurantsMeta = document.getElementById("approvedRestaurantsMeta");

async function fetchVendorOperations() {
  if (!adminToken) {
    if (vendorOperationsList) {
      vendorOperationsList.innerHTML =
        '<p class="text-center text-light-gray">Please login as admin to load vendors.</p>';
    }
    return;
  }

  if (vendorOperationsList) {
    vendorOperationsList.innerHTML =
      '<p class="text-center text-light-gray">Loading vendors...</p>';
  }

  try {
    const params = new URLSearchParams();
    const search = vendorOpsSearchInput?.value?.trim();
    const status = vendorOpsStatusFilter?.value || "all";
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);

    const response = await fetch(
      `${BASE_URL}/api/admin/vendors/operations${params.toString() ? `?${params}` : ""}`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    const data = await response.json();

    if (handleAdminSessionExpiry(response.status)) return;

    if (!response.ok) {
      displayMessage(data.message || "Failed to load vendor operations.", "error");
      vendorOperationsList.innerHTML =
        '<p class="text-center text-red-500">Unable to load vendors.</p>';
      return;
    }

    vendorOperations = data.vendors || [];
    vendorOperationsTotals = data.totals || {};
    renderVendorOperations();
    renderApprovedSpecialtyLists();
  } catch (error) {
    displayMessage(`Network error: ${error.message}`, "error");
    if (vendorOperationsList) {
      vendorOperationsList.innerHTML =
        '<p class="text-center text-red-500">Connection failed.</p>';
    }
  }
}

function isApprovedPharmacistVendor(vendor) {
  return (
    vendor.status === "approved" &&
    (vendor.pharmacistStatus === "approved" || vendor.role === "pharmacist")
  );
}

function isRestaurantVendor(vendor) {
  if (vendor.status !== "approved") return false;
  return (vendor.businessCategories || []).some((category) => {
    const normalized = String(category || "").trim().toLowerCase();
    if (normalized.includes("restaurant equipment")) return false;
    return (
      normalized === "restaurant" ||
      normalized.startsWith("restaurant >") ||
      normalized.includes("food") ||
      normalized.includes("meal") ||
      normalized.includes("catering")
    );
  });
}

function renderApprovedSpecialtyLists() {
  const approvedPharmacists = vendorOperations.filter(isApprovedPharmacistVendor);
  const approvedRestaurants = vendorOperations.filter(isRestaurantVendor);

  renderSpecialtyVendorList({
    container: approvedPharmacistsList,
    meta: approvedPharmacistsMeta,
    vendors: approvedPharmacists,
    emptyMessage: "No approved pharmacist vendors found.",
    label: "approved pharmacist vendor",
  });

  renderSpecialtyVendorList({
    container: approvedRestaurantsList,
    meta: approvedRestaurantsMeta,
    vendors: approvedRestaurants,
    emptyMessage: "No approved restaurant vendors found.",
    label: "approved restaurant vendor",
  });
}

function renderSpecialtyVendorList({ container, meta, vendors, emptyMessage, label }) {
  if (!container) return;

  if (meta) {
    meta.textContent = `${vendors.length} ${label}${vendors.length === 1 ? "" : "s"} loaded.`;
  }

  if (!vendors.length) {
    container.innerHTML = `<p class="text-center text-light-gray">${emptyMessage}</p>`;
    return;
  }

  container.innerHTML = vendors
    .map((vendor) => {
      const contactPhone =
        vendor.businessSupportPhone ||
        vendor.businessWhatsAppNumber ||
        vendor.phoneNumber ||
        "No phone";

      return `
        <article class="rounded-xl border border-cyan-400 border-opacity-10 bg-blue-950 bg-opacity-20 p-4">
          <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 class="text-lg font-bold text-light-slate">${escapeHtml(vendor.businessName || vendor.name || "Unnamed vendor")}</h3>
              <p class="text-sm text-light-gray">Owner: ${escapeHtml(vendor.name || "N/A")}</p>
              <p class="text-sm text-light-gray">Email: <span class="text-accent-cyan">${escapeHtml(vendor.email || "No email")}</span></p>
              <p class="text-sm text-light-gray">Phone: ${escapeHtml(contactPhone)}</p>
              <p class="text-sm text-light-gray">Categories: ${escapeHtml((vendor.businessCategories || []).join(", ") || "N/A")}</p>
            </div>
            <div class="grid gap-2 text-sm md:min-w-[150px]">
              ${vendorMetricBox("Products", `${formatNumber(vendor.activeProducts || 0)} active`)}
              ${vendorMetricBox("Sales", formatCurrency(vendor.totalSalesAmount || 0))}
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderVendorOperations() {
  if (!vendorOperationsList) return;

  updateVendorOperationsSummary();

  if (vendorOpsMeta) {
    vendorOpsMeta.textContent = `${vendorOperations.length} vendor record${vendorOperations.length === 1 ? "" : "s"} loaded.`;
  }

  if (!vendorOperations.length) {
    vendorOperationsList.innerHTML =
      '<p class="text-center text-light-gray">No vendors found for this filter.</p>';
    return;
  }

  vendorOperationsList.innerHTML = vendorOperations
    .map((vendor) => {
      const status = vendor.status || "none";
      return `
        <article class="card p-6 request-card" data-vendor-id="${escapeHtml(vendor.id || "")}">
          <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div class="flex flex-wrap items-center gap-3 mb-3">
                <h3 class="text-2xl font-bold text-light-slate">${escapeHtml(vendor.businessName || vendor.name || "Unnamed vendor")}</h3>
                <span class="status-badge ${vendorOpsStatusClass(status)}">${formatStatusLabel(status)}</span>
                ${vendor.isTemporarilyClosed ? '<span class="status-badge status-suspended">CLOSED</span>' : ""}
              </div>
              <p class="text-sm text-light-gray"><strong>Owner:</strong> ${escapeHtml(vendor.name || "N/A")}</p>
              <p class="text-sm text-light-gray"><strong>Email:</strong> <span class="text-accent-cyan">${escapeHtml(vendor.email || "No email")}</span></p>
              <p class="text-sm text-light-gray"><strong>Phone:</strong> ${escapeHtml(vendor.phoneNumber || "No phone")}</p>
              <p class="text-sm text-light-gray"><strong>Categories:</strong> ${escapeHtml((vendor.businessCategories || []).join(", ") || "N/A")}</p>
              <p class="text-sm text-light-gray"><strong>WhatsApp:</strong> ${escapeHtml(vendor.businessWhatsAppNumber || "N/A")} | <strong>Support:</strong> ${escapeHtml(vendor.businessSupportPhone || "N/A")}</p>
              ${vendor.temporaryClosureReason ? `<p class="text-sm text-red-300"><strong>Closure reason:</strong> ${escapeHtml(vendor.temporaryClosureReason)}</p>` : ""}
            </div>
            <div class="grid gap-3 sm:grid-cols-2 xl:min-w-[440px]">
              ${vendorMetricBox("Wallet", formatCurrency(vendor.vendorWalletBalance || 0))}
              ${vendorMetricBox("Sales", formatCurrency(vendor.totalSalesAmount || 0))}
              ${vendorMetricBox("Payout Due", formatCurrency(vendor.payoutDueAmount || 0))}
              ${vendorMetricBox("Products", `${formatNumber(vendor.activeProducts || 0)} active / ${formatNumber(vendor.totalProducts || 0)} total`)}
              ${vendorMetricBox("Orders", `${formatNumber(vendor.paidOrders || 0)} paid`)}
              ${vendorMetricBox("Shipments", `${formatNumber(vendor.paidShipments || 0)} paid`)}
            </div>
          </div>
          <div class="flex flex-wrap justify-between gap-3 mt-6">
            <div class="text-xs text-light-gray">
              Last sale: ${formatDateTime(vendor.lastSaleAt)} | Last product update: ${formatDateTime(vendor.lastProductActivityAt)}
            </div>
            <div class="flex flex-wrap gap-3">
              ${vendorOpsStatusButton(vendor, "approved", "Reactivate")}
              ${vendorOpsStatusButton(vendor, "suspended", "Suspend")}
              ${vendorOpsStatusButton(vendor, "reviewing", "Reviewing")}
              ${vendorOpsStatusButton(vendor, "rejected", "Reject")}
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  vendorOperationsList.querySelectorAll(".vendor-ops-status-btn").forEach(
    (button) => {
      button.addEventListener("click", () =>
        updateVendorOperationalStatus(button.dataset.vendorId, button.dataset.status),
      );
    },
  );
}

function vendorMetricBox(label, value) {
  return `
    <div class="rounded-lg border border-cyan-300/20 bg-cyan-300/5 p-3">
      <p class="text-xs text-light-gray">${label}</p>
      <p class="font-bold text-light-slate">${escapeHtml(value)}</p>
    </div>
  `;
}

function vendorOpsStatusButton(vendor, status, label) {
  const disabled = vendor.status === status ? "btn-disabled" : "";
  const tone =
    status === "approved"
      ? "btn-success"
      : status === "suspended" || status === "rejected"
        ? "btn-danger"
        : "btn-warning";

  return `<button class="btn ${tone} ${disabled} vendor-ops-status-btn px-4 py-2 text-sm" data-vendor-id="${escapeHtml(vendor.id || "")}" data-status="${status}">${label}</button>`;
}

async function updateVendorOperationalStatus(vendorId, status) {
  if (!vendorId || !status) return;

  let reason = "";
  if (status === "suspended") {
    reason =
      window.prompt(
        "Why is this vendor being suspended?",
        "Vendor account suspended by admin.",
      ) || "";
    if (!reason.trim()) return;
  }

  try {
    const response = await fetch(`${BASE_URL}/api/admin/vendor-status/${vendorId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status, reason }),
    });
    const data = await response.json();

    if (handleAdminSessionExpiry(response.status)) return;

    if (response.ok) {
      displayMessage(data.message || `Vendor status updated to ${status}.`, "success");
      fetchVendorOperations();
    } else {
      displayMessage(data.message || "Failed to update vendor status.", "error");
    }
  } catch (error) {
    displayMessage(`Error: ${error.message}`, "error");
  }
}

function updateVendorOperationsSummary() {
  if (vendorOpsCount) {
    vendorOpsCount.textContent = vendorOperationsTotals.vendors || vendorOperations.length;
  }
  if (vendorOpsApprovedCount) {
    vendorOpsApprovedCount.textContent =
      vendorOperationsTotals.approved ??
      vendorOperations.filter((vendor) => vendor.status === "approved").length;
  }
  if (vendorOpsProductsCount) {
    vendorOpsProductsCount.textContent =
      vendorOperationsTotals.activeProducts ??
      vendorOperations.reduce((sum, vendor) => sum + Number(vendor.activeProducts || 0), 0);
  }
  if (vendorOpsSalesTotal) {
    vendorOpsSalesTotal.textContent = formatCurrency(
      vendorOperationsTotals.totalSalesAmount ??
        vendorOperations.reduce((sum, vendor) => sum + Number(vendor.totalSalesAmount || 0), 0),
    );
  }
  if (vendorOpsPayoutDue) {
    vendorOpsPayoutDue.textContent = formatCurrency(
      vendorOperationsTotals.payoutDueAmount ??
        vendorOperations.reduce((sum, vendor) => sum + Number(vendor.payoutDueAmount || 0), 0),
    );
  }
}

function vendorOpsStatusClass(status = "") {
  const normalized = String(status).toLowerCase();
  if (normalized === "approved") return "status-approved";
  if (["rejected", "suspended"].includes(normalized)) return "status-rejected";
  if (["reviewing", "received"].includes(normalized)) return "status-delivered";
  return "status-pending";
}

function exportVendorOperationsCsv() {
  if (!vendorOperations.length) {
    displayMessage("Load vendors before exporting.", "warning");
    return;
  }

  const rows = [
    [
      "businessName",
      "ownerName",
      "email",
      "phoneNumber",
      "status",
      "vendorWalletBalance",
      "appWalletBalance",
      "totalSalesAmount",
      "payoutDueAmount",
      "totalProducts",
      "activeProducts",
      "paidOrders",
      "paidShipments",
      "businessWhatsAppNumber",
      "businessSupportPhone",
      "createdAt",
    ],
    ...vendorOperations.map((vendor) => [
      vendor.businessName || "",
      vendor.name || "",
      vendor.email || "",
      vendor.phoneNumber || "",
      vendor.status || "",
      vendor.vendorWalletBalance || 0,
      vendor.appWalletBalance || 0,
      vendor.totalSalesAmount || 0,
      vendor.payoutDueAmount || 0,
      vendor.totalProducts || 0,
      vendor.activeProducts || 0,
      vendor.paidOrders || 0,
      vendor.paidShipments || 0,
      vendor.businessWhatsAppNumber || "",
      vendor.businessSupportPhone || "",
      vendor.createdAt || "",
    ]),
  ];

  const csv = rows.map((row) => row.map(vendorOpsCsvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `naijago-vendor-operations-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function vendorOpsCsvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function formatNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toLocaleString() : "0";
}

refreshVendorOpsBtn?.addEventListener("click", fetchVendorOperations);
exportVendorOpsCsvBtn?.addEventListener("click", exportVendorOperationsCsv);
vendorOpsStatusFilter?.addEventListener("change", fetchVendorOperations);
vendorOpsSearchInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") fetchVendorOperations();
});
