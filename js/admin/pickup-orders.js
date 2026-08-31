const pickupMetrics = document.getElementById('pickupMetrics');
const pickupOrders = document.getElementById('pickupOrders');
const pickupStatus = document.getElementById('pickupStatus');
const pickupMoney = (value) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(Number(value || 0));
const pickupSafe = (value) => String(value ?? '').replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]);

async function loadPickupOperations() {
  if (!adminToken) return;
  pickupOrders.innerHTML = '<p class=\'text-light-gray\'>Loading pickup orders...</p>';
  try {
    const query = pickupStatus.value ? `?status=${encodeURIComponent(pickupStatus.value)}` : '';
    const options = { headers: { Authorization: `Bearer ${adminToken}` } };
    const [analyticsResponse, ordersResponse] = await Promise.all([
      fetch(`${BASE_URL}/api/pickup/admin/analytics`, options),
      fetch(`${BASE_URL}/api/pickup/admin/orders${query}`, options),
    ]);
    const analytics = await analyticsResponse.json();
    const orders = await ordersResponse.json();
    if (!analyticsResponse.ok || !ordersResponse.ok) throw new Error(analytics.message || orders.message || 'Unable to load pickup operations.');
    const summary = analytics.summary || {};
    const metrics = [['Total', summary.totalOrders], ['Revenue', pickupMoney(summary.pickupRevenue)], ['Completed', summary.completed], ['Pending', summary.pending], ['Cancelled', summary.cancelled], ['Avg. prep', `${Number(summary.averagePreparationMinutes || 0).toFixed(0)} min`]];
    pickupMetrics.innerHTML = metrics.map(([label, value]) => `<article class='card p-4'><p class='text-light-gray text-sm'>${label}</p><p class='text-2xl text-light-slate font-bold mt-2'>${value}</p></article>`).join('');
    pickupOrders.innerHTML = orders.length ? orders.map((order) => {
      const vendor = order.vendor || {}; const main = order.mainOrder || {};
      return `<article class='border border-slate-700 rounded-xl p-4'><div class='flex justify-between gap-4'><div><h3 class='text-light-slate font-bold'>${pickupSafe(vendor.businessName || order.sellerName || 'NaijaGo')}</h3><p class='text-light-gray'>#${pickupSafe(String(order._id).slice(-8).toUpperCase())} - ${(order.items || []).length} product lines - ${pickupMoney(order.subtotal)}</p></div><span class='analytics-pill medium'>${pickupSafe(String(order.shipmentStatus).replaceAll('_', ' '))}</span></div><p class='text-light-gray mt-3'>Paid: ${main.isPaid ? 'Yes' : 'No'} - ${new Date(order.createdAt).toLocaleString()}</p></article>`;
    }).join('') : '<p class=\'text-light-gray\'>No pickup orders match this filter.</p>';
  } catch (error) { pickupOrders.innerHTML = `<p class='text-red-400'>${pickupSafe(error.message)}</p>`; }
}
document.getElementById('refreshPickupBtn')?.addEventListener('click', loadPickupOperations);
pickupStatus?.addEventListener('change', loadPickupOperations);
if (currentPage === 'pickup-orders') loadPickupOperations();
