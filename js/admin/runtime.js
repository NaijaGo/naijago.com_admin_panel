        const BASE_URL = "https://naijago-backend.onrender.com";
        // const BASE_URL = "http://localhost:5000";

        let adminToken = "";
        let currentFilter = "all";
        let currentRiderFilter = "all";
        let currentWithdrawalFilter = "all";
        let currentCompanyFilter = "all";
        let hasLoadedReferralSettings = false;
        let hasLoadedDeliveryFeeSettings = false;
        let hasLoadedCarouselSlides = false;
        let hasLoadedPharmacySubscriptionSettings = false;
        let allOrders = [];
        let allRiders = [];
        let allWithdrawals = [];
        let allCompanies = [];
        let allDisputes = [];
        let pendingVendorRequests = [];
        let pendingPharmacistRequests = [];
        let customerVendorMetrics = null;
        let isAnalyticsRefreshing = false;
        let analyticsLastUpdated = null;
        let selectedAnalyticsRange = "30d";
        let analyticsRangeWindow = null;
        let latestAnalyticsSnapshot = null;
        let latestDeliveryFeeSettings = null;
        let latestPharmacySubscriptionSettings = null;
        const currentPage = document.body.dataset.page || "dashboard";

        // DOM Elements - only get those that exist
        const messageContainer = document.getElementById("messageContainer");
        const pendingRequestsList = document.getElementById(
          "pendingRequestsList",
        );
        const pharmacistRequestsList = document.getElementById(
          "pharmacistRequestsList",
        );
        const refreshPharmacistRequestsBtn = document.getElementById(
          "refreshPharmacistRequestsBtn",
        );
        const logoutAdminBtn = document.getElementById("logoutAdminBtn");
        const analyticsCards = document.getElementById("analyticsCards");
        const analyticsBreakdown =
          document.getElementById("analyticsBreakdown");
        const analyticsInsights = document.getElementById("analyticsInsights");
        const analyticsMeta = document.getElementById("analyticsMeta");
        const analyticsAlerts = document.getElementById("analyticsAlerts");
        const analyticsPriorityBadge = document.getElementById(
          "analyticsPriorityBadge",
        );
        const refreshAnalyticsBtn = document.getElementById(
          "refreshAnalyticsBtn",
        );
        const exportAnalyticsBtn =
          document.getElementById("exportAnalyticsBtn");
        const analyticsRangeSelect = document.getElementById(
          "analyticsRangeSelect",
        );

        const ordersList = document.getElementById("ordersList");
        const orderFilterDropdown = document.getElementById(
          "orderFilterDropdown",
        );

        const disputesList = document.getElementById("disputesList");

        const withdrawalsList = document.getElementById("withdrawalsList");
        const withdrawalCountBadge = document.getElementById(
          "withdrawalCountBadge",
        );
        const withdrawalTotalDisplay = document.getElementById(
          "withdrawalTotalDisplay",
        );
        const refreshWithdrawalsBtn = document.getElementById(
          "refreshWithdrawalsBtn",
        );
        const referralSettingsSection = document.getElementById(
          "referralSettingsSection",
        );
        const deliveryFeeSettingsSection = document.getElementById(
          "deliveryFeeSettingsSection",
        );
        const carouselSlidesSection = document.getElementById(
          "carouselSlidesSection",
        );
        const pharmacySubscriptionSettingsSection = document.getElementById(
          "pharmacySubscriptionSettingsSection",
        );
        const currentReferralRewardDisplay = document.getElementById(
          "currentReferralRewardDisplay",
        );
        const referralSettingsSource = document.getElementById(
          "referralSettingsSource",
        );
        const referralSettingsUpdatedAt = document.getElementById(
          "referralSettingsUpdatedAt",
        );
        const referralSettingsUpdatedBy = document.getElementById(
          "referralSettingsUpdatedBy",
        );
        const referralRewardAmountInput = document.getElementById(
          "referralRewardAmountInput",
        );
        const referralSettingsForm = document.getElementById(
          "referralSettingsForm",
        );
        const saveReferralSettingsBtn = document.getElementById(
          "saveReferralSettingsBtn",
        );
        const refreshReferralSettingsBtn = document.getElementById(
          "refreshReferralSettingsBtn",
        );
        const referralAuditTrail =
          document.getElementById("referralAuditTrail");
        const deliveryFeeCoverageDisplay = document.getElementById(
          "deliveryFeeCoverageDisplay",
        );
        const deliveryFeeSettingsSource = document.getElementById(
          "deliveryFeeSettingsSource",
        );
        const deliveryFeeFallbackDisplay = document.getElementById(
          "deliveryFeeFallbackDisplay",
        );
        const deliveryFeeMinimumDisplay = document.getElementById(
          "deliveryFeeMinimumDisplay",
        );
        const deliveryFeeSettingsUpdatedAt = document.getElementById(
          "deliveryFeeSettingsUpdatedAt",
        );
        const deliveryFeeSettingsUpdatedBy = document.getElementById(
          "deliveryFeeSettingsUpdatedBy",
        );
        const deliveryFallbackRateInput = document.getElementById(
          "deliveryFallbackRateInput",
        );
        const deliveryMinimumFeeInput = document.getElementById(
          "deliveryMinimumFeeInput",
        );
        const deliveryFeeZoneGroups = document.getElementById(
          "deliveryFeeZoneGroups",
        );
        const deliveryFeeSettingsForm = document.getElementById(
          "deliveryFeeSettingsForm",
        );
        const refreshDeliveryFeeSettingsBtn = document.getElementById(
          "refreshDeliveryFeeSettingsBtn",
        );
        const refreshCarouselSlidesBtn = document.getElementById(
          "refreshCarouselSlidesBtn",
        );
        const mainCarouselCreateForm = document.getElementById(
          "mainCarouselCreateForm",
        );
        const promoCarouselCreateForm = document.getElementById(
          "promoCarouselCreateForm",
        );
        const mainCarouselSlidesList = document.getElementById(
          "mainCarouselSlidesList",
        );
        const promoCarouselSlidesList = document.getElementById(
          "promoCarouselSlidesList",
        );
        const pharmacySubscriptionPlanEditor = document.getElementById(
          "pharmacySubscriptionPlanEditor",
        );
        const pharmacySubscriptionSettingsForm = document.getElementById(
          "pharmacySubscriptionSettingsForm",
        );
        const refreshPharmacySubscriptionSettingsBtn = document.getElementById(
          "refreshPharmacySubscriptionSettingsBtn",
        );
        const storedToken = localStorage.getItem("admin_jwt_token");

        if (!storedToken) {
          redirectToLogin();
        } else {
          adminToken = storedToken;
        }

        if (analyticsRangeSelect) {
          analyticsRangeSelect.value = selectedAnalyticsRange;
        }

        // Initialize Socket.io connection for real-time updates
        let socket = null;
        function initializeSocket() {
          if (!adminToken) return;
          if (typeof window.io !== "function") {
            console.warn("Socket.io client is not loaded; real-time updates are disabled.");
            return;
          }

          socket = window.io(BASE_URL, {
            auth: { token: adminToken },
            transports: ["websocket", "polling"],
          });
          window.adminSocket = socket;

          socket.on("connect", () => {
            console.log("Connected to real-time server");
            if (["orders", "dispatch"].includes(document.body?.dataset?.page)) {
              socket.emit("get_online_riders");
            }
          });

          socket.on("admin_notification", (data) => {
            showRealTimeNotification(data);
            window.dispatchEvent(new CustomEvent("admin-activity-received", { detail: data }));
          });

          socket.on("rider_location_update", (data) => {
            updateRiderLocationOnMap(data);
          });

          socket.on("online_riders_list", (data) => {
            window.latestOnlineRiders = data || {
              individualRiders: [],
              companyRiders: [],
              total: 0,
            };
            window.dispatchEvent(
              new CustomEvent("online-riders-updated", {
                detail: window.latestOnlineRiders,
              }),
            );
          });

          socket.on("rider_status_change", () => {
            socket.emit("get_online_riders");
          });

          socket.on("rider_assigned_success", (data) => {
            displayMessage(
              data?.message || "Rider assigned successfully.",
              "success",
            );
            if (typeof fetchOrders === "function") {
              fetchOrders();
            }
            socket.emit("get_online_riders");
          });

          socket.on("error", (data) => {
            if (data?.message) {
              displayMessage(data.message, "error");
            }
          });

          socket.on("disconnect", () => {
            console.log("Disconnected from real-time server");
          });
        }

        async function initializeAdminActivityCenter() {
          if (!adminToken || document.getElementById("adminActivityButton")) return;
          const shell = document.createElement("div");
          shell.id = "adminActivityCenter";
          shell.style.cssText = "position:fixed;right:18px;bottom:18px;z-index:60;font-family:Inter,sans-serif";
          shell.innerHTML = `
            <button id="adminActivityButton" type="button" aria-label="Open admin activity"
              style="width:54px;height:54px;border-radius:50%;border:1px solid rgba(100,255,218,.35);background:#10233f;color:#64ffda;box-shadow:0 12px 35px rgba(0,0,0,.35);font-size:22px;cursor:pointer;position:relative">
              &#128276;<span id="adminActivityUnread" style="display:none;position:absolute;right:-3px;top:-4px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#ef4444;color:white;font:700 11px/20px Inter,sans-serif"></span>
            </button>
            <section id="adminActivityPanel" hidden style="position:absolute;right:0;bottom:64px;width:min(390px,calc(100vw - 28px));max-height:520px;overflow:hidden;border:1px solid rgba(100,255,218,.25);border-radius:20px;background:#0a192f;color:#ccd6f6;box-shadow:0 22px 60px rgba(0,0,0,.5)">
              <header style="padding:16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(100,255,218,.14)">
                <div><strong style="display:block;color:#fff">Platform activity</strong><small style="color:#a8b2d1">Live business events</small></div>
                <button id="adminActivityReadAll" type="button" style="border:0;background:transparent;color:#64ffda;cursor:pointer;font-weight:700">Mark all read</button>
              </header>
              <div id="adminActivityItems" style="max-height:390px;overflow:auto;padding:10px"><p style="padding:18px;color:#a8b2d1">Loading activity...</p></div>
              <footer style="padding:12px 16px;border-top:1px solid rgba(100,255,218,.14);display:flex;justify-content:space-between;align-items:center">
                <span id="adminPushState" style="font-size:12px;color:#a8b2d1">Push not checked</span>
                <button id="enableAdminPush" type="button" style="border:0;border-radius:9px;background:#64ffda;color:#0a192f;padding:8px 10px;font-weight:800;cursor:pointer">Enable push</button>
              </footer>
            </section>`;
          document.body.appendChild(shell);

          const panel = document.getElementById("adminActivityPanel");
          document.getElementById("adminActivityButton")?.addEventListener("click", async () => {
            panel.hidden = !panel.hidden;
            if (!panel.hidden) await fetchAdminActivity();
          });
          document.getElementById("adminActivityReadAll")?.addEventListener("click", markAllAdminActivityRead);
          document.getElementById("enableAdminPush")?.addEventListener("click", () => initializeAdminWebPush(true));
          window.addEventListener("admin-activity-received", fetchAdminActivity);
          await Promise.allSettled([fetchAdminActivity(), initializeAdminWebPush(false)]);
        }

        async function fetchAdminActivity() {
          if (!adminToken) return;
          try {
            const response = await fetch(`${BASE_URL}/api/admin/activity?limit=30`, {
              headers: { Authorization: `Bearer ${adminToken}` },
            });
            if (!response.ok) return;
            const data = await response.json();
            renderAdminActivity(data.events || [], Number(data.unread || 0));
          } catch (error) {
            console.warn("Admin activity fetch failed", error);
          }
        }

        function renderAdminActivity(events, unread) {
          const badge = document.getElementById("adminActivityUnread");
          if (badge) {
            badge.style.display = unread > 0 ? "block" : "none";
            badge.textContent = unread > 99 ? "99+" : String(unread);
          }
          const container = document.getElementById("adminActivityItems");
          if (!container) return;
          if (!events.length) {
            container.innerHTML = '<p style="padding:22px;text-align:center;color:#a8b2d1">No activity recorded yet.</p>';
            return;
          }
          container.innerHTML = events.map((event) => {
            const destination = event.destination?.page || "";
            const color = event.severity === "critical" ? "#f87171" : event.severity === "warning" ? "#fbbf24" : "#64ffda";
            return `<button type="button" data-event-id="${escapeHtml(event._id || "")}" data-destination="${escapeHtml(destination)}" style="display:block;width:100%;text-align:left;border:0;border-bottom:1px solid rgba(168,178,209,.12);background:transparent;color:#ccd6f6;padding:13px;cursor:pointer">
              <span style="display:block;color:${color};font-size:11px;font-weight:800;text-transform:uppercase">${escapeHtml(event.category || "system")} · ${escapeHtml(event.severity || "info")}</span>
              <strong style="display:block;color:#fff;margin-top:5px">${escapeHtml(event.title || "Activity")}</strong>
              <span style="display:block;font-size:13px;line-height:1.45;margin-top:4px;color:#a8b2d1">${escapeHtml(event.message || "")}</span>
              <small style="display:block;margin-top:6px;color:#718096">${formatDate(event.createdAt)}</small>
            </button>`;
          }).join("");
          container.querySelectorAll("[data-event-id]").forEach((button) => {
            button.addEventListener("click", async () => {
              await markAdminActivityRead(button.dataset.eventId);
              if (button.dataset.destination) window.location.href = `./${button.dataset.destination}`;
            });
          });
        }

        async function markAdminActivityRead(eventId) {
          if (!eventId) return;
          await fetch(`${BASE_URL}/api/admin/activity/${eventId}/read`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${adminToken}` },
          }).catch(() => {});
          await fetchAdminActivity();
        }

        async function markAllAdminActivityRead() {
          await fetch(`${BASE_URL}/api/admin/activity/read-all`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${adminToken}` },
          }).catch(() => {});
          await fetchAdminActivity();
        }

        async function initializeAdminWebPush(requestPermission) {
          const state = document.getElementById("adminPushState");
          try {
            const response = await fetch(`${BASE_URL}/api/admin/push-config`, {
              headers: { Authorization: `Bearer ${adminToken}` },
            });
            const config = await response.json();
            if (!config.enabled) {
              if (state) state.textContent = "Admin push needs server configuration";
              return;
            }
            if (!document.querySelector('script[data-onesignal-admin]')) {
              const script = document.createElement("script");
              script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
              script.defer = true;
              script.dataset.onesignalAdmin = "true";
              document.head.appendChild(script);
            }
            window.OneSignalDeferred = window.OneSignalDeferred || [];
            window.OneSignalDeferred.push(async (OneSignal) => {
              await OneSignal.init({ appId: config.appId, serviceWorkerPath: "OneSignalSDKWorker.js" });
              await OneSignal.login(config.externalId);
              if (requestPermission) await OneSignal.Notifications.requestPermission();
              if (state) state.textContent = OneSignal.Notifications.permission ? "Admin push enabled" : "Push permission required";
            });
          } catch (error) {
            if (state) state.textContent = "Push setup unavailable";
          }
        }

        function showRealTimeNotification(data) {
          const notificationDiv = document.createElement("div");
          notificationDiv.className =
            "fixed top-4 right-4 z-50 card p-4 max-w-sm animate-slide-in";
          notificationDiv.style.minWidth = "300px";

          let icon = "📢";
          let bgColor = "bg-blue-900";
          if (data.type === "order_ready_for_completion") {
            icon = "💰";
            bgColor = "bg-green-900";
          } else if (data.type === "rider_withdrawal_request") {
            icon = "🏧";
            bgColor = "bg-yellow-900";
          } else if (data.type === "delivery_cancelled") {
            icon = "❌";
            bgColor = "bg-red-900";
          }

          notificationDiv.innerHTML = `
            <div class="flex items-start gap-3">
                <span class="text-2xl">${icon}</span>
                <div class="flex-1">
                    <h4 class="font-bold text-accent-cyan">${data.type?.replace(/_/g, " ").toUpperCase() || "Notification"}</h4>
                    <p class="text-sm mt-1">${data.message}</p>
                    <p class="text-xs text-gray-400 mt-2">${new Date().toLocaleTimeString()}</p>
                </div>
                <button class="text-gray-400 hover:text-white" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

          document.body.appendChild(notificationDiv);

          // Auto-remove after 10 seconds
          setTimeout(() => {
            if (notificationDiv.parentNode) {
              notificationDiv.remove();
            }
          }, 10000);
        }

        function updateRiderLocationOnMap(data) {
          console.log("Rider location updated:", data);
          const riderCards = document.querySelectorAll(
            `[data-rider-id="${data.riderId}"]`,
          );
          riderCards.forEach((card) => {
            const locationEl = card.querySelector(".rider-location");
            if (locationEl) {
              locationEl.innerHTML = `
                    <span class="tracking-dot tracking-moving"></span>
                    Live: ${data.location.lat.toFixed(4)}, ${data.location.lng.toFixed(4)}
                `;
              locationEl.title =
                data.location.address || "Location updated just now";
            }
          });
        }

        function displayMessage(message, type) {
          if (!messageContainer) return;
          messageContainer.innerHTML = `<div class="message ${type}">${message}</div>`;
          setTimeout(() => {
            messageContainer.innerHTML = "";
          }, 6000);
        }

        function clearAdminSession() {
          adminToken = "";
          localStorage.removeItem("admin_jwt_token");
          if (socket) {
            socket.disconnect();
            socket = null;
            window.adminSocket = null;
          }
        }

        function redirectToLogin(reason = "") {
          const suffix = reason ? `?reason=${encodeURIComponent(reason)}` : "";
          window.location.replace(`./login.html${suffix}`);
        }

        function formatCurrency(amount) {
          return new Intl.NumberFormat("en-NG", {
            style: "currency",
            currency: "NGN",
            maximumFractionDigits: 0,
          }).format(Number(amount) || 0);
        }

        function formatCompactNumber(value) {
          return new Intl.NumberFormat("en-NG", {
            notation: "compact",
            maximumFractionDigits: 1,
          }).format(Number(value) || 0);
        }

        function formatPercent(value) {
          return `${Math.round(Number(value) || 0)}%`;
        }

        function formatSignedPercent(value) {
          const numericValue = Number(value || 0);

          if (!Number.isFinite(numericValue)) {
            return "0.0%";
          }

          const roundedValue = Number(numericValue.toFixed(1));

          if (roundedValue > 0) {
            return `+${roundedValue}%`;
          }

          return `${roundedValue}%`;
        }

        function getTrendTone(changePercent, positiveIsGood = true) {
          const numericValue = Number(changePercent || 0);

          if (Math.abs(numericValue) < 5) {
            return "medium";
          }

          if (numericValue > 0) {
            return positiveIsGood ? "good" : "high";
          }

          return positiveIsGood ? "high" : "good";
        }

        function getTrendBadge(changePercent) {
          const numericValue = Number(changePercent || 0);

          if (!Number.isFinite(numericValue) || Math.abs(numericValue) < 0.05) {
            return "Flat";
          }

          return `${numericValue > 0 ? "Up" : "Down"} ${Math.abs(numericValue).toFixed(1)}%`;
        }

        function getTrendNarrative(changePercent, positiveIsGood = true) {
          const numericValue = Number(changePercent || 0);

          if (!Number.isFinite(numericValue) || Math.abs(numericValue) < 0.05) {
            return "holding steady versus the previous period";
          }

          const direction = numericValue > 0 ? "up" : "down";

          if (positiveIsGood) {
            return `${direction} ${Math.abs(numericValue).toFixed(1)}% versus the previous period`;
          }

          return `${direction} ${Math.abs(numericValue).toFixed(1)}% versus the previous period, which changes payout exposure`;
        }

        function getAnalyticsRangeBounds() {
          if (
            !analyticsRangeWindow?.startDate ||
            !analyticsRangeWindow?.endDate
          ) {
            return null;
          }

          const startDate = new Date(analyticsRangeWindow.startDate);
          const endDate = new Date(analyticsRangeWindow.endDate);

          if (
            Number.isNaN(startDate.getTime()) ||
            Number.isNaN(endDate.getTime())
          ) {
            return null;
          }

          return { startDate, endDate };
        }

        function filterCollectionByAnalyticsRange(items, getDateValue) {
          const records = Array.isArray(items) ? items : [];
          const rangeBounds = getAnalyticsRangeBounds();

          if (!rangeBounds) {
            return records;
          }

          return records.filter((item) => {
            const rawDate = getDateValue(item);

            if (!rawDate) {
              return false;
            }

            const parsedDate = new Date(rawDate);

            if (Number.isNaN(parsedDate.getTime())) {
              return false;
            }

            return (
              parsedDate >= rangeBounds.startDate &&
              parsedDate < rangeBounds.endDate
            );
          });
        }

        function formatDateTime(value) {
          if (!value) return "Not yet";
          const parsedDate = new Date(value);
          if (Number.isNaN(parsedDate.getTime())) return "Not available";
          return parsedDate.toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          });
        }

        function getAdminDisplayName(admin) {
          if (!admin) return "System";
          return admin.name || admin.email || "Admin";
        }

        function escapeHtml(value = "") {
          return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
        }

        function formatStatusLabel(value = "") {
          return String(value || "none")
            .replace(/_/g, " ")
            .toUpperCase();
        }

        function formatBusinessLocation(location) {
          if (!location) return "N/A";
          if (typeof location === "string") return location || "N/A";
          return (
            location.formattedAddress ||
            location.address ||
            location.city ||
            "N/A"
          );
        }

        function renderOrderItemMetadata(item = {}) {
          const details = [];
          const category = String(item.category || "");
          const isRestaurant =
            category === "Restaurant" ||
            category.startsWith("Restaurant > ") ||
            Boolean(item.restaurantName);
          const isMedicine = Boolean(
            item.medicineAccess ||
            item.requiresPrescription ||
            item.requiresPharmacistApproval,
          );

          if (isRestaurant) {
            details.push(
              `<span class="text-xs text-orange-300 font-semibold">Restaurant: ${escapeHtml(item.restaurantName || "Restaurant vendor")}</span>`,
            );
            if (item.foodInformation) {
              details.push(
                `<span class="text-xs text-light-gray">${escapeHtml(item.foodInformation)}</span>`,
              );
            }
            if (item.orderStartTime || item.orderEndTime) {
              details.push(
                `<span class="text-xs text-yellow-300">Order window: ${escapeHtml(item.orderStartTime || "09:00")} - ${escapeHtml(item.orderEndTime || "19:00")}</span>`,
              );
            }
          }

          if (isMedicine) {
            const access = formatStatusLabel(
              item.medicineAccess || "over_the_counter",
            );
            details.push(
              `<span class="text-xs text-cyan-300 font-semibold">Medicine access: ${access}</span>`,
            );
            if (item.requiresPrescription) {
              details.push(
                '<span class="text-xs text-red-300">Prescription required</span>',
              );
            } else if (item.requiresPharmacistApproval) {
              details.push(
                '<span class="text-xs text-yellow-300">Pharmacist guidance required</span>',
              );
            } else if (item.isOverTheCounter) {
              details.push(
                '<span class="text-xs text-green-300">Over-the-counter</span>',
              );
            }
          }

          if (!details.length) return "";
          return `<div class="mt-1 flex flex-col gap-1">${details.join("")}</div>`;
        }

// Helper function to calculate distance (same as backend)
        function calculateDistance(lat1, lon1, lat2, lon2) {
          const R = 6371; // Radius of the Earth in kilometers
          const dLat = (lat2 - lat1) * (Math.PI / 180);
          const dLon = (lon2 - lon1) * (Math.PI / 180);
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) *
              Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) *
              Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = R * c; // Distance in km
          return parseFloat(distance.toFixed(2));
        }

        function handleAdminSessionExpiry(status) {
          if (status === 401 || status === 403) {
            displayMessage(
              "Session expired. Redirecting to login...",
              "warning",
            );
            clearAdminSession();
            setTimeout(() => redirectToLogin("expired"), 1200);
            return true;
          }

          return false;
        }
