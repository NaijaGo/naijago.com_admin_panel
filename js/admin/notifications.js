const adminNotificationForm = document.getElementById("adminNotificationForm");
const notificationSegment = document.getElementById("notificationSegment");
const notificationTitle = document.getElementById("notificationTitle");
const notificationMessage = document.getElementById("notificationMessage");
const notificationRecipientIds = document.getElementById(
  "notificationRecipientIds",
);
const notificationScheduledFor = document.getElementById(
  "notificationScheduledFor",
);
const notificationPreviewBox = document.getElementById("notificationPreviewBox");
const notificationSendResult = document.getElementById("notificationSendResult");
const previewAdminNotificationBtn = document.getElementById(
  "previewAdminNotificationBtn",
);
const sendAdminNotificationBtn = document.getElementById(
  "sendAdminNotificationBtn",
);
const scheduleAdminNotificationBtn = document.getElementById(
  "scheduleAdminNotificationBtn",
);
const saveNotificationTemplateBtn = document.getElementById(
  "saveNotificationTemplateBtn",
);
const notificationTemplateName = document.getElementById(
  "notificationTemplateName",
);
const notificationTemplateCategory = document.getElementById(
  "notificationTemplateCategory",
);
const notificationTemplateSearch = document.getElementById(
  "notificationTemplateSearch",
);
const notificationTemplateCategoryFilter = document.getElementById(
  "notificationTemplateCategoryFilter",
);
const notificationTemplatesMeta = document.getElementById(
  "notificationTemplatesMeta",
);
const notificationTemplatesList = document.getElementById(
  "notificationTemplatesList",
);
const refreshNotificationTemplatesBtn = document.getElementById(
  "refreshNotificationTemplatesBtn",
);
const notificationHistoryList = document.getElementById(
  "notificationHistoryList",
);
const notificationHistoryMeta = document.getElementById(
  "notificationHistoryMeta",
);
const refreshNotificationHistoryBtn = document.getElementById(
  "refreshNotificationHistoryBtn",
);
const notificationStatsMeta = document.getElementById("notificationStatsMeta");
const notificationStatsCards = document.getElementById("notificationStatsCards");
const refreshNotificationStatsBtn = document.getElementById(
  "refreshNotificationStatsBtn",
);
const exportNotificationSegmentBtn = document.getElementById(
  "exportNotificationSegmentBtn",
);
const marketingListName = document.getElementById("marketingListName");
const marketingListAudience = document.getElementById("marketingListAudience");
const marketingListFile = document.getElementById("marketingListFile");
const marketingListCsv = document.getElementById("marketingListCsv");
const importMarketingListBtn = document.getElementById("importMarketingListBtn");
const marketingListResult = document.getElementById("marketingListResult");
const campaignMarketingList = document.getElementById("campaignMarketingList");
const campaignEmailChannel = document.getElementById("campaignEmailChannel");
const campaignWhatsappChannel = document.getElementById(
  "campaignWhatsappChannel",
);
const refreshMarketingListsBtn = document.getElementById(
  "refreshMarketingListsBtn",
);
const sendMarketingCampaignBtn = document.getElementById(
  "sendMarketingCampaignBtn",
);
const marketingCampaignResult = document.getElementById(
  "marketingCampaignResult",
);
const scheduledNotificationsList = document.getElementById(
  "scheduledNotificationsList",
);
const scheduledNotificationsMeta = document.getElementById(
  "scheduledNotificationsMeta",
);
const refreshScheduledNotificationsBtn = document.getElementById(
  "refreshScheduledNotificationsBtn",
);
let notificationTemplates = [];
let marketingLists = [];

async function sendAdminNotification(event) {
  event?.preventDefault();
  await submitAdminNotification("send");
}

async function scheduleAdminNotification() {
  await submitAdminNotification("schedule");
}

