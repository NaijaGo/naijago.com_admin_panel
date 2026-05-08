let latestSubscriptionPlans = [];

const subscriptionSummaryCards = document.getElementById("subscriptionSummaryCards");
const subscriptionPlanEditor = document.getElementById("subscriptionPlanEditor");
const subscriptionPlansForm = document.getElementById("subscriptionPlansForm");
const subscriptionSubscribersList = document.getElementById("subscriptionSubscribersList");
const subscriptionDiscountOrdersList = document.getElementById("subscriptionDiscountOrdersList");
const refreshSubscriptionsBtn = document.getElementById("refreshSubscriptionsBtn");

function renderSubscriptionSummary(summary = {}) {
  if (!subscriptionSummaryCards) return;
  const cards = [
    ["Active Subscribers", summary.active || 0],
    ["Monthly Plan Value", formatCurrency(summary.activeMonthlyValue || 0)],
    ["Wallet Revenue", formatCurrency(summary.revenue || 0)],
    ["Delivery Discounts", formatCurrency(summary.deliveryDiscounts || 0)],
  ];
  subscriptionSummaryCards.innerHTML = cards
    .map(
      ([label, value]) => `
        <div class="card p-5">
          <p class="text-xs uppercase tracking-[0.25em] text-light-gray">${escapeHtml(label)}</p>
          <p class="text-3xl font-extrabold text-light-slate mt-3">${escapeHtml(String(value))}</p>
        </div>
      `,
    )
    .join("");
}

function renderSubscriptionPlans(plans = []) {
  if (!subscriptionPlanEditor) return;
  latestSubscriptionPlans = plans;
  subscriptionPlanEditor.innerHTML = plans
    .map(
      (plan) => `
        <div class="rounded-2xl border border-cyan-400 border-opacity-10 bg-blue-950 bg-opacity-20 p-5" data-subscription-plan="${escapeHtml(plan.id)}">
          <div class="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 class="text-xl font-bold text-light-slate">${escapeHtml(plan.name)}</h3>
              <p class="text-xs uppercase tracking-[0.2em] text-light-gray">${escapeHtml(plan.id)}</p>
            </div>
            <label class="flex items-center gap-2 text-xs text-light-gray">
              <input type="checkbox" data-plan-field="isActive" ${plan.isActive !== false ? "checked" : ""} />
              Active
            </label>
          </div>
          <label class="block text-xs font-semibold uppercase tracking-[0.2em] text-light-gray mb-2">Price (₦)</label>
          <input class="input-field w-full mb-3" type="number" min="0" data-plan-field="price" value="${Number(plan.price || 0)}" />
          <label class="block text-xs font-semibold uppercase tracking-[0.2em] text-light-gray mb-2">Free Deliveries</label>
          <input class="input-field w-full mb-3" type="number" min="0" data-plan-field="deliveries" value="${Number(plan.deliveries || 0)}" />
          <label class="block text-xs font-semibold uppercase tracking-[0.2em] text-light-gray mb-2">Minimum Order (₦)</label>
          <input class="input-field w-full mb-3" type="number" min="0" data-plan-field="minimumOrderValue" value="${Number(plan.minimumOrderValue || 0)}" />
          <label class="block text-xs font-semibold uppercase tracking-[0.2em] text-light-gray mb-2">Scope</label>
          <select class="input-field w-full" data-plan-field="deliveryScope">
            <option value="same_zone" ${plan.deliveryScope === "same_zone" ? "selected" : ""}>Same zone</option>
            <option value="city_errands" ${plan.deliveryScope === "city_errands" ? "selected" : ""}>City errands</option>
          </select>
        </div>
      `,
    )
    .join("");
}

