const engagementAnalyticsCards = document.getElementById(
  "engagementAnalyticsCards",
);
const engagementAnalyticsBreakdowns = document.getElementById(
  "engagementAnalyticsBreakdowns",
);
const engagementAnalyticsRecent = document.getElementById(
  "engagementAnalyticsRecent",
);
const engagementWhatsappLogs = document.getElementById(
  "engagementWhatsappLogs",
);
const engagementAnalyticsMeta = document.getElementById(
  "engagementAnalyticsMeta",
);
const engagementAnalyticsRange = document.getElementById(
  "engagementAnalyticsRange",
);
const refreshEngagementAnalyticsBtn = document.getElementById(
  "refreshEngagementAnalyticsBtn",
);

function formatCount(value) {
  return Number(value || 0).toLocaleString();
}

function formatDateTime(value) {
  if (!value) return "Unknown time";
  return new Date(value).toLocaleString();
}

function vendorLabel(vendor) {
  if (!vendor) return "Unknown vendor";
  return (
    vendor.businessName ||
    `${vendor.firstName || ""} ${vendor.lastName || ""}`.trim() ||
    vendor.phoneNumber ||
    "Unknown vendor"
  );
}

function renderMetricCard(label, value, hint) {
  return `
    <div class="rounded-xl border border-cyan-400 border-opacity-15 bg-blue-950 bg-opacity-30 p-5">
      <p class="text-xs font-bold uppercase tracking-[0.22em] text-light-gray">${escapeHtml(label)}</p>
      <p class="mt-3 text-3xl font-extrabold text-light-slate">${formatCount(value)}</p>
      <p class="mt-2 text-sm text-light-gray">${escapeHtml(hint || "")}</p>
    </div>
  `;
}

function renderBreakdown(title, rows, formatter) {
  const content = rows?.length
    ? rows
        .map(
          (row) => `
            <div class="flex items-center justify-between gap-4 border-b border-cyan-400 border-opacity-10 py-2">
              <span class="text-light-slate">${escapeHtml(formatter(row))}</span>
              <span class="font-bold text-accent-cyan">${formatCount(row.count)}</span>
            </div>
          `,
        )
        .join("")
    : '<p class="text-light-gray">No data yet.</p>';

  return `
    <section>
      <h3 class="text-lg font-bold text-light-slate mb-2">${escapeHtml(title)}</h3>
      ${content}
    </section>
  `;
}

