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
          const pricing = settings.deliveryPricing || {};
          const payout = settings.riderPayoutPricing || {};
          const campaign = settings.freeDeliveryCampaign || {};
          const setValue = (id, value) => {
            const input = document.getElementById(id);
            if (input) input.value = value == null ? "" : value;
          };
          const setChecked = (id, value) => {
            const input = document.getElementById(id);
            if (input) input.checked = value === true;
          };
          setValue("deliveryPricingMode", pricing.mode || "zone");
          setValue("deliveryBaseFee", pricing.baseFee || 0);
          setValue("deliveryPricePerKm", pricing.pricePerKm || 0);
          setValue("deliveryRoadMinimum", pricing.minimumFee || 0);
          setValue("deliveryMaximumFee", pricing.maximumFee);
          setValue("deliveryMaximumDistance", pricing.maximumDistanceKm);
          setValue("riderBasePayout", payout.basePayout || 0);
          setValue("riderPricePerKm", payout.pricePerKm || 0);
          setValue("riderMinimumPayout", payout.minimumPayout || 0);
          setValue("riderMaximumPayout", payout.maximumPayout);
          setValue("riderMultiVendorAdjustment", payout.multiVendorAdjustment || 0);
          setChecked("freeDeliveryEnabled", campaign.enabled);
          setValue("freeDeliveryMinimumOrder", campaign.minimumOrderAmount || 0);
          setValue("freeDeliveryMaximumDistance", campaign.maximumDistanceKm);
          setValue("freeDeliveryCustomerEligibility", campaign.customerEligibility || "everyone");
          setValue("freeDeliveryVendorIds", (campaign.vendorIds || []).join(", "));
          setValue("freeDeliveryProductIds", (campaign.productIds || []).join(", "));
          setValue("freeDeliveryAreas", (campaign.areas || []).join(", "));
          setValue("freeDeliveryPromoCode", campaign.promoCode || "");
          setValue("freeDeliveryStartsAt", toLocalDateTimeInput(campaign.startsAt));
          setValue("freeDeliveryEndsAt", toLocalDateTimeInput(campaign.endsAt));
          renderDeliveryPricingPreview(pricing);
          renderDeliverySettingsAuditHistory(settings.deliverySettingsHistory || []);
          const preview = document.getElementById("deliveryPricingPreview");
          if (preview && preview.dataset.previewBound !== "true") {
            ["deliveryPricingMode", "deliveryBaseFee", "deliveryPricePerKm", "deliveryRoadMinimum", "deliveryMaximumFee", "deliveryMaximumDistance"]
              .forEach((id) => document.getElementById(id)?.addEventListener("input", refreshDeliveryPricingPreviewFromForm));
            document.getElementById("deliveryPricingMode")?.addEventListener("change", refreshDeliveryPricingPreviewFromForm);
            preview.dataset.previewBound = "true";
          }
          renderDeliveryFeeZoneEditor(
            Array.isArray(settings.zones) ? settings.zones : [],
          );
          hasLoadedDeliveryFeeSettings = true;
        }

        function toLocalDateTimeInput(value) {
          if (!value) return "";
          const date = new Date(value);
          if (!Number.isFinite(date.getTime())) return "";
          const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
          return local.toISOString().slice(0, 16);
        }

        function renderDeliveryPricingPreview(pricing = {}) {
          const container = document.getElementById("deliveryPricingPreview");
          if (!container) return;
          if (pricing.mode !== "road_km") {
            container.innerHTML = '<p class="text-light-gray sm:col-span-2 lg:col-span-5">Road pricing is inactive. Existing zone/fallback fees remain authoritative.</p>';
            return;
          }
          const rows = window.DeliveryPricingPreview.calculateDeliveryPricingPreview(pricing);
          container.innerHTML = rows.map((row) => {
            const distanceLabel = `Road distance: ${row.distanceKm} km`;
            if (!row.available) {
              const status = row.invalidPricing
                ? "Invalid pricing values; correct them before saving."
                : `OUTSIDE CURRENT DELIVERY AREA · Maximum allowed distance: ${row.maximumDistanceKm} km`;
              return `<div class="rounded-xl border border-cyan-400 border-opacity-10 bg-[#10203D] p-3"><strong class="block text-light-gray">${distanceLabel}</strong><span class="block mt-2 font-semibold text-amber-300">${escapeHtml(status)}</span></div>`;
            }

            const adjustmentLabel = row.adjustment
              ? `${row.adjustment.type === "minimum" ? "Minimum" : "Maximum"} fee applied: ${escapeHtml(formatCurrency(row.adjustment.appliedFee))}`
              : "Minimum/maximum adjustment: none";
            return `<div class="rounded-xl border border-cyan-400 border-opacity-10 bg-[#10203D] p-3">
              <strong class="block text-light-gray">${distanceLabel}</strong>
              <div class="mt-2 space-y-1 text-xs text-light-gray">
                <div>Base delivery fee: ${escapeHtml(formatCurrency(row.baseFee))}</div>
                <div>Distance charge: ${escapeHtml(formatCurrency(row.distanceCharge))} (${row.distanceKm} km × ${escapeHtml(formatCurrency(row.pricePerKm))}/km)</div>
                <div>Raw delivery fee: ${escapeHtml(formatCurrency(row.rawFee))}</div>
                <div>${adjustmentLabel}</div>
              </div>
              <strong class="block mt-2">Final customer delivery fee: ${escapeHtml(formatCurrency(row.finalFee))}</strong>
            </div>`;
          }).join("");
        }

        function refreshDeliveryPricingPreviewFromForm() {
          renderDeliveryPricingPreview({
            mode: document.getElementById("deliveryPricingMode")?.value || "zone",
            baseFee: Number(document.getElementById("deliveryBaseFee")?.value || 0),
            pricePerKm: Number(document.getElementById("deliveryPricePerKm")?.value || 0),
            minimumFee: Number(document.getElementById("deliveryRoadMinimum")?.value || 0),
            maximumFee: document.getElementById("deliveryMaximumFee")?.value === ""
              ? null
              : Number(document.getElementById("deliveryMaximumFee")?.value),
            maximumDistanceKm: document.getElementById("deliveryMaximumDistance")?.value === ""
              ? null
              : Number(document.getElementById("deliveryMaximumDistance")?.value),
          });
        }

        function renderDeliverySettingsAuditHistory(history = []) {
          const container = document.getElementById("deliverySettingsAuditHistory");
          if (!container) return;
          if (!history.length) {
            container.textContent = "No pricing changes recorded yet.";
            return;
          }
          container.innerHTML = history.slice(0, 10).map((entry) => {
            const changedAt = entry.changedAt ? formatDateTime(entry.changedAt) : "Unknown time";
            const actor = entry.changedBy && typeof entry.changedBy === "object"
              ? getAdminDisplayName(entry.changedBy)
              : String(entry.changedBy || "Admin");
            const categories = Object.keys(entry.newValue || {}).join(", ") || "Delivery settings";
            return `<details class="rounded-lg border border-cyan-400 border-opacity-10 p-3"><summary class="cursor-pointer">${escapeHtml(changedAt)} · ${escapeHtml(actor)} · ${escapeHtml(categories)}</summary><div class="mt-3 grid gap-3 md:grid-cols-2"><div><strong>Old values</strong><pre class="mt-1 overflow-auto whitespace-pre-wrap">${escapeHtml(JSON.stringify(entry.oldValue || {}, null, 2))}</pre></div><div><strong>New values</strong><pre class="mt-1 overflow-auto whitespace-pre-wrap">${escapeHtml(JSON.stringify(entry.newValue || {}, null, 2))}</pre></div></div></details>`;
          }).join("");
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

          const optionalNumber = (id) => {
            const value = document.getElementById(id)?.value?.trim();
            return value === "" || value == null ? null : Number(value);
          };
          const listValue = (id) => (document.getElementById(id)?.value || "")
            .split(",").map((value) => value.trim()).filter(Boolean);
          const dateValue = (id) => {
            const value = document.getElementById(id)?.value;
            return value ? new Date(value).toISOString() : null;
          };
          const deliveryPricing = {
            mode: document.getElementById("deliveryPricingMode")?.value || "zone",
            baseFee: Number(document.getElementById("deliveryBaseFee")?.value || 0),
            pricePerKm: Number(document.getElementById("deliveryPricePerKm")?.value || 0),
            minimumFee: Number(document.getElementById("deliveryRoadMinimum")?.value || 0),
            maximumFee: optionalNumber("deliveryMaximumFee"),
            maximumDistanceKm: optionalNumber("deliveryMaximumDistance"),
          };
          const riderPayoutPricing = {
            basePayout: Number(document.getElementById("riderBasePayout")?.value || 0),
            pricePerKm: Number(document.getElementById("riderPricePerKm")?.value || 0),
            minimumPayout: Number(document.getElementById("riderMinimumPayout")?.value || 0),
            maximumPayout: optionalNumber("riderMaximumPayout"),
            multiVendorAdjustment: Number(document.getElementById("riderMultiVendorAdjustment")?.value || 0),
          };
          const freeDeliveryCampaign = {
            enabled: Boolean(document.getElementById("freeDeliveryEnabled")?.checked),
            minimumOrderAmount: Number(document.getElementById("freeDeliveryMinimumOrder")?.value || 0),
            maximumDistanceKm: optionalNumber("freeDeliveryMaximumDistance"),
            customerEligibility: document.getElementById("freeDeliveryCustomerEligibility")?.value || "everyone",
            vendorIds: listValue("freeDeliveryVendorIds"),
            productIds: listValue("freeDeliveryProductIds"),
            areas: listValue("freeDeliveryAreas"),
            promoCode: document.getElementById("freeDeliveryPromoCode")?.value?.trim() || "",
            startsAt: dateValue("freeDeliveryStartsAt"),
            endsAt: dateValue("freeDeliveryEndsAt"),
          };

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
                  deliveryPricing,
                  riderPayoutPricing,
                  freeDeliveryCampaign,
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