async function submitAdminNotification(mode) {
  if (!adminToken) {
    displayMessage("Please login as admin to send notifications.", "warning");
    return;
  }

  const segment = notificationSegment?.value || "all_customers";
  const title = notificationTitle?.value?.trim() || "";
  const message = notificationMessage?.value?.trim() || "";
  const recipientIds = parseRecipientIds(notificationRecipientIds?.value || "");
  const scheduledFor = notificationScheduledFor?.value || "";

  if (!title || !message) {
    displayMessage("Title and message are required.", "warning");
    return;
  }

  if (mode === "schedule" && !scheduledFor) {
    displayMessage("Choose a schedule date and time.", "warning");
    return;
  }

  setNotificationButtonsDisabled(true, mode);

  try {
    const preview = await getRecipientPreview(segment, recipientIds);
    renderNotificationPreview(preview);
    const previewResults = preview.results || {};
    const confirmed = window.confirm(
      `This will ${mode === "schedule" ? "schedule" : "send"} to ${previewResults.customers || 0} customers / ${previewResults.vendors || 0} vendors / ${previewResults.riders || 0} riders. Continue?`,
    );

    if (!confirmed) return;

    const endpoint =
      mode === "schedule"
        ? `${BASE_URL}/api/admin/notifications/schedule`
        : `${BASE_URL}/api/admin/notifications/send`;
    const body = {
      segment,
      title,
      message,
      type: "admin_message",
      recipientIds,
    };
    if (mode === "schedule") {
      body.scheduledFor = new Date(scheduledFor).toISOString();
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();

    if (handleAdminSessionExpiry(response.status)) return;

    if (!response.ok) {
      displayMessage(data.message || "Failed to send notification.", "error");
      renderNotificationResult(data, false);
      return;
    }

    displayMessage(
      data.message || (mode === "schedule" ? "Notification scheduled." : "Notification sent."),
      "success",
    );
    renderNotificationResult(data, true);
    adminNotificationForm?.reset();
    renderNotificationPreview(null);
    fetchNotificationHistory();
    fetchScheduledNotifications();
    fetchNotificationStats();
  } catch (error) {
    displayMessage(`Network error: ${error.message}`, "error");
    renderNotificationResult({ message: error.message }, false);
  } finally {
    setNotificationButtonsDisabled(false);
  }
}

async function previewAdminNotification() {
  if (!adminToken) {
    displayMessage("Please login as admin to preview recipients.", "warning");
    return;
  }

  const segment = notificationSegment?.value || "all_customers";
  const recipientIds = parseRecipientIds(notificationRecipientIds?.value || "");

  if (previewAdminNotificationBtn) {
    previewAdminNotificationBtn.disabled = true;
    previewAdminNotificationBtn.textContent = "Previewing...";
  }

  try {
    const data = await getRecipientPreview(segment, recipientIds);
    renderNotificationPreview(data);
  } catch (error) {
    displayMessage(`Network error: ${error.message}`, "error");
  } finally {
    if (previewAdminNotificationBtn) {
      previewAdminNotificationBtn.disabled = false;
      previewAdminNotificationBtn.textContent = "Preview Recipients";
    }
  }
}

async function getRecipientPreview(segment, recipientIds) {
  const response = await fetch(`${BASE_URL}/api/admin/notifications/preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ segment, recipientIds }),
    });
  const data = await response.json();

  if (handleAdminSessionExpiry(response.status)) {
    throw new Error("Admin session expired.");
  }

  if (!response.ok) {
    throw new Error(data.message || "Failed to preview recipients.");
  }

  return data;
}

function setNotificationButtonsDisabled(disabled, mode = "") {
  if (sendAdminNotificationBtn) {
    sendAdminNotificationBtn.disabled = disabled;
    sendAdminNotificationBtn.textContent =
      disabled && mode === "send" ? "Sending..." : "Send Now";
  }
  if (scheduleAdminNotificationBtn) {
    scheduleAdminNotificationBtn.disabled = disabled;
    scheduleAdminNotificationBtn.textContent =
      disabled && mode === "schedule" ? "Scheduling..." : "Schedule";
  }
  if (previewAdminNotificationBtn) previewAdminNotificationBtn.disabled = disabled;
}

function parseRecipientIds(value) {
  return String(value || "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderNotificationResult(data, success) {
  if (!notificationSendResult) return;

  const results = data.results || data.preview || {};
  notificationSendResult.innerHTML = `
    <div class="message ${success ? "success" : "error"}">
      ${escapeHtml(data.message || (success ? "Sent" : "Failed"))}
    </div>
    <div class="grid gap-3 sm:grid-cols-2">
      ${resultCard("Customers", results.customers || 0)}
      ${resultCard("Vendors", results.vendors || 0)}
      ${resultCard("Riders", results.riders || 0)}
      ${resultCard("Total", data.total || 0)}
    </div>
  `;
}

function renderNotificationPreview(data) {
  if (!notificationPreviewBox) return;

  if (!data) {
    notificationPreviewBox.innerHTML =
      '<p class="text-light-gray">Preview the audience before sending.</p>';
    return;
  }

  const results = data.results || {};
  notificationPreviewBox.innerHTML = `
    <p class="font-bold text-light-slate mb-3">
      ${escapeHtml(data.message || "Recipient preview ready.")}
    </p>
    <div class="grid gap-3 sm:grid-cols-4">
      ${resultCard("Customers", results.customers || 0)}
      ${resultCard("Vendors", results.vendors || 0)}
      ${resultCard("Riders", results.riders || 0)}
      ${resultCard("Total", data.total || results.total || 0)}
    </div>
  `;
}

function resultCard(label, value) {
  return `
    <div class="rounded-lg border border-cyan-300/20 bg-cyan-300/5 p-4">
      <p class="text-sm text-light-gray">${label}</p>
      <p class="text-2xl font-bold text-light-slate">${Number(value || 0).toLocaleString()}</p>
    </div>
  `;
}

adminNotificationForm?.addEventListener("submit", sendAdminNotification);
previewAdminNotificationBtn?.addEventListener("click", previewAdminNotification);
scheduleAdminNotificationBtn?.addEventListener("click", scheduleAdminNotification);
saveNotificationTemplateBtn?.addEventListener("click", saveNotificationTemplate);
refreshNotificationTemplatesBtn?.addEventListener("click", fetchNotificationTemplates);
notificationTemplateCategoryFilter?.addEventListener("change", fetchNotificationTemplates);
notificationTemplateSearch?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") fetchNotificationTemplates();
});
refreshNotificationHistoryBtn?.addEventListener("click", fetchNotificationHistory);
refreshNotificationStatsBtn?.addEventListener("click", fetchNotificationStats);
refreshScheduledNotificationsBtn?.addEventListener("click", fetchScheduledNotifications);
exportNotificationSegmentBtn?.addEventListener("click", exportNotificationSegmentCsv);
importMarketingListBtn?.addEventListener("click", importMarketingList);
refreshMarketingListsBtn?.addEventListener("click", fetchMarketingLists);
sendMarketingCampaignBtn?.addEventListener("click", sendMarketingCampaign);
notificationSegment?.addEventListener("change", () => renderNotificationPreview(null));
notificationRecipientIds?.addEventListener("input", () => renderNotificationPreview(null));
marketingListFile?.addEventListener("change", loadMarketingCsvFile);

async function fetchNotificationStats() {
  if (!adminToken || !notificationStatsCards) return;

  notificationStatsCards.innerHTML =
    '<p class="text-light-gray">Loading stats...</p>';

  try {
    const response = await fetch(`${BASE_URL}/api/admin/notification-stats?days=30`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await response.json();

    if (handleAdminSessionExpiry(response.status)) return;

    if (!response.ok) {
      displayMessage(data.message || "Failed to load notification stats.", "error");
      notificationStatsCards.innerHTML =
        '<p class="text-red-500">Unable to load stats.</p>';
      return;
    }

    renderNotificationStats(data);
  } catch (error) {
    displayMessage(`Network error: ${error.message}`, "error");
    notificationStatsCards.innerHTML =
      '<p class="text-red-500">Connection failed.</p>';
  }
}

function renderNotificationStats(data) {
  const delivery = data.delivery || {};
  const scheduled = data.scheduled || {};
  const readStats = data.readStats || {};
  const opened =
    Number(readStats.customers?.read || 0) +
    Number(readStats.vendors?.read || 0) +
    Number(readStats.riders?.read || 0);

  if (notificationStatsMeta) {
    notificationStatsMeta.textContent = `Last ${data.days || 30} days. Includes app, push, WhatsApp, email, scheduled, cancelled, and read stats.`;
  }

  notificationStatsCards.innerHTML = [
    resultCard("Sent", delivery.sent || 0),
    resultCard("Opened / Read", opened),
    resultCard("Failed", delivery.failed || 0),
    resultCard("Scheduled", scheduled.scheduled || 0),
    resultCard("Cancelled", scheduled.cancelled || 0),
  ].join("");
}

async function fetchNotificationTemplates() {
  if (!adminToken || !notificationTemplatesList) return;

  notificationTemplatesList.innerHTML =
    '<p class="text-center text-light-gray lg:col-span-2">Loading templates...</p>';

  try {
    const params = new URLSearchParams();
    const category = notificationTemplateCategoryFilter?.value || "all";
    const search = notificationTemplateSearch?.value?.trim() || "";
    if (category !== "all") params.set("category", category);
    if (search) params.set("search", search);

    const response = await fetch(
      `${BASE_URL}/api/admin/notifications/templates${params.toString() ? `?${params}` : ""}`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    const data = await response.json();

    if (handleAdminSessionExpiry(response.status)) return;

    if (!response.ok) {
      displayMessage(data.message || "Failed to load templates.", "error");
      notificationTemplatesList.innerHTML =
        '<p class="text-center text-red-500 lg:col-span-2">Unable to load templates.</p>';
      return;
    }

    notificationTemplates = data.templates || [];
    if (notificationTemplatesMeta) {
      notificationTemplatesMeta.textContent = `${notificationTemplates.length} reusable template${notificationTemplates.length === 1 ? "" : "s"} loaded.`;
    }
    renderNotificationTemplates();
  } catch (error) {
    displayMessage(`Network error: ${error.message}`, "error");
    notificationTemplatesList.innerHTML =
      '<p class="text-center text-red-500 lg:col-span-2">Connection failed.</p>';
  }
}

function renderNotificationTemplates() {
  if (!notificationTemplatesList) return;

  if (!notificationTemplates.length) {
    notificationTemplatesList.innerHTML =
      '<p class="text-center text-light-gray lg:col-span-2">No templates found yet.</p>';
    return;
  }

  notificationTemplatesList.innerHTML = notificationTemplates
    .map((template) => `
      <article class="card p-5">
        <div class="flex flex-col gap-3 h-full">
          <div class="flex flex-wrap items-center gap-3">
            <h3 class="text-xl font-bold text-light-slate">${escapeHtml(template.name || "Untitled template")}</h3>
            <span class="status-badge status-approved">${escapeHtml(templateCategoryLabel(template.category))}</span>
            <span class="status-badge status-pending">${escapeHtml(template.segment || "segment")}</span>
          </div>
          <div>
            <p class="font-bold text-light-slate">${escapeHtml(template.title || "")}</p>
            <p class="text-sm text-light-gray mt-1">${escapeHtml(template.message || "")}</p>
          </div>
          <p class="text-xs text-light-gray">
            Updated ${formatDateTime(template.updatedAt)}
            ${template.lastUsedAt ? ` • Used ${formatDateTime(template.lastUsedAt)}` : ""}
          </p>
          <div class="flex flex-wrap gap-3 mt-auto">
            <button class="btn btn-primary px-4 py-2 text-sm load-template-btn" data-id="${escapeHtml(template._id || "")}">
              Use
            </button>
            <button class="btn btn-primary-alt px-4 py-2 text-sm update-template-btn" data-id="${escapeHtml(template._id || "")}">
              Update From Compose
            </button>
            <button class="btn btn-danger px-4 py-2 text-sm delete-template-btn" data-id="${escapeHtml(template._id || "")}">
              Delete
            </button>
          </div>
        </div>
      </article>
    `)
    .join("");

  notificationTemplatesList.querySelectorAll(".load-template-btn").forEach((button) => {
    button.addEventListener("click", () => loadNotificationTemplate(button.dataset.id));
  });
  notificationTemplatesList.querySelectorAll(".update-template-btn").forEach((button) => {
    button.addEventListener("click", () => updateNotificationTemplate(button.dataset.id));
  });
  notificationTemplatesList.querySelectorAll(".delete-template-btn").forEach((button) => {
    button.addEventListener("click", () => deleteNotificationTemplate(button.dataset.id));
  });
}

async function saveNotificationTemplate() {
  if (!adminToken) {
    displayMessage("Please login as admin to save templates.", "warning");
    return;
  }

  const payload = notificationTemplatePayload();
  if (!payload) return;

  if (saveNotificationTemplateBtn) {
    saveNotificationTemplateBtn.disabled = true;
    saveNotificationTemplateBtn.textContent = "Saving...";
  }

  try {
    const response = await fetch(`${BASE_URL}/api/admin/notifications/templates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (handleAdminSessionExpiry(response.status)) return;

    if (!response.ok) {
      displayMessage(data.message || "Failed to save template.", "error");
      return;
    }

    displayMessage(data.message || "Template saved.", "success");
    if (notificationTemplateName) notificationTemplateName.value = "";
    fetchNotificationTemplates();
  } catch (error) {
    displayMessage(`Network error: ${error.message}`, "error");
  } finally {
    if (saveNotificationTemplateBtn) {
      saveNotificationTemplateBtn.disabled = false;
      saveNotificationTemplateBtn.textContent = "Save Template";
    }
  }
}

async function updateNotificationTemplate(id) {
  if (!id) return;
  const template = notificationTemplates.find((item) => item._id === id);
  if (!template) return;

  const payload = notificationTemplatePayload(template.name, template.category);
  if (!payload) return;

  if (!window.confirm(`Update "${template.name}" from the current compose fields?`)) {
    return;
  }

  try {
    const response = await fetch(`${BASE_URL}/api/admin/notifications/templates/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (handleAdminSessionExpiry(response.status)) return;

    if (!response.ok) {
      displayMessage(data.message || "Failed to update template.", "error");
      return;
    }

    displayMessage(data.message || "Template updated.", "success");
    fetchNotificationTemplates();
  } catch (error) {
    displayMessage(`Network error: ${error.message}`, "error");
  }
}

async function deleteNotificationTemplate(id) {
  if (!id) return;
  const template = notificationTemplates.find((item) => item._id === id);
  if (!window.confirm(`Delete "${template?.name || "this template"}"?`)) return;

  try {
    const response = await fetch(`${BASE_URL}/api/admin/notifications/templates/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await response.json();

    if (handleAdminSessionExpiry(response.status)) return;

    if (!response.ok) {
      displayMessage(data.message || "Failed to delete template.", "error");
      return;
    }

    displayMessage(data.message || "Template deleted.", "success");
    fetchNotificationTemplates();
  } catch (error) {
    displayMessage(`Network error: ${error.message}`, "error");
  }
}

async function loadNotificationTemplate(id) {
  const template = notificationTemplates.find((item) => item._id === id);
  if (!template) return;

  if (notificationSegment) notificationSegment.value = template.segment || "all_customers";
  if (notificationTitle) notificationTitle.value = template.title || "";
  if (notificationMessage) notificationMessage.value = template.message || "";
  if (notificationTemplateName) notificationTemplateName.value = template.name || "";
  if (notificationTemplateCategory) {
    notificationTemplateCategory.value = template.category || "general";
  }
  renderNotificationPreview(null);
  displayMessage(`Loaded template: ${template.name || "Untitled"}`, "success");

  try {
    await fetch(`${BASE_URL}/api/admin/notifications/templates/${id}/use`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    fetchNotificationTemplates();
  } catch (_) {
    // Usage tracking should not block composing.
  }
}

function notificationTemplatePayload(fallbackName = "", fallbackCategory = "") {
  const name = notificationTemplateName?.value?.trim() || fallbackName;
  const category =
    notificationTemplateCategory?.value || fallbackCategory || "general";
  const segment = notificationSegment?.value || "all_customers";
  const title = notificationTitle?.value?.trim() || "";
  const message = notificationMessage?.value?.trim() || "";

  if (!name || !title || !message) {
    displayMessage("Template name, title, and message are required.", "warning");
    return null;
  }

  return {
    name,
    category,
    segment,
    title,
    message,
    type: "admin_message",
  };
}

function templateCategoryLabel(category = "general") {
  return String(category)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function fetchNotificationHistory() {
  if (!adminToken || !notificationHistoryList) return;

  notificationHistoryList.innerHTML =
    '<p class="text-center text-light-gray">Loading notification history...</p>';

  try {
    const response = await fetch(
      `${BASE_URL}/api/admin/notification-logs?limit=50`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    const data = await response.json();

    if (handleAdminSessionExpiry(response.status)) return;

    if (!response.ok) {
      displayMessage(data.message || "Failed to load notification history.", "error");
      notificationHistoryList.innerHTML =
        '<p class="text-center text-red-500">Unable to load history.</p>';
      return;
    }

    const logs = data.logs || [];
    if (notificationHistoryMeta) {
      notificationHistoryMeta.textContent = `${logs.length} sent notification audit record${logs.length === 1 ? "" : "s"}.`;
    }
    renderNotificationHistory(logs);
  } catch (error) {
    displayMessage(`Network error: ${error.message}`, "error");
    notificationHistoryList.innerHTML =
      '<p class="text-center text-red-500">Connection failed.</p>';
  }
}

function renderNotificationHistory(logs) {
  if (!notificationHistoryList) return;

  if (!logs.length) {
    notificationHistoryList.innerHTML =
      '<p class="text-center text-light-gray">No notification history yet.</p>';
    return;
  }

  notificationHistoryList.innerHTML = logs
    .map((log) => {
      const response = log.providerResponse || {};
      return `
        <article class="card p-5">
          <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div class="flex flex-wrap items-center gap-3 mb-2">
                <h3 class="text-xl font-bold text-light-slate">${escapeHtml(log.title || "Untitled")}</h3>
                <span class="status-badge status-approved">${escapeHtml(log.recipient || response.segment || "segment")}</span>
              </div>
              <p class="text-sm text-light-gray">${escapeHtml(log.message || "")}</p>
              <p class="text-xs text-light-gray mt-2">${escapeHtml(log.eventType || "notification")} • Sent ${formatDateTime(log.createdAt)}</p>
            </div>
            <div class="grid grid-cols-2 gap-2 text-sm md:min-w-[320px]">
              ${historyCount("Customers", response.customers || 0)}
              ${historyCount("Vendors", response.vendors || 0)}
              ${historyCount("Riders", response.riders || 0)}
              ${historyCount("Total", response.total || 0)}
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

async function fetchScheduledNotifications() {
  if (!adminToken || !scheduledNotificationsList) return;

  scheduledNotificationsList.innerHTML =
    '<p class="text-center text-light-gray">Loading scheduled notifications...</p>';

  try {
    const response = await fetch(`${BASE_URL}/api/admin/notifications/scheduled`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await response.json();

    if (handleAdminSessionExpiry(response.status)) return;

    if (!response.ok) {
      displayMessage(data.message || "Failed to load scheduled notifications.", "error");
      scheduledNotificationsList.innerHTML =
        '<p class="text-center text-red-500">Unable to load scheduled notifications.</p>';
      return;
    }

    const scheduled = data.scheduled || [];
    if (scheduledNotificationsMeta) {
      scheduledNotificationsMeta.textContent = `${scheduled.length} scheduled notification record${scheduled.length === 1 ? "" : "s"}.`;
    }
    renderScheduledNotifications(scheduled);
  } catch (error) {
    displayMessage(`Network error: ${error.message}`, "error");
    scheduledNotificationsList.innerHTML =
      '<p class="text-center text-red-500">Connection failed.</p>';
  }
}

function renderScheduledNotifications(items) {
  if (!scheduledNotificationsList) return;

  if (!items.length) {
    scheduledNotificationsList.innerHTML =
      '<p class="text-center text-light-gray">No scheduled notifications yet.</p>';
    return;
  }

  scheduledNotificationsList.innerHTML = items
    .map((item) => {
      const preview = item.preview || {};
      return `
        <article class="card p-5">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div class="flex flex-wrap items-center gap-3 mb-2">
                <h3 class="text-xl font-bold text-light-slate">${escapeHtml(item.title || "Untitled")}</h3>
                <span class="status-badge ${scheduledStatusClass(item.status)}">${formatStatusLabel(item.status || "scheduled")}</span>
                <span class="status-badge status-approved">${escapeHtml(item.segment || "segment")}</span>
              </div>
              <p class="text-sm text-light-gray">${escapeHtml(item.message || "")}</p>
              <p class="text-xs text-light-gray mt-2">Scheduled for ${formatDateTime(item.scheduledFor)}</p>
              ${item.errorMessage ? `<p class="text-xs text-red-300 mt-2">${escapeHtml(item.errorMessage)}</p>` : ""}
            </div>
            <div class="grid grid-cols-2 gap-2 text-sm lg:min-w-[360px]">
              ${historyCount("Customers", preview.customers || 0)}
              ${historyCount("Vendors", preview.vendors || 0)}
              ${historyCount("Riders", preview.riders || 0)}
              ${historyCount("Total", preview.total || 0)}
            </div>
          </div>
          ${
            item.status === "scheduled"
              ? `<div class="flex justify-end mt-4"><button class="btn btn-danger px-4 py-2 cancel-scheduled-notification-btn" data-id="${escapeHtml(item._id || "")}">Cancel</button></div>`
              : ""
          }
        </article>
      `;
    })
    .join("");

  scheduledNotificationsList
    .querySelectorAll(".cancel-scheduled-notification-btn")
    .forEach((button) => {
      button.addEventListener("click", () => cancelScheduledNotification(button.dataset.id));
    });
}

function scheduledStatusClass(status = "") {
  if (status === "sent") return "status-approved";
  if (status === "failed" || status === "cancelled") return "status-rejected";
  if (status === "sending") return "status-delivered";
  return "status-pending";
}

async function cancelScheduledNotification(id) {
  if (!id) return;

  try {
    const response = await fetch(
      `${BASE_URL}/api/admin/notifications/scheduled/${id}/cancel`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    const data = await response.json();

    if (handleAdminSessionExpiry(response.status)) return;

    if (!response.ok) {
      displayMessage(data.message || "Failed to cancel scheduled notification.", "error");
      return;
    }

    displayMessage(data.message || "Scheduled notification cancelled.", "success");
    fetchScheduledNotifications();
  } catch (error) {
    displayMessage(`Network error: ${error.message}`, "error");
  }
}

async function exportNotificationSegmentCsv() {
  if (!adminToken) {
    displayMessage("Please login as admin to export contacts.", "warning");
    return;
  }

  const segment = notificationSegment?.value || "all_customers";
  const recipientIds = parseRecipientIds(notificationRecipientIds?.value || "");

  try {
    const response = await fetch(`${BASE_URL}/api/admin/notifications/export-segment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ segment, recipientIds }),
    });
    const data = await response.json();

    if (handleAdminSessionExpiry(response.status)) return;

    if (!response.ok) {
      displayMessage(data.message || "Failed to export segment.", "error");
      return;
    }

    const rows = [
      [
        "id",
        "type",
        "name",
        "email",
        "phoneNumber",
        "status",
        "businessName",
        "businessWhatsAppNumber",
        "businessSupportPhone",
        "createdAt",
      ],
      ...(data.contacts || []).map((contact) => [
        contact.id || "",
        contact.type || "",
        contact.name || "",
        contact.email || "",
        contact.phoneNumber || "",
        contact.status || "",
        contact.businessName || "",
        contact.businessWhatsAppNumber || "",
        contact.businessSupportPhone || "",
        contact.createdAt || "",
      ]),
    ];

    downloadCsv(
      rows,
      `naijago-${segment}-segment-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    displayMessage(`Exported ${data.count || 0} contacts.`, "success");
  } catch (error) {
    displayMessage(`Network error: ${error.message}`, "error");
  }
}

async function loadMarketingCsvFile() {
  const file = marketingListFile?.files?.[0];
  if (!file || !marketingListCsv) return;
  marketingListCsv.value = await file.text();
}

async function importMarketingList() {
  if (!adminToken) {
    displayMessage("Please login as admin to import contacts.", "warning");
    return;
  }

  const name = marketingListName?.value?.trim() || "";
  const audience = marketingListAudience?.value || "mixed";
  const csvText = marketingListCsv?.value || "";
  const contacts = parseMarketingCsv(csvText);

  if (!name) {
    displayMessage("Marketing list name is required.", "warning");
    return;
  }

  if (!contacts.length) {
    displayMessage("Paste or upload contacts before importing.", "warning");
    return;
  }

  if (importMarketingListBtn) {
    importMarketingListBtn.disabled = true;
    importMarketingListBtn.textContent = "Importing...";
  }

  try {
    const response = await fetch(`${BASE_URL}/api/admin/marketing-lists/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name, audience, contacts }),
    });
    const data = await response.json();

    if (handleAdminSessionExpiry(response.status)) return;

    if (!response.ok) {
      displayMessage(data.message || "Failed to import marketing list.", "error");
      renderMarketingListResult(data.message || "Import failed.", false);
      return;
    }

    renderMarketingListResult(
      `${data.list?.contactCount || 0} contacts imported into ${data.list?.name || name}.`,
      true,
    );
    if (marketingListName) marketingListName.value = "";
    if (marketingListCsv) marketingListCsv.value = "";
    if (marketingListFile) marketingListFile.value = "";
    fetchMarketingLists();
  } catch (error) {
    displayMessage(`Network error: ${error.message}`, "error");
  } finally {
    if (importMarketingListBtn) {
      importMarketingListBtn.disabled = false;
      importMarketingListBtn.textContent = "Import Marketing List";
    }
  }
}

