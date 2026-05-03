// Protected panel bootstrapping
// ──────────────────────────────────────────────
if (adminToken) {
  if (logoutAdminBtn) {
    logoutAdminBtn.addEventListener("click", () => {
      clearAdminSession();
      redirectToLogin("logout");
    });
  }

  displayMessage("Session restored", "success");
  initializeSocket();

  if (currentPage === "dashboard") {
    updateAnalyticsView();
    refreshAnalyticsView();
  }

  // ──────────────────────────────────────────────
  // Green Button Toggles + lazy load
  // ──────────────────────────────────────────────
  document
    .getElementById("toggleCompaniesBtn")
    ?.addEventListener("click", () => {
      const section = document.getElementById("companiesSection");
      section.classList.toggle("hidden");

      // Hide other sections when one is opened
      [
        "referralSettingsSection",
        "deliveryFeeSettingsSection",
        "carouselSlidesSection",
        "pharmacySubscriptionSettingsSection",
        "ordersSection",
        "disputesSection",
        "withdrawalsSection",
      ].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.classList.add("hidden");
      });

      if (!section.classList.contains("hidden")) {
        fetchCompanies();
      }
    });

  document
    .getElementById("toggleReferralSettingsBtn")
    ?.addEventListener("click", () => {
      if (!referralSettingsSection) return;

      referralSettingsSection.classList.toggle("hidden");

      [
        "companiesSection",
        "deliveryFeeSettingsSection",
        "carouselSlidesSection",
        "pharmacySubscriptionSettingsSection",
        "ordersSection",
        "disputesSection",
        "withdrawalsSection",
      ].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.classList.add("hidden");
      });

      if (
        !referralSettingsSection.classList.contains("hidden") &&
        !hasLoadedReferralSettings
      ) {
        fetchReferralSettings();
      }
    });

  document
    .getElementById("toggleDeliveryFeeSettingsBtn")
    ?.addEventListener("click", () => {
      if (!deliveryFeeSettingsSection) return;

      deliveryFeeSettingsSection.classList.toggle("hidden");

      [
        "companiesSection",
        "referralSettingsSection",
        "carouselSlidesSection",
        "pharmacySubscriptionSettingsSection",
        "ordersSection",
        "disputesSection",
        "withdrawalsSection",
      ].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.classList.add("hidden");
      });

      if (
        !deliveryFeeSettingsSection.classList.contains("hidden") &&
        !hasLoadedDeliveryFeeSettings
      ) {
        fetchDeliveryFeeSettings();
      }
    });

  document
    .getElementById("toggleCarouselSlidesBtn")
    ?.addEventListener("click", () => {
      if (!carouselSlidesSection) return;

      carouselSlidesSection.classList.toggle("hidden");

      [
        "companiesSection",
        "referralSettingsSection",
        "deliveryFeeSettingsSection",
        "pharmacySubscriptionSettingsSection",
        "ordersSection",
        "disputesSection",
        "withdrawalsSection",
      ].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.classList.add("hidden");
      });

      if (
        !carouselSlidesSection.classList.contains("hidden") &&
        !hasLoadedCarouselSlides
      ) {
        fetchCarouselSlides();
      }
    });

  document
    .getElementById("togglePharmacySubscriptionSettingsBtn")
    ?.addEventListener("click", () => {
      if (!pharmacySubscriptionSettingsSection) return;

      pharmacySubscriptionSettingsSection.classList.toggle("hidden");

      [
        "companiesSection",
        "referralSettingsSection",
        "deliveryFeeSettingsSection",
        "carouselSlidesSection",
        "ordersSection",
        "disputesSection",
        "withdrawalsSection",
      ].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.classList.add("hidden");
      });

      if (
        !pharmacySubscriptionSettingsSection.classList.contains("hidden") &&
        !hasLoadedPharmacySubscriptionSettings
      ) {
        fetchPharmacySubscriptionSettings();
      }
    });

  document.getElementById("toggleOrdersBtn")?.addEventListener("click", () => {
    const section = document.getElementById("ordersSection");
    section.classList.toggle("hidden");

    // Hide other sections when one is opened
    [
      "companiesSection",
      "referralSettingsSection",
      "deliveryFeeSettingsSection",
      "carouselSlidesSection",
      "pharmacySubscriptionSettingsSection",
      "disputesSection",
      "withdrawalsSection",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.add("hidden");
    });

    if (!section.classList.contains("hidden") && allOrders.length === 0) {
      fetchOrders();
    }
  });

  document
    .getElementById("toggleDisputesBtn")
    ?.addEventListener("click", () => {
      const section = document.getElementById("disputesSection");
      section.classList.toggle("hidden");

      // Hide other sections when one is opened
      [
        "companiesSection",
        "referralSettingsSection",
        "deliveryFeeSettingsSection",
        "carouselSlidesSection",
        "pharmacySubscriptionSettingsSection",
        "ordersSection",
        "withdrawalsSection",
      ].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.classList.add("hidden");
      });

      if (!section.classList.contains("hidden")) {
        fetchDisputes();
      }
    });

  document
    .getElementById("toggleWithdrawalsBtn")
    ?.addEventListener("click", () => {
      const section = document.getElementById("withdrawalsSection");
      section.classList.toggle("hidden");

      // Hide other sections when one is opened
      [
        "companiesSection",
        "referralSettingsSection",
        "deliveryFeeSettingsSection",
        "carouselSlidesSection",
        "pharmacySubscriptionSettingsSection",
        "ordersSection",
        "disputesSection",
      ].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.classList.add("hidden");
      });

      if (!section.classList.contains("hidden")) {
        fetchPendingWithdrawals();
      }
    });

  // Refresh buttons
  refreshAnalyticsBtn?.addEventListener("click", refreshAnalyticsView);
  exportAnalyticsBtn?.addEventListener("click", exportAnalyticsSnapshotToCsv);
  refreshPharmacistRequestsBtn?.addEventListener(
    "click",
    fetchPendingPharmacistRequests,
  );
  analyticsRangeSelect?.addEventListener("change", (event) => {
    selectedAnalyticsRange = event.target.value || "30d";
    refreshAnalyticsView();
  });
  document
    .getElementById("refreshCompaniesBtn")
    ?.addEventListener("click", fetchCompanies);
  if (refreshWithdrawalsBtn) {
    refreshWithdrawalsBtn.addEventListener("click", fetchPendingWithdrawals);
  }
  refreshReferralSettingsBtn?.addEventListener("click", fetchReferralSettings);
  referralSettingsForm?.addEventListener("submit", saveReferralSettings);
  refreshDeliveryFeeSettingsBtn?.addEventListener(
    "click",
    fetchDeliveryFeeSettings,
  );
  deliveryFeeSettingsForm?.addEventListener("submit", saveDeliveryFeeSettings);
  refreshCarouselSlidesBtn?.addEventListener("click", fetchCarouselSlides);
  mainCarouselCreateForm?.addEventListener("submit", createCarouselSlide);
  promoCarouselCreateForm?.addEventListener("submit", createCarouselSlide);
  refreshPharmacySubscriptionSettingsBtn?.addEventListener(
    "click",
    fetchPharmacySubscriptionSettings,
  );
  pharmacySubscriptionSettingsForm?.addEventListener(
    "submit",
    savePharmacySubscriptionSettings,
  );

  const pageLoaders = {
    "vendor-requests": fetchPendingVendorRequests,
    "pharmacist-requests": fetchPendingPharmacistRequests,
    companies: fetchCompanies,
    orders: fetchOrders,
    disputes: fetchDisputes,
    withdrawals: fetchPendingWithdrawals,
    "referral-settings": fetchReferralSettings,
    "delivery-fees": fetchDeliveryFeeSettings,
    "carousel-slides": fetchCarouselSlides,
    "food-readiness-campaigns":
      typeof fetchFoodReadinessCampaigns === "function"
        ? fetchFoodReadinessCampaigns
        : null,
    "pharmacy-chat-prices": fetchPharmacySubscriptionSettings,
    "product-moderation": fetchProductModerationQueue,
    "engagement-analytics":
      typeof fetchEngagementAnalytics === "function"
        ? fetchEngagementAnalytics
        : null,
  };

  pageLoaders[currentPage]?.();

  // Filter change
  if (orderFilterDropdown) {
    orderFilterDropdown.addEventListener("change", (e) => {
      currentFilter = e.target.value;
      if (allOrders.length > 0) {
        renderOrders(applyFilter(allOrders));
      }
    });
  }
}
