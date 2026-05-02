        // Orders Management – Enhanced with payout system
        // ──────────────────────────────────────────────
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
            const res = await fetch(`${BASE_URL}/api/orders`, {
              headers: { Authorization: `Bearer ${adminToken}` },
            });
            const data = await res.json();
            if (res.ok) {
              allOrders = data;
              renderOrders(applyFilter(allOrders));
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

            const statusLower = (
              order.mainOrderStatus || "pending_payment"
            ).toLowerCase();

            // Calculate potential rider payout (150/km per shipment)
            let totalRiderPayout = 0;
            let totalVendorPayout = 0;

            if (order.shipments?.length) {
              order.shipments.forEach((shipment) => {
                if (shipment.vendorLocation && order.userLocation) {
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
                        <p class="text-xs text-yellow-400 mb-2 ml-2">
                            Vendor Payout: ₦${((s.subtotal || 0) - (s.platformFee || 0)).toFixed(2)} | Platform Fee: ₦${(s.platformFee || 0).toFixed(2)}
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
                    ${order.rider ? `<span class="status-badge status-delivered">Rider Assigned</span>` : ""}
                </div>
                <p class="text-light-gray mb-1"><strong>User:</strong> ${user.firstName || "N/A"} ${user.lastName || ""} (<span class="text-accent-cyan">${user.email || "N/A"}</span>)</p>
                <p class="text-light-gray mb-1"><strong>Phone:</strong> ${user.phoneNumber || "N/A"}</p>
                <p class="text-light-gray mb-1"><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>
                <p class="text-light-gray mb-1"><strong>Paid:</strong> <span class="font-bold ${order.isPaid ? "text-green-400" : "text-red-400"}">${order.isPaid ? "Yes" : "No"}</span></p>
                ${rider ? `<p class="text-light-gray mb-1"><strong>Rider:</strong> ${rider.fullName || "Assigned"} (${rider.phoneNumber || "No phone"})</p>` : ""}
                
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
        }

        // ──────────────────────────────────────────────