async function fetchMarketingLists() {
  if (!adminToken || !campaignMarketingList) return;

  campaignMarketingList.innerHTML = '<option value="">Loading lists...</option>';

  try {
    const response = await fetch(`${BASE_URL}/api/admin/marketing-lists`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await response.json();

    if (handleAdminSessionExpiry(response.status)) return;

    if (!response.ok) {
      displayMessage(data.message || "Failed to load marketing lists.", "error");
      campaignMarketingList.innerHTML =
        '<option value="">Unable to load marketing lists</option>';
      return;
    }

    marketingLists = data.lists || [];
    renderMarketingListsSelect();
  } catch (error) {
    displayMessage(`Network error: ${error.message}`, "error");
    campaignMarketingList.innerHTML =
      '<option value="">Connection failed</option>';
  }
}

function renderMarketingListsSelect() {
  if (!campaignMarketingList) return;

  if (!marketingLists.length) {
    campaignMarketingList.innerHTML =
      '<option value="">No imported marketing lists yet</option>';
    return;
  }

  campaignMarketingList.innerHTML = [
    '<option value="">Choose a marketing list</option>',
    ...marketingLists.map((list) => {
      const count = Number(list.contactCount || list.contacts?.length || 0);
      return `<option value="${escapeHtml(list._id || "")}">${escapeHtml(list.name || "Untitled list")} (${count.toLocaleString()} contacts, ${escapeHtml(list.audience || "mixed")})</option>`;
    }),
  ].join("");
}

async function sendMarketingCampaign() {
  if (!adminToken) {
    displayMessage("Please login as admin to send campaigns.", "warning");
    return;
  }

  const listId = campaignMarketingList?.value || "";
  const title = notificationTitle?.value?.trim() || "";
  const message = notificationMessage?.value?.trim() || "";
  const channels = [];
  if (campaignEmailChannel?.checked) channels.push("email");
  if (campaignWhatsappChannel?.checked) channels.push("whatsapp");
  const list = marketingLists.find((item) => item._id === listId);

  if (!listId) {
    displayMessage("Choose a marketing list.", "warning");
    return;
  }

  if (!title || !message) {
    displayMessage("Campaign title and message are required.", "warning");
    return;
  }

  if (!channels.length) {
    displayMessage("Choose email, WhatsApp, or both.", "warning");
    return;
  }

  const contactCount = Number(list?.contactCount || list?.contacts?.length || 0);
  if (
    !window.confirm(
      `Send this campaign to ${contactCount.toLocaleString()} contacts via ${channels.join(" + ")}?`,
    )
  ) {
    return;
  }

  if (sendMarketingCampaignBtn) {
    sendMarketingCampaignBtn.disabled = true;
    sendMarketingCampaignBtn.textContent = "Sending...";
  }

  renderMarketingCampaignResult("Campaign is sending. Keep this page open.", null);

  try {
    const response = await fetch(`${BASE_URL}/api/admin/marketing-campaigns/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ listId, title, message, channels }),
    });
    const data = await response.json();

    if (handleAdminSessionExpiry(response.status)) return;

    if (!response.ok) {
      displayMessage(data.message || "Failed to send campaign.", "error");
      renderMarketingCampaignResult(data.message || "Campaign failed.", false);
      return;
    }

    displayMessage(data.message || "Campaign processed.", "success");
    renderMarketingCampaignResult(data.campaign, true);
    fetchNotificationHistory();
    fetchNotificationStats();
  } catch (error) {
    displayMessage(`Network error: ${error.message}`, "error");
    renderMarketingCampaignResult(error.message, false);
  } finally {
    if (sendMarketingCampaignBtn) {
      sendMarketingCampaignBtn.disabled = false;
      sendMarketingCampaignBtn.textContent = "Send Campaign";
    }
  }
}

function renderMarketingCampaignResult(result, success) {
  if (!marketingCampaignResult) return;

  if (typeof result === "string") {
    marketingCampaignResult.innerHTML = `<div class="message ${success === false ? "error" : "success"}">${escapeHtml(result)}</div>`;
    return;
  }

  const email = result?.results?.email || {};
  const whatsapp = result?.results?.whatsapp || {};
  marketingCampaignResult.innerHTML = `
    <div class="message ${success ? "success" : "error"}">
      Campaign ${success ? "processed" : "failed"} for ${escapeHtml(result?.listName || "selected list")}.
    </div>
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-4">
      ${resultCard("Email sent", email.sent || 0)}
      ${resultCard("Email skipped/failed", Number(email.skipped || 0) + Number(email.failed || 0))}
      ${resultCard("WhatsApp sent", whatsapp.sent || 0)}
      ${resultCard("WhatsApp skipped/failed", Number(whatsapp.skipped || 0) + Number(whatsapp.failed || 0))}
    </div>
  `;
}

function parseMarketingCsv(csvText) {
  const lines = String(csvText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const firstCells = splitCsvLine(lines[0]).map((cell) => cell.toLowerCase());
  const hasHeader = firstCells.some((cell) =>
    ["name", "email", "phonenumber", "phone", "type"].includes(cell.replace(/\s+/g, "")),
  );
  const headers = hasHeader
    ? firstCells.map((cell) => cell.replace(/\s+/g, ""))
    : ["name", "email", "phonenumber", "type"];
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines
    .map((line) => {
      const cells = splitCsvLine(line);
      const row = {};
      headers.forEach((header, index) => {
        row[header] = cells[index] || "";
      });
      return {
        name: row.name || "",
        email: row.email || "",
        phoneNumber: row.phonenumber || row.phone || "",
        type: singularContactType(row.type || ""),
        source: "admin_csv_import",
      };
    })
    .filter((contact) => contact.email || contact.phoneNumber);
}

function splitCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function singularContactType(type) {
  const normalized = String(type || "").toLowerCase();
  if (normalized === "customers") return "customer";
  if (normalized === "vendors") return "vendor";
  if (normalized === "riders") return "rider";
  if (["customer", "vendor", "rider"].includes(normalized)) return normalized;
  return "other";
}

function renderMarketingListResult(message, success) {
  if (!marketingListResult) return;
  marketingListResult.innerHTML = `<div class="message ${success ? "success" : "error"}">${escapeHtml(message)}</div>`;
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

fetchNotificationHistory();
fetchScheduledNotifications();
fetchNotificationTemplates();
fetchMarketingLists();
fetchNotificationStats();

function historyCount(label, value) {
  return `
    <div class="rounded-lg border border-cyan-300/20 bg-cyan-300/5 p-3">
      <p class="text-xs text-light-gray">${label}</p>
      <p class="font-bold text-light-slate">${Number(value || 0).toLocaleString()}</p>
    </div>
  `;
}
