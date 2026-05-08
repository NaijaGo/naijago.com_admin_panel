let pendingRiderRequests = [];

const riderRequestsList = document.getElementById("riderRequestsList");
const riderRequestsMeta = document.getElementById("riderRequestsMeta");
const refreshRiderRequestsBtn = document.getElementById(
  "refreshRiderRequestsBtn",
);

async function fetchPendingRiderRequests() {
  if (!adminToken) {
    if (riderRequestsList) {
      riderRequestsList.innerHTML =
        '<p class="text-center text-light-gray">Please login as admin to load rider requests.</p>';
    }
    return;
  }

  if (riderRequestsList) {
    riderRequestsList.innerHTML =
      '<p class="text-center text-light-gray">Loading rider requests...</p>';
  }

  try {
    const response = await fetch(`${BASE_URL}/api/admin/riders/pending`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await response.json();

    if (handleAdminSessionExpiry(response.status)) return;

    if (!response.ok) {
      displayMessage(data.message || "Failed to fetch rider requests.", "error");
      if (riderRequestsList) {
        riderRequestsList.innerHTML =
          '<p class="text-center text-red-500">Unable to load rider requests.</p>';
      }
      return;
    }

    pendingRiderRequests = data || [];
    renderPendingRiderRequests();
  } catch (error) {
    displayMessage(`Network error: ${error.message}`, "error");
    if (riderRequestsList) {
      riderRequestsList.innerHTML =
        '<p class="text-center text-red-500">Connection failed.</p>';
    }
  }
}

function renderPendingRiderRequests() {
  if (!riderRequestsList) return;

  if (riderRequestsMeta) {
    riderRequestsMeta.textContent = `${pendingRiderRequests.length} pending rider application${pendingRiderRequests.length === 1 ? "" : "s"}.`;
  }

  if (!pendingRiderRequests.length) {
    riderRequestsList.innerHTML =
      '<p class="text-center text-light-gray">No pending rider applications.</p>';
    return;
  }

  riderRequestsList.innerHTML = pendingRiderRequests
    .map((rider) => {
      const documents = rider.documents || {};
      return `
        <article class="card p-6 request-card" data-rider-id="${escapeHtml(rider._id || "")}">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div class="flex flex-wrap items-center gap-3 mb-3">
                <h3 class="text-2xl font-bold text-light-slate">${escapeHtml(rider.fullName || "Unnamed rider")}</h3>
                <span class="status-badge status-pending">${formatStatusLabel(rider.status || "pending")}</span>
              </div>
              <p class="text-sm text-light-gray"><strong>Email:</strong> <span class="text-accent-cyan">${escapeHtml(rider.email || "No email")}</span></p>
              <p class="text-sm text-light-gray"><strong>Phone:</strong> ${escapeHtml(rider.phoneNumber || "No phone")}</p>
              <p class="text-sm text-light-gray"><strong>Plate:</strong> ${escapeHtml(rider.plateNumber || "N/A")} | <strong>Vehicle:</strong> ${escapeHtml(rider.vehicleType || "N/A")}</p>
              <p class="text-sm text-light-gray"><strong>Email verified:</strong> ${rider.isEmailVerified ? "Yes" : "No"} | <strong>Registered:</strong> ${formatDateTime(rider.createdAt)}</p>
            </div>
            <div class="flex flex-wrap gap-2 lg:justify-end">
              ${documentLink("NIN Front", documents.ninFront)}
              ${documentLink("NIN Back", documents.ninBack)}
              ${documentLink("Plate", documents.platePhoto)}
              ${documentLink("Selfie", documents.selfie)}
            </div>
          </div>
          <div class="flex flex-wrap justify-end gap-3 mt-6">
            <button class="btn btn-success px-5 py-2 rider-status-btn" data-rider-id="${escapeHtml(rider._id || "")}" data-status="approved">Approve</button>
            <button class="btn btn-danger px-5 py-2 rider-status-btn" data-rider-id="${escapeHtml(rider._id || "")}" data-status="rejected">Reject</button>
          </div>
        </article>
      `;
    })
    .join("");

  riderRequestsList.querySelectorAll(".rider-status-btn").forEach((button) => {
    button.addEventListener("click", () => {
      updateRiderApprovalStatus(button.dataset.riderId, button.dataset.status);
    });
  });
}

function documentLink(label, url) {
  if (!url) {
    return `<span class="status-badge status-suspended">${escapeHtml(label)} missing</span>`;
  }

  const href = normalizeAssetUrl(url);
  return `<a class="btn btn-primary-alt px-3 py-2 text-xs" href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`;
}

function normalizeAssetUrl(url) {
  const value = String(url || "");
  if (!value) return "#";
  if (/^https?:\/\//i.test(value)) return value;
  return `${BASE_URL}${value.startsWith("/") ? "" : "/"}${value}`;
}

async function updateRiderApprovalStatus(riderId, status) {
  if (!riderId || !status) return;

  let reason = "";
  if (status === "rejected") {
    reason =
      window.prompt(
        "Why is this rider being rejected?",
        "Photo was blurry or the documents are invalid. Please re-upload clear documents.",
      ) || "";
    if (!reason.trim()) return;
  }

  try {
    const response = await fetch(
      `${BASE_URL}/api/admin/riders/${riderId}/status`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status, reason }),
      },
    );
    const data = await response.json();

    if (handleAdminSessionExpiry(response.status)) return;

    if (response.ok) {
      displayMessage(data.message || `Rider ${status}.`, "success");
      fetchPendingRiderRequests();
    } else {
      displayMessage(data.message || "Failed to update rider status.", "error");
    }
  } catch (error) {
    displayMessage(`Error: ${error.message}`, "error");
  }
}

refreshRiderRequestsBtn?.addEventListener("click", fetchPendingRiderRequests);
