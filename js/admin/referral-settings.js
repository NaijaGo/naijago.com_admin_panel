        function renderReferralAudit(history = []) {

          if (!referralAuditTrail) return;

          if (!history.length) {
            referralAuditTrail.innerHTML =
              '<p class="text-light-gray">No referral reward changes have been recorded yet.</p>';
            return;
          }

          referralAuditTrail.innerHTML = history
            .map((entry) => {
              const isStartupSeed = entry.source === "startup_seed";
              const actorLabel = isStartupSeed
                ? "System startup"
                : getAdminDisplayName(entry.changedBy);
              const previousAmountLabel =
                entry.previousAmount === null ||
                entry.previousAmount === undefined
                  ? "Initial reward seed"
                  : `${formatCurrency(entry.previousAmount)} to ${formatCurrency(entry.newAmount)}`;

              return `
                <div class="rounded-xl border border-cyan-400 border-opacity-15 bg-blue-950 bg-opacity-30 p-4">
                    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <p class="font-semibold text-light-slate">${actorLabel}</p>
                            <p class="text-sm text-light-gray mt-1">
                                ${isStartupSeed ? "Default referral reward was seeded when the backend started." : "Referral reward amount updated by admin action."}
                            </p>
                            <p class="text-xs text-gray-400 mt-3">${previousAmountLabel}</p>
                        </div>
                        <div class="sm:text-right">
                            <p class="text-xl font-bold text-accent-cyan">${formatCurrency(entry.newAmount)}</p>
                            <p class="text-xs text-light-gray mt-1">${formatDateTime(entry.changedAt)}</p>
                        </div>
                    </div>
                </div>
            `;
            })
            .join("");
        }

        function renderReferralSettings(settings) {
          if (!currentReferralRewardDisplay || !referralRewardAmountInput)
            return;

          currentReferralRewardDisplay.textContent = formatCurrency(
            settings.referralRewardAmount,
          );
          referralSettingsSource.textContent =
            settings.source === "database"
              ? "Database controlled"
              : "Environment fallback";
          referralSettingsUpdatedAt.textContent = formatDateTime(
            settings.updatedAt || settings.createdAt,
          );
          referralSettingsUpdatedBy.textContent = settings.updatedBy
            ? `${getAdminDisplayName(settings.updatedBy)}${settings.updatedBy.email ? ` (${settings.updatedBy.email})` : ""}`
            : settings.source === "database"
              ? "System"
              : "Not saved yet";
          referralRewardAmountInput.value = Number(
            settings.referralRewardAmount || 0,
          );
          renderReferralAudit(
            Array.isArray(settings.history) ? settings.history : [],
          );
          hasLoadedReferralSettings = true;
        }


        async function fetchReferralSettings() {
          if (!adminToken || !referralAuditTrail) return;

          referralAuditTrail.innerHTML =
            '<p class="text-light-gray">Loading referral reward history...</p>';

          try {
            const res = await fetch(`${BASE_URL}/api/admin/referral-settings`, {
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
              renderReferralSettings(data);
            } else {
              referralAuditTrail.innerHTML =
                '<p class="text-red-400">Unable to load referral reward history.</p>';
              displayMessage(
                data.message || "Failed to load referral settings",
                "error",
              );
            }
          } catch (err) {
            referralAuditTrail.innerHTML =
              '<p class="text-red-400">Unable to load referral reward history.</p>';
            displayMessage(`Error: ${err.message}`, "error");
          }
        }

        async function saveReferralSettings(event) {
          event.preventDefault();

          const parsedRewardAmount = Number.parseFloat(
            referralRewardAmountInput?.value,
          );

          if (!Number.isFinite(parsedRewardAmount) || parsedRewardAmount < 0) {
            displayMessage(
              "Please enter a valid non-negative reward amount.",
              "warning",
            );
            return;
          }

          const originalButtonText =
            saveReferralSettingsBtn?.textContent || "Save Referral Reward";
          if (saveReferralSettingsBtn) {
            saveReferralSettingsBtn.disabled = true;
            saveReferralSettingsBtn.textContent = "Saving...";
          }

          try {
            const res = await fetch(`${BASE_URL}/api/admin/referral-settings`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
              },
              body: JSON.stringify({
                referralRewardAmount: parsedRewardAmount,
              }),
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
              renderReferralSettings(data);
              displayMessage(
                data.message || "Referral reward amount updated successfully.",
                String(data.message || "")
                  .toLowerCase()
                  .includes("unchanged")
                  ? "warning"
                  : "success",
              );
            } else {
              displayMessage(
                data.message || "Failed to update referral reward amount.",
                "error",
              );
            }
          } catch (err) {
            displayMessage(`Error: ${err.message}`, "error");
          } finally {
            if (saveReferralSettingsBtn) {
              saveReferralSettingsBtn.disabled = false;
              saveReferralSettingsBtn.textContent = originalButtonText;
            }
          }
        }
