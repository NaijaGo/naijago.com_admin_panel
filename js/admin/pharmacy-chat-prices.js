        function renderPharmacySubscriptionSettings(settings) {
          if (!pharmacySubscriptionPlanEditor) return;

          latestPharmacySubscriptionSettings = settings;
          const plans = Array.isArray(settings.plans) ? settings.plans : [];
          if (!plans.length) {
            pharmacySubscriptionPlanEditor.innerHTML =
              '<p class="text-light-gray">No pharmacy chat plans configured.</p>';
            return;
          }

          pharmacySubscriptionPlanEditor.innerHTML = plans
            .map(
              (plan) => `
            <div class="rounded-xl bg-blue-900 bg-opacity-20 border border-cyan-400 border-opacity-10 p-4">
                <p class="text-xs uppercase tracking-[0.25em] text-accent-cyan mb-2">${formatStatusLabel(plan.planType)}</p>
                <label class="block text-sm font-semibold text-light-gray mb-2">Label</label>
                <input class="pharmacy-plan-label input-field w-full mb-3" data-plan-type="${escapeHtml(plan.planType)}" value="${escapeHtml(plan.label || "")}" />
                <label class="block text-sm font-semibold text-light-gray mb-2">Price</label>
                <input class="pharmacy-plan-price input-field w-full mb-3" type="number" min="0" step="0.01" data-plan-type="${escapeHtml(plan.planType)}" value="${Number(plan.price || 0)}" />
                <label class="flex items-center gap-3 text-sm text-light-gray">
                    <input class="pharmacy-plan-active h-4 w-4" type="checkbox" data-plan-type="${escapeHtml(plan.planType)}" ${plan.isActive === false ? "" : "checked"} />
                    Active
                </label>
                <p class="text-xs text-light-gray mt-3">${plan.planType === "one_time" ? "One consultation credit." : `${Number(plan.durationDays || 0)} days access.`}</p>
            </div>
        `,
            )
            .join("");
          hasLoadedPharmacySubscriptionSettings = true;
        }

        async function fetchPharmacySubscriptionSettings() {
          if (!adminToken || !pharmacySubscriptionPlanEditor) return;
          pharmacySubscriptionPlanEditor.innerHTML =
            '<p class="text-light-gray">Loading pharmacy chat prices...</p>';

          try {
            const res = await fetch(
              `${BASE_URL}/api/admin/pharmacist-subscription-settings`,
              {
                headers: { Authorization: `Bearer ${adminToken}` },
              },
            );
            const data = await res.json();

            if (handleAdminSessionExpiry(res.status)) return;

            if (res.ok) {
              renderPharmacySubscriptionSettings(data);
            } else {
              displayMessage(
                data.message || "Failed to load pharmacy chat prices.",
                "error",
              );
            }
          } catch (error) {
            displayMessage(
              `Error loading pharmacy chat prices: ${error.message}`,
              "error",
            );
          }
        }

        async function savePharmacySubscriptionSettings(event) {
          event?.preventDefault();
          if (!latestPharmacySubscriptionSettings?.plans) {
            displayMessage("Refresh pharmacy chat prices first.", "warning");
            return;
          }

          const plans = latestPharmacySubscriptionSettings.plans.map((plan) => {
            const type = plan.planType;
            const labelInput = pharmacySubscriptionPlanEditor?.querySelector(
              `.pharmacy-plan-label[data-plan-type="${type}"]`,
            );
            const priceInput = pharmacySubscriptionPlanEditor?.querySelector(
              `.pharmacy-plan-price[data-plan-type="${type}"]`,
            );
            const activeInput = pharmacySubscriptionPlanEditor?.querySelector(
              `.pharmacy-plan-active[data-plan-type="${type}"]`,
            );
            return {
              ...plan,
              label: labelInput?.value?.trim() || plan.label,
              price: Number(priceInput?.value || 0),
              isActive: activeInput?.checked === true,
            };
          });

          if (
            plans.some(
              (plan) =>
                !Number.isFinite(Number(plan.price)) || Number(plan.price) < 0,
            )
          ) {
            displayMessage(
              "All pharmacy chat prices must be valid non-negative numbers.",
              "warning",
            );
            return;
          }

          try {
            const res = await fetch(
              `${BASE_URL}/api/admin/pharmacist-subscription-settings`,
              {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${adminToken}`,
                },
                body: JSON.stringify({ plans }),
              },
            );
            const data = await res.json();

            if (handleAdminSessionExpiry(res.status)) return;

            if (res.ok) {
              renderPharmacySubscriptionSettings(data);
              displayMessage(
                data.message || "Pharmacy chat prices updated.",
                "success",
              );
            } else {
              displayMessage(
                data.message || "Failed to update pharmacy chat prices.",
                "error",
              );
            }
          } catch (error) {
            displayMessage(
              `Error saving pharmacy chat prices: ${error.message}`,
              "error",
            );
          }
        }
