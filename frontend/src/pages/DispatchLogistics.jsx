import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import StateCitySelector from '../components/StateCitySelector';
import RouteMap from '../components/RouteMap';
import {
  Truck, Package, MapPin, Clock, ChevronDown, Inbox,
  Phone, User, Navigation, DollarSign, Search,
  CheckCircle2, AlertCircle, ArrowRight, Fuel, Route,
} from 'lucide-react';

// ── Nominatim geocoding (free, no key needed, India-biased) ──
async function geocodeIndia(name) {
  if (!name || !name.trim()) return null;
  try {
    const url =
      `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(name.trim() + ' India')}&` +
      `format=json&limit=1&countrycodes=in&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'FarmTrace/1.0', 'Accept-Language': 'en' },
    });
    const data = await res.json();
    if (!data || !data[0]) return null;
    const d = data[0];
    const label =
      d.address?.city || d.address?.town || d.address?.village ||
      d.address?.county || name;
    return { lat: parseFloat(d.lat), lng: parseFloat(d.lon), label };
  } catch {
    return null;
  }
}

const VEHICLE_OPTIONS = [
  { key: 'pickup van',      label: 'Pickup Van (छोटा)',      icon: '🛻', capacity: '≤1.5 ton' },
  { key: 'mini truck',      label: 'Mini Truck (2.5 ton)',   icon: '🚛', capacity: '≤2.5 ton' },
  { key: 'medium truck',    label: 'Medium Truck (7 ton)',   icon: '🚚', capacity: '≤7 ton'   },
  { key: 'heavy truck',     label: 'Heavy Truck (12 ton)',   icon: '🚜', capacity: '≤12 ton'  },
  { key: 'reefer truck',    label: 'Reefer Truck (ठंडा)',   icon: '❄️', capacity: 'Cold chain'},
  { key: 'tractor trolley', label: 'Tractor Trolley (खेती)', icon: '🚜', capacity: '≤5 ton'  },
];

// ── Location input with Nominatim autocomplete (intra-city precise) ──
function LocationInput({ value, onChange, onCoords, placeholder, icon }) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [fetching, setFetching] = useState(false);
  const wrapRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    clearTimeout(timerRef.current);
    const q = value.trim();
    if (q.length < 3) { setSuggestions([]); return; }
    timerRef.current = setTimeout(async () => {
      setFetching(true);
      try {
        const url =
          `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(q + ' India')}&format=json&limit=6&countrycodes=in&addressdetails=1`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'FarmTrace/1.0', 'Accept-Language': 'en' },
        });
        const data = await res.json();
        const items = data.map(d => {
          const a = d.address || {};
          const parts = [
            a.suburb || a.neighbourhood || a.road,
            a.city || a.town || a.village || a.county,
            a.state,
          ].filter(Boolean);
          const label = parts.length >= 2
            ? parts.slice(0, 3).join(', ')
            : d.display_name.split(',').slice(0, 3).join(',').trim();
          return { label, lat: parseFloat(d.lat), lng: parseFloat(d.lon) };
        });
        setSuggestions(items);
        setOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setFetching(false);
      }
    }, 350);
    return () => clearTimeout(timerRef.current);
  }, [value]);

  useEffect(() => {
    const handler = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div className="city-input-wrap">
        <span className="city-input-icon">{fetching ? '⌛' : icon}</span>
        <input
          className="city-input"
          value={value}
          onChange={e => { onChange(e.target.value); if (onCoords) onCoords(null); }}
          onFocus={() => { if (suggestions.length) setOpen(true); }}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      {open && suggestions.length > 0 && (
        <ul className="city-dropdown">
          {suggestions.map((s, i) => (
            <li key={i} className="city-option" onMouseDown={() => {
              onChange(s.label);
              if (onCoords) onCoords({ lat: s.lat, lng: s.lng });
              setOpen(false);
            }}>
              <MapPin size={12} style={{ flexShrink: 0 }} /> {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function DispatchLogistics() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // ── Tabs: 'planner' | 'incoming' | 'outgoing' ──
  const [activeTab, setActiveTab] = useState('planner');

  // ── Route Planner state ──
  const [planner, setPlanner] = useState({
    from: '', to: '', vehicleType: 'mini truck',
    fromCoords: null, toCoords: null,
    result: null, loading: false, error: null,
  });
  const [plannerQty, setPlannerQty] = useState('');

  // ── Deliveries state ──
  const [deliveries, setDeliveries] = useState([]);
  const [forms, setForms] = useState({});
  const [logisticsForms, setLogisticsForms] = useState({});
  const [plans, setPlans] = useState({});
  const [routeInfo, setRouteInfo] = useState({});
  const [routeLoading, setRouteLoading] = useState({});
  const [planningId, setPlanningId] = useState(null);
  const [bookingId, setBookingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [expandedCards, setExpandedCards] = useState({});
  const [gpsLoading, setGpsLoading] = useState({});

  useEffect(() => { fetchDeliveries(); }, []);

  const fetchDeliveries = async () => {
    try {
      const res = await api.get('/payment/deliveries/my');
      setDeliveries(res.data);
      const next = {}; const logisticsNext = {};
      res.data.forEach(d => {
        next[d._id] = {
          deliveryStatus: d.deliveryStatus || 'PENDING_DISPATCH',
          driverName: d.driverName || '', driverPhone: d.driverPhone || '',
          vehicleNumber: d.vehicleNumber || '', vehicleType: d.vehicleType || '',
          currentLocation: d.currentLocation || d.location || '',
          destinationLocation: d.destinationLocation || '',
          expectedDeliveryTime: d.expectedDeliveryTime
            ? new Date(d.expectedDeliveryTime).toISOString().slice(0, 16) : '',
          deliveryRemarks: d.deliveryRemarks || '',
        };
        logisticsNext[d._id] = {
          destinationLocation: d.destinationLocation || '',
          preferredVehicleType: d.vehicleType || 'mini truck',
          selectedTransporterId: d.matchedTransporter?.transporterId || '',
          slotDate: d.deliverySlotDate ? new Date(d.deliverySlotDate).toISOString().slice(0, 10) : '',
          slotLabel: d.deliverySlotLabel || '',
          calcFromCity: d.produce?.origin || '',
          calcToCity: d.destinationLocation || '',
        };
      });
      setForms(next); setLogisticsForms(logisticsNext);
      setExpandedCards(prev => {
        const upd = { ...prev };
        res.data.forEach((d, i) => { if (upd[d._id] === undefined) upd[d._id] = i === 0; });
        return upd;
      });
    } catch { /* silent */ } finally { setLoading(false); }
  };

  // ── Route Planner: geocode + calculate ──
  const calculateRoute = async () => {
    const { from, to, vehicleType, fromCoords, toCoords } = planner;
    if (!from.trim() || !to.trim()) {
      setPlanner(p => ({ ...p, error: 'Se aur Tak dono location daalna zaroori hai' }));
      return;
    }
    if (from.trim().toLowerCase() === to.trim().toLowerCase()) {
      setPlanner(p => ({ ...p, error: 'Dono same location hai. Alag areas enter karein.' }));
      return;
    }
    setPlanner(p => ({ ...p, loading: true, error: null, result: null }));
    try {
      const [fromGeo, toGeo] = await Promise.all([
        fromCoords ? Promise.resolve(fromCoords) : geocodeIndia(from),
        toCoords   ? Promise.resolve(toCoords)   : geocodeIndia(to),
      ]);
      const params = new URLSearchParams({
        from: from.trim(), to: to.trim(), vehicleType,
        ...(fromGeo ? { fromLat: fromGeo.lat, fromLng: fromGeo.lng } : {}),
        ...(toGeo   ? { toLat:   toGeo.lat,   toLng:   toGeo.lng   } : {}),
      });
      const res = await api.get(`/market/route-cost?${params}`);
      setPlanner(p => ({ ...p, result: res.data, loading: false }));
    } catch (err) {
      setPlanner(p => ({
        ...p, loading: false,
        error: err.response?.data?.message || 'Route calculate nahi ho paya. Location ka naam check karein.',
      }));
    }
  };

  // ── Delivery handlers ──
  const setField = (id, key, val) =>
    setForms(p => ({ ...p, [id]: { ...(p[id] || {}), [key]: val } }));
  const setLF = (id, key, val) =>
    setLogisticsForms(p => ({ ...p, [id]: { ...(p[id] || {}), [key]: val } }));

  const calculateDeliveryRoute = async (id, originCity, destCity, vehicleType, fromCoordsArg, toCoordsArg) => {
    const from = (originCity || '').trim();
    const to   = (destCity   || '').trim();
    if (!from || !to) return;
    setRouteLoading(p => ({ ...p, [id]: true }));
    setRouteInfo(p => { const n = { ...p }; delete n[id]; return n; });
    try {
      const [fromGeo, toGeo] = await Promise.all([
        fromCoordsArg ? Promise.resolve(fromCoordsArg) : geocodeIndia(from),
        toCoordsArg   ? Promise.resolve(toCoordsArg)   : geocodeIndia(to),
      ]);
      const vt = vehicleType || 'mini truck';
      const params = new URLSearchParams({
        from, to, vehicleType: vt,
        ...(fromGeo ? { fromLat: fromGeo.lat, fromLng: fromGeo.lng } : {}),
        ...(toGeo   ? { toLat:   toGeo.lat,   toLng:   toGeo.lng   } : {}),
      });
      const res = await api.get(`/market/route-cost?${params}`);
      setRouteInfo(p => ({ ...p, [id]: res.data }));
    } catch {
      // silently ignore - user can retry
    } finally {
      setRouteLoading(p => ({ ...p, [id]: false }));
    }
  };

  const save = async (id) => {
    try { setSavingId(id); await api.put(`/payment/deliveries/${id}`, forms[id]); await fetchDeliveries(); }
    catch (err) { alert(err.response?.data?.message || 'Dispatch update fail ho gaya'); }
    finally { setSavingId(null); }
  };

  const fetchCurrentLocation = (id) => {
    if (!navigator.geolocation) { alert('Geolocation browser me supported nahi hai.'); return; }
    setGpsLoading(p => ({ ...p, [id]: true }));
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          let loc = data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          if (data.address) {
            const { road, suburb, city, town, village, state } = data.address;
            const parts = [road, suburb, city || town || village, state].filter(Boolean);
            if (parts.length) loc = parts.join(', ');
          }
          setField(id, 'currentLocation', loc);
        } catch { alert('Location decode fail ho gayi.'); }
        finally { setGpsLoading(p => ({ ...p, [id]: false })); }
      },
      (err) => {
        const msgs = { 1: 'Permission denied. Site settings se location enable karein.', 2: 'Position unavailable.', 3: 'GPS timeout. Dobara try karein.' };
        alert(msgs[err.code] || 'GPS error.');
        setGpsLoading(p => ({ ...p, [id]: false }));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const previewPlan = async (id) => {
    const lf = logisticsForms[id] || {};
    if (!lf.destinationState || !lf.destinationCity) { alert('Destination state aur city dono fill karo'); return; }
    const destLoc = `${lf.destinationCity}, ${lf.destinationState}`;
    try {
      setPlanningId(id);
      const res = await api.post(`/payment/logistics/${id}/preview`, {
        destinationLocation: destLoc, preferredVehicleType: lf.preferredVehicleType,
      });
      setPlans(p => ({ ...p, [id]: res.data }));
      if (!lf.selectedTransporterId && res.data?.matchedTransporters?.[0]?.transporterId)
        setLF(id, 'selectedTransporterId', res.data.matchedTransporters[0].transporterId);
      if (!lf.slotDate && res.data?.availableSlots?.[0]?.slotDate)
        setLF(id, 'slotDate', res.data.availableSlots[0].slotDate);
      if (!lf.slotLabel && res.data?.availableSlots?.[0]?.slotLabel)
        setLF(id, 'slotLabel', res.data.availableSlots[0].slotLabel);
    } catch (err) { alert(err.response?.data?.message || 'Logistics plan preview fail ho gaya'); }
    finally { setPlanningId(null); }
  };

  const bookSlot = async (id) => {
    const lf = logisticsForms[id] || {};
    if (!lf.destinationState || !lf.destinationCity) { alert('Destination state aur city required hai'); return; }
    const destLoc = `${lf.destinationCity}, ${lf.destinationState}`;
    if (!lf.slotDate || !lf.slotLabel) { alert('Delivery slot select karo'); return; }
    const plan = plans[id];
    try {
      setBookingId(id);
      await api.post(`/payment/logistics/${id}/book-slot`, {
        destinationLocation: destLoc, preferredVehicleType: lf.preferredVehicleType,
        transporterId: lf.selectedTransporterId || plan?.matchedTransporters?.[0]?.transporterId || '',
        slotDate: lf.slotDate, slotLabel: lf.slotLabel,
      });
      await fetchDeliveries();
      alert('Delivery slot booked successfully');
    } catch (err) { alert(err.response?.data?.message || 'Slot booking fail ho gaya'); }
    finally { setBookingId(null); }
  };

  // ── Derived ──
  const incomingDeliveries = deliveries.filter(d => d.toPhone === user.phone);
  const outgoingDeliveries = deliveries.filter(d => d.fromPhone === user.phone);
  const activeDeliveries = activeTab === 'incoming' ? incomingDeliveries : outgoingDeliveries;

  const STATUS_BADGE = {
    PENDING_DISPATCH: { bg: '#e8f5e9', color: '#388e3c', text: 'Bhejti Baaki' },
    PICKUP_DISPATCHED: { bg: '#e3f2fd', color: '#1976d2', text: 'Pickup Nikal Gaya' },
    IN_TRANSIT: { bg: '#fff8e1', color: '#f57c00', text: 'Raste Mein' },
    DELIVERED: { bg: '#f1f8e9', color: '#27500A', text: 'Pahunch Gaya' },
  };

  const ri = planner.result;
  const selectedVehicle = VEHICLE_OPTIONS.find(v => v.key === planner.vehicleType) || VEHICLE_OPTIONS[1];
  const isDistributor = (user.role || '').toUpperCase() === 'DISTRIBUTOR';
  const isFarmer = !isDistributor;

  return (
    <div className="dl-page">
      {/* ── TOP NAV ── */}
      <nav className="dl-nav glass">
        <div className="dl-nav-inner">
          <div className="dl-nav-left">
            <button className="dl-back-btn" onClick={() => navigate('/dashboard')}>
              <ChevronDown size={18} style={{ transform: 'rotate(90deg)' }} />
            </button>
            <div className="dl-brand">
              <Truck size={20} color="#27500A" />
              <h1 className="dl-title">Dispatch & Logistics</h1>
            </div>
          </div>

          <div className="dl-tabs">
            {[
              { id: 'planner',  icon: <Route size={16} />,  label: 'Route Planner' },
              { id: 'incoming', icon: <Inbox size={16} />,  label: 'Incoming', count: incomingDeliveries.length },
              { id: 'outgoing', icon: <Truck size={16} />,  label: 'Outgoing',  count: outgoingDeliveries.length },
            ].map(tab => (
              <button
                key={tab.id}
                className={`dl-tab${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.count > 0 && <span className="dl-tab-badge">{tab.count}</span>}
              </button>
            ))}
          </div>

          <div className="dl-role-chip">{user.role || 'User'}</div>
        </div>
      </nav>

      <div className="dl-body">

        {/* ══════════════════════════════════════════
            TAB: ROUTE PLANNER
        ══════════════════════════════════════════ */}
        {activeTab === 'planner' && (
          <div className="planner-wrapper animate-up">

            {/* Hero header */}
            <div className="planner-hero">
              <div className="planner-hero-text">
                <h2 className="planner-heading">
                  {isDistributor ? 'Transport Lagat Calculate Karo' : 'Kahan Bhejna Hai Apna Fasal?'}
                </h2>
                <p className="planner-sub">
                  {isDistributor
                    ? 'Area ya city ka naam daalo — exact transport kharcha aur route milega jo aapko dena hoga'
                    : 'Area ya village ka naam daalo — same city ke alag mohalle ya door ke shahar ka rasta aur transport lagat turant milegi'}
                </p>
                {isDistributor && (
                  <div className="planner-role-tag dist">🚚 Vitrak ka Transport Kharcha</div>
                )}
                {isFarmer && (
                  <div className="planner-role-tag farmer">🌾 Kisan ka Lagat Calculator</div>
                )}
              </div>
              <div className="planner-hero-icon">{isDistributor ? '💸' : '🗺️'}</div>
            </div>

            {/* Input card */}
            <div className="planner-card">
              <div className="planner-inputs">
                <div className="planner-field">
                  <label className="pl-label">
                    <span className="pl-dot green"></span>
                    {isDistributor ? 'Kisan ki Location (Se)' : 'Mera Khet / Gaon (Se)'}
                  </label>
                  <LocationInput
                    value={planner.from}
                    onChange={v => setPlanner(p => ({ ...p, from: v, fromCoords: null }))}
                    onCoords={c => setPlanner(p => ({ ...p, fromCoords: c }))}
                    placeholder="e.g. Civil Lines, Nagpur / Bandra West, Mumbai..."
                    icon="📍"
                  />
                </div>

                <div className="planner-arrow-col">
                  <div className="planner-arrow-line" />
                  <div className="planner-swap-dot">
                    <ArrowRight size={14} color="#fff" />
                  </div>
                  <div className="planner-arrow-line" />
                </div>

                <div className="planner-field">
                  <label className="pl-label">
                    <span className="pl-dot orange"></span>
                    {isDistributor ? 'Meri Location / Godown (Tak)' : 'Vitrak ka Sthan (Tak)'}
                  </label>
                  <LocationInput
                    value={planner.to}
                    onChange={v => setPlanner(p => ({ ...p, to: v, toCoords: null }))}
                    onCoords={c => setPlanner(p => ({ ...p, toCoords: c }))}
                    placeholder="e.g. Andheri East, Mumbai / Sector 12, Faridabad..."
                    icon="🏁"
                  />
                </div>
              </div>

              {/* Vehicle selector */}
              <div className="vehicle-selector">
                <p className="pl-label" style={{ marginBottom: '0.75rem' }}>Gaadi ka Prakar (Vehicle Type)</p>
                <div className="vehicle-grid">
                  {VEHICLE_OPTIONS.map(v => (
                    <button
                      key={v.key}
                      className={`vehicle-chip${planner.vehicleType === v.key ? ' selected' : ''}`}
                      onClick={() => setPlanner(p => ({ ...p, vehicleType: v.key }))}
                    >
                      <span className="vc-icon">{v.icon}</span>
                      <span className="vc-label">{v.label}</span>
                      <span className="vc-cap">{v.capacity}</span>
                    </button>
                  ))}
                </div>
              </div>

              {planner.error && (
                <div className="planner-error">
                  <AlertCircle size={16} /> {planner.error}
                </div>
              )}

              <button
                className="calc-btn"
                onClick={calculateRoute}
                disabled={planner.loading}
              >
                {planner.loading ? (
                  <>
                    <span className="calc-spinner" />
                    Route Calculate Ho Raha Hai...
                  </>
                ) : (
                  <>
                    <Route size={18} />
                    Rasta Dikhaao &amp; Lagat Calculate Karo
                  </>
                )}
              </button>
            </div>

            {/* ── RESULT ── */}
            {ri && (
              <div className="result-wrapper animate-up">

                {/* Route label */}
                <div className="route-label-bar">
                  <span className="rl-from">{ri.from.name.charAt(0).toUpperCase() + ri.from.name.slice(1)}</span>
                  <div className="rl-line">
                    <div className="rl-dash"></div>
                    <span className="rl-km">{ri.route.distanceKm} km</span>
                    <div className="rl-dash"></div>
                  </div>
                  <span className="rl-to">{ri.to.name.charAt(0).toUpperCase() + ri.to.name.slice(1)}</span>
                </div>

                {/* Animated Map */}
                <div className="map-container">
                  <RouteMap routeData={ri} style={{ height: '380px', borderRadius: '24px' }} />
                  {ri.route.source === 'haversine' && (
                    <div className="map-approx-badge">~ Anumaan (Approximate Route)</div>
                  )}
                </div>

                {/* Summary chips */}
                <div className="summary-chips">
                  {[
                    { icon: '📍', label: 'Doori',       val: `${ri.route.distanceKm} km`          },
                    { icon: '⏱️', label: 'Safar Samay', val: ri.route.durationHours                },
                    { icon: selectedVehicle.icon, label: 'Gaadi', val: selectedVehicle.label      },
                    { icon: '💰', label: 'Kul Lagat',   val: `₹${ri.transport.totalTransportCost.toLocaleString('en-IN')}`, highlight: true },
                  ].map((s, i) => (
                    <div key={i} className={`summary-chip${s.highlight ? ' hl' : ''}`}>
                      <span className="sc-icon">{s.icon}</span>
                      <div>
                        <p className="sc-label">{s.label}</p>
                        <p className="sc-val">{s.val}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Fuel prices info */}
                <div className="fuel-info-bar">
                  <Fuel size={14} />
                  <span>Aaj ka Petrol: <b>₹{ri.fuelPrices.petrol}/L</b></span>
                  <span className="fi-sep">·</span>
                  <span>Aaj ka Diesel: <b>₹{ri.fuelPrices.diesel}/L</b></span>
                  <span className="fi-sep">·</span>
                  <span className="fi-date">as of {ri.fuelPrices.asOf}</span>
                </div>

                {/* Cost breakdown */}
                <div className="breakdown-card">
                  <div className="bk-header">
                    <DollarSign size={16} />
                    <span>Lagat ka Poora Vivar (Cost Breakdown)</span>
                  </div>
                  {ri.transport.breakdown.map((row, i) => (
                    <div key={i} className="bk-row">
                      <span className="bk-label">{row.label}</span>
                      <span className="bk-amt">₹{row.amount.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                  <div className="bk-total">
                    <span>Kul Transport Lagat</span>
                    <span>₹{ri.transport.totalTransportCost.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* ── DISTRIBUTOR: cost responsibility banner ── */}
                {isDistributor && (
                  <div className="dist-planner-banner animate-up">
                    <div className="dpb-icon">🚚</div>
                    <div className="dpb-body">
                      <div className="dpb-title">Yeh Kharcha Aapka (Distributor ka) Hai</div>
                      <div className="dpb-sub">
                        Kisan se crop khareedne ke baad, ise apne godown tak laane ka yeh poora transport kharcha aapko dena hoga.
                        Crop ki deal karte waqt is amount ko factor karein.
                      </div>
                    </div>
                    <div className="dpb-amount">
                      <div className="dpb-amt-label">Aapka Kharcha</div>
                      <div className="dpb-amt-val">₹{ri.transport.totalTransportCost.toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                )}

                {/* ── FARMER: per-kg cost calculator ── */}
                {isFarmer && (
                  <div className="per-kg-calc animate-up">
                    <div className="pkc-header">
                      <span className="pkc-bulb">💡</span>
                      <div>
                        <div className="pkc-title">Apni Fasal ki Sahi Kimat Nikalo</div>
                        <div className="pkc-hint">Transport cover karne ke liye apna maal darj karo</div>
                      </div>
                    </div>
                    <div className="pkc-input-row">
                      <label className="pkc-label">Apna Maal (kg mein)</label>
                      <div className="pkc-input-wrap">
                        <input
                          type="number"
                          className="pkc-input"
                          value={plannerQty}
                          onChange={e => setPlannerQty(e.target.value)}
                          placeholder="jaise ki 500"
                          min="1"
                        />
                        <span className="pkc-unit">kg</span>
                      </div>
                    </div>
                    {Number(plannerQty) > 0 && (
                      <div className="pkc-result animate-up">
                        <div className="pkc-result-row">
                          <span>Transport cost per kg</span>
                          <span className="pkc-per-kg">
                            ₹{(ri.transport.totalTransportCost / Number(plannerQty)).toFixed(2)}/kg
                          </span>
                        </div>
                        <div className="pkc-tip">
                          Apni fasal ki asking price mein kam se kam{' '}
                          <strong>₹{(ri.transport.totalTransportCost / Number(plannerQty)).toFixed(2)}/kg</strong>{' '}
                          extra rakhein — tab hi transport kharcha cover hoga.
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════
            TABS: INCOMING / OUTGOING
        ══════════════════════════════════════════ */}
        {(activeTab === 'incoming' || activeTab === 'outgoing') && (
          <div className="deliveries-wrapper">

            {/* Stats row */}
            <div className="stats-row animate-up">
              {[
                { icon: <Truck size={22} />, label: 'Total',        val: activeDeliveries.length,                                             dark: true },
                { icon: <Clock size={22} />, label: 'Raste Mein',   val: activeDeliveries.filter(d => d.deliveryStatus === 'IN_TRANSIT').length },
                { icon: <CheckCircle2 size={22} />, label: 'Pahunch Gaye', val: activeDeliveries.filter(d => d.deliveryStatus === 'DELIVERED').length },
              ].map((s, i) => (
                <div key={i} className={`stat-card${s.dark ? ' dark' : ''}`}>
                  <div className={`stat-icon${s.dark ? ' di' : ''}`}>{s.icon}</div>
                  <div>
                    <p className="stat-label">{s.label}</p>
                    <p className="stat-val">{s.val}</p>
                  </div>
                </div>
              ))}
            </div>

            {loading ? (
              <div className="dl-loading"><div className="dl-spinner" /></div>
            ) : activeDeliveries.length === 0 ? (
              <div className="dl-empty animate-up">
                <div className="dl-empty-icon">🚚</div>
                <h3>{activeTab === 'incoming' ? 'Koi incoming lot nahi hai abhi' : 'Koi dispatch order nahi hai abhi'}</h3>
                <p>Jaise hi payment verify hogi, yahan dikhega.</p>
                {activeTab === 'outgoing' && (
                  <button className="ft-btn-primary-sm" onClick={() => navigate('/transfer')}>
                    New Transfer Request
                  </button>
                )}
              </div>
            ) : (
              <div className="dl-list">
                {activeDeliveries.map((d, idx) => {
                  const b = STATUS_BADGE[d.deliveryStatus] || STATUS_BADGE.PENDING_DISPATCH;
                  const f = forms[d._id] || {};
                  const lf = logisticsForms[d._id] || {};
                  const plan = plans[d._id];
                  const isOpen = Boolean(expandedCards[d._id]);
                  const pct = { DELIVERED: 100, IN_TRANSIT: 66, PICKUP_DISPATCHED: 33, PENDING_DISPATCH: 5 }[d.deliveryStatus] || 5;

                  const STEPS = [
                    { label: 'Verification', pos: 0   },
                    { label: 'Pickup',       pos: 33  },
                    { label: 'Transit',      pos: 66  },
                    { label: 'Pahunch Gaya', pos: 100 },
                  ];

                  return (
                    <div key={d._id} className="dl-card animate-up" style={{ animationDelay: `${idx * 0.08}s` }}>

                      {/* Card top */}
                      <div className="dlc-top">
                        <div className="dlc-avatar">
                          {d.produce?.cropType?.charAt(0).toUpperCase() || 'P'}
                        </div>
                        <div className="dlc-info">
                          <div className="dlc-row1">
                            <span className="dlc-lot">LOT #{d.produce?.lotCode || d.produceId?.slice(-6).toUpperCase()}</span>
                            <span className="dlc-badge" style={{ background: b.bg, color: b.color }}>{b.text}</span>
                          </div>
                          <h3 className="dlc-crop">{d.produce?.cropType || 'Special Produce'}</h3>
                          <div className="dlc-meta">
                            <span><Package size={12} /> {d.produce?.quantity || 0} kg</span>
                            <span><MapPin size={12} /> {d.destinationLocation || 'N/A'}</span>
                          </div>
                        </div>
                        <div className="dlc-card-right">
                          <button
                            className={`dlc-expand${isOpen ? ' open' : ''}`}
                            onClick={() => setExpandedCards(p => ({ ...p, [d._id]: !p[d._id] }))}
                          >
                            <ChevronDown size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Progress Steps */}
                      <div className="step-tracker">
                        <div className="step-bar-wrap">
                          <div className="step-bar-track">
                            <div className="step-bar-fill" style={{ width: `${pct}%` }} />
                            {STEPS.map(({ pos }) => (
                              <div
                                key={pos}
                                className={`step-node${pct >= pos ? ' done' : ''}`}
                                style={{ left: `${pos}%` }}
                              >
                                <div className="step-circle" />
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="step-labels-row">
                          {STEPS.map(({ label, pos }) => (
                            <span key={label} className={`step-lbl-text${pct >= pos ? ' done' : ''}`}>{label}</span>
                          ))}
                        </div>
                      </div>

                      {/* Quick info */}
                      <div className="dlc-quick">
                        {[
                          { icon: <User size={14} />,       color: '#27500A', label: activeTab === 'incoming' ? 'Bhejne Wala' : 'Paane Wala', val: activeTab === 'incoming' ? d.fromPhone : d.toPhone, cost: false },
                          { icon: <Navigation size={14} />, color: '#2563eb', label: 'Current Location', val: d.currentLocation || 'Updating...', cost: false },
                          { icon: <Clock size={14} />,      color: '#d97706', label: 'ETA / Booking',    val: d.deliverySlotLabel || 'Scheduled nahi', cost: false },
                          { icon: <DollarSign size={14} />, color: activeTab === 'incoming' ? '#b45309' : '#7c3aed', label: activeTab === 'incoming' ? 'Aapka Kharcha' : 'Freight', val: d.freightEstimateAmount ? `₹${d.freightEstimateAmount}` : activeTab === 'incoming' ? 'Calculate karein ↓' : 'Dispatch pe calculate', cost: true },
                        ].map((q, i) => (
                          <div key={i} className={`dlc-qi${q.cost ? ' qi-cost' : ''}`}>
                            <div className="dlc-qi-icon" style={{ background: `${q.color}15`, color: q.color }}>
                              {q.icon}
                            </div>
                            <div className="dlc-qi-text">
                              <p className="dlc-qi-label">{q.label}</p>
                              <p className="dlc-qi-val" title={q.val}>{q.val}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* ── EXPANDED PANEL ── */}
                      {isOpen && (() => {
                        const isIncoming = activeTab === 'incoming';
                        const ri = routeInfo[d._id];
                        const rt = ri?.transport;

                        const farmerOrigin = d.produce?.origin ||
                          (user.city ? `${user.city}${user.state ? ', ' + user.state : ''}` : '');
                        const lotOrigin = d.produce?.origin || '';
                        const originCity = isIncoming ? lotOrigin : farmerOrigin;

                        return (
                          <div className="dlc-expanded animate-up">

                            {isIncoming ? (
                              /* ══════════════════════════════════════
                                 DISTRIBUTOR INCOMING VIEW
                                 Transport cost is distributor's responsibility
                              ══════════════════════════════════════ */
                              <>
                                {/* ── Transport Cost Responsibility Banner ── */}
                                <div className="dist-cost-banner">
                                  <div className="dcb-left">
                                    <div className="dcb-icon-wrap">🚚</div>
                                    <div className="dcb-text">
                                      <div className="dcb-title">Transport Lagat — Aapki Zimmedari</div>
                                      <div className="dcb-sub">Niche se apna route calculate karo aur transport kharcha dekho — ye aapko (distributor ko) dena hoga</div>
                                    </div>
                                  </div>
                                  {ri && rt && (
                                    <div className="dcb-cost-badge">
                                      <div className="dcb-cost-label">Aapka Kharcha</div>
                                      <div className="dcb-cost-val">₹{rt.totalTransportCost.toLocaleString('en-IN')}</div>
                                    </div>
                                  )}
                                </div>

                                {/* ── Route Calculator (Distributor) ── */}
                                <div className="exp-route-section amber-section">
                                  <div className="exp-section-header amber">
                                    <Route size={14} />
                                    <span>Transport Lagat Calculator</span>
                                    <span className="esh-tag">Vitrak (Distributor) ka Kharcha</span>
                                  </div>

                                  {/* City inputs */}
                                  <div className="card-planner-inputs">
                                    <div className="cpi-field">
                                      <label className="pl-label">
                                        <span className="pl-dot green" />
                                        Kisan ki Location (Se)
                                      </label>
                                      <LocationInput
                                        value={lf.calcFromCity !== undefined ? lf.calcFromCity : (originCity || '')}
                                        onChange={v => setLF(d._id, 'calcFromCity', v)}
                                        onCoords={c => setLF(d._id, 'calcFromCoords', c)}
                                        placeholder="e.g. Civil Lines, Gorakhpur / Bandra, Mumbai..."
                                        icon="📍"
                                      />
                                    </div>
                                    <div className="cpi-arrow-col">
                                      <div className="planner-arrow-line" />
                                      <div className="planner-swap-dot"><ArrowRight size={14} color="#fff" /></div>
                                      <div className="planner-arrow-line" />
                                    </div>
                                    <div className="cpi-field">
                                      <label className="pl-label">
                                        <span className="pl-dot orange" />
                                        Aapki Location (Tak)
                                      </label>
                                      <LocationInput
                                        value={lf.calcToCity || ''}
                                        onChange={v => setLF(d._id, 'calcToCity', v)}
                                        onCoords={c => setLF(d._id, 'calcToCoords', c)}
                                        placeholder="e.g. Andheri East, Mumbai / Connaught Place, Delhi..."
                                        icon="🏁"
                                      />
                                    </div>
                                  </div>

                                  {/* Vehicle grid */}
                                  <div className="vehicle-grid cpi-vehicle-grid">
                                    {VEHICLE_OPTIONS.map(v => (
                                      <button
                                        key={v.key}
                                        className={`vehicle-chip${(lf.preferredVehicleType || 'mini truck') === v.key ? ' selected amber-chip' : ''}`}
                                        onClick={() => setLF(d._id, 'preferredVehicleType', v.key)}
                                      >
                                        <span className="vc-icon">{v.icon}</span>
                                        <span className="vc-label">{v.label}</span>
                                        <span className="vc-cap">{v.capacity}</span>
                                      </button>
                                    ))}
                                  </div>

                                  {/* Calculate button */}
                                  <button
                                    className="calc-btn card-calc-btn amber-calc-btn"
                                    disabled={routeLoading[d._id] || !lf.calcToCity || !(lf.calcFromCity !== undefined ? lf.calcFromCity : originCity)}
                                    onClick={() => calculateDeliveryRoute(
                                      d._id,
                                      lf.calcFromCity !== undefined ? lf.calcFromCity : originCity,
                                      lf.calcToCity,
                                      lf.preferredVehicleType || 'mini truck',
                                      lf.calcFromCoords || null,
                                      lf.calcToCoords   || null
                                    )}
                                  >
                                    {routeLoading[d._id]
                                      ? <><span className="calc-spinner" /> Calculate Ho Raha Hai...</>
                                      : <><Route size={16} /> Rasta &amp; Lagat Calculate Karo</>}
                                  </button>

                                  {/* Result with Map */}
                                  {ri && rt && (
                                    <div className="route-cost-result animate-up">
                                      <div className="route-label-bar card-route-label" style={{ marginBottom: '0.75rem' }}>
                                        <span className="rl-from">{ri.from?.name || (lf.calcFromCity || originCity || '').split(',')[0]}</span>
                                        <div className="rl-line">
                                          <div className="rl-dash" />
                                          <span className="rl-km">{ri.route.distanceKm} km</span>
                                          <div className="rl-dash" />
                                        </div>
                                        <span className="rl-to">{ri.to?.name || (lf.calcToCity || '').split(',')[0]}</span>
                                      </div>
                                      <div className="card-map-wrap">
                                        <RouteMap routeData={ri} style={{ height: '220px', borderRadius: '14px' }} />
                                        {ri.route.source === 'haversine' && (
                                          <div className="map-approx-badge">~ Approximate Route</div>
                                        )}
                                      </div>
                                      <div className="rcr-pills" style={{ marginTop: '0.9rem' }}>
                                        <div className="rcr-pill">
                                          <span className="rcr-pill-icon">📏</span>
                                          <div>
                                            <div className="rcr-pill-label">Doori</div>
                                            <div className="rcr-pill-val">{ri.route.distanceKm} km</div>
                                          </div>
                                        </div>
                                        <div className="rcr-pill">
                                          <span className="rcr-pill-icon">⏱️</span>
                                          <div>
                                            <div className="rcr-pill-label">Samay</div>
                                            <div className="rcr-pill-val">{ri.route.durationHours}</div>
                                          </div>
                                        </div>
                                        <div className="rcr-pill total amber-total">
                                          <span className="rcr-pill-icon">💸</span>
                                          <div>
                                            <div className="rcr-pill-label">Aapka Kharcha</div>
                                            <div className="rcr-pill-val">₹{rt.totalTransportCost.toLocaleString('en-IN')}</div>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="rcr-breakdown">
                                        <div className="rcr-fuel-bar">
                                          <Fuel size={12} />
                                          Petrol ₹{ri.fuelPrices.petrol}/L &nbsp;·&nbsp; Diesel ₹{ri.fuelPrices.diesel}/L &nbsp;·&nbsp;
                                          <span style={{ color: '#d97706' }}>Aaj ke bhav</span>
                                        </div>
                                        {rt.breakdown.map((row, bi) => (
                                          <div key={bi} className="rcr-bk-row">
                                            <span>{row.label}</span>
                                            <span className="rcr-bk-amt">₹{row.amount.toLocaleString('en-IN')}</span>
                                          </div>
                                        ))}
                                        <div className="rcr-bk-total amber-bk-total">
                                          <span>Aapka Kul Transport Kharcha</span>
                                          <span>₹{rt.totalTransportCost.toLocaleString('en-IN')}</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* ── Delivery Tracking ── */}
                                <div className="dist-tracking-section">
                                  <div className="exp-section-header dts-header">
                                    <Navigation size={14} />
                                    <span>Delivery Tracking</span>
                                  </div>
                                  <div className="ro-grid">
                                    {[
                                      { label: 'Driver', val: `${d.driverName || 'N/A'} · ${d.driverPhone || 'Not shared'}` },
                                      { label: 'Expected Arrival', val: d.expectedDeliveryTime ? new Date(d.expectedDeliveryTime).toLocaleString('en-IN') : 'Processing...' },
                                      { label: 'Vehicle', val: `${d.vehicleNumber || 'Pending'} (${d.vehicleType || 'Any'})` },
                                      { label: 'Last Location', val: `📍 ${d.currentLocation || 'Warehouse'}` },
                                    ].map((r, i) => (
                                      <div key={i} className="ro-item">
                                        <span className="ro-label">{r.label}</span>
                                        <span className="ro-val">{r.val}</span>
                                      </div>
                                    ))}
                                    {d.deliveryRemarks && (
                                      <div className="ro-remark">
                                        <AlertCircle size={13} color="#d97706" /> "{d.deliveryRemarks}"
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </>

                            ) : d.canUpdate ? (
                              /* ══════════════════════════════════════
                                 FARMER OUTGOING / EDITABLE VIEW
                              ══════════════════════════════════════ */
                              <>
                                {/* ── TOP: Route & Cost ── */}
                                <div className="exp-route-section">
                                  <div className="exp-section-header green">
                                    <Route size={14} />
                                    <span>Transport Route & Cost</span>
                                  </div>

                                  <div className="route-form-row">
                                    <div className="route-loc-field">
                                      <div className="rlf-label">
                                        <span className="rlf-dot green" />
                                        Kisan ki Location (Se)
                                        <span className="rlf-auto-tag">📋 Registration se auto</span>
                                      </div>
                                      <div className="rlf-readonly">
                                        <MapPin size={13} color="#27500A" />
                                        <span>{originCity || 'Location profile mein set karein'}</span>
                                      </div>
                                    </div>

                                    <div className="route-arrow"><ArrowRight size={16} color="#9ca3af" /></div>

                                    <div className="route-loc-field">
                                      <div className="rlf-label">
                                        <span className="rlf-dot orange" />
                                        Drop Location (Tak)
                                      </div>
                                      <StateCitySelector
                                        stateValue={lf.destinationState || ''}
                                        cityValue={lf.destinationCity || ''}
                                        onStateChange={s => setLF(d._id, 'destinationState', s)}
                                        onCityChange={c => setLF(d._id, 'destinationCity', c)}
                                      />
                                    </div>

                                    <div className="route-vehicle-field">
                                      <div className="rlf-label"><Truck size={12} /> Vehicle</div>
                                      <select
                                        className="dl-select"
                                        value={lf.preferredVehicleType || 'mini truck'}
                                        onChange={e => setLF(d._id, 'preferredVehicleType', e.target.value)}
                                      >
                                        {VEHICLE_OPTIONS.map(v => (
                                          <option key={v.key} value={v.key}>{v.icon} {v.label}</option>
                                        ))}
                                      </select>
                                    </div>

                                    <button
                                      className="route-calc-trigger"
                                      disabled={routeLoading[d._id] || !lf.destinationCity || !originCity}
                                      onClick={() => calculateDeliveryRoute(
                                        d._id, originCity,
                                        lf.destinationCity ? `${lf.destinationCity}, ${lf.destinationState || ''}` : '',
                                        lf.preferredVehicleType || 'mini truck'
                                      )}
                                    >
                                      {routeLoading[d._id]
                                        ? <><span className="calc-spinner" /> Calculating...</>
                                        : <><Route size={14} /> Calculate</>}
                                    </button>
                                  </div>

                                  {ri && rt && (
                                    <div className="route-cost-result animate-up">
                                      <div className="rcr-pills">
                                        <div className="rcr-pill">
                                          <span className="rcr-pill-icon">📏</span>
                                          <div>
                                            <div className="rcr-pill-label">Doori</div>
                                            <div className="rcr-pill-val">{ri.route.distanceKm} km</div>
                                          </div>
                                        </div>
                                        <div className="rcr-pill">
                                          <span className="rcr-pill-icon">⏱️</span>
                                          <div>
                                            <div className="rcr-pill-label">Samay</div>
                                            <div className="rcr-pill-val">{ri.route.durationHours}</div>
                                          </div>
                                        </div>
                                        <div className="rcr-pill total">
                                          <span className="rcr-pill-icon">💰</span>
                                          <div>
                                            <div className="rcr-pill-label">Kul Transport Lagat</div>
                                            <div className="rcr-pill-val">₹{rt.totalTransportCost.toLocaleString('en-IN')}</div>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="rcr-breakdown">
                                        <div className="rcr-fuel-bar">
                                          <Fuel size={12} />
                                          Petrol ₹{ri.fuelPrices.petrol}/L &nbsp;·&nbsp; Diesel ₹{ri.fuelPrices.diesel}/L &nbsp;·&nbsp; <span style={{ color: '#d97706' }}>Aaj ke bhav</span>
                                        </div>
                                        {rt.breakdown.map((row, bi) => (
                                          <div key={bi} className="rcr-bk-row">
                                            <span>{row.label}</span>
                                            <span className="rcr-bk-amt">₹{row.amount.toLocaleString('en-IN')}</span>
                                          </div>
                                        ))}
                                        <div className="rcr-bk-total">
                                          <span>Kul Transport Lagat</span>
                                          <span>₹{rt.totalTransportCost.toLocaleString('en-IN')}</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* ── BOTTOM: Slot Booking + Dispatch Monitoring ── */}
                                <div className="dlc-grid">
                                  <div className="dlc-section">
                                    <h4 className="dlc-section-title"><CheckCircle2 size={14} /> Slot Booking</h4>
                                    <button className="dl-btn-secondary" style={{ marginTop: 0 }} onClick={() => previewPlan(d._id)} disabled={planningId === d._id || !lf.destinationCity}>
                                      {planningId === d._id ? 'Generating...' : 'Preview Transporters & ETA'}
                                    </button>
                                    {plan && (
                                      <div className="plan-result animate-up">
                                        <div className="plan-route-label">
                                          <span className="prl-dot" />{plan.origin}<ArrowRight size={11} />{plan.destination}<span className="prl-dot orange" />
                                        </div>
                                        <div className="mt2">
                                          <label className="pl-label">Carrier</label>
                                          <select className="dl-select" value={lf.selectedTransporterId || ''} onChange={e => setLF(d._id, 'selectedTransporterId', e.target.value)}>
                                            {plan.matchedTransporters?.map(t => (
                                              <option key={t.transporterId} value={t.transporterId}>{t.name} · {t.vehicleType} · {t.rating}★</option>
                                            ))}
                                          </select>
                                        </div>
                                        <div className="slot-row mt2">
                                          <div>
                                            <label className="pl-label">Date</label>
                                            <select className="dl-select" value={lf.slotDate || ''} onChange={e => setLF(d._id, 'slotDate', e.target.value)}>
                                              {[...new Set((plan.availableSlots || []).map(s => s.slotDate))].map(dv => (
                                                <option key={dv} value={dv}>{dv}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div>
                                            <label className="pl-label">Slot</label>
                                            <select className="dl-select" value={lf.slotLabel || ''} onChange={e => setLF(d._id, 'slotLabel', e.target.value)}>
                                              {(plan.availableSlots || []).filter(s => !lf.slotDate || s.slotDate === lf.slotDate).map(s => (
                                                <option key={s.slotKey} value={s.slotLabel}>{s.slotLabel}</option>
                                              ))}
                                            </select>
                                          </div>
                                        </div>
                                        <button className="dl-btn-primary" onClick={() => bookSlot(d._id)} disabled={bookingId === d._id}>
                                          {bookingId === d._id ? 'Confirming...' : 'Book Dispatch Slot'}
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  <div className="dlc-section alt">
                                    <h4 className="dlc-section-title alt"><Navigation size={14} /> Dispatch Monitoring</h4>
                                    <label className="pl-label">Status</label>
                                    <select className="dl-select" value={f.deliveryStatus || 'PENDING_DISPATCH'} onChange={e => setField(d._id, 'deliveryStatus', e.target.value)}>
                                      <option value="PENDING_DISPATCH">Pending Dispatch</option>
                                      <option value="PICKUP_DISPATCHED">Pickup Dispatched</option>
                                      <option value="IN_TRANSIT">In Transit</option>
                                      <option value="DELIVERED">Delivered</option>
                                    </select>
                                    <div className="two-col mt2">
                                      <div>
                                        <label className="pl-label">Driver Phone</label>
                                        <div className="input-icon-left">
                                          <Phone size={13} />
                                          <input className="dl-input" placeholder="+91..." value={f.driverPhone || ''} onChange={e => setField(d._id, 'driverPhone', e.target.value)} />
                                        </div>
                                      </div>
                                      <div>
                                        <label className="pl-label">Vehicle No.</label>
                                        <div className="input-icon-left">
                                          <Search size={13} />
                                          <input className="dl-input" placeholder="Plate" value={f.vehicleNumber || ''} onChange={e => setField(d._id, 'vehicleNumber', e.target.value)} />
                                        </div>
                                      </div>
                                    </div>
                                    <div className="mt2">
                                      <div className="label-action-row">
                                        <label className="pl-label">GPS Position</label>
                                        <button className="gps-btn" onClick={() => fetchCurrentLocation(d._id)} disabled={gpsLoading[d._id]}>
                                          {gpsLoading[d._id] ? 'Locating...' : '📍 Auto-Fetch'}
                                        </button>
                                      </div>
                                      <input className="dl-input" value={f.currentLocation || ''} onChange={e => setField(d._id, 'currentLocation', e.target.value)} placeholder="e.g. Nashik Highway" />
                                    </div>
                                    <div className="mt2">
                                      <label className="pl-label">Note (Optional)</label>
                                      <textarea className="dl-input dl-textarea" value={f.deliveryRemarks || ''} onChange={e => setField(d._id, 'deliveryRemarks', e.target.value)} placeholder="Retailer ke liye koi update..." />
                                    </div>
                                    <button className="dl-btn-primary" onClick={() => save(d._id)} disabled={savingId === d._id}>
                                      {savingId === d._id ? 'Saving...' : 'Publish Status Update'}
                                    </button>
                                  </div>
                                </div>
                              </>

                            ) : (
                              /* ── READ ONLY FALLBACK ── */
                              <div className="read-only-view">
                                <div className="ro-alert">
                                  <AlertCircle size={18} />
                                  <p>Aap is shipment ko <strong>track</strong> kar rahe ho. Sender update kar raha hai.</p>
                                </div>
                                <div className="ro-grid">
                                  {[
                                    { label: 'Driver', val: `${d.driverName || 'N/A'} · ${d.driverPhone || 'Not shared'}` },
                                    { label: 'Expected Arrival', val: d.expectedDeliveryTime ? new Date(d.expectedDeliveryTime).toLocaleString('en-IN') : 'Processing...' },
                                    { label: 'Vehicle', val: `${d.vehicleNumber || 'Pending'} (${d.vehicleType || 'Any'})` },
                                    { label: 'Last Location', val: `📍 ${d.currentLocation || 'Warehouse'}` },
                                  ].map((r, i) => (
                                    <div key={i} className="ro-item">
                                      <span className="ro-label">{r.label}</span>
                                      <span className="ro-val">{r.val}</span>
                                    </div>
                                  ))}
                                  {d.deliveryRemarks && (
                                    <div className="ro-remark">
                                      <AlertCircle size={13} color="#d97706" /> "{d.deliveryRemarks}"
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        /* ── Base ── */
        .dl-page { background: #f4f7f4; min-height: 100vh; }

        /* ── NAV ── */
        .dl-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
          background: rgba(255,255,255,0.96);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(0,0,0,0.06);
          padding: 0.85rem 0;
        }
        .dl-nav-inner {
          max-width: 1280px; margin: 0 auto; padding: 0 1.5rem;
          display: flex; align-items: center; justify-content: space-between; gap: 1.5rem;
        }
        .dl-nav-left { display: flex; align-items: center; gap: 1rem; }
        .dl-back-btn {
          width: 40px; height: 40px; border-radius: 50%;
          border: 1.5px solid rgba(0,0,0,0.08); background: #fff;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.2s;
        }
        .dl-back-btn:hover { transform: translateX(-3px); background: #f4f7f4; }
        .dl-brand { display: flex; align-items: center; gap: 0.6rem; }
        .dl-title { font-size: 1.3rem; font-weight: 900; color: #27500A; letter-spacing: -0.02em; }
        .dl-tabs { display: flex; background: #f4f7f4; padding: 4px; border-radius: 14px; gap: 3px; }
        .dl-tab {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.55rem 1.1rem; border-radius: 10px; border: none;
          background: transparent; font-weight: 800; font-size: 0.88rem;
          color: #6b7280; cursor: pointer; transition: all 0.2s;
        }
        .dl-tab.active { background: #fff; color: #27500A; box-shadow: 0 2px 10px rgba(0,0,0,0.07); }
        .dl-tab-badge {
          background: #27500A; color: #fff; font-size: 0.62rem;
          padding: 1px 6px; border-radius: 6px; min-width: 18px; text-align: center;
        }
        .dl-role-chip {
          font-size: 0.75rem; font-weight: 900; color: #27500A;
          background: rgba(39,80,10,0.08); padding: 0.3rem 0.85rem;
          border-radius: 20px; text-transform: uppercase; letter-spacing: 0.06em;
        }
        .dl-body { max-width: 1280px; margin: 0 auto; padding: 7rem 1.5rem 3rem; }

        /* ── ANIMATIONS ── */
        @keyframes slideUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:none; } }
        .animate-up { animation: slideUp 0.45s cubic-bezier(.22,.68,0,1.2) both; }

        /* ── PLANNER ── */
        .planner-wrapper { max-width: 860px; margin: 0 auto; }
        .planner-hero {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 1.75rem;
        }
        .planner-heading { font-size: 1.9rem; font-weight: 950; color: #27500A; letter-spacing: -0.03em; }
        .planner-sub { font-size: 0.95rem; color: #6b7280; font-weight: 600; margin-top: 0.4rem; max-width: 520px; }
        .planner-hero-icon { font-size: 4rem; line-height: 1; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.1)); }

        .planner-card {
          background: #fff; border-radius: 28px; padding: 2rem;
          box-shadow: 0 8px 40px rgba(39,80,10,0.08);
          border: 1.5px solid rgba(39,80,10,0.06);
          margin-bottom: 1.5rem;
        }

        .planner-inputs { display: grid; grid-template-columns: 1fr auto 1fr; gap: 1rem; align-items: end; margin-bottom: 1.75rem; }
        .planner-field { display: flex; flex-direction: column; gap: 0.5rem; }
        .pl-label { font-size: 0.82rem; font-weight: 900; color: #374151; display: flex; align-items: center; gap: 0.4rem; }
        .pl-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .pl-dot.green { background: #27500A; }
        .pl-dot.orange { background: #d97706; }

        .planner-arrow-col { display: flex; flex-direction: column; align-items: center; gap: 4px; padding-bottom: 4px; }
        .planner-arrow-line { width: 1px; height: 20px; background: rgba(39,80,10,0.15); }
        .planner-swap-dot { width: 30px; height: 30px; background: #27500A; border-radius: 50%; display: flex; align-items: center; justify-content: center; }

        /* City input */
        .city-input-wrap {
          display: flex; align-items: center; gap: 0.6rem;
          background: #f9fafb; border: 1.5px solid rgba(0,0,0,0.08);
          border-radius: 14px; padding: 0.75rem 1rem;
          transition: all 0.2s;
        }
        .city-input-wrap:focus-within { border-color: #27500A; background: #fff; box-shadow: 0 0 0 3px rgba(39,80,10,0.08); }
        .city-input-icon { font-size: 1.1rem; }
        .city-input { border: none; background: transparent; flex: 1; font-size: 0.98rem; font-weight: 700; color: #111; outline: none; }
        .city-input::placeholder { color: #9ca3af; font-weight: 500; }
        .city-dropdown {
          position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 9999;
          background: #fff; border-radius: 14px; border: 1.5px solid rgba(0,0,0,0.08);
          box-shadow: 0 12px 40px rgba(0,0,0,0.12); list-style: none; overflow: hidden;
        }
        .city-option {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.65rem 1rem; font-size: 0.9rem; font-weight: 700;
          color: #374151; cursor: pointer; transition: background 0.15s;
        }
        .city-option:hover { background: #f0f9f0; color: #27500A; }

        /* Vehicle selector */
        .vehicle-selector { margin-bottom: 1.5rem; }
        .vehicle-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
        @media (max-width: 640px) { .vehicle-grid { grid-template-columns: repeat(2, 1fr); } }
        .vehicle-chip {
          display: flex; flex-direction: column; align-items: center; gap: 0.2rem;
          padding: 0.85rem 0.5rem; border-radius: 14px;
          border: 1.5px solid rgba(0,0,0,0.07); background: #f9fafb;
          cursor: pointer; transition: all 0.2s;
        }
        .vehicle-chip:hover { border-color: rgba(39,80,10,0.3); background: #f0f9f0; }
        .vehicle-chip.selected { border-color: #27500A; background: rgba(39,80,10,0.06); }
        .vc-icon { font-size: 1.5rem; }
        .vc-label { font-size: 0.75rem; font-weight: 800; color: #374151; text-align: center; }
        .vc-cap { font-size: 0.65rem; font-weight: 700; color: #9ca3af; }

        /* Error */
        .planner-error {
          display: flex; align-items: center; gap: 0.5rem;
          background: #fff1f2; color: #be123c; font-weight: 700; font-size: 0.88rem;
          padding: 0.75rem 1rem; border-radius: 12px; margin-bottom: 1rem;
        }

        /* Calculate button */
        .calc-btn {
          width: 100%; padding: 1rem; border-radius: 16px;
          border: none; background: #27500A; color: #fff;
          font-size: 1rem; font-weight: 900; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 0.6rem;
          transition: all 0.2s; letter-spacing: 0.01em;
          box-shadow: 0 4px 20px rgba(39,80,10,0.35);
        }
        .calc-btn:hover:not(:disabled) { background: #1e3d07; transform: translateY(-2px); box-shadow: 0 8px 28px rgba(39,80,10,0.4); }
        .calc-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
        .calc-spinner {
          width: 18px; height: 18px; border: 2.5px solid rgba(255,255,255,0.3);
          border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── RESULT ── */
        .result-wrapper { display: flex; flex-direction: column; gap: 1.25rem; }

        .route-label-bar {
          display: flex; align-items: center; gap: 1rem;
          background: #fff; border-radius: 16px; padding: 1rem 1.5rem;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
        }
        .rl-from, .rl-to { font-size: 1.1rem; font-weight: 950; color: #27500A; }
        .rl-to { color: #d97706; }
        .rl-line { flex: 1; display: flex; align-items: center; gap: 0.5rem; }
        .rl-dash { flex: 1; height: 2px; background: repeating-linear-gradient(90deg,#27500A 0,#27500A 6px,transparent 6px,transparent 12px); }
        .rl-km { font-size: 0.82rem; font-weight: 900; color: #6b7280; white-space: nowrap; background: #f4f7f4; padding: 0.2rem 0.6rem; border-radius: 8px; }

        .map-container { position: relative; border-radius: 24px; overflow: hidden; box-shadow: 0 12px 40px rgba(39,80,10,0.12); }
        .map-approx-badge {
          position: absolute; top: 12px; right: 12px; z-index: 999;
          background: rgba(217,119,6,0.9); color: #fff; font-size: 0.72rem; font-weight: 900;
          padding: 0.3rem 0.8rem; border-radius: 20px; pointer-events: none;
        }

        .summary-chips { display: grid; grid-template-columns: repeat(4,1fr); gap: 0.75rem; }
        @media (max-width: 640px) { .summary-chips { grid-template-columns: repeat(2,1fr); } }
        .summary-chip {
          background: #fff; border-radius: 18px; padding: 1rem 1.25rem;
          display: flex; align-items: center; gap: 0.75rem;
          box-shadow: 0 4px 16px rgba(0,0,0,0.04);
          border: 1.5px solid rgba(0,0,0,0.04);
        }
        .summary-chip.hl { background: #27500A; border-color: #27500A; }
        .summary-chip.hl .sc-label, .summary-chip.hl .sc-val { color: #fff; }
        .sc-icon { font-size: 1.5rem; }
        .sc-label { font-size: 0.68rem; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; }
        .sc-val { font-size: 1.05rem; font-weight: 950; color: #27500A; margin-top: 0.1rem; }

        .fuel-info-bar {
          display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;
          background: #fff; border-radius: 14px; padding: 0.75rem 1.25rem;
          font-size: 0.85rem; font-weight: 700; color: #6b7280;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .fi-sep { color: #d1d5db; }
        .fi-date { margin-left: auto; color: #9ca3af; font-style: italic; }
        .fuel-info-bar b { color: #27500A; }

        .breakdown-card {
          background: #fff; border-radius: 20px; overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.05);
          border: 1.5px solid rgba(0,0,0,0.04);
        }
        .bk-header {
          display: flex; align-items: center; gap: 0.6rem;
          padding: 1rem 1.5rem; background: rgba(39,80,10,0.05);
          font-size: 0.85rem; font-weight: 950; color: #27500A;
          text-transform: uppercase; letter-spacing: 0.07em;
          border-bottom: 1px solid rgba(0,0,0,0.04);
        }
        .bk-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 0.85rem 1.5rem; border-bottom: 1px solid rgba(0,0,0,0.03);
          font-size: 0.92rem; font-weight: 700; color: #374151;
        }
        .bk-amt { font-weight: 900; color: #27500A; }
        .bk-total {
          display: flex; justify-content: space-between;
          padding: 1.1rem 1.5rem; background: rgba(39,80,10,0.06);
          font-size: 1.05rem; font-weight: 950; color: #27500A;
          border-top: 2px solid rgba(39,80,10,0.12);
        }

        /* ── Role tag ── */
        .planner-role-tag {
          display: inline-flex; align-items: center; gap: 0.35rem;
          font-size: 0.75rem; font-weight: 900; padding: 0.3rem 0.85rem;
          border-radius: 20px; margin-top: 0.75rem; letter-spacing: 0.04em;
        }
        .planner-role-tag.dist { background: rgba(217,119,6,0.1); color: #b45309; }
        .planner-role-tag.farmer { background: rgba(39,80,10,0.08); color: #27500A; }

        /* ── Distributor planner banner ── */
        .dist-planner-banner {
          display: flex; align-items: flex-start; gap: 1rem;
          background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
          border: 1.5px solid rgba(217,119,6,0.25);
          border-radius: 20px; padding: 1.25rem 1.5rem;
        }
        .dpb-icon { font-size: 2rem; flex-shrink: 0; }
        .dpb-body { flex: 1; }
        .dpb-title { font-size: 0.95rem; font-weight: 950; color: #92400e; margin-bottom: 0.3rem; }
        .dpb-sub { font-size: 0.82rem; font-weight: 600; color: #b45309; line-height: 1.5; }
        .dpb-amount { text-align: right; flex-shrink: 0; }
        .dpb-amt-label { font-size: 0.65rem; font-weight: 900; color: #b45309; text-transform: uppercase; letter-spacing: 0.07em; }
        .dpb-amt-val { font-size: 1.5rem; font-weight: 950; color: #92400e; letter-spacing: -0.02em; }

        /* ── Per-kg calculator ── */
        .per-kg-calc {
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          border: 1.5px solid rgba(39,80,10,0.18);
          border-radius: 20px; padding: 1.4rem 1.5rem;
          display: flex; flex-direction: column; gap: 1rem;
        }
        .pkc-header { display: flex; align-items: flex-start; gap: 0.85rem; }
        .pkc-bulb { font-size: 1.6rem; flex-shrink: 0; }
        .pkc-title { font-size: 1rem; font-weight: 950; color: #27500A; }
        .pkc-hint { font-size: 0.78rem; font-weight: 600; color: #4b7a20; margin-top: 0.15rem; }
        .pkc-input-row { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
        .pkc-label { font-size: 0.82rem; font-weight: 900; color: #374151; flex-shrink: 0; }
        .pkc-input-wrap {
          display: flex; align-items: center; gap: 0.5rem;
          background: #fff; border: 1.5px solid rgba(39,80,10,0.2);
          border-radius: 12px; padding: 0.55rem 0.85rem; flex: 1; max-width: 200px;
        }
        .pkc-input-wrap:focus-within { border-color: #27500A; box-shadow: 0 0 0 3px rgba(39,80,10,0.1); }
        .pkc-input { border: none; background: transparent; flex: 1; font-size: 1rem; font-weight: 800; color: #111; outline: none; width: 80px; }
        .pkc-unit { font-size: 0.82rem; font-weight: 900; color: #27500A; }
        .pkc-result {
          background: #fff; border-radius: 14px; padding: 1rem 1.25rem;
          border: 1.5px solid rgba(39,80,10,0.12);
          display: flex; flex-direction: column; gap: 0.6rem;
        }
        .pkc-result-row {
          display: flex; justify-content: space-between; align-items: center;
          font-size: 0.9rem; font-weight: 800; color: #374151;
        }
        .pkc-per-kg { font-size: 1.3rem; font-weight: 950; color: #27500A; }
        .pkc-tip {
          font-size: 0.82rem; font-weight: 600; color: #4b7a20;
          background: rgba(39,80,10,0.05); border-radius: 10px; padding: 0.6rem 0.85rem;
          line-height: 1.5;
        }
        .pkc-tip strong { color: #27500A; }

        /* ── DELIVERIES ── */
        .deliveries-wrapper {}
        .stats-row {
          display: grid; grid-template-columns: repeat(3,1fr); gap: 1rem;
          margin-bottom: 1.75rem;
        }
        .stat-card {
          background: #fff; padding: 1.25rem 1.5rem; border-radius: 20px;
          display: flex; align-items: center; gap: 1rem;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
          border: 1px solid rgba(0,0,0,0.05);
        }
        .stat-card.dark { background: #27500A; border-color: transparent; }
        .stat-icon {
          width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
          background: #f4f7f4; display: flex; align-items: center;
          justify-content: center; color: #27500A;
        }
        .stat-icon.di { background: rgba(255,255,255,0.18); color: #fff; }
        .dark .stat-label { color: rgba(255,255,255,0.65); }
        .dark .stat-val { color: #fff; }
        .stat-label { font-size: 0.72rem; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.06em; }
        .stat-val { font-size: 1.8rem; font-weight: 950; color: #27500A; letter-spacing: -0.03em; line-height: 1; margin-top: 0.1rem; }

        .dl-loading { display: flex; justify-content: center; padding: 8rem 0; }
        .dl-spinner {
          width: 44px; height: 44px; border: 4px solid rgba(39,80,10,0.1);
          border-top-color: #27500A; border-radius: 50%; animation: spin 0.8s linear infinite;
        }

        .dl-empty { text-align: center; padding: 6rem 2rem; }
        .dl-empty-icon { font-size: 4rem; margin-bottom: 1.5rem; }
        .dl-empty h3 { font-size: 1.4rem; font-weight: 900; color: #27500A; margin-bottom: 0.5rem; }
        .dl-empty p { color: #9ca3af; font-weight: 600; margin-bottom: 1.5rem; }
        .ft-btn-primary-sm {
          padding: 0.75rem 2rem; border-radius: 14px; border: none;
          background: #27500A; color: #fff; font-weight: 900; cursor: pointer;
        }

        /* ── DELIVERY CARD ── */
        .dl-list { display: flex; flex-direction: column; gap: 1.25rem; }

        .dl-card {
          background: #fff; border-radius: 24px; padding: 1.75rem 2rem;
          box-shadow: 0 1px 12px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.05);
          transition: box-shadow 0.25s, transform 0.2s; overflow: hidden;
        }
        .dl-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.08), 0 0 0 1.5px rgba(39,80,10,0.1); transform: translateY(-1px); }

        /* Card header */
        .dlc-top { display: flex; align-items: center; gap: 1.1rem; margin-bottom: 1.4rem; }
        .dlc-avatar {
          width: 56px; height: 56px; border-radius: 18px; flex-shrink: 0;
          background: linear-gradient(135deg, #d1fae5 0%, #ecfdf5 100%);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.5rem; font-weight: 950; color: #27500A;
          border: 1.5px solid rgba(39,80,10,0.12);
          box-shadow: 0 2px 8px rgba(39,80,10,0.1);
        }
        .dlc-info { flex: 1; min-width: 0; }
        .dlc-row1 { display: flex; align-items: center; gap: 0.55rem; margin-bottom: 0.25rem; flex-wrap: wrap; }
        .dlc-lot {
          font-size: 0.65rem; font-weight: 900; color: #b0b8c4;
          letter-spacing: 0.14em; font-family: monospace;
          background: #f4f6f8; padding: 0.15rem 0.5rem; border-radius: 6px;
        }
        .dlc-badge {
          padding: 0.22rem 0.7rem; border-radius: 20px;
          font-size: 0.68rem; font-weight: 900; letter-spacing: 0.03em;
        }
        .dlc-crop { font-size: 1.25rem; font-weight: 950; color: #111827; letter-spacing: -0.025em; text-transform: capitalize; }
        .dlc-meta { display: flex; gap: 1rem; margin-top: 0.35rem; flex-wrap: wrap; }
        .dlc-meta span {
          display: flex; align-items: center; gap: 0.35rem;
          font-size: 0.78rem; font-weight: 700; color: #6b7280;
          background: #f9fafb; padding: 0.2rem 0.6rem; border-radius: 8px;
        }
        .dlc-card-right { display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0; }
        .dlc-expand {
          width: 36px; height: 36px; border-radius: 50%; border: 1.5px solid #e5e7eb;
          background: #f9fafb; display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: #9ca3af; transition: all 0.25s;
        }
        .dlc-expand:hover { border-color: rgba(39,80,10,0.3); color: #27500A; background: rgba(39,80,10,0.04); transform: scale(1.06); }
        .dlc-expand.open { background: #27500A; color: #fff; transform: rotate(180deg); border-color: #27500A; box-shadow: 0 4px 12px rgba(39,80,10,0.3); }

        /* ── STEP TRACKER ── */
        .step-tracker { padding: 0.5rem 0 0.25rem; }
        .step-bar-wrap { padding: 0 8px; }
        .step-bar-track {
          position: relative; height: 5px; background: #e9ecef; border-radius: 10px;
          margin: 0 0 10px;
        }
        .step-bar-fill {
          position: absolute; top: 0; left: 0; height: 100%;
          background: linear-gradient(90deg, #27500A, #5fa832);
          border-radius: 10px; transition: width 0.8s cubic-bezier(.4,0,.2,1);
        }
        .step-node {
          position: absolute; top: 50%;
          transform: translate(-50%, -50%);
        }
        .step-circle {
          width: 14px; height: 14px; border-radius: 50%;
          background: #d1d5db; border: 2.5px solid #fff;
          box-shadow: 0 0 0 2px #d1d5db;
          transition: all 0.35s; position: relative; z-index: 2;
        }
        .step-node.done .step-circle {
          background: #27500A; box-shadow: 0 0 0 3px rgba(39,80,10,0.2);
          border-color: #fff;
        }
        .step-labels-row {
          display: flex; justify-content: space-between;
          padding: 0 4px;
        }
        .step-lbl-text {
          font-size: 0.6rem; font-weight: 800; text-transform: uppercase;
          letter-spacing: 0.05em; color: #c0c4cc; white-space: nowrap;
          transition: color 0.3s;
        }
        .step-lbl-text:nth-child(2), .step-lbl-text:nth-child(3) { text-align: center; }
        .step-lbl-text:last-child { text-align: right; }
        .step-lbl-text.done { color: #27500A; }

        /* Quick info */
        .dlc-quick {
          display: flex; flex-wrap: wrap; gap: 0.5rem;
          padding-top: 1.1rem; margin-top: 0.25rem;
          border-top: 1.5px solid #f3f4f6;
        }
        .dlc-qi {
          display: flex; align-items: center; gap: 0.65rem;
          flex: 1 1 155px; min-width: 0;
          background: #f8fafc; border-radius: 14px;
          border: 1px solid #edf0f3;
          padding: 0.7rem 1rem;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .dlc-qi:hover { border-color: #dde3ea; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
        .dlc-qi.qi-cost {
          background: linear-gradient(135deg,rgba(180,83,9,0.04),rgba(180,83,9,0.07));
          border-color: rgba(180,83,9,0.15);
        }
        .dlc-qi-icon {
          width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .dlc-qi-text { min-width: 0; flex: 1; }
        .dlc-qi-label {
          font-size: 0.58rem; font-weight: 900; text-transform: uppercase;
          letter-spacing: 0.08em; color: #b0bac4; margin-bottom: 0.2rem;
        }
        .dlc-qi-val {
          font-size: 0.88rem; font-weight: 800; color: #1a2433; line-height: 1.25;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .dlc-qi.qi-cost .dlc-qi-val { color: #92400e; font-size: 1rem; font-weight: 950; }

        /* Expanded */
        .dlc-expanded {
          margin-top: 1.4rem; padding-top: 1.5rem;
          border-top: 1.5px dashed #e8ecf0;
        }
        .dlc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
        @media (max-width: 900px) { .dlc-grid { grid-template-columns: 1fr; } }
        .dlc-section {
          background: #fafafa; border-radius: 18px; padding: 1.4rem;
          border: 1px solid #f0f0f0;
        }
        .dlc-section.alt { background: #f8fbff; border-color: #e8f0fe; }
        .dlc-section-title {
          font-size: 0.72rem; font-weight: 950; color: #27500A;
          text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 1.1rem;
          display: flex; align-items: center; gap: 0.45rem;
          padding-bottom: 0.75rem; border-bottom: 1px solid rgba(39,80,10,0.1);
        }
        .dlc-section.alt .dlc-section-title { color: #1d4ed8; border-color: rgba(29,78,216,0.1); }

        .dl-input {
          width: 100%; padding: 0.7rem 1rem; border-radius: 10px;
          border: 1.5px solid #e5e7eb; background: #fff;
          font-size: 0.9rem; font-weight: 700; color: #111; outline: none;
          transition: all 0.18s; box-sizing: border-box;
        }
        .dl-input:focus { border-color: #27500A; box-shadow: 0 0 0 3px rgba(39,80,10,0.08); }
        .dl-textarea { min-height: 74px; resize: vertical; }
        .dl-select {
          width: 100%; padding: 0.7rem 1rem; border-radius: 10px;
          border: 1.5px solid #e5e7eb; background: #fff;
          font-size: 0.9rem; font-weight: 700; color: #111; outline: none; cursor: pointer;
        }
        .dl-select:focus { border-color: #27500A; }
        .dl-btn-primary {
          width: 100%; padding: 0.8rem; border-radius: 12px; border: none;
          background: #27500A; color: #fff; font-size: 0.92rem; font-weight: 900;
          cursor: pointer; transition: all 0.2s; margin-top: 0.75rem;
        }
        .dl-btn-primary:hover:not(:disabled) { background: #1e3d07; transform: translateY(-1px); }
        .dl-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .dl-btn-secondary {
          width: 100%; padding: 0.8rem; border-radius: 12px;
          border: 1.5px solid #27500A; background: transparent;
          color: #27500A; font-size: 0.92rem; font-weight: 900;
          cursor: pointer; transition: all 0.2s; margin-top: 0.75rem;
        }
        .dl-btn-secondary:hover:not(:disabled) { background: rgba(39,80,10,0.05); }
        .dl-btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }

        .input-icon-left { position: relative; display: flex; align-items: center; }
        .input-icon-left > svg { position: absolute; left: 0.85rem; color: #9ca3af; pointer-events: none; }
        .input-icon-left > .dl-input { padding-left: 2.4rem; }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; }
        .label-action-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem; }
        .gps-btn {
          background: rgba(39,80,10,0.07); border: none; color: #27500A;
          font-weight: 900; font-size: 0.72rem; cursor: pointer;
          padding: 0.25rem 0.6rem; border-radius: 8px; transition: background 0.2s;
        }
        .gps-btn:hover:not(:disabled) { background: rgba(39,80,10,0.14); }
        .mt2 { margin-top: 0.75rem; }
        .slot-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; }

        .plan-result {
          background: rgba(39,80,10,0.04); border-radius: 14px; padding: 1rem;
          margin-top: 0.75rem; border: 1px solid rgba(39,80,10,0.1);
        }
        .plan-route-label {
          display: flex; align-items: center; gap: 0.4rem;
          font-size: 0.82rem; font-weight: 800; color: #27500A; margin-bottom: 0.75rem;
        }
        .prl-dot { width: 7px; height: 7px; background: #27500A; border-radius: 50%; }
        .prl-dot.orange { background: #d97706; }

        /* Read-only */
        .read-only-view {}
        .ro-alert {
          display: flex; align-items: center; gap: 0.75rem;
          background: #f0fdf4; padding: 0.9rem 1.1rem; border-radius: 12px;
          color: #27500A; font-weight: 700; font-size: 0.88rem;
          margin-bottom: 1.25rem; border: 1px solid #bbf7d0;
        }
        .ro-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .ro-item { display: flex; flex-direction: column; gap: 0.25rem; }
        .ro-label { font-size: 0.65rem; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.06em; }
        .ro-val { font-size: 0.92rem; font-weight: 900; color: #27500A; }
        .ro-remark {
          grid-column: 1/-1; display: flex; align-items: flex-start; gap: 0.5rem;
          background: #fffbeb; padding: 0.9rem 1rem; border-radius: 12px;
          font-size: 0.88rem; font-weight: 700; color: #92400e; font-style: italic;
          border: 1px dashed rgba(217,119,6,0.35); margin-top: 0.25rem;
        }

        /* ── EXPANDED ROUTE SECTION ── */
        .exp-route-section {
          background: #f8fdf8; border: 1.5px solid rgba(39,80,10,0.1);
          border-radius: 18px; padding: 1.25rem 1.4rem; margin-bottom: 1.25rem;
        }
        .exp-section-header {
          display: flex; align-items: center; gap: 0.45rem;
          font-size: 0.72rem; font-weight: 950; text-transform: uppercase;
          letter-spacing: 0.09em; margin-bottom: 1.1rem;
          padding-bottom: 0.75rem; border-bottom: 1px solid rgba(39,80,10,0.1);
        }
        .exp-section-header.green { color: #27500A; }

        .route-form-row {
          display: grid;
          grid-template-columns: 1fr auto 1fr 160px auto;
          gap: 0.75rem; align-items: end;
        }
        @media (max-width: 1000px) {
          .route-form-row { grid-template-columns: 1fr 1fr; }
          .route-arrow { display: none; }
          .route-calc-trigger { grid-column: 1/-1; }
        }

        .route-loc-field { display: flex; flex-direction: column; gap: 0.35rem; }
        .rlf-label {
          display: flex; align-items: center; gap: 0.35rem;
          font-size: 0.73rem; font-weight: 800; color: #374151;
        }
        .rlf-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .rlf-dot.green { background: #27500A; }
        .rlf-dot.orange { background: #d97706; }
        .rlf-auto-tag {
          margin-left: auto; font-size: 0.65rem; font-weight: 700;
          color: #27500A; background: rgba(39,80,10,0.08);
          padding: 0.1rem 0.5rem; border-radius: 6px;
        }
        .rlf-readonly {
          display: flex; align-items: center; gap: 0.5rem;
          background: #fff; border: 1.5px solid #e5e7eb; border-radius: 10px;
          padding: 0.65rem 1rem; font-size: 0.9rem; font-weight: 800; color: #111;
          min-height: 42px;
        }

        .route-arrow { display: flex; align-items: center; padding-bottom: 2px; }
        .route-vehicle-field { display: flex; flex-direction: column; gap: 0.35rem; }

        .route-calc-trigger {
          padding: 0 1.1rem; height: 42px; border-radius: 10px; border: none;
          background: #27500A; color: #fff; font-size: 0.85rem; font-weight: 900;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          gap: 0.4rem; white-space: nowrap; transition: all 0.2s;
          box-shadow: 0 2px 10px rgba(39,80,10,0.3);
        }
        .route-calc-trigger:hover:not(:disabled) { background: #1e3d07; transform: translateY(-1px); }
        .route-calc-trigger:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }

        /* Route cost result */
        .route-cost-result {
          margin-top: 1rem; border-top: 1px dashed rgba(39,80,10,0.15); padding-top: 1rem;
        }
        .rcr-pills {
          display: grid; grid-template-columns: 1fr 1fr 1.5fr; gap: 0.75rem; margin-bottom: 0.9rem;
        }
        @media (max-width: 640px) { .rcr-pills { grid-template-columns: 1fr 1fr; } }
        .rcr-pill {
          background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
          padding: 0.75rem 1rem; display: flex; align-items: center; gap: 0.6rem;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
        }
        .rcr-pill.total { background: #27500A; border-color: #27500A; }
        .rcr-pill.total .rcr-pill-label,
        .rcr-pill.total .rcr-pill-val { color: #fff; }
        .rcr-pill-icon { font-size: 1.2rem; line-height: 1; }
        .rcr-pill-label { font-size: 0.62rem; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.04em; }
        .rcr-pill-val { font-size: 1rem; font-weight: 950; color: #27500A; }

        .rcr-breakdown {
          background: #fff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden;
        }
        .rcr-fuel-bar {
          display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;
          padding: 0.55rem 1rem; background: #f9fafb; border-bottom: 1px solid #f0f0f0;
          font-size: 0.75rem; font-weight: 700; color: #6b7280;
        }
        .rcr-bk-row {
          display: flex; justify-content: space-between; padding: 0.6rem 1rem;
          font-size: 0.85rem; font-weight: 700; color: #374151;
          border-bottom: 1px solid #f5f5f5;
        }
        .rcr-bk-amt { color: #27500A; font-weight: 900; }
        .rcr-bk-total {
          display: flex; justify-content: space-between; padding: 0.8rem 1rem;
          background: rgba(39,80,10,0.05); font-size: 0.95rem; font-weight: 950;
          color: #27500A; border-top: 1.5px solid rgba(39,80,10,0.1);
        }

        /* Section title alt (blue) */
        .dlc-section-title.alt { color: #1d4ed8; border-color: rgba(29,78,216,0.1); }

        /* ── DISTRIBUTOR INCOMING VIEW ── */
        .dist-cost-banner {
          display: flex; align-items: center; justify-content: space-between;
          background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
          border: 2px solid #f59e0b; border-radius: 20px;
          padding: 1.25rem 1.5rem; margin-bottom: 1.25rem; gap: 1.25rem;
          box-shadow: 0 4px 20px rgba(245,158,11,0.12);
        }
        .dcb-left { display: flex; align-items: center; gap: 1rem; flex: 1; min-width: 0; }
        .dcb-icon-wrap { font-size: 2.2rem; flex-shrink: 0; line-height: 1; }
        .dcb-text {}
        .dcb-title {
          font-size: 1rem; font-weight: 950; color: #78350f; margin-bottom: 0.25rem;
          letter-spacing: -0.01em;
        }
        .dcb-sub { font-size: 0.8rem; font-weight: 600; color: #92400e; line-height: 1.4; }
        .dcb-cost-badge {
          flex-shrink: 0; text-align: center;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          border-radius: 16px; padding: 0.85rem 1.4rem;
          box-shadow: 0 6px 20px rgba(245,158,11,0.4);
        }
        .dcb-cost-label {
          font-size: 0.6rem; font-weight: 900; color: rgba(255,255,255,0.85);
          text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.2rem;
        }
        .dcb-cost-val { font-size: 1.5rem; font-weight: 950; color: #fff; letter-spacing: -0.02em; }

        /* Amber section styling */
        .amber-section {
          background: #fffdf5 !important;
          border-color: rgba(245,158,11,0.25) !important;
        }
        .exp-section-header.amber {
          color: #92400e !important;
          border-color: rgba(245,158,11,0.2) !important;
        }
        .esh-tag {
          margin-left: auto; font-size: 0.62rem; font-weight: 900;
          background: rgba(245,158,11,0.15); color: #92400e;
          padding: 0.15rem 0.6rem; border-radius: 6px; letter-spacing: 0.03em;
        }

        /* Distributor vehicle grid */
        .dist-vehicle-grid {
          display: grid; grid-template-columns: repeat(6,1fr); gap: 0.5rem;
          margin: 1rem 0;
        }
        @media (max-width: 900px) { .dist-vehicle-grid { grid-template-columns: repeat(3,1fr); } }
        @media (max-width: 640px) { .dist-vehicle-grid { grid-template-columns: repeat(2,1fr); } }
        .dist-vehicle-chip {
          display: flex; flex-direction: column; align-items: center; gap: 0.2rem;
          padding: 0.65rem 0.4rem; border-radius: 12px;
          border: 1.5px solid rgba(0,0,0,0.07); background: #fafafa;
          cursor: pointer; transition: all 0.2s;
        }
        .dist-vehicle-chip:hover { border-color: rgba(245,158,11,0.4); background: #fffbeb; }
        .dist-vehicle-chip.selected { border-color: #f59e0b; background: rgba(245,158,11,0.08); box-shadow: 0 0 0 3px rgba(245,158,11,0.12); }
        .dist-vehicle-chip .vc-label { font-size: 0.68rem; }
        .dist-vehicle-chip .vc-cap { font-size: 0.6rem; }

        /* Amber calculate trigger */
        .route-calc-trigger.amber-trigger {
          background: linear-gradient(135deg, #f59e0b, #d97706) !important;
          box-shadow: 0 2px 12px rgba(245,158,11,0.35) !important;
        }
        .route-calc-trigger.amber-trigger:hover:not(:disabled) {
          background: linear-gradient(135deg, #d97706, #b45309) !important;
          transform: translateY(-1px);
        }

        /* Amber cost pill & total */
        .rcr-pill.total.amber-total { background: linear-gradient(135deg,#f59e0b,#d97706); border-color: #f59e0b; }
        .rcr-bk-total.amber-bk-total {
          background: rgba(245,158,11,0.08); color: #78350f;
          border-top-color: rgba(245,158,11,0.2);
        }

        /* Distributor Tracking Section */
        .dist-tracking-section {
          background: #f8fbff; border: 1.5px solid rgba(29,78,216,0.1);
          border-radius: 18px; padding: 1.25rem 1.4rem; margin-top: 1.25rem;
        }
        .exp-section-header.dts-header { color: #1d4ed8 !important; border-color: rgba(29,78,216,0.12) !important; }

        /* Responsive */
        @media (max-width: 768px) {
          .dl-nav-inner { flex-wrap: wrap; gap: 0.75rem; }
          .planner-inputs { grid-template-columns: 1fr; }
          .planner-arrow-col { display: none; }
          .planner-hero { flex-direction: column; gap: 1rem; align-items: flex-start; }
          .planner-hero-icon { font-size: 2.5rem; }
          .summary-chips { grid-template-columns: repeat(2,1fr); }
          .stats-row { grid-template-columns: 1fr; }
          .dlc-qi { flex-basis: calc(50% - 0.28rem); }
          .route-label-bar { flex-direction: column; gap: 0.5rem; }
          .rl-line { width: 100%; }
          .fi-date { margin-left: 0; }
        }
      `}</style>
    </div>
  );
}
