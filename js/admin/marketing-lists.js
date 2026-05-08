let marketingListsPageItems = [];
let selectedMarketingList = null;

const marketingListsMeta = document.getElementById("marketingListsMeta");
const marketingListsPageList = document.getElementById("marketingListsPageList");
const marketingListDetailTitle = document.getElementById("marketingListDetailTitle");
const marketingListDetailMeta = document.getElementById("marketingListDetailMeta");
const marketingListContacts = document.getElementById("marketingListContacts");
const refreshMarketingListsPageBtn = document.getElementById("refreshMarketingListsPageBtn");
const exportSelectedMarketingListBtn = document.getElementById("exportSelectedMarketingListBtn");
const deleteSelectedMarketingListBtn = document.getElementById("deleteSelectedMarketingListBtn");
const sendSelectedMarketingCampaignBtn = document.getElementById("sendSelectedMarketingCampaignBtn");
const campaignTitle = document.getElementById("campaignTitle");
const campaignMessage = document.getElementById("campaignMessage");
const pageCampaignEmail = document.getElementById("pageCampaignEmail");
const pageCampaignWhatsapp = document.getElementById("pageCampaignWhatsapp");
const marketingListCampaignResult = document.getElementById("marketingListCampaignResult");

async function fetchMarketingListsPage() {
  if (!adminToken || !marketingListsPageList) return;

  marketingListsPageList.innerHTML =
    '<p class="text-center text-light-gray">Loading marketing lists...</p>';

  try {
    const response = await fetch(`${BASE_URL}/api/admin/marketing-lists`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await response.json();

    if (handleAdminSessionExpiry(response.status)) return;

    if (!response.ok) {
      displayMessage(data.message || "Failed to load marketing lists.", "error");
      marketingListsPageList.innerHTML =
        '<p class="text-center text-red-500">Unable to load marketing lists.</p>';
      return;
    }

    marketingListsPageItems = data.lists || [];
    if (marketingListsMeta) {
      marketingListsMeta.textContent = `${marketingListsPageItems.length} imported list${marketingListsPageItems.length === 1 ? "" : "s"}.`;
    }
    renderMarketingListsPage();
  } catch (error) {
    displayMessage(`Network error: ${error.message}`, "error");
    marketingListsPageList.innerHTML =
      '<p class="text-center text-red-500">Connection failed.</p>';
  }
}

function renderMarketingListsPage() {
  if (!marketingListsPageList) return;

  if (!marketingListsPageItems.length) {
    marketingListsPageList.innerHTML =
      '<p class="text-center text-light-gray">No marketing lists imported yet.</p>';
    return;
  }

  marketingListsPageList.innerHTML = marketingListsPageItems
    .map((list) => {
      const count = Number(list.contactCount || list.contacts?.length || 0);
      return `
        <article class="rounded-lg border border-cyan-300/20 bg-cyan-300/5 p-4">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 class="text-lg font-bold text-light-slate">${escapeHtml(list.name || "Untitled list")}</h3>
              <p class="text-sm text-light-gray">${count.toLocaleString()} contacts • ${escapeHtml(list.audience || "mixed")}</p>
              <p class="text-xs text-light-gray mt-1">Imported ${formatDateTime(list.createdAt)}</p>
            </div>
            <button class="btn btn-primary px-4 py-2 select-marketing-list-btn" data-id="${escapeHtml(list._id || "")}">
              View
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  marketingListsPageList.querySelectorAll(".select-marketing-list-btn").forEach((button) => {
    button.addEventListener("click", () => loadMarketingListDetail(button.dataset.id));
  });
}

async function loadMarketingListDetail(id) {
  if (!id) return;

  if (marketingListContacts) {
    marketingListContacts.innerHTML =
      '<p class="text-center text-light-gray">Loading contacts...</p>';
  }

  try {
    const response = await fetch(`${BASE_URL}/api/admin/marketing-lists/${id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await response.json();

    if (handleAdminSessionExpiry(response.status)) return;

    if (!response.ok) {
      displayMessage(data.message || "Failed to load list.", "error");
      return;
    }

    selectedMarketingList = data.list;
    renderMarketingListDetail();
  } catch (error) {
    displayMessage(`Network error: ${error.message}`, "error");
  }
}

function renderMarketingListDetail() {
  if (!selectedMarketingList) return;

  const contacts = selectedMarketingList.contacts || [];
  if (marketingListDetailTitle) {
    marketingListDetailTitle.textContent = selectedMarketingList.name || "List Details";
  }
  if (marketingListDetailMeta) {
    marketingListDetailMeta.textContent =
      `${contacts.length.toLocaleString()} contacts • ${selectedMarketingList.audience || "mixed"} • imported ${formatDateTime(selectedMarketingList.createdAt)}`;
  }

  if (!contacts.length) {
    marketingListContacts.innerHTML =
      '<p class="text-center text-light-gray">This list has no contacts.</p>';
    return;
  }

  marketingListContacts.innerHTML = contacts
    .slice(0, 300)
    .map((contact) => `
      <article class="rounded-lg border border-cyan-300/20 bg-cyan-300/5 p-4">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 class="font-bold text-light-slate">${escapeHtml(contact.name || "Unnamed contact")}</h3>
            <p class="text-sm text-light-gray">${escapeHtml(contact.email || "No email")}</p>
            <p class="text-sm text-light-gray">${escapeHtml(contact.phoneNumber || "No phone")}</p>
          </div>
          <span class="status-badge status-pending">${escapeHtml(contact.type || "other")}</span>
        </div>
      </article>
    `)
    .join("");

  if (contacts.length > 300) {
    marketingListContacts.insertAdjacentHTML(
      "beforeend",
      `<p class="text-center text-light-gray">Showing first 300 of ${contacts.length.toLocaleString()} contacts. Export CSV for the full list.</p>`,
    );
  }
}

function exportSelectedMarketingList() {
  if (!selectedMarketingList) {
    displayMessage("Choose a marketing list first.", "warning");
    return;
  }

  const rows = [
    ["name", "email", "phoneNumber", "type", "source"],
    ...(selectedMarketingList.contacts || []).map((contact) => [
      contact.name || "",
      contact.email || "",
      contact.phoneNumber || "",
      contact.type || "",
      contact.source || "",
    ]),
  ];

  downloadCsv(
    rows,
    `naijago-marketing-list-${(selectedMarketingList.name || "contacts").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`,
  );
}

async function deleteSelectedMarketingList() {
  if (!selectedMarketingList) {
    displayMessage("Choose a marketing list first.", "warning");
    return;
  }

  if (!window.confirm(`Delete "${selectedMarketingList.name}"? This cannot be undone.`)) {
    return;
  }

  try {
    const response = await fetch(
      `${BASE_URL}/api/admin/marketing-lists/${selectedMarketingList._id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    const data = await response.json();

    if (handleAdminSessionExpiry(response.status)) return;

    if (!response.ok) {
      displayMessage(data.message || "Failed to delete list.", "error");
      return;
    }

    displayMessage(data.message || "Marketing list deleted.", "success");
    selectedMarketingList = null;
    if (marketingListDetailTitle) marketingListDetailTitle.textContent = "List Details";
    if (marketingListDetailMeta) marketingListDetailMeta.textContent = "Choose a list to view contacts.";
    if (marketingListContacts) {
      marketingListContacts.innerHTML =
        '<p class="text-center text-light-gray">No list selected.</p>';
    }
    fetchMarketingListsPage();
  } catch (error) {
    displayMessage(`Network error: ${error.message}`, "error");
  }
}

async function sendSelectedMarketingCampaign() {
  if (!selectedMarketingList) {
    displayMessage("Choose a marketing list first.", "warning");
    return;
  }

  const title = campaignTitle?.value?.trim() || "";
  const message = campaignMessage?.value?.trim() || "";
  const channels = [];
  if (pageCampaignEmail?.checked) channels.push("email");
  if (pageCampaignWhatsapp?.checked) channels.push("whatsapp");

  if (!title || !message) {
    displayMessage("Campaign title and message are required.", "warning");
    return;
  }
  if (!channels.length) {
    displayMessage("Choose email, WhatsApp, or both.", "warning");
    return;
  }

  const count = Number(selectedMarketingList.contactCount || selectedMarketingList.contacts?.length || 0);
  if (!window.confirm(`Send to ${count.toLocaleString()} contacts via ${channels.join(" + ")}?`)) {
    return;
  }

  sendSelectedMarketingCampaignBtn.disabled = true;
  sendSelectedMarketingCampaignBtn.textContent = "Sending...";
  renderCampaignResult("Campaign is sending. Keep this page open.", null);

  try {
    const response = await fetch(`${BASE_URL}/api/admin/marketing-campaigns/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        listId: selectedMarketingList._id,
        title,
        message,
        channels,
      }),
    });
    const data = await response.json();

    if (handleAdminSessionExpiry(response.status)) return;

    if (!response.ok) {
      displayMessage(data.message || "Campaign failed.", "error");
      renderCampaignResult(data.message || "Campaign failed.", false);
      return;
    }

    displayMessage(data.message || "Campaign processed.", "success");
    renderCampaignResult(data.campaign, true);
  } catch (error) {
    displayMessage(`Network error: ${error.message}`, "error");
    renderCampaignResult(error.message, false);
  } finally {
    sendSelectedMarketingCampaignBtn.disabled = false;
    sendSelectedMarketingCampaignBtn.textContent = "Send Campaign";
  }
}

