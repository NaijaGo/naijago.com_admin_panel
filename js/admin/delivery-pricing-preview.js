(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DeliveryPricingPreview = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const roundSetting = (value) => Number(Number(value || 0).toFixed(2));

  function calculateDeliveryPricingPreview(pricing = {}, distances = [1, 5, 10, 20, 30]) {
    const maximumDistance = pricing.maximumDistanceKm == null || pricing.maximumDistanceKm === ''
      ? null
      : roundSetting(pricing.maximumDistanceKm);
    const baseFee = roundSetting(pricing.baseFee);
    const pricePerKm = roundSetting(pricing.pricePerKm);
    const minimumFee = roundSetting(pricing.minimumFee);
    const maximumFee = pricing.maximumFee == null || pricing.maximumFee === ''
      ? null
      : roundSetting(pricing.maximumFee);
    const validPricing =
      [baseFee, pricePerKm, minimumFee].every((value) => Number.isFinite(value) && value >= 0) &&
      (maximumFee === null || (Number.isFinite(maximumFee) && maximumFee > 0 && maximumFee >= minimumFee)) &&
      (maximumDistance === null || (Number.isFinite(maximumDistance) && maximumDistance > 0));

    return distances.map((distanceKm) => {
      if (!validPricing) {
        return {
          distanceKm,
          available: false,
          invalidPricing: true,
          maximumDistanceKm: maximumDistance,
          baseFee,
          pricePerKm,
          distanceCharge: null,
          rawFee: null,
          minimumFee,
          maximumFee,
          adjustment: null,
          finalFee: null,
        };
      }
      if (maximumDistance != null && distanceKm > maximumDistance) {
        return {
          distanceKm,
          available: false,
          maximumDistanceKm: maximumDistance,
          baseFee,
          pricePerKm,
          distanceCharge: null,
          rawFee: null,
          minimumFee,
          maximumFee,
          adjustment: null,
          finalFee: null,
        };
      }

      const distanceCharge = Number((distanceKm * pricePerKm).toFixed(2));
      const rawFee = Number((baseFee + distanceCharge).toFixed(2));
      const minimumAppliedFee = Math.max(rawFee, minimumFee);
      if (!Number.isFinite(distanceCharge) || !Number.isFinite(rawFee) ||
          !Number.isFinite(minimumAppliedFee)) {
        return {
          distanceKm,
          available: false,
          invalidPricing: true,
          maximumDistanceKm: maximumDistance,
          baseFee,
          pricePerKm,
          distanceCharge,
          rawFee,
          minimumFee,
          maximumFee,
          adjustment: null,
          finalFee: null,
        };
      }

      const finalFee = Number((maximumFee == null
        ? minimumAppliedFee
        : Math.min(minimumAppliedFee, maximumFee)).toFixed(2));
      const adjustment = rawFee < minimumFee
        ? { type: 'minimum', appliedFee: minimumFee }
        : maximumFee != null && minimumAppliedFee > maximumFee
          ? { type: 'maximum', appliedFee: maximumFee }
          : null;
      return {
        distanceKm,
        available: true,
        baseFee,
        pricePerKm,
        distanceCharge,
        rawFee,
        minimumFee,
        maximumFee,
        adjustment,
        finalFee,
      };
    });
  }
  return { calculateDeliveryPricingPreview };
});
