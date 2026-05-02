        function countBy(items, selector) {

          return (items || []).reduce((acc, item) => {
            const key = selector(item) || "unknown";
            acc[key] = (acc[key] || 0) + 1;
            return acc;
          }, {});
        }

        function getOrderStatusCounts(orders = allOrders) {
          return countBy(orders, (order) =>
            (order.mainOrderStatus || "pending_payment").toLowerCase(),
          );
        }

        function getCompanyStatusCounts(companies = allCompanies) {
          return countBy(companies, (company) =>
            (company.status || "unknown").toLowerCase(),
          );
        }

        function getDisputeStatusCounts(disputes = allDisputes) {
          return countBy(disputes, (dispute) =>
            (dispute.status || "open").toLowerCase(),
          );
        }

        function getWithdrawalStatusCounts(withdrawals = allWithdrawals) {
          return countBy(withdrawals, (withdrawal) =>
            (withdrawal.status || "pending").toLowerCase(),
          );
        }

        function createBreakdownRows(items, total) {
          if (!items.length || total === 0) {
            return '<p class="text-sm text-light-gray">No records available for this slice yet.</p>';
          }

          return items
            .map((item) => {
              const ratio =
                total > 0
                  ? Math.max(6, Math.round((item.value / total) * 100))
                  : 0;
              return `
                <div class="space-y-2">
                    <div class="flex items-center justify-between gap-3 text-sm">
                        <span class="text-light-slate font-semibold">${item.label}</span>
                        <span class="text-light-gray">${item.displayValue ?? item.value} <span class="text-xs text-gray-400">(${formatPercent((item.value / total) * 100)})</span></span>
                    </div>
                    <div class="analytics-track">
                        <div class="analytics-fill" style="width: ${ratio}%"></div>
                    </div>
                </div>
            `;
            })
            .join("");
        }

        function renderAnalyticsCards(metrics) {
          if (!analyticsCards) return;

          analyticsCards.innerHTML = metrics
            .map(
              (metric) => `
            <div class="card analytics-card p-6">
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <p class="text-sm uppercase tracking-[0.24em] text-light-gray">${metric.label}</p>
                        <p class="analytics-value text-accent-cyan mt-4">${metric.value}</p>
                    </div>
                    <span class="analytics-pill ${metric.tone}">${metric.badge}</span>
                </div>
                <p class="text-sm text-light-gray mt-4">${metric.detail}</p>
            </div>
        `,
            )
            .join("");
        }

        function renderAnalyticsBreakdown(sections) {
          if (!analyticsBreakdown) return;

          analyticsBreakdown.innerHTML = sections
            .map(
              (section) => `
            <div class="analytics-group">
                <div class="flex items-center justify-between gap-3 mb-4">
                    <h4 class="text-lg font-semibold text-light-slate">${section.title}</h4>
                    <span class="text-xs uppercase tracking-[0.25em] text-gray-400">${section.totalDisplay ?? section.total} ${section.unitLabel || "items"}</span>
                </div>
                <div class="space-y-4">
                    ${createBreakdownRows(section.items, section.total)}
                </div>
            </div>
        `,
            )
            .join("");
        }

        function renderAnalyticsInsights(insights) {
          if (!analyticsInsights) return;
          if (!analyticsPriorityBadge) return;

          const highestPriority = insights.some((item) => item.tone === "high")
            ? { label: "Attention", tone: "high" }
            : insights.some((item) => item.tone === "medium")
              ? { label: "Watchlist", tone: "medium" }
              : { label: "Stable", tone: "good" };

          analyticsPriorityBadge.className = `analytics-pill ${highestPriority.tone}`;
          analyticsPriorityBadge.textContent = highestPriority.label;

          analyticsInsights.innerHTML = insights
            .map(
              (item) => `
            <div class="insight-item ${item.tone} rounded-xl p-4">
                <div class="flex items-center justify-between gap-3">
                    <p class="font-semibold text-light-slate">${item.title}</p>
                    <span class="analytics-pill ${item.tone}">${item.badge}</span>
                </div>
                <p class="text-sm text-light-gray mt-3">${item.detail}</p>
            </div>
        `,
            )
            .join("");
        }

        function renderAnalyticsAlerts(alerts) {
          if (!analyticsAlerts) return;

          if (!alerts.length) {
            analyticsAlerts.innerHTML =
              '<span class="analytics-pill good">No Major Warnings</span>';
            return;
          }

          analyticsAlerts.innerHTML = alerts
            .map(
              (alert) => `
            <span class="analytics-pill ${alert.tone}" title="${escapeHtml(alert.detail || "")}">
                ${escapeHtml(alert.label)}
            </span>
        `,
            )
            .join("");
        }

        function escapeCsvValue(value) {
          const normalizedValue = String(value ?? "");
          return `"${normalizedValue.replace(/"/g, '""')}"`;
        }

        function exportAnalyticsSnapshotToCsv() {
          if (!latestAnalyticsSnapshot) {
            displayMessage(
              "Refresh the analytics first so there is data to export.",
              "warning",
            );
            return;
          }

          const rows = [["section", "metric", "value", "notes"]];
          const appendRow = (section, metric, value, notes = "") => {
            rows.push([section, metric, value, notes]);
          };

          appendRow("meta", "range", latestAnalyticsSnapshot.rangeLabel, "");
          appendRow(
            "meta",
            "generated_at",
            latestAnalyticsSnapshot.generatedAt,
            "",
          );

          (latestAnalyticsSnapshot.metrics || []).forEach((metric) => {
            appendRow(
              "metric",
              metric.label,
              metric.value,
              metric.detail || "",
            );
          });

          (latestAnalyticsSnapshot.alerts || []).forEach((alert) => {
            appendRow("alert", alert.label, alert.tone, alert.detail || "");
          });

          (latestAnalyticsSnapshot.breakdownSections || []).forEach(
            (section) => {
              (section.items || []).forEach((item) => {
                appendRow(
                  section.title,
                  item.label,
                  item.displayValue ?? item.value,
                  "",
                );
              });
            },
          );

          (latestAnalyticsSnapshot.topPerformingVendors || []).forEach(
            (vendor, index) => {
              appendRow(
                "top_vendor",
                `#${index + 1} ${vendor.vendorName}`,
                formatCurrency(vendor.totalSalesAmount),
                `${vendor.paidOrders} paid orders | ${vendor.activeProducts} active products | ${vendor.email || "No email"}`,
              );
            },
          );

          const csvContent = rows
            .map((columns) => columns.map(escapeCsvValue).join(","))
            .join("\r\n");
          const csvBlob = new Blob([csvContent], {
            type: "text/csv;charset=utf-8;",
          });
          const downloadUrl = URL.createObjectURL(csvBlob);
          const downloadLink = document.createElement("a");
          const exportDate = new Date().toISOString().slice(0, 10);

          downloadLink.href = downloadUrl;
          downloadLink.download = `naijago-analytics-${selectedAnalyticsRange}-${exportDate}.csv`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          URL.revokeObjectURL(downloadUrl);
        }

        function updateAnalyticsView() {
          const commerceMetrics = customerVendorMetrics || {};
          const analyticsRange =
            commerceMetrics.range || analyticsRangeWindow || {};
          const rangeLabel = analyticsRange.label || "All Time";
          const isAllTimeRange = Boolean(
            analyticsRange.isAllTime || !analyticsRange.startDate,
          );
          const analyticsOrders = filterCollectionByAnalyticsRange(
            allOrders,
            (order) => order.createdAt,
          );
          const analyticsDisputes = filterCollectionByAnalyticsRange(
            allDisputes,
            (dispute) => dispute.createdAt || dispute.updatedAt,
          );
          const analyticsWithdrawals = filterCollectionByAnalyticsRange(
            allWithdrawals,
            (withdrawal) =>
              withdrawal.createdAt ||
              withdrawal.requestedAt ||
              withdrawal.updatedAt,
          );
          const orderStatusCounts = getOrderStatusCounts(analyticsOrders);
          const companyStatusCounts = getCompanyStatusCounts();
          const disputeStatusCounts = getDisputeStatusCounts(analyticsDisputes);
          const withdrawalStatusCounts =
            getWithdrawalStatusCounts(analyticsWithdrawals);

          const registeredVendors = Number(
            commerceMetrics.registeredVendors || 0,
          );
          const activeVendors = Number(commerceMetrics.activeVendors || 0);
          const registeredCustomers = Number(
            commerceMetrics.registeredCustomers || 0,
          );
          const customersWithoutPurchases = Number(
            commerceMetrics.customersWithoutPurchases ??
              commerceMetrics.firstTimeCustomersWithoutPurchase ??
              0,
          );
          const customersWithPurchases = Number(
            commerceMetrics.customersWithPurchases || 0,
          );
          const vendorsWithSales = Number(
            commerceMetrics.vendorsWithSales || 0,
          );
          const customerPurchaseConversionRate = Number(
            commerceMetrics.customerPurchaseConversionRate ||
              (registeredCustomers
                ? (customersWithPurchases / registeredCustomers) * 100
                : 0),
          );
          const vendorActivationRate = Number(
            commerceMetrics.vendorActivationRate ||
              (registeredVendors
                ? (activeVendors / registeredVendors) * 100
                : 0),
          );
          const vendorSalesParticipationRate = Number(
            commerceMetrics.vendorSalesParticipationRate ||
              (registeredVendors
                ? (vendorsWithSales / registeredVendors) * 100
                : 0),
          );
          const vendorsWithZeroProducts = Number(
            commerceMetrics.vendorsWithZeroProducts || 0,
          );
          const vendorsWithProductsButNoSales = Number(
            commerceMetrics.vendorsWithProductsButNoSales || 0,
          );
          const activeVendorsWithNoSales = Number(
            commerceMetrics.activeVendorsWithNoSales || 0,
          );
          const vendorsInactive30Days = Number(
            commerceMetrics.vendorsInactive30Days || 0,
          );
          const referralsSentInRange = Number(
            commerceMetrics.referralsSentInRange || 0,
          );
          const referralsConvertedInRange = Number(
            commerceMetrics.referralsConvertedInRange || 0,
          );
          const referralRewardCostTotalInRange = Number(
            commerceMetrics.referralRewardCostTotalInRange || 0,
          );
          const totalReferralSignups = Number(
            commerceMetrics.totalReferralSignups || 0,
          );
          const totalRewardedReferrals = Number(
            commerceMetrics.totalRewardedReferrals || 0,
          );
          const totalReferralRewardCost = Number(
            commerceMetrics.totalReferralRewardCost || 0,
          );
          const pendingReferralConversions = Number(
            commerceMetrics.pendingReferralConversions || 0,
          );
          const topPerformingVendors = Array.isArray(
            commerceMetrics.topPerformingVendors,
          )
            ? commerceMetrics.topPerformingVendors
            : [];
          const totalOrders = Number(
            commerceMetrics.totalOrdersInRange ?? analyticsOrders.length,
          );
          const paidOrdersInRange = Number(
            commerceMetrics.paidOrdersInRange ||
              analyticsOrders.filter((order) => order.isPaid).length,
          );
          const grossMerchandiseValue = Number(
            commerceMetrics.grossMerchandiseValue || 0,
          );
          const platformRevenue = Number(commerceMetrics.platformRevenue || 0);
          const averageOrderValue = Number(
            commerceMetrics.averageOrderValue || 0,
          );
          const newCustomersInRange = Number(
            commerceMetrics.newCustomersInRange || 0,
          );
          const purchasingCustomersInRange = Number(
            commerceMetrics.purchasingCustomersInRange || 0,
          );
          const firstTimeCustomersInRange = Number(
            commerceMetrics.firstTimeCustomersInRange || 0,
          );
          const repeatCustomersInRange = Number(
            commerceMetrics.repeatCustomersInRange || 0,
          );
          const repeatCustomerRateInRange = Number(
            commerceMetrics.repeatCustomerRateInRange ||
              (purchasingCustomersInRange
                ? (repeatCustomersInRange / purchasingCustomersInRange) * 100
                : 0),
          );
          const firstPurchaseShareInRange = Number(
            commerceMetrics.firstPurchaseShareInRange ||
              (purchasingCustomersInRange
                ? (firstTimeCustomersInRange / purchasingCustomersInRange) * 100
                : 0),
          );
          const vendorPayoutDueAmount = Number(
            commerceMetrics.vendorPayoutDueAmount || 0,
          );
          const vendorPayoutDueShipments = Number(
            commerceMetrics.vendorPayoutDueShipments || 0,
          );
          const vendorPayoutsCompletedInRange = Number(
            commerceMetrics.vendorPayoutsCompletedInRange || 0,
          );
          const vendorPayoutsCompletedShipmentsInRange = Number(
            commerceMetrics.vendorPayoutsCompletedShipmentsInRange || 0,
          );
          const analyticsTrends = commerceMetrics.trends || {};
          const totalCompanies = allCompanies.length;
          const totalDisputes = analyticsDisputes.length;
          const totalWithdrawals = analyticsWithdrawals.length;
          const totalResolvedDisputesAllTime =
            getDisputeStatusCounts(allDisputes).resolved || 0;
          const unresolvedDisputesBacklog = Math.max(
            allDisputes.length - totalResolvedDisputesAllTime,
            0,
          );
          const inFlightOrders =
            (orderStatusCounts.processing || 0) +
            (orderStatusCounts.partially_shipped || 0) +
            (orderStatusCounts.shipped || 0) +
            (orderStatusCounts.out_for_delivery || 0);
          const payoutReadyOrders = orderStatusCounts.delivered || 0;
          const completedOrders = orderStatusCounts.completed || 0;
          const completionRate = totalOrders
            ? (completedOrders / totalOrders) * 100
            : 0;
          const activeCompanies = companyStatusCounts.active || 0;
          const pendingCompanies = companyStatusCounts.pending || 0;
          const suspendedCompanies = companyStatusCounts.suspended || 0;
          const resolvedDisputes = disputeStatusCounts.resolved || 0;
          const openDisputes = Math.max(totalDisputes - resolvedDisputes, 0);
          const pendingWithdrawals = allWithdrawals.filter(
            (withdrawal) => withdrawal.status === "pending",
          );
          const pendingWithdrawalAmount = pendingWithdrawals.reduce(
            (sum, withdrawal) => sum + (withdrawal.amount || 0),
            0,
          );
          const pendingSettlementAmount = allCompanies.reduce(
            (sum, company) => sum + (company.stats?.pendingSettlement || 0),
            0,
          );
          const totalActiveRiders = allCompanies.reduce(
            (sum, company) => sum + (company.stats?.activeRiders || 0),
            0,
          );
          const pendingPharmacyReviews = pendingPharmacistRequests.length;
          const firstTimeBuyerLabel = isAllTimeRange
            ? "One-Time Buyers"
            : "First-Time Buyers";
          const newCustomerLabel = isAllTimeRange
            ? "Customers Registered"
            : "New Customers";
          const referralSignupsLabel = isAllTimeRange
            ? "Referral Signups"
            : `Referral Signups (${rangeLabel})`;
          const referralConversionsLabel = isAllTimeRange
            ? "Rewarded Referrals"
            : `Rewarded Referrals (${rangeLabel})`;
          const referralCostLabel = isAllTimeRange
            ? "Referral Reward Cost"
            : `Referral Reward Cost (${rangeLabel})`;
          const revenueTone = isAllTimeRange
            ? "medium"
            : getTrendTone(analyticsTrends.gmvChangePercent);
          const revenueBadge = isAllTimeRange
            ? "Lifetime"
            : getTrendBadge(analyticsTrends.gmvChangePercent);
          const platformRevenueTone = isAllTimeRange
            ? "medium"
            : getTrendTone(analyticsTrends.platformRevenueChangePercent);
          const platformRevenueBadge = isAllTimeRange
            ? "Lifetime"
            : getTrendBadge(analyticsTrends.platformRevenueChangePercent);
          const averageOrderValueTone = isAllTimeRange
            ? "medium"
            : getTrendTone(analyticsTrends.averageOrderValueChangePercent);
          const averageOrderValueBadge = isAllTimeRange
            ? "Lifetime"
            : getTrendBadge(analyticsTrends.averageOrderValueChangePercent);
          const newCustomerTone = isAllTimeRange
            ? "medium"
            : getTrendTone(analyticsTrends.newCustomersChangePercent);
          const newCustomerBadge = isAllTimeRange
            ? "Lifetime"
            : getTrendBadge(analyticsTrends.newCustomersChangePercent);
          const firstTimeBuyerTone = isAllTimeRange
            ? firstTimeCustomersInRange > 0
              ? "medium"
              : "good"
            : getTrendTone(analyticsTrends.firstTimeCustomersChangePercent);
          const firstTimeBuyerBadge = isAllTimeRange
            ? "Lifetime"
            : getTrendBadge(analyticsTrends.firstTimeCustomersChangePercent);
          const repeatBuyerTone = isAllTimeRange
            ? repeatCustomersInRange > 0
              ? "good"
              : "medium"
            : getTrendTone(analyticsTrends.repeatCustomersChangePercent);
          const repeatBuyerBadge = isAllTimeRange
            ? "Lifetime"
            : getTrendBadge(analyticsTrends.repeatCustomersChangePercent);
          const payoutsCompletedTone = isAllTimeRange
            ? vendorPayoutsCompletedInRange > 0
              ? "good"
              : "medium"
            : getTrendTone(analyticsTrends.vendorPayoutsCompletedChangePercent);
          const payoutsCompletedBadge = isAllTimeRange
            ? "Lifetime"
            : getTrendBadge(
                analyticsTrends.vendorPayoutsCompletedChangePercent,
              );
          const referralSignupsTone = isAllTimeRange
            ? totalReferralSignups > 0
              ? "good"
              : "medium"
            : getTrendTone(analyticsTrends.referralsSentChangePercent);
          const referralSignupsBadge = isAllTimeRange
            ? "Lifetime"
            : getTrendBadge(analyticsTrends.referralsSentChangePercent);
          const referralConversionsTone = isAllTimeRange
            ? totalRewardedReferrals > 0
              ? "good"
              : "medium"
            : getTrendTone(analyticsTrends.referralsConvertedChangePercent);
          const referralConversionsBadge = isAllTimeRange
            ? "Lifetime"
            : getTrendBadge(analyticsTrends.referralsConvertedChangePercent);
          const referralCostTone = isAllTimeRange
            ? totalReferralRewardCost > 0
              ? "medium"
              : "good"
            : "medium";
          const referralCostBadge = isAllTimeRange
            ? "Lifetime"
            : getTrendBadge(analyticsTrends.rewardCostTotalChangePercent);
          const topVendorSalesTotal = topPerformingVendors.reduce(
            (sum, vendor) => sum + Number(vendor.totalSalesAmount || 0),
            0,
          );
          const revenueAndPayoutTotal =
            grossMerchandiseValue +
            platformRevenue +
            vendorPayoutsCompletedInRange +
            vendorPayoutDueAmount;

          const metrics = [
            {
              label: "Registered Vendors",
              value: registeredVendors,
              badge: registeredVendors > 0 ? "Approved" : "None",
              tone: registeredVendors > 0 ? "good" : "medium",
              detail: `${activeVendors} approved vendors currently have active product listings, and ${vendorsWithSales} have already recorded sales.`,
            },
            {
              label: "Active Vendors",
              value: activeVendors,
              badge:
                vendorActivationRate >= 60
                  ? "Healthy"
                  : vendorActivationRate >= 35
                    ? "Watch"
                    : "Low",
              tone:
                vendorActivationRate >= 60
                  ? "good"
                  : vendorActivationRate >= 35
                    ? "medium"
                    : "high",
              detail: `${formatPercent(vendorActivationRate)} of approved vendors currently have active products available for customers to buy.`,
            },
            {
              label: "Vendors With Zero Products",
              value: vendorsWithZeroProducts,
              badge:
                vendorsWithZeroProducts === 0
                  ? "Clear"
                  : vendorsWithZeroProducts <= 3
                    ? "Watch"
                    : "Backlog",
              tone:
                vendorsWithZeroProducts === 0
                  ? "good"
                  : vendorsWithZeroProducts <= 3
                    ? "medium"
                    : "high",
              detail: `${vendorsWithZeroProducts} approved vendors still have no products listed, which blocks them from participating in demand.`,
            },
            {
              label: "Vendors With Products But No Sales",
              value: vendorsWithProductsButNoSales,
              badge:
                vendorsWithProductsButNoSales === 0
                  ? "Clear"
                  : vendorsWithProductsButNoSales <= 5
                    ? "Watch"
                    : "Risk",
              tone:
                vendorsWithProductsButNoSales === 0
                  ? "good"
                  : vendorsWithProductsButNoSales <= 5
                    ? "medium"
                    : "high",
              detail: `${vendorsWithProductsButNoSales} vendors have catalog supply but have not recorded a paid sale yet.`,
            },
            {
              label: "Inactive Vendors 30 Days",
              value: vendorsInactive30Days,
              badge:
                vendorsInactive30Days === 0
                  ? "Fresh"
                  : vendorsInactive30Days <= 5
                    ? "Watch"
                    : "Dormant",
              tone:
                vendorsInactive30Days === 0
                  ? "good"
                  : vendorsInactive30Days <= 5
                    ? "medium"
                    : "high",
              detail: `${vendorsInactive30Days} approved vendors show no product activity and no paid sale within the last 30 days.`,
            },
            {
              label: "Registered Customers",
              value: registeredCustomers,
              badge: registeredCustomers > 0 ? "Growing" : "New",
              tone: registeredCustomers > 0 ? "good" : "medium",
              detail: `${customersWithPurchases} have converted into buyers, while ${customersWithoutPurchases} are still waiting for their first order.`,
            },
            {
              label: `GMV (${rangeLabel})`,
              value: formatCurrency(grossMerchandiseValue),
              badge: revenueBadge,
              tone: revenueTone,
              detail: isAllTimeRange
                ? `${paidOrdersInRange} paid orders have generated ${formatCurrency(grossMerchandiseValue)} across the full tracked history.`
                : `${paidOrdersInRange} paid orders generated ${formatCurrency(grossMerchandiseValue)} in ${rangeLabel.toLowerCase()}, ${getTrendNarrative(analyticsTrends.gmvChangePercent)}.`,
            },
            {
              label: `Platform Revenue (${rangeLabel})`,
              value: formatCurrency(platformRevenue),
              badge: platformRevenueBadge,
              tone: platformRevenueTone,
              detail: isAllTimeRange
                ? `${formatCurrency(platformRevenue)} has been captured in platform fees so far.`
                : `${formatCurrency(platformRevenue)} in fees were captured in ${rangeLabel.toLowerCase()}, ${getTrendNarrative(analyticsTrends.platformRevenueChangePercent)}.`,
            },
            {
              label: `Average Order Value (${rangeLabel})`,
              value: formatCurrency(averageOrderValue),
              badge: averageOrderValueBadge,
              tone: averageOrderValueTone,
              detail: isAllTimeRange
                ? `Average paid basket size is ${formatCurrency(averageOrderValue)} across all successful purchases.`
                : `Average paid basket size is ${formatCurrency(averageOrderValue)} in ${rangeLabel.toLowerCase()}, ${getTrendNarrative(analyticsTrends.averageOrderValueChangePercent)}.`,
            },
            {
              label: `${newCustomerLabel} (${rangeLabel})`,
              value: newCustomersInRange,
              badge: newCustomerBadge,
              tone: newCustomerTone,
              detail: isAllTimeRange
                ? `${newCustomersInRange} customer accounts have been created in total.`
                : `${newCustomersInRange} customer accounts were created in ${rangeLabel.toLowerCase()}, ${getTrendNarrative(analyticsTrends.newCustomersChangePercent)}.`,
            },
            {
              label: `${firstTimeBuyerLabel} (${rangeLabel})`,
              value: firstTimeCustomersInRange,
              badge: firstTimeBuyerBadge,
              tone: firstTimeBuyerTone,
              detail: isAllTimeRange
                ? `${firstTimeCustomersInRange} buyers have made exactly one paid purchase so far.`
                : `${firstTimeCustomersInRange} customers made their first paid purchase in ${rangeLabel.toLowerCase()}, representing ${formatPercent(firstPurchaseShareInRange)} of paying customers in that window.`,
            },
            {
              label: `Repeat Buyers (${rangeLabel})`,
              value: repeatCustomersInRange,
              badge: repeatBuyerBadge,
              tone: repeatBuyerTone,
              detail: isAllTimeRange
                ? `${repeatCustomersInRange} buyers have made two or more paid orders so far.`
                : `${repeatCustomersInRange} returning customers placed paid orders in ${rangeLabel.toLowerCase()}, a ${formatPercent(repeatCustomerRateInRange)} repeat-buyer rate.`,
            },
            {
              label: "Customers Yet To Buy",
              value: customersWithoutPurchases,
              badge: customerPurchaseConversionRate >= 50 ? "Pipeline" : "Gap",
              tone: customerPurchaseConversionRate >= 50 ? "medium" : "high",
              detail: `${formatPercent(100 - customerPurchaseConversionRate)} of registered customers have not completed a paid order yet.`,
            },
            {
              label: "Purchasing Customers",
              value: customersWithPurchases,
              badge:
                customerPurchaseConversionRate >= 55
                  ? "Strong"
                  : customerPurchaseConversionRate >= 35
                    ? "Building"
                    : "Low",
              tone:
                customerPurchaseConversionRate >= 55
                  ? "good"
                  : customerPurchaseConversionRate >= 35
                    ? "medium"
                    : "high",
              detail: `${formatPercent(customerPurchaseConversionRate)} of registered customers have completed at least one paid order.`,
            },
            {
              label: "Vendors With Sales",
              value: vendorsWithSales,
              badge:
                vendorSalesParticipationRate >= 50
                  ? "Selling"
                  : vendorSalesParticipationRate >= 25
                    ? "Emerging"
                    : "Thin",
              tone:
                vendorSalesParticipationRate >= 50
                  ? "good"
                  : vendorSalesParticipationRate >= 25
                    ? "medium"
                    : "high",
              detail: `${formatPercent(vendorSalesParticipationRate)} of approved vendors have recorded at least one paid sale so far.`,
            },
            {
              label: referralSignupsLabel,
              value: isAllTimeRange
                ? totalReferralSignups
                : referralsSentInRange,
              badge: referralSignupsBadge,
              tone: referralSignupsTone,
              detail: isAllTimeRange
                ? `${totalReferralSignups} customers have joined through a referral code, with ${pendingReferralConversions} still waiting to convert into rewarded purchases.`
                : `${referralsSentInRange} referred signups were recorded in ${rangeLabel.toLowerCase()}, ${getTrendNarrative(analyticsTrends.referralsSentChangePercent)}.`,
            },
            {
              label: referralConversionsLabel,
              value: isAllTimeRange
                ? totalRewardedReferrals
                : referralsConvertedInRange,
              badge: referralConversionsBadge,
              tone: referralConversionsTone,
              detail: isAllTimeRange
                ? `${totalRewardedReferrals} referred customers have reached their first rewarded purchase so far.`
                : `${referralsConvertedInRange} referrals converted to rewarded first purchases in ${rangeLabel.toLowerCase()}, ${getTrendNarrative(analyticsTrends.referralsConvertedChangePercent)}.`,
            },
            {
              label: referralCostLabel,
              value: formatCurrency(
                isAllTimeRange
                  ? totalReferralRewardCost
                  : referralRewardCostTotalInRange,
              ),
              badge: referralCostBadge,
              tone: referralCostTone,
              detail: isAllTimeRange
                ? `${formatCurrency(totalReferralRewardCost)} has been paid out in referral rewards across all rewarded referrals.`
                : `${formatCurrency(referralRewardCostTotalInRange)} in referral rewards was granted in ${rangeLabel.toLowerCase()}, ${getTrendNarrative(analyticsTrends.rewardCostTotalChangePercent)}.`,
            },
            {
              label: "Vendor Payout Queue",
              value: formatCurrency(vendorPayoutDueAmount),
              badge:
                vendorPayoutDueAmount > 250000
                  ? "High"
                  : vendorPayoutDueAmount > 0
                    ? "Open"
                    : "Clear",
              tone:
                vendorPayoutDueAmount > 250000
                  ? "high"
                  : vendorPayoutDueAmount > 0
                    ? "medium"
                    : "good",
              detail: `${vendorPayoutDueShipments} shipment payouts are currently ready for vendors, while ${pendingWithdrawals.length} withdrawal requests remain in the broader cash-out queue.`,
            },
            {
              label: "Pharmacist Approval Queue",
              value: pendingPharmacyReviews,
              badge: pendingPharmacyReviews > 0 ? "Review" : "Clear",
              tone: pendingPharmacyReviews > 0 ? "medium" : "good",
              detail: `${pendingPharmacyReviews} approved vendor${pendingPharmacyReviews === 1 ? "" : "s"} are waiting for pharmacy privileges. Approved pharmacists can list medicines and consult with customers.`,
            },
            {
              label: `Vendor Payouts Completed (${rangeLabel})`,
              value: formatCurrency(vendorPayoutsCompletedInRange),
              badge: payoutsCompletedBadge,
              tone: payoutsCompletedTone,
              detail: isAllTimeRange
                ? `${vendorPayoutsCompletedShipmentsInRange} shipment payouts have been completed for vendors so far.`
                : `${vendorPayoutsCompletedShipmentsInRange} shipment payouts were completed in ${rangeLabel.toLowerCase()}, ${getTrendNarrative(analyticsTrends.vendorPayoutsCompletedChangePercent)}.`,
            },
            {
              label: "Completion Rate",
              value: formatPercent(completionRate),
              badge:
                completionRate >= 60
                  ? "Healthy"
                  : completionRate >= 35
                    ? "Watch"
                    : "Risk",
              tone:
                completionRate >= 60
                  ? "good"
                  : completionRate >= 35
                    ? "medium"
                    : "high",
              detail: `${completedOrders} completed orders out of ${totalOrders || 0} tracked in ${rangeLabel.toLowerCase()}, while ${inFlightOrders} remain in motion and ${payoutReadyOrders} are delivered but not fully closed out.`,
            },
          ];

          const breakdownSections = [
            {
              title: `Revenue and Payouts (${rangeLabel})`,
              total: revenueAndPayoutTotal,
              totalDisplay: formatCurrency(revenueAndPayoutTotal),
              unitLabel: "tracked",
              items: [
                {
                  label: "GMV",
                  value: grossMerchandiseValue,
                  displayValue: formatCurrency(grossMerchandiseValue),
                },
                {
                  label: "Platform Revenue",
                  value: platformRevenue,
                  displayValue: formatCurrency(platformRevenue),
                },
                {
                  label: "Vendor Payouts Completed",
                  value: vendorPayoutsCompletedInRange,
                  displayValue: formatCurrency(vendorPayoutsCompletedInRange),
                },
                {
                  label: "Vendor Payout Queue",
                  value: vendorPayoutDueAmount,
                  displayValue: formatCurrency(vendorPayoutDueAmount),
                },
              ].filter((item) => item.value > 0),
            },
            {
              title: "Vendor Base",
              total: registeredVendors,
              items: [
                { label: "Approved Vendors", value: registeredVendors },
                { label: "Active Vendors", value: activeVendors },
                { label: "Vendors With Sales", value: vendorsWithSales },
                { label: "Pharmacy Requests", value: pendingPharmacyReviews },
              ].filter((item) => item.value > 0),
            },
            {
              title: "Vendor Quality",
              total: registeredVendors,
              items: [
                { label: "Zero Products", value: vendorsWithZeroProducts },
                {
                  label: "Products But No Sales",
                  value: vendorsWithProductsButNoSales,
                },
                {
                  label: "Active Vendors With No Sales",
                  value: activeVendorsWithNoSales,
                },
                { label: "Inactive 30 Days", value: vendorsInactive30Days },
              ].filter((item) => item.value > 0),
            },
            {
              title: "Customer Base",
              total: registeredCustomers,
              items: [
                { label: "Registered Customers", value: registeredCustomers },
                { label: "Yet To Buy", value: customersWithoutPurchases },
                { label: "With Purchases", value: customersWithPurchases },
              ].filter((item) => item.value > 0),
            },
            {
              title: `Buyer Behavior (${rangeLabel})`,
              total: Math.max(purchasingCustomersInRange, 0),
              items: [
                {
                  label: "Paying Customers",
                  value: purchasingCustomersInRange,
                },
                {
                  label: firstTimeBuyerLabel,
                  value: firstTimeCustomersInRange,
                },
                { label: "Repeat Buyers", value: repeatCustomersInRange },
              ].filter((item) => item.value > 0),
            },
            {
              title: `Referral Performance (${rangeLabel})`,
              total: Math.max(
                isAllTimeRange ? totalReferralSignups : referralsSentInRange,
                isAllTimeRange
                  ? totalRewardedReferrals
                  : referralsConvertedInRange,
                0,
              ),
              items: [
                {
                  label: "Referral Signups",
                  value: isAllTimeRange
                    ? totalReferralSignups
                    : referralsSentInRange,
                },
                {
                  label: "Rewarded Referrals",
                  value: isAllTimeRange
                    ? totalRewardedReferrals
                    : referralsConvertedInRange,
                },
                ...(isAllTimeRange
                  ? [
                      {
                        label: "Pending Referral Conversions",
                        value: pendingReferralConversions,
                      },
                    ]
                  : []),
              ].filter((item) => item.value > 0),
            },
            {
              title: `Order Status Mix (${rangeLabel})`,
              total: totalOrders,
              items: [
                {
                  label: "Pending Payment",
                  value: orderStatusCounts.pending_payment || 0,
                },
                {
                  label: "Processing",
                  value: orderStatusCounts.processing || 0,
                },
                {
                  label: "Partially Shipped",
                  value: orderStatusCounts.partially_shipped || 0,
                },
                { label: "Shipped", value: orderStatusCounts.shipped || 0 },
                {
                  label: "Out for Delivery",
                  value: orderStatusCounts.out_for_delivery || 0,
                },
                { label: "Delivered", value: orderStatusCounts.delivered || 0 },
                { label: "Completed", value: orderStatusCounts.completed || 0 },
                { label: "Cancelled", value: orderStatusCounts.cancelled || 0 },
              ].filter((item) => item.value > 0),
            },
            {
              title: "Company Status Mix",
              total: totalCompanies,
              items: [
                { label: "Active", value: activeCompanies },
                { label: "Pending", value: pendingCompanies },
                { label: "Suspended", value: suspendedCompanies },
              ].filter((item) => item.value > 0),
            },
            {
              title: `Dispute and Withdrawal Load (${rangeLabel})`,
              total: totalDisputes + totalWithdrawals,
              items: [
                { label: "Open Disputes", value: openDisputes },
                { label: "Resolved Disputes", value: resolvedDisputes },
                {
                  label: "Pending Withdrawals",
                  value: withdrawalStatusCounts.pending || 0,
                },
                {
                  label: "Completed Withdrawals",
                  value: withdrawalStatusCounts.completed || 0,
                },
                {
                  label: "Failed Withdrawals",
                  value: withdrawalStatusCounts.failed || 0,
                },
              ].filter((item) => item.value > 0),
            },
            {
              title: `Top Performing Vendors (${rangeLabel})`,
              total: topVendorSalesTotal,
              totalDisplay: formatCurrency(topVendorSalesTotal),
              unitLabel: "sales",
              items: topPerformingVendors
                .map((vendor) => ({
                  label: `${vendor.vendorName} • ${vendor.paidOrders} paid orders`,
                  value: Number(vendor.totalSalesAmount || 0),
                  displayValue: formatCurrency(vendor.totalSalesAmount || 0),
                }))
                .filter((item) => item.value > 0),
            },
          ];

          const insights = [];

          if (registeredCustomers > 0 && customerPurchaseConversionRate < 45) {
            insights.push({
              title: "Customer conversion is leaving revenue on the table",
              badge: customerPurchaseConversionRate < 30 ? "High" : "Medium",
              tone: customerPurchaseConversionRate < 30 ? "high" : "medium",
              detail: `${customersWithoutPurchases} registered customers have not made a first purchase yet. Improve onboarding offers, reminders, and first-order activation.`,
            });
          }

          if (
            purchasingCustomersInRange >= 5 &&
            repeatCustomerRateInRange < 25
          ) {
            insights.push({
              title: "Repeat purchasing is still thin",
              badge: repeatCustomerRateInRange < 15 ? "High" : "Medium",
              tone: repeatCustomerRateInRange < 15 ? "high" : "medium",
              detail: `${repeatCustomersInRange} repeat buyers accounted for only ${formatPercent(repeatCustomerRateInRange)} of paying customers in ${rangeLabel.toLowerCase()}. Loyalty nudges and post-purchase follow-up should help.`,
            });
          }

          if (
            !isAllTimeRange &&
            Number(analyticsTrends.gmvChangePercent || 0) < -10
          ) {
            insights.push({
              title: "GMV softened versus the previous period",
              badge: "Medium",
              tone: "medium",
              detail: `GMV is ${formatSignedPercent(analyticsTrends.gmvChangePercent)} versus the previous window. Review campaign output, checkout friction, and stock availability.`,
            });
          }

          if (registeredVendors > 0 && vendorActivationRate < 55) {
            insights.push({
              title: "Approved vendors are not fully active",
              badge: vendorActivationRate < 30 ? "High" : "Medium",
              tone: vendorActivationRate < 30 ? "high" : "medium",
              detail: `Only ${activeVendors} out of ${registeredVendors} approved vendors have active listings. More activation support can widen available supply.`,
            });
          }

          if (activeVendors > 0 && vendorSalesParticipationRate < 50) {
            insights.push({
              title: "Many active vendors have not converted into sellers",
              badge: vendorSalesParticipationRate < 25 ? "High" : "Medium",
              tone: vendorSalesParticipationRate < 25 ? "high" : "medium",
              detail: `${vendorsWithSales} vendors have recorded sales, leaving ${Math.max(activeVendors - vendorsWithSales, 0)} active vendors still without a paid sale.`,
            });
          }

          if (vendorsWithZeroProducts > 0) {
            insights.push({
              title: "Some approved vendors still have empty storefronts",
              badge: vendorsWithZeroProducts > 5 ? "High" : "Medium",
              tone: vendorsWithZeroProducts > 5 ? "high" : "medium",
              detail: `${vendorsWithZeroProducts} approved vendors have zero listed products. A quick activation push can turn approvals into actual supply.`,
            });
          }

          if (vendorsInactive30Days > 0) {
            insights.push({
              title: "Dormant vendors need reactivation",
              badge: vendorsInactive30Days > 8 ? "High" : "Medium",
              tone: vendorsInactive30Days > 8 ? "high" : "medium",
              detail: `${vendorsInactive30Days} approved vendors have shown no product activity and no paid sales in the last 30 days.`,
            });
          }

          if (pendingVendorRequests.length > 8) {
            insights.push({
              title: "Vendor onboarding queue is building up",
              badge: "High",
              tone: "high",
              detail: `${pendingVendorRequests.length} vendor requests are waiting. Clearing this queue can expand supply before demand shifts elsewhere.`,
            });
          }

          if (pendingPharmacyReviews > 0) {
            insights.push({
              title: "Pharmacist approvals are waiting",
              badge: pendingPharmacyReviews > 5 ? "High" : "Medium",
              tone: pendingPharmacyReviews > 5 ? "high" : "medium",
              detail: `${pendingPharmacyReviews} approved vendor${pendingPharmacyReviews === 1 ? " wants" : "s want"} pharmacist privileges. Review them before they can list medicine or provide pharmacy guidance.`,
            });
          }

          if (openDisputes > 0) {
            insights.push({
              title: "Dispute backlog can affect trust",
              badge: openDisputes > 5 ? "High" : "Medium",
              tone: openDisputes > 5 ? "high" : "medium",
              detail: `${openDisputes} disputes remain unresolved. Resolving them quickly reduces refund pressure and support churn.`,
            });
          }

          if (
            vendorPayoutDueAmount > 0 ||
            pendingWithdrawals.length > 0 ||
            pendingSettlementAmount > 0
          ) {
            insights.push({
              title: "Cash-out pressure needs review",
              badge:
                vendorPayoutDueAmount > 250000 ||
                pendingWithdrawalAmount > 250000
                  ? "High"
                  : "Medium",
              tone:
                vendorPayoutDueAmount > 250000 ||
                pendingWithdrawalAmount > 250000
                  ? "high"
                  : "medium",
              detail: `${formatCurrency(vendorPayoutDueAmount)} is currently queued for vendor payouts, with ${pendingWithdrawals.length} withdrawal requests and ${formatCurrency(pendingSettlementAmount)} in pending settlements also on the radar.`,
            });
          }

          if (completionRate < 45 && totalOrders >= 5) {
            insights.push({
              title: "Fulfillment throughput is under target",
              badge: "Medium",
              tone: "medium",
              detail: `Only ${formatPercent(completionRate)} of tracked orders are fully completed. Inspect cancellations, delivery delays, and payout blockers.`,
            });
          }

          if (
            (isAllTimeRange ? totalReferralSignups : referralsSentInRange) >
              0 &&
            (isAllTimeRange
              ? totalRewardedReferrals
              : referralsConvertedInRange) === 0
          ) {
            insights.push({
              title:
                "Referral traffic is not converting into rewarded purchases yet",
              badge: "Medium",
              tone: "medium",
              detail: isAllTimeRange
                ? `${totalReferralSignups} referral signups have been recorded, but none has reached the rewarded first-purchase stage yet.`
                : `${referralsSentInRange} referral signups were recorded in ${rangeLabel.toLowerCase()}, but no rewarded first purchase landed in the same window.`,
            });
          }

          if (
            !isAllTimeRange &&
            Number(analyticsTrends.gmvChangePercent || 0) > 10
          ) {
            insights.push({
              title: "Revenue momentum is improving",
              badge: "Good",
              tone: "good",
              detail: `GMV is ${formatSignedPercent(analyticsTrends.gmvChangePercent)} versus the previous period, supported by ${paidOrdersInRange} paid orders in ${rangeLabel.toLowerCase()}.`,
            });
          }

          if (activeCompanies > 0) {
            insights.push({
              title: "Active supply base available",
              badge: "Good",
              tone: "good",
              detail: `${activeCompanies} active companies and ${formatCompactNumber(totalActiveRiders)} active riders give you room to push campaigns or clear order backlog.`,
            });
          }

          if (!insights.length) {
            insights.push({
              title: "No major operational pressure detected",
              badge: "Good",
              tone: "good",
              detail:
                "The main queues are currently light. This is a good window to focus on growth experiments or service quality improvements.",
            });
          }

          const alerts = [];

          if (
            pendingWithdrawals.length >= 5 ||
            pendingWithdrawalAmount >= 250000
          ) {
            alerts.push({
              label: `High Pending Withdrawals: ${pendingWithdrawals.length}`,
              tone: "high",
              detail: `${pendingWithdrawals.length} withdrawal requests worth ${formatCurrency(pendingWithdrawalAmount)} are currently pending.`,
            });
          }

          if (unresolvedDisputesBacklog >= 5) {
            alerts.push({
              label: `High Unresolved Disputes: ${unresolvedDisputesBacklog}`,
              tone: "high",
              detail: `${unresolvedDisputesBacklog} disputes remain unresolved across the full admin queue.`,
            });
          }

          if (activeVendorsWithNoSales >= 5) {
            alerts.push({
              label: `Active Vendors With No Sales: ${activeVendorsWithNoSales}`,
              tone: "medium",
              detail: `${activeVendorsWithNoSales} active vendors still have no paid sale on record.`,
            });
          }

          if (pendingPharmacyReviews > 0) {
            alerts.push({
              label: `Pharmacy Reviews: ${pendingPharmacyReviews}`,
              tone: pendingPharmacyReviews > 5 ? "high" : "medium",
              detail: `${pendingPharmacyReviews} pharmacist approval request${pendingPharmacyReviews === 1 ? " is" : "s are"} waiting.`,
            });
          }

          if (
            customersWithoutPurchases >= 25 ||
            (registeredCustomers > 0 &&
              (customersWithoutPurchases / registeredCustomers) * 100 >= 45)
          ) {
            alerts.push({
              label: `Customers Yet To Buy: ${customersWithoutPurchases}`,
              tone: "medium",
              detail: `${customersWithoutPurchases} registered customers still have not completed a paid order.`,
            });
          }

          renderAnalyticsCards(metrics);
          renderAnalyticsBreakdown(breakdownSections);
          renderAnalyticsInsights(insights.slice(0, 4));
          renderAnalyticsAlerts(alerts);

          latestAnalyticsSnapshot = {
            rangeLabel,
            generatedAt: analyticsLastUpdated
              ? analyticsLastUpdated.toISOString()
              : new Date().toISOString(),
            metrics,
            breakdownSections,
            alerts,
            topPerformingVendors,
          };

          if (analyticsMeta) {
            const parts = [
              `Range ${rangeLabel}`,
              `${totalOrders} orders`,
              `${paidOrdersInRange} paid`,
              `${formatCurrency(grossMerchandiseValue)} GMV`,
              `${registeredCustomers} customers`,
              `${registeredVendors} vendors`,
              `${vendorPayoutDueShipments} payout-ready shipments`,
              `${pendingVendorRequests.length} vendor reviews`,
              `${pendingPharmacyReviews} pharmacy reviews`,
            ];

            const refreshedText = analyticsLastUpdated
              ? `Last refreshed ${analyticsLastUpdated.toLocaleTimeString()}`
              : "Live metrics update as data loads";

            analyticsMeta.textContent = `${parts.join(" | ")} | ${refreshedText}`;
          }
        }

        async function refreshAnalyticsView() {
          if (isAnalyticsRefreshing) return;

          isAnalyticsRefreshing = true;

          if (refreshAnalyticsBtn) {
            refreshAnalyticsBtn.disabled = true;
            refreshAnalyticsBtn.textContent = "Refreshing...";
          }

          if (analyticsMeta) {
            analyticsMeta.textContent = `Refreshing ${analyticsRangeSelect?.selectedOptions?.[0]?.textContent || "selected"} operational data and decision signals...`;
          }

          await Promise.allSettled([
            fetchPendingVendorRequests(),
            fetchPendingPharmacistRequests(),
            fetchCustomerVendorMetrics(selectedAnalyticsRange),
            fetchOrders(),
            fetchDisputes(),
            fetchPendingWithdrawals(),
            fetchCompanies(),
          ]);

          analyticsLastUpdated = new Date();
          isAnalyticsRefreshing = false;
          updateAnalyticsView();

          if (refreshAnalyticsBtn) {
            refreshAnalyticsBtn.disabled = false;
            refreshAnalyticsBtn.textContent = "Refresh Insights";
          }
        }

        // ──────────────────────────────────────────────
        // Vendor Requests (always visible)
        // ──────────────────────────────────────────────
        async function fetchCustomerVendorMetrics(
          range = selectedAnalyticsRange,
        ) {
          if (!adminToken) return;

          selectedAnalyticsRange = range || "30d";

          try {
            const query = new URLSearchParams({
              range: selectedAnalyticsRange,
            }).toString();
            const response = await fetch(
              `${BASE_URL}/api/admin/customer-vendor-metrics?${query}`,
              {
                headers: { Authorization: `Bearer ${adminToken}` },
              },
            );
            const data = await response.json();

            if (handleAdminSessionExpiry(response.status)) {
              return;
            }

            if (response.ok) {
              customerVendorMetrics = data || null;
              analyticsRangeWindow = data?.range || null;

              if (
                analyticsRangeSelect &&
                analyticsRangeSelect.value !== selectedAnalyticsRange
              ) {
                analyticsRangeSelect.value = selectedAnalyticsRange;
              }

              updateAnalyticsView();
            } else {
              displayMessage(
                data.message || "Failed to fetch customer and vendor metrics.",
                "error",
              );
            }
          } catch (err) {
            displayMessage(
              `Error loading customer/vendor metrics: ${err.message}`,
              "error",
            );
          }
        }
