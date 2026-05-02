        async function fetchPendingVendorRequests() {
          if (!adminToken) {
            if (pendingRequestsList) {
              pendingRequestsList.innerHTML =
                '<p class="text-center text-light-gray">Please login as admin to load requests.</p>';
            }
            return;
          }
          if (pendingRequestsList) {
            pendingRequestsList.innerHTML =
              '<p class="text-center text-light-gray">Loading pending requests...</p>';
          }
          try {
            const res = await fetch(`${BASE_URL}/api/admin/vendor-requests`, {
              headers: { Authorization: `Bearer ${adminToken}` },
            });
            const data = await res.json();
            if (res.status === 401 || res.status === 403) {
              displayMessage(
                "Session expired. Redirecting to login...",
                "warning",
              );
              clearAdminSession();
              setTimeout(() => redirectToLogin("expired"), 1200);
              return;
            }
            if (res.ok) {
              pendingVendorRequests = data || [];
              renderPendingRequests(data);
              updateAnalyticsView();
            } else {
              displayMessage(
                data.message || "Failed to fetch requests",
                "error",
              );
              if (pendingRequestsList) {
                pendingRequestsList.innerHTML =
                  '<p class="text-center text-red-500">Error loading requests</p>';
              }
            }
          } catch (err) {
            displayMessage(`Network error: ${err.message}`, "error");
            if (pendingRequestsList) {
              pendingRequestsList.innerHTML =
                '<p class="text-center text-red-500">Connection failed</p>';
            }
          }
        }

        function renderPendingRequests(requests) {
          if (!pendingRequestsList) return;

          pendingRequestsList.innerHTML = "";
          if (!requests?.length) {
            pendingRequestsList.innerHTML =
              '<p class="text-center text-light-gray">No pending vendor requests.</p>';
            return;
          }
          requests.forEach((r) => {
            const card = document.createElement("div");
            card.className = "card p-6 request-card";
            card.innerHTML = `
                <h3 class="text-xl font-semibold text-accent-cyan mb-2">${r.firstName} ${r.lastName}</h3>
                <p class="text-light-gray text-sm mb-1"><strong>Email:</strong> ${r.email}</p>
                <p class="text-light-gray text-sm mb-1"><strong>Phone:</strong> ${r.phoneNumber}</p>
                <p class="text-light-gray text-sm mb-1"><strong>Business:</strong> ${r.businessName || "N/A"}</p>
                <p class="text-light-gray text-sm mb-4"><strong>Categories:</strong> ${r.businessCategories?.join(", ") || "N/A"}</p>
                <p class="text-light-gray text-sm mb-4"><strong>Status:</strong> <span class="text-orange-400 font-bold">${r.vendorStatus?.toUpperCase() || "NONE"}</span></p>
                <div class="flex justify-end gap-4 mt-4">
                    <button class="btn btn-success px-6 py-2 approve-btn" data-user-id="${r._id}">Approve</button>
                    <button class="btn btn-danger px-6 py-2 reject-btn" data-user-id="${r._id}">Reject</button>
                </div>
            `;
            pendingRequestsList.appendChild(card);
          });
          document
            .querySelectorAll(".approve-btn")
            .forEach(
              (b) =>
                (b.onclick = () =>
                  updateVendorStatus(b.dataset.userId, "approved")),
            );
          document
            .querySelectorAll(".reject-btn")
            .forEach(
              (b) =>
                (b.onclick = () =>
                  updateVendorStatus(b.dataset.userId, "rejected")),
            );
        }

        async function updateVendorStatus(userId, status) {
          try {
            const res = await fetch(
              `${BASE_URL}/api/admin/vendor-status/${userId}`,
              {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${adminToken}`,
                },
                body: JSON.stringify({ status }),
              },
            );
            const data = await res.json();
            if (res.ok) {
              displayMessage(`Request ${status}!`, "success");
              fetchPendingVendorRequests();
            } else {
              displayMessage(
                data.message || "Failed to update status",
                "error",
              );
            }
          } catch (err) {
            displayMessage(`Error: ${err.message}`, "error");
          }
        }

        async function fetchPendingPharmacistRequests() {
          if (!adminToken) {
            if (pharmacistRequestsList) {
              pharmacistRequestsList.innerHTML =
                '<p class="text-center text-light-gray">Please login as admin to load pharmacy requests.</p>';
            }
            return;
          }

          if (pharmacistRequestsList) {
            pharmacistRequestsList.innerHTML =
              '<p class="text-center text-light-gray">Loading pharmacist requests...</p>';
          }

          try {
            const res = await fetch(
              `${BASE_URL}/api/admin/pharmacist-requests`,
              {
                headers: { Authorization: `Bearer ${adminToken}` },
              },
            );
            const data = await res.json();

            if (handleAdminSessionExpiry(res.status)) {
              return;
            }

            if (res.ok) {
              pendingPharmacistRequests = data || [];
              renderPendingPharmacistRequests(pendingPharmacistRequests);
              updateAnalyticsView();
            } else {
              displayMessage(
                data.message || "Failed to fetch pharmacist requests",
                "error",
              );
              if (pharmacistRequestsList) {
                pharmacistRequestsList.innerHTML =
                  '<p class="text-center text-red-500">Error loading pharmacist requests</p>';
              }
            }
          } catch (err) {
            displayMessage(`Network error: ${err.message}`, "error");
            if (pharmacistRequestsList) {
              pharmacistRequestsList.innerHTML =
                '<p class="text-center text-red-500">Connection failed</p>';
            }
          }
        }

        function renderPendingPharmacistRequests(requests) {
          if (!pharmacistRequestsList) return;

          pharmacistRequestsList.innerHTML = "";
          if (!requests?.length) {
            pharmacistRequestsList.innerHTML =
              '<p class="text-center text-light-gray">No pending pharmacist requests.</p>';
            return;
          }

          requests.forEach((request) => {
            const card = document.createElement("div");
            const status = request.pharmacistStatus || "sent";
            const location = formatBusinessLocation(request.businessLocation);
            card.className = "card p-6 request-card";
            card.innerHTML = `
                <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <h3 class="text-xl font-semibold text-accent-cyan mb-2">${escapeHtml(request.firstName)} ${escapeHtml(request.lastName)}</h3>
                        <p class="text-light-gray text-sm mb-1"><strong>Email:</strong> ${escapeHtml(request.email)}</p>
                        <p class="text-light-gray text-sm mb-1"><strong>Phone:</strong> ${escapeHtml(request.phoneNumber || "N/A")}</p>
                        <p class="text-light-gray text-sm mb-1"><strong>Business:</strong> ${escapeHtml(request.businessName || "N/A")}</p>
                        <p class="text-light-gray text-sm mb-1"><strong>Location:</strong> ${escapeHtml(location)}</p>
                        <p class="text-light-gray text-sm mb-1"><strong>Vendor Status:</strong> <span class="text-green-400 font-bold">${formatStatusLabel(request.vendorStatus)}</span></p>
                        <p class="text-light-gray text-sm mb-1"><strong>Requested:</strong> ${formatDateTime(request.pharmacistRequestDate || request.updatedAt)}</p>
                        <p class="text-light-gray text-sm"><strong>Pharmacy Status:</strong> <span class="text-orange-400 font-bold">${formatStatusLabel(status)}</span></p>
                    </div>
                    <span class="status-badge ${status === "reviewing" ? "status-delivered" : "status-pending"}">${formatStatusLabel(status)}</span>
                </div>
                <div class="flex flex-wrap justify-end gap-3 mt-5">
                    <button class="btn btn-primary-alt px-4 py-2 pharmacist-status-btn" data-user-id="${request._id}" data-status="received">Mark Received</button>
                    <button class="btn btn-warning px-4 py-2 pharmacist-status-btn" data-user-id="${request._id}" data-status="reviewing">Mark Reviewing</button>
                    <button class="btn btn-success px-5 py-2 pharmacist-status-btn" data-user-id="${request._id}" data-status="approved">Approve Pharmacist</button>
                    <button class="btn btn-danger px-5 py-2 pharmacist-status-btn" data-user-id="${request._id}" data-status="rejected">Reject</button>
                </div>
            `;
            pharmacistRequestsList.appendChild(card);
          });

          pharmacistRequestsList
            .querySelectorAll(".pharmacist-status-btn")
            .forEach((button) => {
              button.addEventListener("click", () => {
                updatePharmacistStatus(
                  button.dataset.userId,
                  button.dataset.status,
                );
              });
            });
        }

        async function updatePharmacistStatus(userId, status) {
          try {
            const res = await fetch(
              `${BASE_URL}/api/admin/pharmacist-status/${userId}`,
              {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${adminToken}`,
                },
                body: JSON.stringify({ status }),
              },
            );
            const data = await res.json();

            if (handleAdminSessionExpiry(res.status)) {
              return;
            }

            if (res.ok) {
              displayMessage(
                data.message || `Pharmacist request ${status}.`,
                "success",
              );
              fetchPendingPharmacistRequests();
            } else {
              displayMessage(
                data.message || "Failed to update pharmacist status",
                "error",
              );
            }
          } catch (err) {
            displayMessage(`Error: ${err.message}`, "error");
          }
        }

        // ──────────────────────────────────────────────
