let dispatchMap = null;
let dispatchMarkers = [];
let dispatchOrders = [];
let dispatchRiders = { individualRiders: [], companyRiders: [], total: 0 };

function dispatchCoord(location = {}) {
  const lat = Number(location.lat ?? location.latitude);
  const lng = Number(location.lng ?? location.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function dispatchLastSeen(location = {}) {
  const raw = location.lastUpdated || location.timestamp;
  const time = raw ? new Date(raw).getTime() : NaN;
  if (!Number.isFinite(time)) return "never";
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} day(s) ago`;
}

function dispatchFreshGps(location = {}) {
  const raw = location.lastUpdated || location.timestamp;
  const time = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(time) && Date.now() - time <= 10 * 60 * 1000;
}

function dispatchDistanceKm(from, to) {
  if (!from || !to) return null;
  return calculateDistance(from.lat, from.lng, to.lat, to.lng);
}

function dispatchRiderList() {
  const individual = Array.isArray(dispatchRiders.individualRiders)
    ? dispatchRiders.individualRiders.map((rider) => ({ ...rider, riderType: "individual" }))
    : [];
  const company = Array.isArray(dispatchRiders.companyRiders)
    ? dispatchRiders.companyRiders.map((rider) => ({ ...rider, riderType: "company" }))
    : [];
  return [...individual, ...company];
}

function dispatchPersonName(person, fallback = "Rider") {
  if (!person || typeof person !== "object") return fallback;
  return (
    person.fullName ||
    person.name ||
    person.businessName ||
    person.companyName ||
    [person.firstName, person.lastName].filter(Boolean).join(" ") ||
    fallback
  );
}

function dispatchPickupLocation(order) {
  const firstShipment = Array.isArray(order.shipments) ? order.shipments[0] : null;
  return dispatchCoord(firstShipment?.vendorLocation || firstShipment?.vendor?.businessLocation || {});
}

function dispatchOrderStatus(order) {
  if (order.rider) return "accepted";
  if (order.assignedRider) return "offer_pending";
  return "unassigned";
}

function initDispatchMap() {
  if (dispatchMap || typeof L !== "object") return;
  dispatchMap = L.map("dispatchMap", {
    zoomControl: true,
    attributionControl: true,
  }).setView([9.0765, 7.3986], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  }).addTo(dispatchMap);
}

function clearDispatchMarkers() {
  dispatchMarkers.forEach((marker) => marker.remove());
  dispatchMarkers = [];
}

function addDispatchMarker(coord, html, color) {
  if (!dispatchMap || !coord) return;
  const marker = L.circleMarker([coord.lat, coord.lng], {
    radius: 9,
    color,
    fillColor: color,
    fillOpacity: 0.85,
    weight: 2,
  }).addTo(dispatchMap);
  marker.bindPopup(html);
  dispatchMarkers.push(marker);
}

function renderDispatchMap() {
  initDispatchMap();
  clearDispatchMarkers();

  const bounds = [];
  for (const rider of dispatchRiderList()) {
    const location = rider.location || rider.currentLocation || {};
    const coord = dispatchCoord(location);
    if (!coord) continue;
    bounds.push([coord.lat, coord.lng]);
    addDispatchMarker(
      coord,
      `<strong>${escapeHtml(rider.fullName || "Rider")}</strong><br>${escapeHtml(rider.phoneNumber || "")}<br>${dispatchFreshGps(location) ? "GPS fresh" : "GPS stale"} • ${escapeHtml(dispatchLastSeen(location))}`,
      dispatchFreshGps(location) ? "#22c55e" : "#f59e0b",
    );
  }

  for (const order of dispatchOrders) {
    const coord = dispatchPickupLocation(order);
    if (!coord) continue;
    bounds.push([coord.lat, coord.lng]);
    addDispatchMarker(
      coord,
      `<strong>Pickup</strong><br>Order ${escapeHtml(order._id || "")}<br>${escapeHtml(formatStatusLabel(dispatchOrderStatus(order)))}`,
      dispatchOrderStatus(order) === "unassigned" ? "#ef4444" : "#38bdf8",
    );
  }

  if (bounds.length) {
    dispatchMap.fitBounds(bounds, { padding: [35, 35], maxZoom: 14 });
  }
}

function renderDispatchLists() {
  const riders = dispatchRiderList();
  const freshCount = riders.filter((rider) =>
    dispatchFreshGps(rider.location || rider.currentLocation || {}),
  ).length;
  const pendingOrders = dispatchOrders.filter(
    (order) => dispatchOrderStatus(order) === "offer_pending",
  );
  const activeOrders = dispatchOrders.filter(
    (order) => dispatchOrderStatus(order) === "accepted",
  );

  document.getElementById("dispatchOnlineCount").textContent = String(riders.length);
  document.getElementById("dispatchFreshGpsCount").textContent = String(freshCount);
  document.getElementById("dispatchPendingCount").textContent = String(pendingOrders.length);
  document.getElementById("dispatchActiveCount").textContent = String(activeOrders.length);

  const riderList = document.getElementById("dispatchRiderList");
  riderList.innerHTML = riders.length
    ? riders
        .map((rider) => {
          const location = rider.location || rider.currentLocation || {};
          const coord = dispatchCoord(location);
          const nearestOrder = dispatchOrders
            .map((order) => ({
              order,
              distance: dispatchDistanceKm(coord, dispatchPickupLocation(order)),
            }))
            .filter((item) => item.distance !== null)
            .sort((a, b) => a.distance - b.distance)[0];
          return `
            <article class="rounded-lg border border-cyan-300 border-opacity-20 bg-cyan-300 bg-opacity-5 p-3">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="font-bold text-light-slate">${escapeHtml(rider.fullName || "Rider")}</p>
                  <p class="text-sm text-light-gray">${escapeHtml(rider.phoneNumber || "No phone")} ${rider.plateNumber ? `• ${escapeHtml(rider.plateNumber)}` : ""}</p>
                </div>
                <span class="${dispatchFreshGps(location) ? "text-green-300" : "text-yellow-300"} text-xs font-bold">${dispatchFreshGps(location) ? "Fresh" : "Stale"}</span>
              </div>
              <p class="mt-2 text-sm text-light-gray">Last seen ${escapeHtml(dispatchLastSeen(location))}</p>
              <p class="text-sm text-accent-cyan">Nearest pickup: ${nearestOrder ? `${nearestOrder.distance.toFixed(2)} km` : "Unknown"}</p>
            </article>
          `;
        })
        .join("")
    : '<p class="text-light-gray">No online riders reported yet.</p>';

  const orderList = document.getElementById("dispatchOrderList");
  orderList.innerHTML = dispatchOrders.length
    ? dispatchOrders
        .map((order) => {
          const rider = order.rider || order.assignedRider || null;
          const assignedAt = order.assignedAt ? new Date(order.assignedAt).toLocaleTimeString() : "";
          return `
            <article class="rounded-lg border border-cyan-300 border-opacity-20 bg-blue-950 bg-opacity-30 p-3">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="font-bold text-light-slate">${escapeHtml(order._id || "Order")}</p>
                  <p class="text-sm text-light-gray">${escapeHtml(formatStatusLabel(order.shipmentStatus || order.mainOrderStatus || "processing"))}</p>
                </div>
                <span class="text-xs font-bold text-accent-cyan">${escapeHtml(formatStatusLabel(dispatchOrderStatus(order)))}</span>
              </div>
              <p class="mt-2 text-sm text-light-gray">Rider: ${rider ? escapeHtml(dispatchPersonName(rider, "Rider")) : "None"}</p>
              ${assignedAt ? `<p class="text-sm text-yellow-200">Offer sent: ${escapeHtml(assignedAt)}</p>` : ""}
            </article>
          `;
        })
        .join("")
    : '<p class="text-light-gray">No active dispatch orders.</p>';
}

function renderDispatchDashboard() {
  dispatchOrders = allOrders.filter((order) => {
    const status = (order.mainOrderStatus || "").toLowerCase();
    return order.isPaid && !["completed", "cancelled"].includes(status);
  });
  renderDispatchLists();
  renderDispatchMap();
}

async function fetchDispatchDashboard() {
  if (!adminToken) return;
  const response = await fetch(`${BASE_URL}/api/orders/admin`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const data = await response.json();
  if (!response.ok) {
    displayMessage(data.message || "Failed to load dispatch orders", "error");
    return;
  }
  allOrders = Array.isArray(data) ? data : [];
  window.adminSocket?.emit("get_online_riders");
  renderDispatchDashboard();
}

window.addEventListener("online-riders-updated", (event) => {
  dispatchRiders = event.detail || { individualRiders: [], companyRiders: [], total: 0 };
  renderDispatchDashboard();
});

document.getElementById("refreshDispatchBtn")?.addEventListener("click", fetchDispatchDashboard);
window.fetchDispatchDashboard = fetchDispatchDashboard;
