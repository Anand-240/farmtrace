const AVERAGE_SPEED_KMPH = 42;

const CITY_COORDS = {
  delhi: { lat: 28.6139, lng: 77.2090 },
  gurgaon: { lat: 28.4595, lng: 77.0266 },
  noida: { lat: 28.5355, lng: 77.3910 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
  lucknow: { lat: 26.8467, lng: 80.9462 },
  kanpur: { lat: 26.4499, lng: 80.3319 },
  bhopal: { lat: 23.2599, lng: 77.4126 },
  indore: { lat: 22.7196, lng: 75.8577 },
  pune: { lat: 18.5204, lng: 73.8567 },
  mumbai: { lat: 19.0760, lng: 72.8777 },
  nashik: { lat: 19.9975, lng: 73.7898 },
  surat: { lat: 21.1702, lng: 72.8311 },
  ahmedabad: { lat: 23.0225, lng: 72.5714 },
  hyderabad: { lat: 17.3850, lng: 78.4867 },
  vijayawada: { lat: 16.5062, lng: 80.6480 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  mysuru: { lat: 12.2958, lng: 76.6394 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  coimbatore: { lat: 11.0168, lng: 76.9558 },
  kochi: { lat: 9.9312, lng: 76.2673 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  patna: { lat: 25.5941, lng: 85.1376 }
};

const TRANSPORTERS = [
  {
    transporterId: 'TRN-AGRI-101',
    name: 'GreenRoute Movers',
    phone: '+91-90111-22001',
    vehicleType: 'Mini Truck',
    vehicleCapacityKg: 2500,
    rating: 4.6,
    baseCity: 'delhi',
    pricePerKm: 24
  },
  {
    transporterId: 'TRN-AGRI-102',
    name: 'Kisan Freight Network',
    phone: '+91-90111-22002',
    vehicleType: 'Medium Truck',
    vehicleCapacityKg: 7000,
    rating: 4.4,
    baseCity: 'jaipur',
    pricePerKm: 31
  },
  {
    transporterId: 'TRN-AGRI-103',
    name: 'Rapid Mandi Logistics',
    phone: '+91-90111-22003',
    vehicleType: 'Pickup Van',
    vehicleCapacityKg: 1400,
    rating: 4.2,
    baseCity: 'lucknow',
    pricePerKm: 19
  },
  {
    transporterId: 'TRN-AGRI-104',
    name: 'South Agro Haul',
    phone: '+91-90111-22004',
    vehicleType: 'Mini Truck',
    vehicleCapacityKg: 2600,
    rating: 4.7,
    baseCity: 'bengaluru',
    pricePerKm: 23
  },
  {
    transporterId: 'TRN-AGRI-105',
    name: 'West Corridor Carriers',
    phone: '+91-90111-22005',
    vehicleType: 'Heavy Truck',
    vehicleCapacityKg: 12000,
    rating: 4.5,
    baseCity: 'mumbai',
    pricePerKm: 36
  },
  {
    transporterId: 'TRN-AGRI-106',
    name: 'Delta Cold Chain',
    phone: '+91-90111-22006',
    vehicleType: 'Reefer Truck',
    vehicleCapacityKg: 6000,
    rating: 4.8,
    baseCity: 'hyderabad',
    pricePerKm: 42
  }
];

function normalizeCity(input = '') {
  return input
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .split(' ')[0];
}

function resolveCityCoords(location = '') {
  const normalized = normalizeCity(location);
  return CITY_COORDS[normalized] || null;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(from, to) {
  const R = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function estimateRoute(origin, destination) {
  const originCoords = resolveCityCoords(origin);
  const destinationCoords = resolveCityCoords(destination);

  if (!originCoords || !destinationCoords) {
    return {
      distanceKm: 0,
      etaMinutes: 0,
      isEstimated: false,
      message: 'Origin/destination city mapping unavailable'
    };
  }

  const distanceKm = haversineDistanceKm(originCoords, destinationCoords);
  const roadFactor = 1.22;
  const correctedDistance = Math.max(5, Math.round(distanceKm * roadFactor));
  const etaMinutes = Math.max(35, Math.round((correctedDistance / AVERAGE_SPEED_KMPH) * 60));

  return {
    distanceKm: correctedDistance,
    etaMinutes,
    isEstimated: true,
    message: 'ETA simulated using city-level geospatial estimate'
  };
}

function vehicleSurcharge(vehicleType = '') {
  const key = vehicleType.toLowerCase();
  if (key.includes('reefer')) return 1.32;
  if (key.includes('heavy')) return 1.24;
  if (key.includes('medium')) return 1.14;
  if (key.includes('mini')) return 1.05;
  if (key.includes('pickup')) return 0.95;
  return 1;
}

function estimateFreight({ distanceKm, quantityKg, vehicleType }) {
  const quantityMultiplier = quantityKg > 5000 ? 1.28 : quantityKg > 2000 ? 1.12 : 1;
  const perKm = 18 * quantityMultiplier * vehicleSurcharge(vehicleType);
  const amount = Math.round(Math.max(600, distanceKm * perKm));
  return {
    currency: 'INR',
    amount,
    amountPerKm: Math.round(perKm)
  };
}

function matchTransporters({ origin, distanceKm, quantityKg, preferredVehicleType = '' }) {
  const originCoords = resolveCityCoords(origin);
  const desiredVehicle = preferredVehicleType.toLowerCase();

  const candidates = TRANSPORTERS
    .filter((item) => item.vehicleCapacityKg >= Math.max(300, quantityKg * 0.9))
    .filter((item) => !desiredVehicle || item.vehicleType.toLowerCase().includes(desiredVehicle))
    .map((item) => {
      const baseCoords = resolveCityCoords(item.baseCity);
      const pickupDistanceKm = originCoords && baseCoords
        ? Math.round(haversineDistanceKm(originCoords, baseCoords))
        : 25;
      const pickupEtaMinutes = Math.max(25, Math.round((pickupDistanceKm / 34) * 60));
      const tripAmount = Math.round(Math.max(750, distanceKm * item.pricePerKm));
      return {
        ...item,
        pickupDistanceKm,
        pickupEtaMinutes,
        estimatedTripAmount: tripAmount,
        score: (item.rating * 100) - (pickupEtaMinutes * 0.42) - (item.pricePerKm * 0.55)
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return candidates;
}

function generateDeliverySlots(startDate = new Date()) {
  const slotLabels = [
    '08:00-10:00',
    '10:00-12:00',
    '12:00-14:00',
    '14:00-16:00',
    '16:00-18:00',
    '18:00-20:00'
  ];

  const slots = [];
  for (let d = 1; d <= 4; d += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + d);
    const dateISO = date.toISOString().slice(0, 10);

    slotLabels.forEach((label) => {
      slots.push({
        slotDate: dateISO,
        slotLabel: label,
        slotKey: `${dateISO}|${label}`
      });
    });
  }

  return slots;
}

function buildLogisticsPlan({ origin, destination, quantityKg, preferredVehicleType }) {
  const route = estimateRoute(origin, destination);
  const fallbackVehicle = preferredVehicleType || 'Mini Truck';
  const freight = estimateFreight({
    distanceKm: route.distanceKm,
    quantityKg,
    vehicleType: fallbackVehicle
  });

  const matchedTransporters = matchTransporters({
    origin,
    distanceKm: route.distanceKm,
    quantityKg,
    preferredVehicleType
  });

  return {
    route,
    freight,
    matchedTransporters,
    availableSlots: generateDeliverySlots()
  };
}

function parseSlotDateTime(slotDate, slotLabel) {
  if (!slotDate || !slotLabel) return null;
  const [start] = slotLabel.split('-');
  if (!start) return null;

  const date = new Date(`${slotDate}T${start}:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

module.exports = {
  TRANSPORTERS,
  buildLogisticsPlan,
  parseSlotDateTime
};
