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
  patna: { lat: 25.5941, lng: 85.1376 },
  nagpur: { lat: 21.1458, lng: 79.0882 },
  aurangabad: { lat: 19.8762, lng: 75.3433 },
  solapur: { lat: 17.6599, lng: 75.9064 },
  kolhapur: { lat: 16.7050, lng: 74.2433 },
  satara: { lat: 17.6805, lng: 74.0183 },
  amravati: { lat: 20.9374, lng: 77.7796 },
  nanded: { lat: 19.1383, lng: 77.3210 },
  latur: { lat: 18.4088, lng: 76.5604 },
  akola: { lat: 20.7096, lng: 77.0079 },
  chandrapur: { lat: 19.9615, lng: 79.2961 },
  yavatmal: { lat: 20.3888, lng: 78.1204 },
  jalna: { lat: 19.8408, lng: 75.8816 },
  sangli: { lat: 16.8524, lng: 74.5815 },
  raigad: { lat: 18.5158, lng: 73.1878 },
  thane: { lat: 19.2183, lng: 72.9781 },
  panvel: { lat: 18.9894, lng: 73.1175 },
  shirdi: { lat: 19.7673, lng: 74.4777 },
  malegaon: { lat: 20.5579, lng: 74.5089 },
  parbhani: { lat: 19.2704, lng: 76.7747 },
  osmanabad: { lat: 18.1860, lng: 76.0435 },
  wardha: { lat: 20.7453, lng: 78.5989 },
  gondia: { lat: 21.4615, lng: 80.1987 },
  bhandara: { lat: 21.1668, lng: 79.6524 },
  gadchiroli: { lat: 20.1809, lng: 80.0020 },
  washim: { lat: 20.1109, lng: 77.1456 },
  hingoli: { lat: 19.7176, lng: 77.1498 },
  buldhana: { lat: 20.5294, lng: 76.1841 },
  ratnagiri: { lat: 16.9944, lng: 73.3001 },
  sindhudurg: { lat: 16.3491, lng: 73.7037 },
  palghar: { lat: 19.6967, lng: 72.7697 },
  dhule: { lat: 20.9042, lng: 74.7748 },
  nandurbar: { lat: 21.3683, lng: 74.2432 },
  jalgaon: { lat: 21.0077, lng: 75.5626 },
};

function resolveCity(name = '') {
  const key = name.trim().toLowerCase().replace(/[^a-z ]/g, '').split(' ')[0];
  return CITY_COORDS[key] ? { coords: CITY_COORDS[key], name: key } : null;
}

function toRadians(v) { return (v * Math.PI) / 180; }

function haversineKm(from, to) {
  const R = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function haversineFallback(from, to) {
  const straight = haversineKm(from.coords, to.coords);
  const dist = Math.round(straight * 1.22);
  const duration = Math.round((dist / 45) * 60);
  // Simple straight-line geometry for map (5 intermediate points)
  const points = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    points.push([
      from.coords.lat + (to.coords.lat - from.coords.lat) * t,
      from.coords.lng + (to.coords.lng - from.coords.lng) * t
    ]);
  }
  return { distanceKm: dist, durationMin: duration, geometry: points, source: 'haversine' };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function getRouteOSRM(from, to) {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.coords.lng},${from.coords.lat};${to.coords.lng},${to.coords.lat}?overview=full&geometries=geojson`;
  const data = await fetchWithTimeout(url);
  const route = data.routes[0];
  if (!route) throw new Error('No route from OSRM');
  return {
    distanceKm: Math.round(route.distance / 100) / 10,
    durationMin: Math.round(route.duration / 60),
    geometry: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    source: 'OSRM'
  };
}

async function getRouteORS(from, to) {
  const key = process.env.OPENROUTE_API_KEY;
  if (!key) throw new Error('No ORS key');
  const data = await fetchWithTimeout(
    'https://api.openrouteservice.org/v2/directions/driving-hgv/geojson',
    {
      method: 'POST',
      headers: { Authorization: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates: [[from.coords.lng, from.coords.lat], [to.coords.lng, to.coords.lat]] })
    }
  );
  const feat = data.features[0];
  const sum = feat.properties.summary;
  return {
    distanceKm: Math.round(sum.distance / 100) / 10,
    durationMin: Math.round(sum.duration / 60),
    geometry: feat.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    source: 'ORS'
  };
}

async function geocodeWithNominatim(name) {
  const q = encodeURIComponent(`${name} India`);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=in&addressdetails=1`;
  try {
    const data = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'FarmTrace/1.0', 'Accept-Language': 'en' }
    }, 8000);
    if (!data || !data[0]) return null;
    const d = data[0];
    const displayName = d.address?.city || d.address?.town || d.address?.village || d.address?.county || name;
    return { coords: { lat: parseFloat(d.lat), lng: parseFloat(d.lon) }, name: displayName.toLowerCase() };
  } catch {
    return null;
  }
}

async function resolveLocation(nameOrCoords) {
  if (nameOrCoords && typeof nameOrCoords === 'object' && nameOrCoords.lat != null) {
    return { coords: nameOrCoords, name: nameOrCoords.label || 'location' };
  }
  const local = resolveCity(String(nameOrCoords));
  if (local) return local;
  return geocodeWithNominatim(String(nameOrCoords));
}

async function getRoute(fromCity, toCity) {
  const [from, to] = await Promise.all([resolveLocation(fromCity), resolveLocation(toCity)]);

  if (!from) return { error: `City not found: ${fromCity}` };
  if (!to) return { error: `City not found: ${toCity}` };

  if (process.env.OPENROUTE_API_KEY) {
    try {
      const route = await getRouteORS(from, to);
      return { from, to, ...route };
    } catch (e) { /* fall through */ }
  }

  try {
    const route = await getRouteOSRM(from, to);
    return { from, to, ...route };
  } catch (e) {
    const route = haversineFallback(from, to);
    return { from, to, ...route };
  }
}

async function getRouteByCoords(fromLabel, fromCoords, toLabel, toCoords) {
  const from = { name: fromLabel.toLowerCase(), coords: fromCoords };
  const to   = { name: toLabel.toLowerCase(),   coords: toCoords   };
  try {
    const route = await getRouteOSRM(from, to);
    return { from, to, ...route };
  } catch {
    const route = haversineFallback(from, to);
    return { from, to, ...route };
  }
}

module.exports = { getRoute, getRouteByCoords, resolveCity, CITY_COORDS };
