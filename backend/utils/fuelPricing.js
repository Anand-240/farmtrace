const FUEL_TYPE_BY_VEHICLE = {
  'pickup van': 'petrol',
  'mini truck': 'diesel',
  'medium truck': 'diesel',
  'heavy truck': 'diesel',
  'reefer truck': 'diesel',
  'tractor trolley': 'diesel',
};

// km per liter (loaded, highway)
const MILEAGE_BY_VEHICLE = {
  'pickup van': 14,
  'mini truck': 10,
  'medium truck': 7,
  'heavy truck': 5,
  'reefer truck': 4,
  'tractor trolley': 6,
};

// Toll rate ₹ per km by vehicle
const TOLL_PER_KM = {
  'pickup van': 1.5,
  'mini truck': 3,
  'medium truck': 4,
  'heavy truck': 5.5,
  'reefer truck': 5.5,
  'tractor trolley': 2,
};

function getCurrentFuelPrices() {
  return {
    petrol: parseFloat(process.env.PETROL_PRICE_PER_LITER) || 104.95,
    diesel: parseFloat(process.env.DIESEL_PRICE_PER_LITER) || 91.82,
    asOf: new Date().toISOString().slice(0, 10),
    note: 'Average prices for Pune/Mumbai region (May 2026). Override via PETROL_PRICE_PER_LITER / DIESEL_PRICE_PER_LITER env vars.'
  };
}

function calculateTransportCost(distanceKm, vehicleType = 'mini truck') {
  const key = vehicleType.toLowerCase();
  const fuelType = FUEL_TYPE_BY_VEHICLE[key] || 'diesel';
  const mileageKmpl = MILEAGE_BY_VEHICLE[key] || 8;
  const tollPerKm = TOLL_PER_KM[key] || 3;

  const prices = getCurrentFuelPrices();
  const pricePerLiter = prices[fuelType];

  const litersNeeded = distanceKm / mileageKmpl;
  const fuelCost = Math.round(litersNeeded * pricePerLiter);
  const tollCost = Math.round(distanceKm * tollPerKm);
  const driverAllowance = Math.round(distanceKm * 2.5); // ~₹2.5/km driver allowance
  const totalTransportCost = fuelCost + tollCost + driverAllowance;

  return {
    vehicleType,
    fuelType,
    pricePerLiter,
    mileageKmpl,
    litersNeeded: Math.round(litersNeeded * 10) / 10,
    fuelCost,
    tollCost,
    driverAllowance,
    totalTransportCost,
    breakdown: [
      { label: `${fuelType === 'diesel' ? 'Diesel' : 'Petrol'} (₹${pricePerLiter}/L × ${Math.round(litersNeeded * 10) / 10}L)`, amount: fuelCost },
      { label: `Toll (₹${tollPerKm}/km × ${distanceKm}km)`, amount: tollCost },
      { label: `Driver allowance`, amount: driverAllowance }
    ]
  };
}

module.exports = { calculateTransportCost, getCurrentFuelPrices };
