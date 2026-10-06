const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateDeliveryPricingPreview } = require('../js/admin/delivery-pricing-preview');

test('preview reports the complete fee breakdown from unsaved form values', () => {
  const rows = calculateDeliveryPricingPreview({
    mode: 'road_km', baseFee: 500, pricePerKm: 150, minimumFee: 1000, maximumFee: 5000,
  }, [10]);
  assert.deepEqual(rows[0], {
    distanceKm: 10,
    available: true,
    baseFee: 500,
    pricePerKm: 150,
    distanceCharge: 1500,
    rawFee: 2000,
    minimumFee: 1000,
    maximumFee: 5000,
    adjustment: null,
    finalFee: 2000,
  });
});

test('preview identifies a minimum-fee adjustment', () => {
  const [row] = calculateDeliveryPricingPreview({
    baseFee: 500, pricePerKm: 150, minimumFee: 1000,
  }, [2]);
  assert.equal(row.distanceCharge, 300);
  assert.equal(row.rawFee, 800);
  assert.deepEqual(row.adjustment, { type: 'minimum', appliedFee: 1000 });
  assert.equal(row.finalFee, 1000);
});

test('preview identifies a maximum-fee adjustment', () => {
  const [row] = calculateDeliveryPricingPreview({
    baseFee: 500, pricePerKm: 150, minimumFee: 0, maximumFee: 5000,
  }, [40]);
  assert.equal(row.distanceCharge, 6000);
  assert.equal(row.rawFee, 6500);
  assert.deepEqual(row.adjustment, { type: 'maximum', appliedFee: 5000 });
  assert.equal(row.finalFee, 5000);
});

test('preview rounds pricing settings to the same two decimals as backend settings', () => {
  const [row] = calculateDeliveryPricingPreview({
    baseFee: 500.239, pricePerKm: 150.239, minimumFee: 0,
  }, [1]);
  assert.equal(row.baseFee, 500.24);
  assert.equal(row.pricePerKm, 150.24);
  assert.equal(row.distanceCharge, 150.24);
  assert.equal(row.rawFee, 650.48);
  assert.equal(row.finalFee, 650.48);
});

test('preview marks distances above the current maximum as outside the delivery area with no fee', () => {
  const rows = calculateDeliveryPricingPreview({
    mode: 'road_km', baseFee: 500, pricePerKm: 150, minimumFee: 0,
    maximumDistanceKm: 30,
  }, [40]);
  assert.equal(rows[0].available, false);
  assert.equal(rows[0].maximumDistanceKm, 30);
  assert.equal(rows[0].finalFee, null);
});
