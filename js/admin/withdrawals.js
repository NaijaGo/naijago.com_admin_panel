        // Withdrawals Management
        // ──────────────────────────────────────────────
        async function fetchPendingWithdrawals() {
          if (!adminToken) {
            if (withdrawalsList) {
              withdrawalsList.innerHTML =
                '<p class="text-center text-red-500">Please login to view withdrawals.</p>';
            }
            return;
          }
          if (withdrawalsList) {
            withdrawalsList.innerHTML =
              '<p class="text-center text-light-gray">Loading withdrawal requests...</p>';
          }
          try {
            // Fetch vendor withdrawals
            const vendorRes = await fetch(
              `${BASE_URL}/api/admin/vendors/withdrawals`,
              {
                headers: { Authorization: `Bearer ${adminToken}` },
              },
            );

            // Fetch rider withdrawals
            const riderRes = await fetch(
              `${BASE_URL}/api/admin/riders/withdrawals`,
              {
                headers: { Authorization: `Bearer ${adminToken}` },
              },
            );

            let vendorWithdrawals = [];
            let riderWithdrawals = [];

            if (vendorRes.ok) {
              const data = await vendorRes.json();
              vendorWithdrawals = data.map((w) => ({ ...w, type: "vendor" }));
            }

            if (riderRes.ok) {
              const data = await riderRes.json();
              riderWithdrawals = data.map((w) => ({ ...w, type: "rider" }));
            }

            allWithdrawals = [...vendorWithdrawals, ...riderWithdrawals];

            // Calculate totals
            const pendingWithdrawals = allWithdrawals.filter(
              (w) => w.status === "pending",
            );
            const totalPending = pendingWithdrawals.reduce(
              (sum, w) => sum + (w.amount || 0),
              0,
            );

            if (withdrawalCountBadge) {
              withdrawalCountBadge.textContent = pendingWithdrawals.length;
            }
            if (withdrawalTotalDisplay) {
              withdrawalTotalDisplay.textContent = `Total Pending: ₦${totalPending.toFixed(2)}`;
            }

            renderWithdrawals(allWithdrawals);
            updateAnalyticsView();
          } catch (err) {
            if (withdrawalsList) {
              withdrawalsList.innerHTML = `<p class="text-center text-red-500">Network error: ${err.message}</p>`;
            }
          }
        }

        // ──────────────────────────────────────────────

        function renderWithdrawals(withdrawals) {
          if (!withdrawalsList) return;

          withdrawalsList.innerHTML = "";

          // Apply filter
          let filteredWithdrawals = withdrawals;
          if (currentWithdrawalFilter !== "all") {
            if (
              currentWithdrawalFilter === "vendor" ||
              currentWithdrawalFilter === "rider"
            ) {
              filteredWithdrawals = withdrawals.filter(
                (w) => w.type === currentWithdrawalFilter,
              );
            } else {
              filteredWithdrawals = withdrawals.filter(
                (w) => w.status === currentWithdrawalFilter,
              );
            }
          }

          if (!filteredWithdrawals.length) {
            withdrawalsList.innerHTML =
              '<p class="text-center text-light-gray">No withdrawal requests matching filter.</p>';
            return;
          }

          filteredWithdrawals.forEach((w) => {
            const card = document.createElement("div");
            card.className = `card p-5 ${w.status === "pending" ? "pending-payout-card" : "payout-card"}`;

            const userType = w.type === "vendor" ? "Vendor" : "Rider";
            const userIcon = w.type === "vendor" ? "🏪" : "🏍️";

            card.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="text-xl font-semibold text-accent-cyan">${userIcon} ${userType} Withdrawal</h3>
                        <p class="text-sm text-gray-400">Reference: ${w.reference || "N/A"}</p>
                    </div>
                    <span class="status-badge ${w.status === "pending" ? "status-pending" : w.status === "completed" ? "status-approved" : "status-rejected"}">
                        ${w.status}
                    </span>
                </div>
                
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <p class="text-sm text-gray-400">Amount</p>
                        <p class="text-2xl font-bold ${w.status === "pending" ? "text-yellow-400" : "text-green-400"}">₦${w.amount?.toFixed(2) || "0.00"}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-400">User</p>
                        <p class="font-semibold">${w.userName || w.fullName || "N/A"}</p>
                        <p class="text-xs text-gray-400">${w.email || "N/A"}</p>
                    </div>
                </div>
                
                <div class="bg-gray-900 bg-opacity-50 p-3 rounded mb-4">
                    <p class="text-sm font-semibold text-gray-300 mb-2">Payment Details</p>
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <div>
                            <p class="text-gray-400">Method</p>
                            <p>${w.paymentMethod || "Bank Transfer"}</p>
                        </div>
                        <div>
                            <p class="text-gray-400">Bank</p>
                            <p>${w.accountDetails?.bankName || "N/A"}</p>
                        </div>
                        <div>
                            <p class="text-gray-400">Account No.</p>
                            <p>${w.accountDetails?.accountNumber || "N/A"}</p>
                        </div>
                        <div>
                            <p class="text-gray-400">Account Name</p>
                            <p>${w.accountDetails?.accountName || "N/A"}</p>
                        </div>
                    </div>
                </div>
                
                <div class="flex justify-between items-center text-sm text-gray-400">
                    <div>
                        <p>Requested: ${new Date(w.createdAt).toLocaleString()}</p>
                        ${w.completedAt ? `<p>Processed: ${new Date(w.completedAt).toLocaleString()}</p>` : ""}
                    </div>
                    <div class="flex gap-2">
                        ${
                          w.status === "pending"
                            ? `
                            <button class="btn btn-success px-4 py-2 text-sm process-withdrawal-btn" 
                                data-id="${w._id || w.reference}" 
                                data-type="${w.type}"
                                data-amount="${w.amount}">
                                Process
                            </button>
                            <button class="btn btn-danger px-4 py-2 text-sm reject-withdrawal-btn" 
                                data-id="${w._id || w.reference}"
                                data-type="${w.type}">
                                Reject
                            </button>
                        `
                            : ""
                        }
                        ${
                          w.status === "completed"
                            ? `
                            <button class="btn btn-primary-alt px-4 py-2 text-sm" disabled>
                                ✅ Processed
                            </button>
                        `
                            : ""
                        }
                    </div>
                </div>
            `;

            withdrawalsList.appendChild(card);
          });

          // Add event listeners
          document
            .querySelectorAll(".process-withdrawal-btn")
            .forEach((btn) => {
              btn.addEventListener("click", () =>
                processWithdrawal(
                  btn.dataset.id,
                  btn.dataset.type,
                  parseFloat(btn.dataset.amount),
                ),
              );
            });

          document.querySelectorAll(".reject-withdrawal-btn").forEach((btn) => {
            btn.addEventListener("click", () =>
              rejectWithdrawal(btn.dataset.id, btn.dataset.type),
            );
          });

          // Add withdrawal filter listeners
          document.querySelectorAll(".withdrawal-filter-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
              currentWithdrawalFilter = btn.dataset.type;
              document
                .querySelectorAll(".withdrawal-filter-btn")
                .forEach((b) => {
                  b.classList.remove("bg-accent-cyan", "text-primary-blue");
                  b.classList.add("btn-primary-alt");
                });
              btn.classList.remove("btn-primary-alt");
              btn.classList.add("bg-accent-cyan", "text-primary-blue");
              renderWithdrawals(allWithdrawals);
            });
          });
        }

        async function processWithdrawal(withdrawalId, userType, amount) {
          if (
            !confirm(
              `Process withdrawal of ₦${amount.toFixed(2)} for this ${userType}?`,
            )
          )
            return;

          try {
            const endpoint =
              userType === "vendor"
                ? `${BASE_URL}/api/admin/vendors/withdrawals/${withdrawalId}/process`
                : `${BASE_URL}/api/admin/riders/withdrawals/${withdrawalId}/process`;

            const res = await fetch(endpoint, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
              },
              body: JSON.stringify({ status: "completed" }),
            });

            const data = await res.json();
            if (res.ok) {
              displayMessage(
                `Withdrawal processed successfully! ₦${amount.toFixed(2)} sent.`,
                "success",
              );
              fetchPendingWithdrawals();
            } else {
              displayMessage(
                data.message || "Failed to process withdrawal",
                "error",
              );
            }
          } catch (err) {
            displayMessage(`Error: ${err.message}`, "error");
          }
        }

        async function rejectWithdrawal(withdrawalId, userType) {
          const reason = prompt("Enter reason for rejection:");
          if (!reason) return;

          try {
            const endpoint =
              userType === "vendor"
                ? `${BASE_URL}/api/admin/vendors/withdrawals/${withdrawalId}/reject`
                : `${BASE_URL}/api/admin/riders/withdrawals/${withdrawalId}/reject`;

            const res = await fetch(endpoint, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
              },
              body: JSON.stringify({ status: "failed", reason }),
            });

            const data = await res.json();
            if (res.ok) {
              displayMessage(`Withdrawal rejected.`, "success");
              fetchPendingWithdrawals();
            } else {
              displayMessage(
                data.message || "Failed to reject withdrawal",
                "error",
              );
            }
          } catch (err) {
            displayMessage(`Error: ${err.message}`, "error");
          }
        }

        // ──────────────────────────────────────────────
