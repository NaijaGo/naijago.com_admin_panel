        // Orders Management – Enhanced with payout system
        // ──────────────────────────────────────────────
        let onlineRidersState = window.latestOnlineRiders || {
          individualRiders: [],
          companyRiders: [],
          total: 0,
        };

        window.addEventListener("online-riders-updated", (event) => {
          onlineRidersState = event.detail || {
            individualRiders: [],
            companyRiders: [],
            total: 0,
          };
          if (Array.isArray(allOrders) && allOrders.length) {
            renderOrders(applyFilter(allOrders));
          }
        });

        function updateDispatchCountdowns() {
          document.querySelectorAll(".dispatch-timeout-countdown").forEach((node) => {
            const assignedAt = Number(node.dataset.assignedAt || 0);
            const timeoutSeconds = Number(node.dataset.timeoutSeconds || 600);
            if (!assignedAt) return;
            const remainingSeconds = Math.max(
              0,
              Math.ceil((assignedAt + timeoutSeconds * 1000 - Date.now()) / 1000),
            );
            node.textContent = `${remainingSeconds}s left`;
            node.classList.toggle("text-red-300", remainingSeconds === 0);
            node.classList.toggle("text-yellow-300", remainingSeconds > 0);
          });
        }

        setInterval(updateDispatchCountdowns, 1000);

        function requestOnlineRiders() {
          const adminSocket = window.adminSocket;
          if (adminSocket?.connected) {
            adminSocket.emit("get_online_riders");
          }
        }

        async function fetchOrders() {
          if (!adminToken) {
            if (ordersList) {
              ordersList.innerHTML =
                '<p class="text-center text-red-500">Please login as admin to view orders.</p>';
            }
            return;
          }
          if (ordersList) {
            ordersList.innerHTML =
              '<p class="text-center text-light-gray">Loading orders...</p>';
          }
          try {
            const res = await fetch(`${BASE_URL}/api/orders/admin`, {
              headers: { Authorization: `Bearer ${adminToken}` },
            });
            const data = await res.json();
            if (res.ok) {
              allOrders = data;
              renderOrders(applyFilter(allOrders));
              requestOnlineRiders();
              updateAnalyticsView();
            } else {
              if (ordersList) {
                ordersList.innerHTML = `<p class="text-center text-red-500">${data.message || "Failed to fetch orders"}</p>`;
              }
            }
          } catch (err) {
            if (ordersList) {
              ordersList.innerHTML = `<p class="text-center text-red-500">Network error: ${err.message}</p>`;
            }
          }
        }

        function applyFilter(orders) {
          if (currentFilter === "all") return orders;
          return orders.filter((o) => o.mainOrderStatus === currentFilter);
        }

        function assignedPersonName(person, fallback = "Assigned") {
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

        function assignedPersonPhone(person) {
          return (
            person?.phoneNumber ||
            person?.contactPhone ||
            person?.businessSupportPhone ||
            "No phone"
          );
        }

        function getOnlineRiderChoices() {
          const individualRiders = Array.isArray(onlineRidersState.individualRiders)
            ? onlineRidersState.individualRiders
            : [];
          const companyRiders = Array.isArray(onlineRidersState.companyRiders)
            ? onlineRidersState.companyRiders
            : [];

          return [
            ...individualRiders.map((rider) => ({
              ...rider,
              riderType: "individual",
              labelPrefix: "Individual",
            })),
            ...companyRiders.map((rider) => ({
              ...rider,
              riderType: "company",
              labelPrefix: rider.companyName
                ? `Company: ${rider.companyName}`
                : "Company Rider",
            })),
          ].filter((rider) => rider.riderId || rider._id);
        }

        function renderRiderAssignControls(order) {
          const riderChoices = getOnlineRiderChoices();
          const orderId = order._id || order.id || "";
          const onlineTotal =
            typeof onlineRidersState.total === "number"
              ? onlineRidersState.total
              : riderChoices.length;

          if (!riderChoices.length) {
            return `
              <div class="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p class="text-sm text-yellow-200">No riders are online right now. Ask a rider to open the rider app and go online, then refresh.</p>
                <button type="button" class="btn btn-primary-alt refresh-online-riders-btn px-4 py-2 text-sm">Refresh Online Riders</button>
              </div>
            `;
          }

          const options = riderChoices
            .map((rider) => {
              const riderId = rider.riderId || rider._id || "";
              const companyId = rider.companyId || "";
              const availability = rider.isAvailable ? "Available" : "Online";
              const plate = rider.plateNumber ? ` | ${rider.plateNumber}` : "";
              const phone = rider.phoneNumber ? ` | ${rider.phoneNumber}` : "";
              const label = `${rider.labelPrefix}: ${rider.fullName || "Rider"}${phone}${plate} (${availability})`;
              const value = `${rider.riderType}|${riderId}|${companyId}`;
              return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
            })
            .join("");

          return `
            <div class="mt-4 rounded-lg border border-yellow-300 border-opacity-20 bg-black bg-opacity-20 p-3">
              <div class="mb-2 flex items-center justify-between gap-3">
                <p class="text-sm font-semibold text-yellow-200">${onlineTotal} rider${onlineTotal === 1 ? "" : "s"} online</p>
                <button type="button" class="text-xs text-accent-cyan refresh-online-riders-btn">Refresh</button>
              </div>
              <div class="flex flex-col gap-3 md:flex-row">
                <select
                  class="assign-rider-select flex-1 rounded-lg border border-accent-cyan bg-[#1C2B47] px-3 py-2 text-light-slate"
                  data-rider-select-for="${escapeHtml(orderId)}"
                >
                  ${options}
                </select>
                <button
                  type="button"
                  class="btn btn-success assign-rider-btn px-5 py-2"
                  data-order-id="${escapeHtml(orderId)}"
                >
                  Assign Rider
                </button>
              </div>
            </div>
          `;
        }

        function renderAssignedRiderLine(label, rider, extra = "") {
          if (!rider) return "";
          const riderId = rider._id || rider.id || rider.riderId || "";
          return `
            <p class="text-sm text-light-gray">
              <strong>${label}:</strong>
              <span class="text-light-slate">${escapeHtml(assignedPersonName(rider, "Assigned rider"))}</span>
              <span class="text-accent-cyan">${escapeHtml(assignedPersonPhone(rider))}</span>
              ${rider.plateNumber ? ` | Plate: ${escapeHtml(rider.plateNumber)}` : ""}
              ${riderId ? ` | ID: ${escapeHtml(riderId)}` : ""}
              ${extra}
            </p>
          `;
        }

        function assignedAtMs(value) {
          const parsed = value ? new Date(value).getTime() : NaN;
          return Number.isFinite(parsed) ? parsed : null;
        }

        function formatLastSeenFromLocation(location) {
          const lastUpdated = location?.lastUpdated || location?.timestamp;
          const parsed = lastUpdated ? new Date(lastUpdated).getTime() : NaN;
          if (!Number.isFinite(parsed)) return "never";
          const seconds = Math.max(0, Math.floor((Date.now() - parsed) / 1000));
          if (seconds < 60) return `${seconds}s ago`;
          const minutes = Math.floor(seconds / 60);
          if (minutes < 60) return `${minutes} min ago`;
          const hours = Math.floor(minutes / 60);
          if (hours < 24) return `${hours} hr ago`;
          return `${Math.floor(hours / 24)} day(s) ago`;
        }

        function isFreshLocation(location) {
          const lastUpdated = location?.lastUpdated || location?.timestamp;
          const parsed = lastUpdated ? new Date(lastUpdated).getTime() : NaN;
          return Number.isFinite(parsed) && Date.now() - parsed <= 10 * 60 * 1000;
        }

        function firstVendorLocation(order) {
          const shipment = Array.isArray(order.shipments) ? order.shipments[0] : null;
          return shipment?.vendorLocation || shipment?.vendor?.businessLocation || null;
        }

        function distanceToVendor(order, rider) {
          const location = rider?.currentLocation || rider?.location || {};
          const vendorLocation = firstVendorLocation(order);
          const riderLat = location.lat ?? location.latitude;
          const riderLng = location.lng ?? location.longitude;
          const vendorLat = vendorLocation?.latitude ?? vendorLocation?.lat;
          const vendorLng = vendorLocation?.longitude ?? vendorLocation?.lng;
          if ([riderLat, riderLng, vendorLat, vendorLng].some((value) => value === undefined || value === null || Number.isNaN(Number(value)))) {
            return null;
          }
          return calculateDistance(Number(riderLat), Number(riderLng), Number(vendorLat), Number(vendorLng));
        }

        function renderDispatchTelemetry(order, rider, statusLabel) {
          if (!rider) return "";
          const location = rider.currentLocation || rider.location || {};
          const fresh = isFreshLocation(location);
          const distance = distanceToVendor(order, rider);
          const assignedMs = assignedAtMs(order.assignedAt);
          const timeoutSeconds = Number(window.RIDER_ASSIGNMENT_TIMEOUT_SECONDS || 600);
          const remainingSeconds =
            assignedMs && !order.isClaimed
              ? Math.max(0, Math.ceil((assignedMs + timeoutSeconds * 1000 - Date.now()) / 1000))
              : null;
          const timeoutHtml =
            remainingSeconds === null
              ? '<span class="text-green-300">Accepted</span>'
              : `<span class="dispatch-timeout-countdown ${remainingSeconds === 0 ? "text-red-300" : "text-yellow-300"}" data-assigned-at="${assignedMs}" data-timeout-seconds="${timeoutSeconds}">${remainingSeconds}s left</span>`;
          const locationText =
            location.lat != null && location.lng != null
              ? `${Number(location.lat).toFixed(5)}, ${Number(location.lng).toFixed(5)}`
              : "No GPS point";

          return `
            <div class="mt-3 grid gap-2 rounded-lg border border-cyan-300 border-opacity-20 bg-black bg-opacity-20 p-3 text-sm md:grid-cols-2">
              <p class="text-light-gray"><strong>Status:</strong> <span class="text-light-slate">${escapeHtml(statusLabel)}</span></p>
              <p class="text-light-gray"><strong>Accept timeout:</strong> ${timeoutHtml}</p>
              <p class="text-light-gray"><strong>Last seen:</strong> <span class="${fresh ? "text-green-300" : "text-yellow-300"}">${escapeHtml(formatLastSeenFromLocation(location))} • ${fresh ? "GPS fresh" : "GPS stale"}</span></p>
              <p class="text-light-gray"><strong>Distance to vendor:</strong> <span class="text-accent-cyan">${distance === null ? "Unknown" : `${distance.toFixed(2)} km`}</span></p>
              <p class="text-light-gray md:col-span-2"><strong>Last location:</strong> <span class="text-light-slate">${escapeHtml(location.address || locationText)}</span></p>
            </div>
          `;
        }

        function renderOrderAssignmentPanel(order, mainRider) {
          const company = order.company || order.assignedToCompany;
          const pendingAssignedRider =
            order.assignedRider && !order.isClaimed ? order.assignedRider : null;
          const companyDeliveries = Array.isArray(order.companyDeliveries)
            ? order.companyDeliveries
            : [];
          const shipmentRiders = (order.shipments || [])
            .map((shipment, index) => ({ shipment, index }))
            .filter(({ shipment }) => shipment.rider);

          if (!mainRider && !pendingAssignedRider && !company && !companyDeliveries.length && !shipmentRiders.length) {
            return `
              <div class="rounded-lg border border-yellow-400 border-opacity-30 bg-yellow-900 bg-opacity-20 p-4 my-4">
                <p class="font-bold text-yellow-300">No rider assigned yet</p>
                <p class="text-sm text-light-gray mt-1">This order is still waiting for dispatch assignment.</p>
                ${renderRiderAssignControls(order)}
              </div>
            `;
          }

          const companyDeliveryHtml = companyDeliveries
            .map((delivery) => {
              const deliveryCompany = delivery.company || company;
              const deliveryRider = delivery.rider;
              return `
                <div class="rounded-lg border border-cyan-300 border-opacity-20 bg-cyan-300 bg-opacity-5 p-3">
                  <p class="text-sm text-light-gray">
                    <strong>Company Delivery:</strong>
                    <span class="text-light-slate">${escapeHtml(delivery.deliveryId || delivery._id || "Delivery")}</span>
                    | Status: <span class="text-accent-cyan">${escapeHtml(formatStatusLabel(delivery.status || "pending"))}</span>
                  </p>
                  ${
                    deliveryCompany
                      ? `<p class="text-sm text-light-gray"><strong>Company:</strong> ${escapeHtml(assignedPersonName(deliveryCompany, "Assigned company"))} (${escapeHtml(assignedPersonPhone(deliveryCompany))})</p>`
                      : ""
                  }
                  ${
                    deliveryRider
                      ? renderAssignedRiderLine("Company Rider", deliveryRider)
                      : '<p class="text-sm text-yellow-300"><strong>Company Rider:</strong> Company has not assigned a specific rider yet.</p>'
                  }
                </div>
              `;
            })
            .join("");

          const shipmentRiderHtml = shipmentRiders
            .map(({ shipment, index }) =>
              renderAssignedRiderLine(
                `Shipment ${index + 1} Rider`,
                shipment.rider,
                ` | Status: ${escapeHtml(formatStatusLabel(shipment.shipmentStatus || "processing"))}`,
              ),
            )
            .join("");

          return `
            <div class="rounded-lg border border-cyan-400 border-opacity-20 bg-blue-900 bg-opacity-20 p-4 my-4">
              <h4 class="font-bold text-accent-cyan mb-2">Assigned Rider / Delivery</h4>
              ${pendingAssignedRider ? renderAssignedRiderLine("Offer Sent To", pendingAssignedRider) : ""}
              ${pendingAssignedRider ? renderDispatchTelemetry(order, pendingAssignedRider, "Waiting for rider accept/reject") : ""}
              ${mainRider ? renderAssignedRiderLine("Main Order Rider", mainRider) : ""}
              ${mainRider ? renderDispatchTelemetry(order, mainRider, "Accepted active rider") : ""}
              ${
                company && !companyDeliveries.length
                  ? `<p class="text-sm text-light-gray"><strong>Assigned Company:</strong> ${escapeHtml(assignedPersonName(company, "Assigned company"))} (${escapeHtml(assignedPersonPhone(company))})</p>`
                  : ""
              }
              ${shipmentRiderHtml}
              ${companyDeliveryHtml}
            </div>
          `;
        }

        function renderOrders(orders) {
          if (!ordersList) return;

          ordersList.innerHTML = "";
          if (!orders.length) {
            ordersList.innerHTML =
              '<p class="text-center text-light-gray">No orders found matching the filter criteria.</p>';
            return;
          }

          orders.forEach((order) => {
            const card = document.createElement("div");
            card.className = "card order-card";

            if (order.mainOrderStatus === "delivered") {
              card.classList.add("pending-payout-card");
            } else if (order.mainOrderStatus === "completed") {
              card.classList.add("payout-card");
            }

            const user = order.user || {};
            const shipping = order.shippingAddress || {};
            const rider =
              order.rider && typeof order.rider === "object"
                ? order.rider
                : order.rider
                  ? { _id: order.rider }
                  : null;
            const hasAssignment =
              Boolean(order.assignedRider) ||
              Boolean(rider) ||
              Boolean(order.company) ||
              Boolean(order.assignedToCompany) ||
              Boolean(order.companyDeliveries?.length) ||
              Boolean(order.shipments?.some((shipment) => shipment.rider));

            const statusLower = (
              order.mainOrderStatus || "pending_payment"
            ).toLowerCase();

            const riderPayoutBreakdown = order.riderPayoutBreakdown || {};
            const payoutShipmentBreakdowns = Array.isArray(
              riderPayoutBreakdown.shipments,
            )
              ? riderPayoutBreakdown.shipments
              : [];
            let totalRiderPayout =
              Number(order.riderPayoutAmount || riderPayoutBreakdown.amount || 0) ||
              0;
            let totalVendorPayout = 0;

            if (order.shipments?.length) {
              order.shipments.forEach((shipment) => {
                if (!totalRiderPayout && shipment.vendorLocation && order.userLocation) {
                  const distance = calculateDistance(
                    shipment.vendorLocation.latitude,
                    shipment.vendorLocation.longitude,
                    order.userLocation.latitude,
                    order.userLocation.longitude,
                  );
                  totalRiderPayout += distance * 150;
                }
                // Vendor gets subtotal - platformFee
                totalVendorPayout +=
                  (shipment.subtotal || 0) - (shipment.platformFee || 0);
              });
            }
            const riderDistanceKm = Number(
              riderPayoutBreakdown.totalDistanceKm ||
                payoutShipmentBreakdowns.reduce(
                  (sum, item) => sum + Number(item.distanceKm || 0),
                  0,
                ) ||
                0,
            );
            const riderRatePerKm = Number(riderPayoutBreakdown.ratePerKm || 150);
            const riderPayoutMethod =
              riderPayoutBreakdown.method === "shipping_share"
                ? "shipping share fallback"
                : riderPayoutBreakdown.method === "mixed"
                  ? "mixed distance/fallback"
                  : "distance rate";

            let itemsHtml = "";
            if (order.shipments?.length) {
              order.shipments.forEach((s, i) => {
                const v = s.vendor || {};
                itemsHtml += `
                        <h4 class="text-sm font-semibold mt-4 mb-2 text-accent-cyan border-b border-gray-700 pb-1">
                            📦 Shipment ${i + 1} (Vendor: ${v.businessName || "N/A"})
                        </h4>
                        <p class="text-xs text-light-gray mb-1 ml-2">
                            Vendor Phone: ${v.phoneNumber || "N/A"} | Location: ${v.businessLocation?.formattedAddress || "N/A"}
                        </p>
                        ${
                          s.rider
                            ? `<p class="text-xs text-green-300 mb-1 ml-2">Assigned Rider: ${escapeHtml(assignedPersonName(s.rider, "Assigned rider"))} | ${escapeHtml(assignedPersonPhone(s.rider))}${s.rider.plateNumber ? ` | Plate: ${escapeHtml(s.rider.plateNumber)}` : ""}</p>`
                            : ""
                        }
                        <p class="text-xs text-yellow-400 mb-2 ml-2">
                            Vendor Payout: ₦${((s.subtotal || 0) - (s.platformFee || 0)).toFixed(2)} | Platform Fee: ₦${(s.platformFee || 0).toFixed(2)}
                            ${
                              s.subscriptionFreeDeliveryApplied
                                ? ` | Subscription Discount: ₦${(s.subscriptionDeliveryDiscount || 0).toFixed(2)}`
                                : ""
                            }
                        </p>`;
                s.items?.forEach((item) => {
                  let sizeDisplay = "";
                  if (item.selectedSize) {
                    if (typeof item.selectedSize === "string") {
                      sizeDisplay = `Size: ${item.selectedSize}`;
                    } else if (typeof item.selectedSize === "object") {
                      const sizeObj = item.selectedSize;
                      if (sizeObj.label) {
                        sizeDisplay = `Size: ${sizeObj.label}`;
                        if (sizeObj.length || sizeObj.width || sizeObj.height) {
                          const unit = sizeObj.unit || "CM";
                          sizeDisplay += ` (${sizeObj.length || "0"}×${sizeObj.width || "0"}×${sizeObj.height || "0"} ${unit})`;
                        }
                      } else if (
                        sizeObj.length ||
                        sizeObj.width ||
                        sizeObj.height
                      ) {
                        const unit = sizeObj.unit || "CM";
                        sizeDisplay = `Dimensions: ${sizeObj.length || "0"}×${sizeObj.width || "0"}×${sizeObj.height || "0"} ${unit}`;
                      } else {
                        sizeDisplay = "Custom Size";
                      }
                    }
                  }

                  itemsHtml += `
                            <li class="text-light-gray mb-2 border-l-2 border-green-500 pl-2 ml-2">
                                <strong class="text-light-slate">${item.name}</strong> - Qty: ${item.quantity} - ₦${item.price?.toFixed(2) || "0.00"}
                                ${sizeDisplay ? `<br><span class="text-xs text-accent-cyan font-medium">${sizeDisplay}</span>` : ""}
                                ${renderOrderItemMetadata(item)}
                                <br><span class="text-xs text-gray-500">Shipment ID: ${s._id} | Status: ${s.shipmentStatus}</span>
                            </li>`;
                });
              });
            } else {
              itemsHtml =
                '<p class="text-red-500">No shipments linked to this order.</p>';
            }

            const currentStatus = statusLower;

            const isDisabled = (target) => {
              switch (currentStatus) {
                case "completed":
                case "cancelled":
                  return true;
                case "delivered":
                  return !["completed", "cancelled"].includes(target);
                case "out_for_delivery":
                  return !["delivered", "completed", "cancelled"].includes(
                    target,
                  );
                case "shipped":
                  return ![
                    "out_for_delivery",
                    "delivered",
                    "completed",
                    "cancelled",
                  ].includes(target);
                case "partially_shipped":
                  return ![
                    "shipped",
                    "out_for_delivery",
                    "delivered",
                    "completed",
                    "cancelled",
                  ].includes(target);
                case "processing":
                  return ![
                    "partially_shipped",
                    "shipped",
                    "out_for_delivery",
                    "delivered",
                    "completed",
                    "cancelled",
                  ].includes(target);
                case "pending_payment":
                  return !["processing", "cancelled"].includes(target);
                default:
                  return ![
                    "pending_payment",
                    "processing",
                    "cancelled",
                  ].includes(target);
              }
            };

            const getBtnClass = (target) => {
              let cls = "status-btn px-3 py-1 text-sm font-medium";
              if (target === currentStatus) return `${cls} btn-current`;
              if (isDisabled(target)) return `${cls} btn-disabled`;
              if (target === "cancelled") return `${cls} btn-danger`;
              if (target === "completed") return `${cls} btn-success`;
              if (target === "delivered") return `${cls} btn-warning`;
              return `${cls} btn-primary-alt`;
            };

            const btns = `
                <button class="${getBtnClass("pending_payment")}" ${isDisabled("pending_payment") ? "disabled" : ""} data-order-id="${order._id}" data-status="pending_payment">Pending Payment</button>
                <button class="${getBtnClass("processing")}" ${isDisabled("processing") ? "disabled" : ""} data-order-id="${order._id}" data-status="processing">Processing</button>
                <button class="${getBtnClass("partially_shipped")}" ${isDisabled("partially_shipped") ? "disabled" : ""} data-order-id="${order._id}" data-status="partially_shipped">Partially Shipped</button>
                <button class="${getBtnClass("shipped")}" ${isDisabled("shipped") ? "disabled" : ""} data-order-id="${order._id}" data-status="shipped">Shipped</button>
                <button class="${getBtnClass("out_for_delivery")}" ${isDisabled("out_for_delivery") ? "disabled" : ""} data-order-id="${order._id}" data-status="out_for_delivery">Out for Delivery</button>
                <button class="${getBtnClass("delivered")}" ${isDisabled("delivered") ? "disabled" : ""} data-order-id="${order._id}" data-status="delivered">Mark Delivered</button>
                <button class="${getBtnClass("completed")}" ${isDisabled("completed") ? "disabled" : ""} data-order-id="${order._id}" data-status="completed">Complete & Pay</button>
                <button class="${getBtnClass("cancelled")}" ${isDisabled("cancelled") ? "disabled" : ""} data-order-id="${order._id}" data-status="cancelled">Cancel</button>
            `;

            card.innerHTML = `
                <div class="flex justify-between items-start mb-3">
                    <h3 class="text-2xl font-semibold text-accent-cyan">Order ID: ${order._id}</h3>
                    ${hasAssignment ? `<span class="status-badge status-delivered">Rider Assigned</span>` : `<span class="status-badge status-pending">Awaiting Rider</span>`}
                </div>
                <p class="text-light-gray mb-1"><strong>User:</strong> ${user.firstName || "N/A"} ${user.lastName || ""} (<span class="text-accent-cyan">${user.email || "N/A"}</span>)</p>
                <p class="text-light-gray mb-1"><strong>Phone:</strong> ${user.phoneNumber || "N/A"}</p>
                <p class="text-light-gray mb-1"><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>
                <p class="text-light-gray mb-1"><strong>Paid:</strong> <span class="font-bold ${order.isPaid ? "text-green-400" : "text-red-400"}">${order.isPaid ? "Yes" : "No"}</span></p>
                ${
                  order.subscriptionFreeDeliveryApplied
                    ? `<p class="text-green-300 mb-1"><strong>Subscription:</strong> ${order.subscriptionPlanId || "Plan"} free delivery applied • Saved ₦${(order.subscriptionDeliveryDiscount || 0).toFixed(2)} • Consumed: ${order.subscriptionDeliveryConsumed ? "Yes" : "Pending payment"}</p>`
                    : ""
                }
                ${renderOrderAssignmentPanel(order, rider)}
                
                <!-- Payout Information Box -->
                ${
                  order.mainOrderStatus === "delivered" ||
                  order.mainOrderStatus === "completed"
                    ? `
                <div class="${order.mainOrderStatus === "delivered" ? "bg-yellow-900 bg-opacity-30" : "bg-green-900 bg-opacity-30"} p-4 rounded-lg my-4 border ${order.mainOrderStatus === "delivered" ? "border-yellow-700" : "border-green-700"}">
                    <h4 class="font-bold ${order.mainOrderStatus === "delivered" ? "text-yellow-300" : "text-green-300"} mb-2">
                        ${order.mainOrderStatus === "delivered" ? "💰 READY FOR PAYOUT" : "✅ PAYOUT COMPLETED"}
                    </h4>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <p class="text-sm text-gray-300">Total Vendor Payout:</p>
                            <p class="text-xl font-bold ${order.mainOrderStatus === "delivered" ? "text-yellow-300" : "text-green-300"}">₦${totalVendorPayout.toFixed(2)}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-300">Total Rider Payout:</p>
                            <p class="text-xl font-bold ${order.mainOrderStatus === "delivered" ? "text-yellow-300" : "text-green-300"}">₦${totalRiderPayout.toFixed(2)}</p>
                            <p class="text-xs text-gray-300">${riderDistanceKm.toFixed(2)} km × ₦${riderRatePerKm.toFixed(2)}/km • ${riderPayoutMethod}</p>
                        </div>
                    </div>
                    ${
                      order.mainOrderStatus === "delivered"
                        ? `
                    <p class="text-xs text-yellow-200 mt-2">Click "Complete & Pay" to process payouts to vendor(s) and rider simultaneously.</p>
                    `
                        : `
                    <p class="text-xs text-green-200 mt-2">Payouts completed on ${order.vendorPaidAt ? new Date(order.vendorPaidAt).toLocaleString() : new Date(order.deliveredAt).toLocaleString()}</p>
                    `
                    }
                </div>
                `
                    : ""
                }
                
                <div class="mb-2"><strong>Status:</strong> <span class="font-bold text-lg ${order.mainOrderStatus === "delivered" ? "text-yellow-400" : order.mainOrderStatus === "completed" ? "text-green-400" : "text-blue-400"}">${order.mainOrderStatus || "N/A"}</span></div>
                <div class="mb-4">
                    <strong>Shipping Address:</strong><br>
                    <span class="text-light-gray">${shipping.address || "N/A"}, ${shipping.city || "N/A"}, ${shipping.postalCode || "N/A"}, ${shipping.country || "N/A"}</span>
                </div>
                <p class="text-light-slate text-xl font-bold mb-2">🛒 Items & Shipments:</p>
                <ul class="list-none mb-6">${itemsHtml}</ul>
                <div class="border-t border-gray-700 pt-4">
                    <h4 class="text-light-slate font-semibold mb-2">Update Status:</h4>
                    <div class="flex flex-wrap gap-2">${btns}</div>
                    <p class="text-xs text-light-gray mt-2">
                        • Enabled buttons follow valid order flow.<br>
                        • <strong class="text-yellow-400">"Mark Delivered"</strong> = Physical delivery confirmed.<br>
                        • <strong class="text-green-400">"Complete & Pay"</strong> = Process payouts to vendor(s) and rider simultaneously (150/km).<br>
                        • Customer app status updates automatically after each admin change.
                    </p>
                </div>
            `;

            ordersList.appendChild(card);
          });

          document
            .querySelectorAll(
              ".status-btn:not(.btn-current):not(.btn-disabled)",
            )
            .forEach((btn) => {
              btn.addEventListener("click", async (e) => {
                const orderId = btn.dataset.orderId;
                const newStatus = btn.dataset.status;
                const container = btn.closest(".flex.flex-wrap.gap-2");
                const siblings =
                  container?.querySelectorAll(".status-btn") || [];

                siblings.forEach((b) => (b.disabled = true));

                try {
                  const res = await fetch(
                    `${BASE_URL}/api/orders/${orderId}/status`,
                    {
                      method: "PUT",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${adminToken}`,
                      },
                      body: JSON.stringify({ status: newStatus }),
                    },
                  );
                  const data = await res.json();
                  if (res.ok) {
                    const statusLabel = newStatus
                      .replace(/_/g, " ")
                      .toUpperCase();
                    if (newStatus === "completed") {
                      displayMessage(
                        `✅ Order completed. Customer app updated and vendor payouts have been processed.`,
                        "success",
                      );
                    } else {
                      displayMessage(
                        `Status updated to ${statusLabel}. Customer app will reflect the new order stage.`,
                        "success",
                      );
                    }
                    fetchOrders();
                  } else {
                    displayMessage(data.message || "Update failed", "error");
                    siblings.forEach((b) => (b.disabled = false));
                  }
                } catch (err) {
                  displayMessage(`Network error`, "error");
                  siblings.forEach((b) => (b.disabled = false));
                }
              });
            });

          document
            .querySelectorAll(".refresh-online-riders-btn")
            .forEach((button) => {
              button.addEventListener("click", () => {
                requestOnlineRiders();
                displayMessage("Refreshing online riders...", "success");
              });
            });

          document.querySelectorAll(".assign-rider-btn").forEach((button) => {
            button.addEventListener("click", () => {
              const orderId = button.dataset.orderId;
              const adminSocket = window.adminSocket;
              const select = button
                .closest(".order-card")
                ?.querySelector(".assign-rider-select");
              const selectedValue = select?.value || "";
              const [riderType, riderId, companyId] = selectedValue.split("|");

              if (!adminSocket?.connected) {
                displayMessage(
                  "Real-time server is not connected yet. Refresh the page and try again.",
                  "error",
                );
                return;
              }

              if (!orderId || !riderId) {
                displayMessage("Choose an online rider first.", "error");
                return;
              }

              button.disabled = true;
              button.textContent = "Assigning...";
              adminSocket.emit("assign_rider_to_order", {
                orderId,
                riderId,
                riderType: riderType || "individual",
                ...(companyId ? { companyId } : {}),
              });

              setTimeout(() => {
                if (button.isConnected) {
                  button.disabled = false;
                  button.textContent = "Assign Rider";
                }
              }, 8000);
            });
          });
        }

        // ──────────────────────────────────────────────
