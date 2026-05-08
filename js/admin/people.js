let activePeopleType = "customers";
let peopleContactsByType = {
  customers: [],
  vendors: [],
  riders: [],
};

const peopleLabels = {
  customers: "Customers",
  vendors: "Vendors",
  riders: "Riders",
};

const peopleSearchInput = document.getElementById("peopleSearchInput");
const peopleStatusFilter = document.getElementById("peopleStatusFilter");
const refreshPeopleBtn = document.getElementById("refreshPeopleBtn");
const exportPeopleCsvBtn = document.getElementById("exportPeopleCsvBtn");
const peopleDirectoryList = document.getElementById("peopleDirectoryList");
const peopleListTitle = document.getElementById("peopleListTitle");
const peopleListMeta = document.getElementById("peopleListMeta");

function peopleQueryParams(type) {
  const params = new URLSearchParams();
  const search = peopleSearchInput?.value?.trim();
  const status = peopleStatusFilter?.value || "all";

  if (search) params.set("search", search);
  if (type !== "customers" && status !== "all") {
    params.set("status", status);
  }

  return params.toString();
}

async function fetchPeopleDirectory(type = activePeopleType) {
  if (!adminToken) {
    if (peopleDirectoryList) {
      peopleDirectoryList.innerHTML =
        '<p class="text-center text-light-gray">Please login as admin to load contacts.</p>';
    }
    return;
  }

  activePeopleType = type;
  updatePeopleTypeButtons();

  if (peopleDirectoryList) {
    peopleDirectoryList.innerHTML =
      '<p class="text-center text-light-gray">Loading contacts...</p>';
  }

  try {
    const query = peopleQueryParams(type);
    const response = await fetch(
      `${BASE_URL}/api/admin/contacts/${type}${query ? `?${query}` : ""}`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    const data = await response.json();

    if (handleAdminSessionExpiry(response.status)) return;

    if (!response.ok) {
      displayMessage(data.message || "Failed to load contacts.", "error");
      if (peopleDirectoryList) {
        peopleDirectoryList.innerHTML =
          '<p class="text-center text-red-500">Unable to load contacts.</p>';
      }
      return;
    }

    peopleContactsByType[type] = data.contacts || [];
    updatePeopleCounts(type, data.count || peopleContactsByType[type].length);
    renderPeopleDirectory();
  } catch (error) {
    displayMessage(`Network error: ${error.message}`, "error");
    if (peopleDirectoryList) {
      peopleDirectoryList.innerHTML =
        '<p class="text-center text-red-500">Connection failed.</p>';
    }
  }
}

function renderPeopleDirectory() {
  if (!peopleDirectoryList) return;

  const contacts = peopleContactsByType[activePeopleType] || [];
  const label = peopleLabels[activePeopleType] || "Contacts";

  if (peopleListTitle) peopleListTitle.textContent = label;
  if (peopleListMeta) {
    peopleListMeta.textContent = `${contacts.length} ${label.toLowerCase()} loaded from backend.`;
  }

  if (!contacts.length) {
    peopleDirectoryList.innerHTML =
      '<p class="text-center text-light-gray">No contacts found for this list.</p>';
    return;
  }

  peopleDirectoryList.innerHTML = contacts
    .map((contact) => {
      const status = contact.status || "none";
      const extra = buildPeopleExtra(contact);

      return `
        <article class="card p-5">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div class="flex flex-wrap items-center gap-3 mb-2">
                <h3 class="text-xl font-bold text-light-slate">${escapeHtml(contact.name || "Unnamed contact")}</h3>
                <span class="status-badge ${statusClass(status)}">${formatStatusLabel(status)}</span>
              </div>
              <p class="text-sm text-light-gray"><strong>Email:</strong> <span class="text-accent-cyan">${escapeHtml(contact.email || "No email")}</span></p>
              <p class="text-sm text-light-gray"><strong>Phone:</strong> ${escapeHtml(contact.phoneNumber || "No phone")}</p>
              ${extra}
            </div>
            <div class="text-sm text-light-gray lg:text-right">
              <p><strong>Created:</strong> ${formatDateTime(contact.createdAt)}</p>
              <p><strong>Updated:</strong> ${formatDateTime(contact.updatedAt)}</p>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function buildPeopleExtra(contact) {
  if (activePeopleType === "vendors") {
    return `
      <p class="text-sm text-light-gray"><strong>Business:</strong> ${escapeHtml(contact.businessName || "N/A")}</p>
      <p class="text-sm text-light-gray"><strong>Categories:</strong> ${escapeHtml((contact.businessCategories || []).join(", ") || "N/A")}</p>
      <p class="text-sm text-light-gray"><strong>WhatsApp:</strong> ${escapeHtml(contact.businessWhatsAppNumber || "N/A")} | <strong>Support:</strong> ${escapeHtml(contact.businessSupportPhone || "N/A")}</p>
    `;
  }

  if (activePeopleType === "riders") {
    return `
      <p class="text-sm text-light-gray"><strong>Source:</strong> ${escapeHtml(contact.source || "individual")} ${contact.companyName ? `| <strong>Company:</strong> ${escapeHtml(contact.companyName)}` : ""}</p>
      <p class="text-sm text-light-gray"><strong>Plate:</strong> ${escapeHtml(contact.plateNumber || "N/A")} | <strong>Vehicle:</strong> ${escapeHtml(contact.vehicleType || "N/A")}</p>
      <p class="text-sm text-light-gray"><strong>Active:</strong> ${contact.isActive ? "Yes" : "No"} | <strong>Available:</strong> ${contact.isAvailable ? "Yes" : "No"}</p>
    `;
  }

  return "";
}

function statusClass(status = "") {
  const normalized = String(status).toLowerCase();
  if (["approved", "active", "user", "pharmacist"].includes(normalized)) {
    return "status-approved";
  }
  if (["rejected", "suspended"].includes(normalized)) {
    return "status-rejected";
  }
  if (["reviewing", "received"].includes(normalized)) {
    return "status-delivered";
  }
  return "status-pending";
}

function updatePeopleTypeButtons() {
  document.querySelectorAll(".people-type-btn").forEach((button) => {
    const isActive = button.dataset.type === activePeopleType;
    button.classList.toggle("btn-primary", isActive);
    button.classList.toggle("btn-primary-alt", !isActive);
  });

  if (peopleStatusFilter) {
    peopleStatusFilter.disabled = activePeopleType === "customers";
  }
}

function updatePeopleCounts(type, count) {
  const target = document.getElementById(
    `people${type.charAt(0).toUpperCase()}${type.slice(1)}Count`,
  );
  if (target) target.textContent = count;
}

function exportActivePeopleCsv() {
  const contacts = peopleContactsByType[activePeopleType] || [];
  if (!contacts.length) {
    displayMessage("Load contacts before exporting.", "warning");
    return;
  }

  const rows = [
    [
      "type",
      "source",
      "name",
      "email",
      "phoneNumber",
      "status",
      "businessName",
      "businessWhatsAppNumber",
      "businessSupportPhone",
      "plateNumber",
      "vehicleType",
      "companyName",
      "createdAt",
    ],
    ...contacts.map((contact) => [
      activePeopleType,
      contact.source || "",
      contact.name || "",
      contact.email || "",
      contact.phoneNumber || "",
      contact.status || "",
      contact.businessName || "",
      contact.businessWhatsAppNumber || "",
      contact.businessSupportPhone || "",
      contact.plateNumber || "",
      contact.vehicleType || "",
      contact.companyName || "",
      contact.createdAt || "",
    ]),
  ];

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `naijago-${activePeopleType}-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

document.querySelectorAll(".people-type-btn").forEach((button) => {
  button.addEventListener("click", () => {
    fetchPeopleDirectory(button.dataset.type || "customers");
  });
});

refreshPeopleBtn?.addEventListener("click", () =>
  fetchPeopleDirectory(activePeopleType),
);
exportPeopleCsvBtn?.addEventListener("click", exportActivePeopleCsv);
peopleSearchInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") fetchPeopleDirectory(activePeopleType);
});
peopleStatusFilter?.addEventListener("change", () =>
  fetchPeopleDirectory(activePeopleType),
);
