        function renderDeliveryFeeZoneEditor(zones = []) {
          if (!deliveryFeeZoneGroups) return;

          if (!zones.length) {
            deliveryFeeZoneGroups.innerHTML =
              '<p class="text-light-gray">No delivery zones configured yet.</p>';
            return;
          }

          const groupedZones = zones.reduce((groups, zone) => {
            const groupName = zone.group || "Abuja Zones";
            if (!groups[groupName]) {
              groups[groupName] = [];
            }
            groups[groupName].push(zone);
            return groups;
          }, {});

          deliveryFeeZoneGroups.innerHTML = Object.entries(groupedZones)
            .map(
              ([groupName, groupZones]) => `
            <div class="rounded-2xl border border-cyan-400 border-opacity-10 bg-blue-950 bg-opacity-20 p-5">
                <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-4">
                    <div>
                        <h4 class="text-xl font-bold text-light-slate">${escapeHtml(groupName)}</h4>
                        <p class="text-sm text-light-gray">${groupZones.length} Abuja zone${groupZones.length === 1 ? "" : "s"} in this pricing group.</p>
                    </div>
                    <span class="analytics-pill medium">${groupZones.length} zones</span>
                </div>
                <div class="grid gap-4 md:grid-cols-2">
                    ${groupZones
                      .map(
                        (zone) => `
                        <div class="rounded-xl border border-cyan-400 border-opacity-10 bg-[#10203D] p-4">
                            <div class="flex items-start justify-between gap-4">
                                <div>
                                    <p class="text-lg font-semibold text-light-slate">${escapeHtml(zone.zoneName || zone.zoneKey || "Zone")}</p>
                                    <p class="text-xs uppercase tracking-[0.2em] text-light-gray mt-1">${escapeHtml(zone.city || "Abuja")}</p>
                                </div>
                                <label class="flex items-center gap-2 text-xs text-light-gray">
                                    <input
                                        type="checkbox"
                                        class="h-4 w-4"
                                        data-delivery-zone-active="${escapeHtml(zone.zoneKey)}"
                                        ${zone.isActive !== false ? "checked" : ""}
                                    />
                                    Active
                                </label>
                            </div>

                            <div class="mt-4">
                                <label class="block text-xs font-semibold uppercase tracking-[0.2em] text-light-gray mb-2">
                                    Fee Amount (₦)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    class="input-field w-full"
                                    data-delivery-zone-amount="${escapeHtml(zone.zoneKey)}"
                                    value="${Number(zone.amount || 0)}"
                                />
                            </div>

                            <p class="text-xs text-gray-400 mt-3 leading-6">
                                Matches: ${escapeHtml((zone.aliases || []).join(", ") || zone.zoneName || zone.zoneKey || "No aliases")}
                            </p>
                            ${
                              (zone.tags || []).length
                                ? `
                                <div class="flex flex-wrap gap-2 mt-3">
                                    ${(zone.tags || [])
                                      .map(
                                        (tag) => `
                                        <span class="analytics-pill good">${escapeHtml(String(tag).replace(/_/g, " "))}</span>
                                    `,
                                      )
                                      .join("")}
                                </div>
                            `
                                : ""
                            }
                        </div>
                    `,
                      )
                      .join("")}
                </div>
            </div>
        `,
            )
            .join("");
        }

        function renderDeliveryFeeSettings(settings) {
          if (
            !deliveryFeeCoverageDisplay ||
            !deliveryFallbackRateInput ||
            !deliveryMinimumFeeInput
          )
            return;

          latestDeliveryFeeSettings = settings;
          deliveryFeeCoverageDisplay.textContent = `${Number(settings.zoneCount || settings.zones?.length || 0)} Abuja Zones`;
          deliveryFeeSettingsSource.textContent =
            settings.source === "database"
              ? "Database controlled"
              : "Startup defaults";
          deliveryFeeFallbackDisplay.textContent = `₦${Number(settings.fallbackRatePerKm || 0).toFixed(2)} / km`;
          deliveryFeeMinimumDisplay.textContent = formatCurrency(
            settings.minimumDeliveryFee || 0,
          );
          deliveryFeeSettingsUpdatedAt.textContent = formatDateTime(
            settings.updatedAt || settings.createdAt,
          );
          deliveryFeeSettingsUpdatedBy.textContent = settings.updatedBy
            ? `${getAdminDisplayName(settings.updatedBy)}${settings.updatedBy.email ? ` (${settings.updatedBy.email})` : ""}`
            : settings.source === "database"
              ? "System"
              : "Startup seed";
          deliveryFallbackRateInput.value = Number(
            settings.fallbackRatePerKm || 0,
          );
          deliveryMinimumFeeInput.value = Number(
            settings.minimumDeliveryFee || 0,
          );
          renderDeliveryFeeZoneEditor(
            Array.isArray(settings.zones) ? settings.zones : [],
          );
          hasLoadedDeliveryFeeSettings = true;
        }

        async function fetchDeliveryFeeSettings() {
          if (!adminToken) {
            displayMessage(
              "Please login as admin to load delivery fee settings.",
              "error",
            );
            return;
          }

          try {
            const res = await fetch(
              `${BASE_URL}/api/admin/delivery-fee-settings`,
              {
                headers: {
                  Authorization: `Bearer ${adminToken}`,
                },
              },
            );

            const data = await res.json();
            if (res.ok) {
              renderDeliveryFeeSettings(data);
            } else {
              displayMessage(
                data.message || "Failed to load delivery fee settings",
                "error",
              );
            }
          } catch (error) {
            displayMessage(
              `Error loading delivery fee settings: ${error.message}`,
              "error",
            );
          }
        }

        async function saveDeliveryFeeSettings(event) {
          event.preventDefault();

          if (!adminToken) {
            displayMessage(
              "Please login as admin to save delivery fee settings.",
              "error",
            );
            return;
          }

          if (
            !latestDeliveryFeeSettings ||
            !Array.isArray(latestDeliveryFeeSettings.zones)
          ) {
            displayMessage("Refresh delivery fee settings first.", "warning");
            return;
          }

          const fallbackRatePerKm = Number(
            deliveryFallbackRateInput?.value || 0,
          );
          const minimumDeliveryFee = Number(
            deliveryMinimumFeeInput?.value || 0,
          );

          if (!Number.isFinite(fallbackRatePerKm) || fallbackRatePerKm < 0) {
            displayMessage(
              "Fallback rate per KM must be a valid non-negative number.",
              "warning",
            );
            return;
          }

          if (!Number.isFinite(minimumDeliveryFee) || minimumDeliveryFee < 0) {
            displayMessage(
              "Minimum delivery fee must be a valid non-negative number.",
              "warning",
            );
            return;
          }

          const zones = latestDeliveryFeeSettings.zones.map((zone) => {
            const amountInput = deliveryFeeZoneGroups?.querySelector(
              `[data-delivery-zone-amount="${zone.zoneKey}"]`,
            );
            const activeInput = deliveryFeeZoneGroups?.querySelector(
              `[data-delivery-zone-active="${zone.zoneKey}"]`,
            );
            const amount = Number(amountInput?.value ?? zone.amount ?? 0);

            return {
              ...zone,
              amount:
                Number.isFinite(amount) && amount >= 0
                  ? amount
                  : Number(zone.amount || 0),
              isActive: activeInput
                ? Boolean(activeInput.checked)
                : zone.isActive !== false,
            };
          });

          try {
            const res = await fetch(
              `${BASE_URL}/api/admin/delivery-fee-settings`,
              {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${adminToken}`,
                },
                body: JSON.stringify({
                  fallbackRatePerKm,
                  minimumDeliveryFee,
                  zones,
                }),
              },
            );

            const data = await res.json();
            if (res.ok) {
              renderDeliveryFeeSettings(data);
              displayMessage(
                data.message || "Delivery fee settings updated successfully.",
                "success",
              );
            } else {
              displayMessage(
                data.message || "Failed to update delivery fee settings.",
                "error",
              );
            }
          } catch (error) {
            displayMessage(
              `Error saving delivery fee settings: ${error.message}`,
              "error",
            );
          }
        }