function renderEngagementAnalytics(data) {
  if (!engagementAnalyticsCards) return;

  const totals = data.totals || {};
  const whatsapp = data.breakdowns?.whatsapp || {};
  const whatsappTotal =
    Number(whatsapp.sent || 0) +
    Number(whatsapp.failed || 0) +
    Number(whatsapp.skipped || 0);

  engagementAnalyticsCards.innerHTML = [
    renderMetricCard("Carousel Clicks", totals.carouselClicks, "Main and promo slide taps."),
    renderMetricCard("Restaurant Clicks", totals.restaurantCardClicks, "Home restaurant card opens."),
    renderMetricCard("Food Orders", totals.foodOrders, "Orders containing restaurant food."),
    renderMetricCard("Pharmacy Starts", totals.pharmacyConsultationStarts, "Customer consultation starts."),
    renderMetricCard("WhatsApp Alerts", whatsappTotal, `Sent ${formatCount(whatsapp.sent)} • Failed ${formatCount(whatsapp.failed)}`),
  ].join("");

  if (engagementAnalyticsMeta) {
    engagementAnalyticsMeta.textContent = `Showing the last ${data.range?.days || 30} days. Updated ${new Date().toLocaleTimeString()}.`;
  }

  if (engagementAnalyticsBreakdowns) {
    engagementAnalyticsBreakdowns.innerHTML = [
      renderBreakdown(
        "Carousel Clicks",
        data.breakdowns?.carouselByPlacement || [],
        (row) =>
          `${row._id?.placement || "unknown"} • ${row._id?.targetType || "none"}`,
      ),
      renderBreakdown(
        "Restaurant Clicks",
        data.breakdowns?.restaurantByCity || [],
        (row) => `${row._id?.city || "Unknown city"} • ${row._id?.source || "unknown source"}`,
      ),
      renderBreakdown(
        "Pharmacy Starts",
        data.breakdowns?.pharmacyBySource || [],
        (row) => row._id || "unknown source",
      ),
      renderBreakdown(
        "WhatsApp Status",
        Object.entries(whatsapp).map(([status, count]) => ({
          _id: status,
          count,
        })),
        (row) => row._id,
      ),
    ].join("");
  }

  if (engagementAnalyticsRecent) {
    const events = data.recentEvents || [];
    engagementAnalyticsRecent.innerHTML = events.length
      ? events
          .map(
            (event) => `
              <div class="rounded-lg border border-cyan-400 border-opacity-10 bg-slate-950 bg-opacity-40 p-3">
                <p class="font-bold text-light-slate">${escapeHtml(event.eventType || "event")}</p>
                <p class="text-sm text-light-gray">${escapeHtml(event.source || "unknown source")} • ${escapeHtml(event.targetType || "target")} • ${formatDateTime(event.createdAt)}</p>
                <p class="text-xs text-light-gray mt-1">${escapeHtml(event.city || "")}</p>
              </div>
            `,
          )
          .join("")
      : '<p class="text-light-gray">No recent events yet.</p>';
  }

  if (engagementWhatsappLogs) {
    const logs = data.recentWhatsappLogs || [];
    engagementWhatsappLogs.innerHTML = logs.length
      ? logs
          .map(
            (log) => `
              <div class="grid gap-3 rounded-lg border border-cyan-400 border-opacity-10 bg-slate-950 bg-opacity-40 p-3 md:grid-cols-[1fr_auto]">
                <div>
                  <p class="font-bold text-light-slate">${escapeHtml(vendorLabel(log.vendor))}</p>
                  <p class="text-sm text-light-gray">${escapeHtml(log.status || "unknown")} • ${escapeHtml(log.recipient || "no recipient")} • ${formatDateTime(log.createdAt)}</p>
                  ${log.errorMessage ? `<p class="text-sm text-red-300 mt-1">${escapeHtml(log.errorMessage)}</p>` : ""}
                </div>
                <span class="self-start rounded-full px-3 py-1 text-xs font-bold ${
                  log.status === "sent"
                    ? "bg-emerald-500 bg-opacity-20 text-emerald-200"
                    : log.status === "failed"
                      ? "bg-red-500 bg-opacity-20 text-red-200"
                      : "bg-slate-500 bg-opacity-20 text-slate-200"
                }">${escapeHtml(log.status || "unknown")}</span>
              </div>
            `,
          )
          .join("")
      : '<p class="text-light-gray">No WhatsApp logs in this range.</p>';
  }
}

async function fetchEngagementAnalytics() {
  if (!adminToken || !engagementAnalyticsCards) return;
  const days = engagementAnalyticsRange?.value || "30";
  engagementAnalyticsCards.innerHTML = '<p class="text-light-gray">Loading analytics...</p>';

  try {
    const response = await fetch(
      `${BASE_URL}/api/admin/engagement-analytics?days=${encodeURIComponent(days)}`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    const data = await response.json();
    if (handleAdminSessionExpiry(response.status)) return;
    if (!response.ok) {
      throw new Error(data.message || "Failed to load engagement analytics.");
    }
    renderEngagementAnalytics(data);
  } catch (error) {
    engagementAnalyticsCards.innerHTML = `<p class="text-red-400">${escapeHtml(error.message)}</p>`;
  }
}

refreshEngagementAnalyticsBtn?.addEventListener(
  "click",
  fetchEngagementAnalytics,
);
engagementAnalyticsRange?.addEventListener("change", fetchEngagementAnalytics);

if (currentPage === "engagement-analytics") {
  fetchEngagementAnalytics();
}
