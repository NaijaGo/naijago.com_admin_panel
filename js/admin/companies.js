        // Company Management Functions
        // ──────────────────────────────────────────────
        async function fetchCompanies() {
          if (!adminToken) {
            const container = document.getElementById("companiesList");
            if (container) {
              container.innerHTML =
                '<p class="text-center text-red-500">Please login to view companies.</p>';
            }
            return;
          }

          try {
            const res = await fetch(`${BASE_URL}/api/companyadmin/companies`, {
              headers: { Authorization: `Bearer ${adminToken}` },
            });
            const data = await res.json();
            if (res.ok) {
              allCompanies = data;
              renderCompanies(data);
              updateAnalyticsView();
            } else {
              const container = document.getElementById("companiesList");
              if (container) {
                container.innerHTML = `<p class="text-center text-red-500">${data.message || "Failed to load companies"}</p>`;
              }
            }
          } catch (err) {
            const container = document.getElementById("companiesList");
            if (container) {
              container.innerHTML = `<p class="text-center text-red-500">Network error</p>`;
            }
          }
        }

        function renderCompanies(companies) {
          const container = document.getElementById("companiesList");
          if (!container) return;

          container.innerHTML = "";

          // Apply filter
          let filteredCompanies = companies;
          if (currentCompanyFilter !== "all") {
            filteredCompanies = companies.filter(
              (c) => c.status === currentCompanyFilter,
            );
          }

          if (!filteredCompanies.length) {
            container.innerHTML =
              '<p class="text-center text-light-gray">No companies found.</p>';
            return;
          }

          filteredCompanies.forEach((company) => {
            const card = document.createElement("div");
            card.className = "card p-6";
            card.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="text-xl font-semibold text-accent-cyan">${company.companyName}</h3>
                        <p class="text-sm text-gray-400">RC: ${company.rcNumber || "N/A"}</p>
                    </div>
                    <span class="status-badge ${company.status === "active" ? "status-approved" : company.status === "pending" ? "status-pending" : "status-suspended"}">
                        ${company.status}
                    </span>
                </div>
                
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <p class="text-sm text-gray-400">Contact</p>
                        <p class="font-semibold">${company.contactPerson}</p>
                        <p class="text-xs text-gray-400">${company.email}</p>
                        <p class="text-xs text-gray-400">${company.phoneNumber}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-400">Riders</p>
                        <p class="font-bold text-lg">${company.stats?.totalRiders || 0} total</p>
                        <p class="text-xs text-gray-400">${company.stats?.activeRiders || 0} active</p>
                    </div>
                </div>
                
                <div class="bg-gray-900 bg-opacity-50 p-3 rounded mb-4">
                    <p class="text-sm font-semibold text-gray-300 mb-2">Financials</p>
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <div>
                            <p class="text-gray-400">Total Earnings</p>
                            <p class="font-bold text-green-400">₦${(company.stats?.totalEarnings || 0).toFixed(2)}</p>
                        </div>
                        <div>
                            <p class="text-gray-400">Pending Settlement</p>
                            <p class="font-bold text-yellow-400">₦${(company.stats?.pendingSettlement || 0).toFixed(2)}</p>
                        </div>
                    </div>
                </div>
                
                <div class="flex justify-between items-center text-sm">
                    <div class="text-gray-400">
                        <p>Created: ${new Date(company.createdAt).toLocaleDateString()}</p>
                        ${company.lastLogin ? `<p>Last login: ${new Date(company.lastLogin).toLocaleDateString()}</p>` : ""}
                    </div>
                    <div class="flex gap-2">
                        <button class="btn btn-primary-alt px-3 py-1 text-sm view-company-btn" data-id="${company._id}">View</button>
                        <button class="btn btn-warning px-3 py-1 text-sm edit-company-btn" data-id="${company._id}">Edit</button>
                        ${
                          company.status === "active"
                            ? `<button class="btn btn-danger px-3 py-1 text-sm suspend-company-btn" data-id="${company._id}">Suspend</button>`
                            : `<button class="btn btn-success px-3 py-1 text-sm activate-company-btn" data-id="${company._id}">Activate</button>`
                        }
                    </div>
                </div>
            `;
            container.appendChild(card);
          });

          // Add event listeners
          document.querySelectorAll(".view-company-btn").forEach((btn) => {
            btn.addEventListener("click", () =>
              viewCompanyDetails(btn.dataset.id),
            );
          });

          document.querySelectorAll(".suspend-company-btn").forEach((btn) => {
            btn.addEventListener("click", () =>
              updateCompanyStatus(btn.dataset.id, "suspended"),
            );
          });

          document.querySelectorAll(".activate-company-btn").forEach((btn) => {
            btn.addEventListener("click", () =>
              updateCompanyStatus(btn.dataset.id, "active"),
            );
          });

          // Add company filter listeners
          document.querySelectorAll(".company-filter-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
              currentCompanyFilter = btn.dataset.status;
              document.querySelectorAll(".company-filter-btn").forEach((b) => {
                b.classList.remove("bg-accent-cyan", "text-primary-blue");
                b.classList.add("btn-primary-alt");
              });
              btn.classList.remove("btn-primary-alt");
              btn.classList.add("bg-accent-cyan", "text-primary-blue");
              renderCompanies(allCompanies);
            });
          });
        }

        async function viewCompanyDetails(companyId) {
          try {
            const res = await fetch(
              `${BASE_URL}/api/admin/companies/${companyId}`,
              {
                headers: { Authorization: `Bearer ${adminToken}` },
              },
            );
            const company = await res.json();

            // Show modal with company details
            const modalHtml = `
                <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div class="bg-secondary-blue rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-xl font-bold text-accent-cyan">Company Details</h3>
                            <button class="text-gray-400 hover:text-white text-2xl" onclick="this.closest('.fixed').remove()">&times;</button>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 class="font-semibold text-accent-cyan mb-2">Company Info</h4>
                                <p><strong>Name:</strong> ${company.companyName}</p>
                                <p><strong>Contact:</strong> ${company.contactPerson}</p>
                                <p><strong>Email:</strong> ${company.email}</p>
                                <p><strong>Phone:</strong> ${company.phoneNumber}</p>
                                <p><strong>Address:</strong> ${company.officeAddress}</p>
                            </div>
                            
                            <div>
                                <h4 class="font-semibold text-accent-cyan mb-2">Bank Details</h4>
                                ${
                                  company.bankAccount
                                    ? `
                                    <p><strong>Bank:</strong> ${company.bankAccount.bankName || "N/A"}</p>
                                    <p><strong>Account:</strong> ${company.bankAccount.accountNumber || "N/A"}</p>
                                    <p><strong>Name:</strong> ${company.bankAccount.accountName || "N/A"}</p>
                                `
                                    : '<p class="text-gray-400">No bank details provided</p>'
                                }
                            </div>
                        </div>
                        
                        <div class="mt-6">
                            <h4 class="font-semibold text-accent-cyan mb-2">Recent Settlements</h4>
                            <!-- Add settlement history here -->
                        </div>
                    </div>
                </div>
            `;

            const modalDiv = document.createElement("div");
            modalDiv.innerHTML = modalHtml;
            document.body.appendChild(modalDiv);
          } catch (err) {
            displayMessage("Failed to load company details", "error");
          }
        }

        async function updateCompanyStatus(companyId, status) {
          if (!confirm(`Are you sure you want to ${status} this company?`))
            return;

          try {
            const res = await fetch(
              `${BASE_URL}/api/admin/companies/${companyId}/status`,
              {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${adminToken}`,
                },
                body: JSON.stringify({ status }),
              },
            );

            if (res.ok) {
              displayMessage(`Company ${status} successfully`, "success");
              fetchCompanies();
            } else {
              const data = await res.json();
              displayMessage(
                data.message || "Failed to update company",
                "error",
              );
            }
          } catch (err) {
            displayMessage("Network error", "error");
          }
        }