function renderSubscribers(subscribers = []) {
  if (!subscriptionSubscribersList) return;
  if (!subscribers.length) {
    subscriptionSubscribersList.innerHTML = '<p class="text-light-gray">No subscription setups yet.</p>';
    return;
  }
  subscriptionSubscribersList.innerHTML = subscribers
    .map((user) => {
      const sub = user.naijagoSubscription || {};
      const name = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Customer";
      return `
        <div class="rounded-2xl border border-cyan-400 border-opacity-10 bg-[#10203D] p-4">
          <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p class="text-lg font-bold text-light-slate">${escapeHtml(name)}</p>
              <p class="text-sm text-light-gray">${escapeHtml(user.email || "")} • ${escapeHtml(user.phoneNumber || "No phone")}</p>
            </div>
            <span class="analytics-pill ${sub.status === "active" ? "good" : "medium"}">${escapeHtml(sub.status || "inactive")}</span>
          </div>
          <div class="grid gap-3 mt-4 md:grid-cols-4 text-sm">
            <p><span class="text-light-gray">Plan:</span> <strong class="text-light-slate">${escapeHtml(sub.planName || sub.planId || "None")}</strong></p>
            <p><span class="text-light-gray">Price:</span> <strong class="text-light-slate">${formatCurrency(sub.price || 0)}</strong></p>
            <p><span class="text-light-gray">Remaining:</span> <strong class="text-light-slate">${Number(sub.deliveriesRemaining || 0)} / ${Number(sub.monthlyDeliveryLimit || 0)}</strong></p>
            <p><span class="text-light-gray">Expires:</span> <strong class="text-light-slate">${formatDateTime(sub.expiresAt)}</strong></p>
          </div>
          <p class="text-xs text-light-gray mt-3">Preferences: ${escapeHtml((sub.preferences || []).join(", ") || "None")}</p>
        </div>
      `;
    })
    .join("");
}

function renderDiscountOrders(orders = []) {
  if (!subscriptionDiscountOrdersList) return;
  if (!orders.length) {
    subscriptionDiscountOrdersList.innerHTML = '<p class="text-light-gray">No subscription delivery discounts used yet.</p>';
    return;
  }
  subscriptionDiscountOrdersList.innerHTML = orders
    .map((order) => {
      const user = order.user || {};
      const name = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Customer";
      return `
        <div class="rounded-2xl border border-cyan-400 border-opacity-10 bg-[#10203D] p-4">
          <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p class="text-light-slate font-bold">${escapeHtml(name)}</p>
            <p class="text-green-300 font-bold">${formatCurrency(order.subscriptionDeliveryDiscount || 0)} saved</p>
          </div>
          <p class="text-sm text-light-gray mt-2">Order total ${formatCurrency(order.totalPrice || 0)} • Plan ${escapeHtml(order.subscriptionPlanId || "N/A")} • ${formatDateTime(order.createdAt)}</p>
        </div>
      `;
    })
    .join("");
}

async function fetchSubscriptions() {
  if (!adminToken) return;
  try {
    const response = await fetch(`${BASE_URL}/api/subscriptions/admin/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Failed to fetch subscriptions.");
    renderSubscriptionSummary(data.summary);
    renderSubscriptionPlans(data.plans || []);
    renderSubscribers(data.subscribers || []);
    renderDiscountOrders(data.discountedOrders || []);
  } catch (error) {
    displayMessage(`Error loading subscriptions: ${error.message}`, "error");
  }
}

async function saveSubscriptionPlans(event) {
  event.preventDefault();
  if (!adminToken) return;
  const plans = latestSubscriptionPlans.map((plan) => {
    const root = subscriptionPlanEditor.querySelector(`[data-subscription-plan="${plan.id}"]`);
    return {
      ...plan,
      price: Number(root?.querySelector('[data-plan-field="price"]')?.value || plan.price || 0),
      deliveries: Number(root?.querySelector('[data-plan-field="deliveries"]')?.value || plan.deliveries || 0),
      minimumOrderValue: Number(root?.querySelector('[data-plan-field="minimumOrderValue"]')?.value || plan.minimumOrderValue || 0),
      deliveryScope: root?.querySelector('[data-plan-field="deliveryScope"]')?.value || plan.deliveryScope,
      deliveryScopeLabel: (root?.querySelector('[data-plan-field="deliveryScope"]')?.value || plan.deliveryScope) === "city_errands" ? "Within city errands" : "Same zone only",
      isActive: Boolean(root?.querySelector('[data-plan-field="isActive"]')?.checked),
    };
  });
  try {
    const response = await fetch(`${BASE_URL}/api/subscriptions/admin/plans`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ plans }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Failed to save plans.");
    displayMessage(data.message || "Subscription plans saved.", "success");
    fetchSubscriptions();
  } catch (error) {
    displayMessage(`Error saving plans: ${error.message}`, "error");
  }
}

refreshSubscriptionsBtn?.addEventListener("click", fetchSubscriptions);
subscriptionPlansForm?.addEventListener("submit", saveSubscriptionPlans);
window.fetchSubscriptions = fetchSubscriptions;