function renderCampaignResult(result, success) {
  if (!marketingListCampaignResult) return;
  if (typeof result === "string") {
    marketingListCampaignResult.innerHTML =
      `<div class="message ${success === false ? "error" : "success"}">${escapeHtml(result)}</div>`;
    return;
  }

  const email = result?.results?.email || {};
  const whatsapp = result?.results?.whatsapp || {};
  marketingListCampaignResult.innerHTML = `
    <div class="message ${success ? "success" : "error"}">Campaign processed.</div>
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-4">
      ${metric("Email sent", email.sent || 0)}
      ${metric("Email skipped/failed", Number(email.skipped || 0) + Number(email.failed || 0))}
      ${metric("WhatsApp sent", whatsapp.sent || 0)}
      ${metric("WhatsApp skipped/failed", Number(whatsapp.skipped || 0) + Number(whatsapp.failed || 0))}
    </div>
  `;
}

function metric(label, value) {
  return `
    <div class="rounded-lg border border-cyan-300/20 bg-cyan-300/5 p-3">
      <p class="text-xs text-light-gray">${label}</p>
      <p class="font-bold text-light-slate">${Number(value || 0).toLocaleString()}</p>
    </div>
  `;
}

function downloadCsv(rows, filename) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

refreshMarketingListsPageBtn?.addEventListener("click", fetchMarketingListsPage);
exportSelectedMarketingListBtn?.addEventListener("click", exportSelectedMarketingList);
deleteSelectedMarketingListBtn?.addEventListener("click", deleteSelectedMarketingList);
sendSelectedMarketingCampaignBtn?.addEventListener("click", sendSelectedMarketingCampaign);

fetchMarketingListsPage();
