let riderDirectory = [];

const riderSearchInput = document.getElementById("riderSearchInput");
const riderStatusFilter = document.getElementById("riderStatusFilter");
const riderSourceFilter = document.getElementById("riderSourceFilter");
const refreshRidersBtn = document.getElementById("refreshRidersBtn");
const exportRidersCsvBtn = document.getElementById("exportRidersCsvBtn");
const riderOperationsList = document.getElementById("riderOperationsList");
const riderDirectoryMeta = document.getElementById("riderDirectoryMeta");
const riderTotalCount = document.getElementById("riderTotalCount");
const riderActiveCount = document.getElementById("riderActiveCount");
const riderDeliveryCount = document.getElementById("riderDeliveryCount");
const riderEarningsTotal = document.getElementById("riderEarningsTotal");

async function fetchRiderOperations() {
  if (!adminToken) {
    if (riderOperationsList) {
      riderOperationsList.innerHTML =
        '<p class="text-center text-light-gray">Please login as admin to load riders.</p>';
    }
    return;
  }

  if (riderOperationsList) {
    riderOperationsList.innerHTML =
      '<p class="text-center text-light-gray">Loading riders...</p>';
  }

  try {
    const params = new URLSearchParams();
    const search = riderSearchInput?.value?.trim();
    const status = riderStatusFilter?.value || "all";
    const source = riderSourceFilter?.value || "all";
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (source !== "all") params.set("source", source);

    const response = await fetch(
      `${BASE_URL}/api/admin/contacts/riders${params.toString() ? `?${params}` : ""}`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    const data = await response.json();

    if (handleAdminSessionExpiry(response.status)) return;

    if (!response.ok) {
      displayMessage(data.message || "Failed to load riders.", "error");
      riderOperationsList.innerHTML =
        '<p class="text-center text-red-500">Unable to load riders.</p>';
      return;
    }

    riderDirectory = data.contacts || [];
    renderRiderOperations();
  } catch (error) {
    displayMessage(`Network error: ${error.message}`, "error");
    if (riderOperationsList) {
      riderOperationsList.innerHTML =
        '<p class="text-center text-red-500">Connection failed.</p>';
    }
  }
}

function renderRiderOperations() {
  if (!riderOperationsList) return;

  updateRiderSummary();

  if (riderDirectoryMeta) {
    riderDirectoryMeta.textContent = `${riderDirectory.length} rider record${riderDirectory.length === 1 ? "" : "s"} loaded.`;
  }

  if (!riderDirectory.length) {
    riderOperationsList.innerHTML =
      '<p class="text-center text-light-gray">No riders found for this filter.</p>';
    return;
  }

  riderOperationsList.innerHTML = riderDirectory
    .map((rider) => {
      const status = rider.status || "none";
      return `
        <article class="card p-6 rider-card" data-rider-id="${escapeHtml(rider.id || "")}">
          <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div class="flex flex-wrap items-center gap-3 mb-3">
                <h3 class="text-2xl font-bold text-light-slate">${escapeHtml(rider.name || "Unnamed rider")}</h3>
                <span class="status-badge ${riderStatusClass(status)}">${formatStatusLabel(status)}</span>
                <span class="status-badge ${rider.source === "company" ? "status-delivered" : "status-pending"}">${escapeHtml(rider.source || "individual")}</span>
              </div>
              <p class="text-sm text-light-gray"><strong>Email:</strong> <span class="text-accent-cyan">${escapeHtml(rider.email || "No email")}</span></p>
              <p class="text-sm text-light-gray"><strong>Phone:</strong> ${escapeHtml(rider.phoneNumber || "No phone")}</p>
              <p class="text-sm text-light-gray"><strong>Plate:</strong> ${escapeHtml(rider.plateNumber || "N/A")} | <strong>Vehicle:</strong> ${escapeHtml(rider.vehicleType || "N/A")}</p>
              ${rider.companyName ? `<p class="text-sm text-light-gray"><strong>Company:</strong> ${escapeHtml(rider.companyName)}</p>` : ""}
              <p class="text-sm text-light-gray"><strong>Active:</strong> ${rider.isActive ? "Yes" : "No"} | <strong>Available:</strong> ${rider.isAvailable ? "Yes" : "No"} | <strong>Rating:</strong> ${formatNumber(rider.rating)}</p>
            </div>
            <div class="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
              ${metricBox("Wallet", formatCurrency(rider.walletBalance || 0))}
              ${metricBox("Earnings", formatCurrency(rider.totalEarnings || 0))}
              ${metricBox("Completed", formatNumber(rider.completedDeliveries || 0))}
              ${metricBox("Active Jobs", formatNumber(rider.activeDeliveries || 0))}
            </div>
          </div>
          <div class="flex flex-wrap justify-end gap-3 mt-6">
            ${riderStatusActions(rider)}
          </div>
        </article>
      `;
    })
    .join("");

  riderOperationsList.querySelectorAll(".rider-op-status-btn").forEach((button) => {
    button.addEventListener("click", () => {
      updateRiderOperationalStatus(
        button.dataset.riderId,
        button.dataset.source,
        button.dataset.status,
      );
    });
  });
}

function metricBox(label, value) {
  return `
    <div class="rounded-lg border border-cyan-300/20 bg-cyan-300/5 p-3">
      <p class="text-xs text-light-gray">${label}</p>
      <p class="font-bold text-light-slate">${escapeHtml(value)}</p>
    </div>
  `;
}

function riderStatusActions(rider) {
  if (rider.source === "company") {
    return [
      companyRiderStatusButton(rider, "active", "Activate"),
      companyRiderStatusButton(rider, "inactive", "Deactivate"),
      companyRiderStatusButton(rider, "suspended", "Suspend"),
      companyRiderStatusButton(rider, "pending_verification", "Pending"),
    ].join("");
  }

  return [
    individualRiderStatusButton(rider, "approved", "Approve"),
    individualRiderStatusButton(rider, "suspended", "Suspend"),
    individualRiderStatusButton(rider, "pending", "Move Pending"),
    individualRiderStatusButton(rider, "rejected", "Reject"),
  ].join("");
}

function individualRiderStatusButton(rider, status, label) {
  return riderButton(rider, status, label, rider.status);
}

function companyRiderStatusButton(rider, status, label) {
  return riderButton(rider, status, label, rider.status);
}

function riderButton(rider, status, label, currentStatus) {
  const disabled = status === currentStatus ? "btn-disabled" : "";
  const tone =
    status === "approved" || status === "active"
      ? "btn-success"
      : status === "rejected" || status === "suspended"
        ? "btn-danger"
        : "btn-primary-alt";

  return `<button class="btn ${tone} ${disabled} rider-op-status-btn px-4 py-2 text-sm" data-rider-id="${escapeHtml(rider.id || "")}" data-source="${escapeHtml(rider.source || "individual")}" data-status="${status}">${label}</button>`;
}

async function updateRiderOperationalStatus(riderId, source, status) {
  if (!riderId || !status) return;

  let reason = "";
  if (["rejected", "suspended"].includes(status)) {
    reason =
      window.prompt(
        `Reason for ${status}?`,
        status === "suspended"
          ? "Rider account suspended by admin."
          : "Photo was blurry or the documents are invalid. Please re-upload clear documents.",
      ) || "";
    if (!reason.trim()) return;
  }

  const endpoint =
    source === "company"
      ? `${BASE_URL}/api/admin/company-riders/${riderId}/status`
      : `${BASE_URL}/api/admin/riders/${riderId}/status`;

  try {
    const response = await fetch(endpoint, {
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
      displayMessage(data.message || `Rider status updated to ${status}.`, "success");
      fetchRiderOperations();
    } else {
      displayMessage(data.message || "Failed to update rider status.", "error");
    }
  } catch (error) {
    displayMessage(`Error: ${error.message}`, "error");
  }
}

function updateRiderSummary() {
  const activeCount = riderDirectory.filter((rider) =>
    ["approved", "active"].includes(String(rider.status).toLowerCase()),
  ).length;
  const completed = riderDirectory.reduce(
    (sum, rider) => sum + Number(rider.completedDeliveries || 0),
    0,
  );
  const earnings = riderDirectory.reduce(
    (sum, rider) => sum + Number(rider.totalEarnings || 0),
    0,
  );

  if (riderTotalCount) riderTotalCount.textContent = riderDirectory.length;
  if (riderActiveCount) riderActiveCount.textContent = activeCount;
  if (riderDeliveryCount) riderDeliveryCount.textContent = completed;
  if (riderEarningsTotal) riderEarningsTotal.textContent = formatCurrency(earnings);
}

function riderStatusClass(status = "") {
  const normalized = String(status).toLowerCase();
  if (["approved", "active"].includes(normalized)) return "status-approved";
  if (["rejected", "suspended"].includes(normalized)) return "status-rejected";
  if (["inactive", "pending_verification"].includes(normalized)) {
    return "status-suspended";
  }
  return "status-pending";
}

function exportRidersCsv() {
  if (!riderDirectory.length) {
    displayMessage("Load riders before exporting.", "warning");
    return;
  }

  const rows = [
    [
      "source",
      "name",
      "email",
      "phoneNumber",
      "status",
      "plateNumber",
      "vehicleType",
      "companyName",
      "isActive",
      "isAvailable",
      "walletBalance",
      "totalEarnings",
      "completedDeliveries",
      "activeDeliveries",
      "rating",
      "createdAt",
    ],
    ...riderDirectory.map((rider) => [
      rider.source || "",
      rider.name || "",
      rider.email || "",
      rider.phoneNumber || "",
      rider.status || "",
      rider.plateNumber || "",
      rider.vehicleType || "",
      rider.companyName || "",
      rider.isActive ? "yes" : "no",
      rider.isAvailable ? "yes" : "no",
      rider.walletBalance || 0,
      rider.totalEarnings || 0,
      rider.completedDeliveries || 0,
      rider.activeDeliveries || 0,
      rider.rating || 0,
      rider.createdAt || "",
    ]),
  ];

  const csv = rows.map((row) => row.map(riderCsvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `naijago-riders-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function riderCsvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function formatNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toLocaleString() : "0";
}

refreshRidersBtn?.addEventListener("click", fetchRiderOperations);
exportRidersCsvBtn?.addEventListener("click", exportRidersCsv);
riderStatusFilter?.addEventListener("change", fetchRiderOperations);
riderSourceFilter?.addEventListener("change", fetchRiderOperations);
riderSearchInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") fetchRiderOperations();
});
