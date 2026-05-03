import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import StateCitySelector from '../components/StateCitySelector';
import { 
  Truck, 
  Package, 
  MapPin, 
  Clock, 
  ChevronDown, 
  Inbox, 
  Phone, 
  User, 
  Navigation, 
  DollarSign,
  Search,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function DispatchLogistics() {
  const [deliveries, setDeliveries] = useState([]);
  const [forms, setForms] = useState({});
  const [logisticsForms, setLogisticsForms] = useState({});
  const [plans, setPlans] = useState({});
  const [planningId, setPlanningId] = useState(null);
  const [bookingId, setBookingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [expandedCards, setExpandedCards] = useState({});
  const [gpsLoading, setGpsLoading] = useState({});
  const [activeTab, setActiveTab] = useState('incoming'); // 'incoming' or 'outgoing'
  
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const fetchDeliveries = async () => {
    try {
      const res = await api.get('/payment/deliveries/my');
      setDeliveries(res.data);

      const next = {};
      const logisticsNext = {};
      res.data.forEach((d) => {
        next[d._id] = {
          deliveryStatus: d.deliveryStatus || 'PENDING_DISPATCH',
          driverName: d.driverName || '',
          driverPhone: d.driverPhone || '',
          vehicleNumber: d.vehicleNumber || '',
          vehicleType: d.vehicleType || '',
          currentLocation: d.currentLocation || d.location || '',
          destinationLocation: d.destinationLocation || '',
          expectedDeliveryTime: d.expectedDeliveryTime
            ? new Date(d.expectedDeliveryTime).toISOString().slice(0, 16)
            : '',
          deliveryRemarks: d.deliveryRemarks || ''
        };

        logisticsNext[d._id] = {
          destinationLocation: d.destinationLocation || '',
          preferredVehicleType: d.vehicleType || '',
          selectedTransporterId: d.matchedTransporter?.transporterId || '',
          slotDate: d.deliverySlotDate ? new Date(d.deliverySlotDate).toISOString().slice(0, 10) : '',
          slotLabel: d.deliverySlotLabel || ''
        };
      });
      setForms(next);
      setLogisticsForms(logisticsNext);
      setExpandedCards((prev) => {
        const updated = { ...prev };
        res.data.forEach((d, idx) => {
          if (updated[d._id] === undefined) {
            updated[d._id] = idx === 0;
          }
        });
        return updated;
      });
    } catch (err) {
      alert('Deliveries load nahi hui');
    } finally {
      setLoading(false);
    }
  };

  const setField = (id, key, value) => {
    setForms((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [key]: value
      }
    }));
  };

  const setLogisticsField = (id, key, value) => {
    setLogisticsForms((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [key]: value
      }
    }));
  };

  const save = async (id) => {
    try {
      setSavingId(id);
      await api.put(`/payment/deliveries/${id}`, forms[id]);
      await fetchDeliveries();
    } catch (err) {
      alert(err.response?.data?.message || 'Dispatch update fail ho gaya');
    } finally {
      setSavingId(null);
    }
  };

  const fetchCurrentLocation = (id) => {
    if (!navigator.geolocation) {
      alert('Geolocation browser me supported nahi hai.');
      return;
    }
    
    setGpsLoading((prev) => ({ ...prev, [id]: true }));
    
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          
          let readableLoc = data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          if (data.address) {
             const { road, suburb, city, town, village, state } = data.address;
             const localities = [road, suburb, city || town || village, state].filter(Boolean);
             if (localities.length > 0) readableLoc = localities.join(', ');
          }
          
          setField(id, 'currentLocation', readableLoc);
        } catch (err) {
          alert('Location decode fail ho gayi API issue ki wajah se.');
        } finally {
          setGpsLoading((prev) => ({ ...prev, [id]: false }));
        }
      },
      (err) => {
        let msg = 'GPS error occur hua.';
        if (err.code === 1) msg = 'Location permission denied. Site settings se location enable karein.';
        else if (err.code === 2) msg = 'Position unavailable. Check karein ki GPS on hai ya nahi.';
        else if (err.code === 3) msg = 'GPS timeout ho gaya. Signal weak ho sakta hai, dobara try karein.';
        
        alert(msg);
        setGpsLoading((prev) => ({ ...prev, [id]: false }));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const previewPlan = async (id) => {
    const logistics = logisticsForms[id] || {};
    if (!logistics.destinationState || !logistics.destinationCity) {
      alert('Destination state aur city dono fill karo');
      return;
    }
    const destLoc = `${logistics.destinationCity}, ${logistics.destinationState}`;

    try {
      setPlanningId(id);
      const res = await api.post(`/payment/logistics/${id}/preview`, {
        destinationLocation: destLoc,
        preferredVehicleType: logistics.preferredVehicleType
      });
      setPlans((prev) => ({ ...prev, [id]: res.data }));

      if (!logistics.selectedTransporterId && res.data?.matchedTransporters?.[0]?.transporterId) {
        setLogisticsField(id, 'selectedTransporterId', res.data.matchedTransporters[0].transporterId);
      }
      if (!logistics.slotDate && res.data?.availableSlots?.[0]?.slotDate) {
        setLogisticsField(id, 'slotDate', res.data.availableSlots[0].slotDate);
      }
      if (!logistics.slotLabel && res.data?.availableSlots?.[0]?.slotLabel) {
        setLogisticsField(id, 'slotLabel', res.data.availableSlots[0].slotLabel);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Logistics plan preview fail ho gaya');
    } finally {
      setPlanningId(null);
    }
  };

  const bookSlot = async (id) => {
    const logistics = logisticsForms[id] || {};
    const selectedPlan = plans[id];

    if (!logistics.destinationState || !logistics.destinationCity) {
      alert('Destination state aur city required hai');
      return;
    }
    const destLoc = `${logistics.destinationCity}, ${logistics.destinationState}`;

    if (!logistics.slotDate || !logistics.slotLabel) {
      alert('Delivery slot select karo');
      return;
    }

    const fallbackTransporterId = selectedPlan?.matchedTransporters?.[0]?.transporterId || '';

    try {
      setBookingId(id);
      await api.post(`/payment/logistics/${id}/book-slot`, {
        destinationLocation: destLoc,
        preferredVehicleType: logistics.preferredVehicleType,
        transporterId: logistics.selectedTransporterId || fallbackTransporterId,
        slotDate: logistics.slotDate,
        slotLabel: logistics.slotLabel
      });

      await fetchDeliveries();
      alert('Delivery slot booked successfully');
    } catch (err) {
      alert(err.response?.data?.message || 'Slot booking fail ho gaya');
    } finally {
      setBookingId(null);
    }
  };

  const badge = {
    PENDING_DISPATCH: { bg: 'rgba(5, 150, 105, 0.08)', color: '#059669', text: 'Bhejti Baaki (Pending)' },
    PICKUP_DISPATCHED: { bg: 'rgba(37, 99, 235, 0.08)', color: '#2563eb', text: 'Pickup Nikal Gaya' },
    IN_TRANSIT: { bg: 'rgba(217, 119, 6, 0.08)', color: '#d97706', text: 'Raste Mein (Transit)' },
    DELIVERED: { bg: 'rgba(13, 51, 25, 0.1)', color: 'var(--ft-forest)', text: 'Pahunch Gaya (Delivered)' }
  };

  const incomingDeliveries = deliveries.filter(d => d.toPhone === user.phone);
  const outgoingDeliveries = deliveries.filter(d => d.fromPhone === user.phone);

  const activeDeliveries = activeTab === 'incoming' ? incomingDeliveries : outgoingDeliveries;

  return (
    <div className="ft-page dashboard-wrapper">
      {/* ── TOP NAVIGATION ── */}
      <nav className="dashboard-nav glass">
        <div className="ft-container nav-content">
          <div className="nav-left">
            <button onClick={() => navigate('/dashboard')} className="back-circle-btn">
              <ChevronDown size={20} style={{ transform: 'rotate(90deg)' }} />
            </button>
            <div className="nav-brand">
              <span className="brand-dot"></span>
              <h1 className="nav-title">Dispatch & Logistics</h1>
            </div>
          </div>
          
          <div className="nav-tabs-container">
            <button 
              className={`nav-tab-btn ${activeTab === 'incoming' ? 'active' : ''}`}
              onClick={() => setActiveTab('incoming')}
            >
              <Inbox size={18} />
              <span>Incoming Lots</span>
              {incomingDeliveries.length > 0 && <span className="tab-count">{incomingDeliveries.length}</span>}
            </button>
            <button 
              className={`nav-tab-btn ${activeTab === 'outgoing' ? 'active' : ''}`}
              onClick={() => setActiveTab('outgoing')}
            >
              <Truck size={18} />
              <span>Retailer Dispatch</span>
              {outgoingDeliveries.length > 0 && <span className="tab-count">{outgoingDeliveries.length}</span>}
            </button>
          </div>

          <div className="nav-right">
            <div className="user-role-badge">{user.role} Control</div>
          </div>
        </div>
      </nav>

      <div className="ft-container main-content" style={{ paddingTop: '8.5rem' }}>
        {/* ── SUMMARY SECTION ── */}
        <div className="logistics-stats-grid animate-slide-up">
          <div className="stat-card premium">
            <div className="stat-icon-wrap"><Truck size={24} /></div>
            <div className="stat-info">
              <p className="stat-label">Total Shipments</p>
              <p className="stat-value">{activeDeliveries.length}</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrap yellow"><Clock size={24} /></div>
            <div className="stat-info">
              <p className="stat-label">In Transit</p>
              <p className="stat-value">{activeDeliveries.filter(d => d.deliveryStatus === 'IN_TRANSIT').length}</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrap green"><CheckCircle2 size={24} /></div>
            <div className="stat-info">
              <p className="stat-label">Successfully Delivered</p>
              <p className="stat-value">{activeDeliveries.filter(d => d.deliveryStatus === 'DELIVERED').length}</p>
            </div>
          </div>
        </div>

        {/* ── CONTENT FEED ── */}
        {loading ? (
          <div className="loading-state-full"><div className="ft-spinner-large" /></div>
        ) : activeDeliveries.length === 0 ? (
          <div className="empty-state-illust">
            <div className="illust-icon">🚚</div>
            <h3>{activeTab === 'incoming' ? 'Abhi koi incoming lots nahi hain' : 'Abhi koi dispatch orders nahi hain'}</h3>
            <p>Jaise hi koi naya payment verify hoga, vo yahan dikhega.</p>
            {activeTab === 'outgoing' && (
              <button 
                className="ft-btn ft-btn-primary" 
                style={{ marginTop: '1.5rem' }}
                onClick={() => navigate('/transfer')}
              >
                Create New Transfer Request
              </button>
            )}
          </div>
        ) : (
          <div className="logistics-list">
            {activeDeliveries.map((d, idx) => {
              const b = badge[d.deliveryStatus] || badge.PENDING_DISPATCH;
              const f = forms[d._id] || {};
              const lf = logisticsForms[d._id] || {};
              const plan = plans[d._id];
              const isExpanded = Boolean(expandedCards[d._id]);

              return (
                <div key={d._id} className="logistics-card animate-slide-up" style={{ animationDelay: `${idx * 0.1}s` }}>
                  <div className="card-top-main">
                    <div className="card-identity">
                      <div className="crop-avatar">
                        {d.produce?.cropType?.charAt(0) || 'P'}
                      </div>
                      <div className="identity-text">
                        <div className="lot-row">
                          <span className="lot-id">LOT #{d.produce?.lotCode || d.produceId.slice(-6).toUpperCase()}</span>
                          <span className="status-badge-premium" style={{ background: b.bg, color: b.color }}>
                            {b.text}
                          </span>
                        </div>
                        <h2 className="crop-title">{d.produce?.cropType || 'Special Produce'}</h2>
                      </div>
                    </div>
                    
                    <div className="card-summary-strip">
                      <div className="strip-item">
                        <Package size={14} />
                        <span>{d.produce?.quantity || 0} kg</span>
                      </div>
                      <div className="strip-item">
                        <MapPin size={14} />
                        <span>{d.destinationLocation || 'N/A'}</span>
                      </div>
                      <button 
                        className={`expand-btn ${isExpanded ? 'open' : ''}`}
                        onClick={() => setExpandedCards(prev => ({ ...prev, [d._id]: !prev[d._id] }))}
                      >
                        {isExpanded ? 'Kamm Karo' : 'Details Dekho'}
                        <ChevronDown size={16} />
                      </button>
                    </div>
                  </div>

                  {/* ── PROGRESS TRACKER ── */}
                  <div className="logistics-progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ 
                        width: d.deliveryStatus === 'DELIVERED' ? '100%' : 
                               d.deliveryStatus === 'IN_TRANSIT' ? '66%' : 
                               d.deliveryStatus === 'PICKUP_DISPATCHED' ? '33%' : '5%' 
                      }}
                    />
                    <div className="progress-markers">
                      <div className={`marker ${['PENDING_DISPATCH', 'PICKUP_DISPATCHED', 'IN_TRANSIT', 'DELIVERED'].includes(d.deliveryStatus) ? 'active' : ''}`}><span className="dot"></span><span className="label">Verification</span></div>
                      <div className={`marker ${['PICKUP_DISPATCHED', 'IN_TRANSIT', 'DELIVERED'].includes(d.deliveryStatus) ? 'active' : ''}`}><span className="dot"></span><span className="label">Pickup</span></div>
                      <div className={`marker ${['IN_TRANSIT', 'DELIVERED'].includes(d.deliveryStatus) ? 'active' : ''}`}><span className="dot"></span><span className="label">Transit</span></div>
                      <div className={`marker ${d.deliveryStatus === 'DELIVERED' ? 'active' : ''}`}><span className="dot"></span><span className="label">Delivered</span></div>
                    </div>
                  </div>

                  <div className="quick-info-grid">
                    <div className="q-info-item">
                      <User size={14} />
                      <div className="q-text">
                        <p className="q-label">{activeTab === 'incoming' ? 'Sender (Farmer)' : 'Receiver (Retailer)'}</p>
                        <p className="q-val">{activeTab === 'incoming' ? d.fromPhone : d.toPhone}</p>
                      </div>
                    </div>
                    <div className="q-info-item">
                      <Navigation size={14} />
                      <div className="q-text">
                        <p className="q-label">Current Location</p>
                        <p className="q-val">{d.currentLocation || 'Updating...'}</p>
                      </div>
                    </div>
                    <div className="q-info-item">
                      <Clock size={14} />
                      <div className="q-text">
                        <p className="q-label">ETA / Booking</p>
                        <p className="q-val">{d.deliverySlotLabel ? `${d.deliverySlotLabel}` : 'Not scheduled'}</p>
                      </div>
                    </div>
                    <div className="q-info-item">
                      <DollarSign size={14} />
                      <div className="q-text">
                        <p className="q-label">Freight Info</p>
                        <p className="q-val">{d.freightEstimateAmount ? `₹${d.freightEstimateAmount}` : 'Calculated on dispatch'}</p>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="expanded-control-panel animate-fade-in">
                      {d.canUpdate ? (
                        <div className="control-grid-premium">
                          {/* Segment 1: Plan */}
                          <div className="control-section-card">
                            <h3 className="section-card-title">1. Logistics Planning</h3>
                            <div className="ft-form-group">
                              <label className="ft-label-mini">Destination Delivery Area</label>
                              <StateCitySelector
                                stateValue={lf.destinationState || ''}
                                cityValue={lf.destinationCity || ''}
                                onStateChange={(state) => setLogisticsField(d._id, 'destinationState', state)}
                                onCityChange={(city) => setLogisticsField(d._id, 'destinationCity', city)}
                              />
                            </div>
                            <div className="ft-form-group mt-3">
                              <label className="ft-label-mini">Vehicle preference (Small/Large)</label>
                              <div className="input-with-icon-left">
                                <Truck size={16} />
                                <input
                                  className="ft-input-modern"
                                  placeholder="e.g. 10 Wheeler Truck"
                                  value={lf.preferredVehicleType || ''}
                                  onChange={(e) => setLogisticsField(d._id, 'preferredVehicleType', e.target.value)}
                                />
                              </div>
                            </div>
                            <button
                              className="ft-btn ft-btn-secondary ft-btn-full"
                              onClick={() => previewPlan(d._id)}
                              disabled={planningId === d._id}
                            >
                              {planningId === d._id ? 'Generating Plan...' : 'Preview Transporters & ETA'}
                            </button>

                            {plan && (
                              <div className="plan-results-area animate-slide-up">
                                <div className="route-header">
                                  <div className="point-dot"></div>
                                  <div className="route-line-visual"></div>
                                  <div className="point-dot end"></div>
                                  <span className="route-text">{plan.origin} → {plan.destination}</span>
                                </div>
                                <div className="transporter-selection">
                                  <label className="ft-label-mini">Choose Verified Carrier</label>
                                  <select
                                    className="ft-select-modern"
                                    value={lf.selectedTransporterId || ''}
                                    onChange={(e) => setLogisticsField(d._id, 'selectedTransporterId', e.target.value)}
                                  >
                                    {plan.matchedTransporters?.map((t) => (
                                      <option key={t.transporterId} value={t.transporterId}>
                                        {`${t.name} • ${t.vehicleType} • ${t.rating}★`}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="slot-grid mt-3">
                                  <div className="slot-col">
                                    <label className="ft-label-mini">Date</label>
                                    <select
                                      className="ft-select-modern"
                                      value={lf.slotDate || ''}
                                      onChange={(e) => setLogisticsField(d._id, 'slotDate', e.target.value)}
                                    >
                                      {Array.from(new Set((plan.availableSlots || []).map((slot) => slot.slotDate))).map((dateValue) => (
                                        <option key={dateValue} value={dateValue}>{dateValue}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="slot-col">
                                    <label className="ft-label-mini">Slot Window</label>
                                    <select
                                      className="ft-select-modern"
                                      value={lf.slotLabel || ''}
                                      onChange={(e) => setLogisticsField(d._id, 'slotLabel', e.target.value)}
                                    >
                                      {(plan.availableSlots || [])
                                        .filter((slot) => !lf.slotDate || slot.slotDate === lf.slotDate)
                                        .map((slot) => (
                                          <option key={slot.slotKey} value={slot.slotLabel}>{slot.slotLabel}</option>
                                        ))}
                                    </select>
                                  </div>
                                </div>
                                <button
                                  className="ft-btn ft-btn-primary ft-btn-full mt-4"
                                  onClick={() => bookSlot(d._id)}
                                  disabled={bookingId === d._id}
                                >
                                  {bookingId === d._id ? 'Confirming...' : 'Book Dispatch Slot'}
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Segment 2: Live Tracking Updates */}
                          <div className="control-section-card blue-tint">
                            <h3 className="section-card-title">2. Dispatch Monitoring</h3>
                            <div className="ft-form-group">
                              <label className="ft-label-mini">Real-time Status Update</label>
                              <select 
                                className="ft-select-modern" 
                                value={f.deliveryStatus || 'PENDING_DISPATCH'} 
                                onChange={(e) => setField(d._id, 'deliveryStatus', e.target.value)}
                              >
                                <option value="PENDING_DISPATCH">Pending Dispatch</option>
                                <option value="PICKUP_DISPATCHED">Pickup Dispatched</option>
                                <option value="IN_TRANSIT">In Transit</option>
                                <option value="DELIVERED">Delivered</option>
                              </select>
                            </div>
                            
                            <div className="form-info-row mt-3">
                              <div className="info-field">
                                <label className="ft-label-mini">Driver Contact</label>
                                <div className="input-with-icon-left">
                                  <Phone size={14} />
                                  <input 
                                    className="ft-input-modern" 
                                    placeholder="Number" 
                                    value={f.driverPhone || ''} 
                                    onChange={(e) => setField(d._id, 'driverPhone', e.target.value)} 
                                  />
                                </div>
                              </div>
                              <div className="info-field">
                                <label className="ft-label-mini">Vehicle No.</label>
                                <div className="input-with-icon-left">
                                  <Search size={14} />
                                  <input 
                                    className="ft-input-modern" 
                                    placeholder="Plate No." 
                                    value={f.vehicleNumber || ''} 
                                    onChange={(e) => setField(d._id, 'vehicleNumber', e.target.value)} 
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="ft-form-group mt-3">
                              <div className="label-with-action">
                                <label className="ft-label-mini">Current GPS Position</label>
                                <button 
                                  className="gps-refresh-action"
                                  onClick={() => fetchCurrentLocation(d._id)}
                                  disabled={gpsLoading[d._id]}
                                >
                                  {gpsLoading[d._id] ? 'Locating...' : 'Auto-Fetch Live loc 📍'}
                                </button>
                              </div>
                              <input 
                                className="ft-input-modern" 
                                value={f.currentLocation || ''} 
                                onChange={(e) => setField(d._id, 'currentLocation', e.target.value)} 
                                placeholder="Example: Near Highway 4, Pune"
                              />
                            </div>
                            
                            <div className="ft-form-group mt-3">
                              <label className="ft-label-mini">Receiver Update Note (Optional)</label>
                              <textarea 
                                className="ft-input-modern" 
                                style={{ minHeight: '80px', paddingTop: '0.75rem', resize: 'vertical' }}
                                value={f.deliveryRemarks || ''} 
                                onChange={(e) => setField(d._id, 'deliveryRemarks', e.target.value)} 
                                placeholder="Retailer ke liye koi khaas jaankari ya update..."
                              />
                            </div>

                            <button 
                              className="ft-btn ft-btn-primary ft-btn-full mt-4" 
                              onClick={() => save(d._id)} 
                              disabled={savingId === d._id}
                            >
                              {savingId === d._id ? 'Updating...' : 'Publish Status Update'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="read-only-logistics-view">
                          <div className="ro-alert">
                            <AlertCircle size={20} />
                            <p>Aap is shipment ko <strong>Track/Monitor</strong> kar rahe ho. Details sender dwara update ho rahi hain.</p>
                          </div>
                          <div className="ro-details-grid">
                            <div className="ro-item">
                              <span className="ro-label">Driver Details</span>
                              <span className="ro-val">{d.driverName || 'N/A'} • {d.driverPhone || 'Not shared'}</span>
                            </div>
                            <div className="ro-item">
                              <span className="ro-label">Expected Arrival</span>
                              <span className="ro-val">{d.expectedDeliveryTime ? new Date(d.expectedDeliveryTime).toLocaleString() : 'Processing...'}</span>
                            </div>
                            <div className="ro-item">
                              <span className="ro-label">Vehicle Identity</span>
                              <span className="ro-val">{d.vehicleNumber || 'Pending'} ({d.vehicleType || 'Any'})</span>
                            </div>
                            <div className="ro-item">
                              <span className="ro-label">Last Checked Point</span>
                              <span className="ro-val">📍 {d.currentLocation || 'Warehouse Junction'}</span>
                            </div>
                            {d.deliveryRemarks && (
                              <div className="ro-item full-width" style={{ gridColumn: '1 / -1', background: 'rgba(217, 119, 6, 0.05)', padding: '1.25rem', borderRadius: '16px', border: '1px dashed rgba(217, 119, 6, 0.3)', marginTop: '0.5rem' }}>
                                <span className="ro-label" style={{ color: '#d97706', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                                  <AlertCircle size={14} /> Distributor Update Note
                                </span>
                                <span className="ro-val" style={{ fontSize: '1rem', fontWeight: 800, color: '#92400e', fontStyle: 'italic', lineHeight: 1.4 }}>
                                  "{d.deliveryRemarks}"
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .dashboard-wrapper {
          background: #f8faf9;
          min-height: 100vh;
        }

        .dashboard-nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          padding: 1.25rem 0;
        }

        .nav-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 2rem;
        }

        .nav-left {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .back-circle-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 1.5px solid rgba(0,0,0,0.05);
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .back-circle-btn:hover {
          transform: translateX(-4px);
          background: var(--ft-bg);
        }

        .nav-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .brand-dot {
          width: 8px;
          height: 8px;
          background: var(--ft-forest);
          border-radius: 50%;
        }

        .nav-title {
          font-size: 1.5rem;
          font-weight: 950;
          color: var(--ft-forest);
          letter-spacing: -0.03em;
        }

        .nav-tabs-container {
          display: flex;
          background: var(--ft-bg);
          padding: 0.4rem;
          border-radius: 16px;
          gap: 0.25rem;
          border: 1px solid rgba(0,0,0,0.03);
        }

        .nav-tab-btn {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.65rem 1.25rem;
          border-radius: 12px;
          border: none;
          background: transparent;
          font-weight: 800;
          color: var(--ft-text-muted);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .nav-tab-btn.active {
          background: #fff;
          color: var(--ft-forest);
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }

        .tab-count {
          background: var(--ft-forest);
          color: #fff;
          font-size: 0.65rem;
          padding: 0.1rem 0.4rem;
          border-radius: 6px;
          min-width: 14px;
          text-align: center;
        }

        .logistics-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          margin-bottom: 3rem;
        }

        .stat-card {
          background: #fff;
          padding: 1.75rem;
          border-radius: 24px;
          display: flex;
          align-items: center;
          gap: 1.5rem;
          box-shadow: 0 8px 30px rgba(0,0,0,0.02);
          border: 1.5px solid rgba(0,0,0,0.01);
        }

        .stat-card.premium {
          background: var(--ft-forest);
          color: #fff;
        }

        .stat-icon-wrap {
          width: 54px;
          height: 54px;
          border-radius: 16px;
          background: var(--ft-bg);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--ft-forest);
        }

        .premium .stat-icon-wrap {
          background: rgba(255,255,255,0.15);
          color: #fff;
        }

        .stat-value {
          font-size: 2rem;
          font-weight: 950;
          letter-spacing: -0.02em;
        }

        .stat-label {
          font-size: 0.85rem;
          font-weight: 750;
          opacity: 0.8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .logistics-card {
          background: #fff;
          border-radius: 32px;
          padding: 2rem;
          margin-bottom: 2rem;
          box-shadow: 0 10px 40px rgba(0,0,0,0.02);
          border: 1.5px solid rgba(0,0,0,0.015);
        }

        .card-top-main {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 2rem;
          margin-bottom: 2rem;
        }

        .card-identity {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .crop-avatar {
          width: 64px;
          height: 64px;
          border-radius: 20px;
          background: linear-gradient(135deg, var(--ft-sage-light) 0%, #fff 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.75rem;
          font-weight: 950;
          color: var(--ft-forest);
          border: 1.5px solid rgba(0,0,0,0.03);
        }

        .lot-id {
          font-size: 0.75rem;
          font-weight: 900;
          color: var(--ft-text-muted);
          letter-spacing: 0.1em;
        }

        .crop-title {
          font-size: 1.5rem;
          font-weight: 950;
          color: var(--ft-forest);
          letter-spacing: -0.02em;
          margin-top: 0.25rem;
        }

        .card-summary-strip {
          display: flex;
          align-items: center;
          gap: 1.25rem;
          background: var(--ft-bg);
          padding: 0.75rem 1.5rem;
          border-radius: 16px;
        }

        .strip-item {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-size: 0.9rem;
          font-weight: 800;
          color: var(--ft-forest);
        }

        .logistics-progress-bar {
          position: relative;
          height: 6px;
          background: var(--ft-bg);
          border-radius: 10px;
          margin: 3rem 1.5rem;
        }

        .progress-fill {
          height: 100%;
          background: var(--ft-forest);
          border-radius: 10px;
          transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 0 15px rgba(13, 51, 25, 0.3);
        }

        .progress-markers {
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          transform: translateY(-50%);
          display: flex;
          justify-content: space-between;
        }

        .marker {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }

        .marker .dot {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #fff;
          border: 3px solid var(--ft-bg);
          transition: all 0.3s ease;
        }

        .marker.active .dot {
          background: var(--ft-forest);
          border-color: #fff;
          box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }

        .marker .label {
          font-size: 0.7rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--ft-text-muted);
        }

        .marker.active .label {
          color: var(--ft-forest);
        }

        .quick-info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1.5rem;
          padding-top: 2rem;
          border-top: 1.5px solid rgba(0,0,0,0.03);
        }

        .q-info-item {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
        }

        .q-label {
          font-size: 0.7rem;
          font-weight: 850;
          color: var(--ft-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .q-val {
          font-size: 1rem;
          font-weight: 900;
          color: var(--ft-text);
          margin-top: 0.15rem;
        }

        .expanded-control-panel {
          margin-top: 2.5rem;
          padding-top: 2.5rem;
          border-top: 2px dashed rgba(0,0,0,0.05);
        }

        .control-grid-premium {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
        }

        .control-section-card {
          background: #fcfdfc;
          border-radius: 24px;
          padding: 2rem;
          border: 1.5px solid rgba(0,0,0,0.03);
        }

        .control-section-card.blue-tint {
          background: #f9fbfc;
        }

        .section-card-title {
          font-size: 0.9rem;
          font-weight: 950;
          color: var(--ft-forest);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 2rem;
        }

        .ft-label-mini {
          font-size: 0.85rem;
          font-weight: 850;
          color: var(--ft-text);
          display: block;
          margin-bottom: 0.6rem;
        }

        .ft-input-modern, .ft-select-modern {
          width: 100%;
          padding: 0.9rem 1.25rem;
          border-radius: 14px;
          border: 1.5px solid transparent;
          background: #fff;
          font-size: 1rem;
          font-weight: 700;
          box-shadow: 0 4px 15px rgba(0,0,0,0.02);
          transition: all 0.2s ease;
        }

        .ft-input-modern:focus {
          border-color: var(--ft-forest);
          box-shadow: 0 10px 25px rgba(13, 51, 25, 0.08);
          outline: none;
        }

        .label-with-action {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .gps-refresh-action {
          background: transparent;
          border: none;
          color: var(--ft-forest);
          font-weight: 900;
          font-size: 0.75rem;
          cursor: pointer;
        }

        .status-badge-premium {
          padding: 0.35rem 1rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .loading-state-full {
          display: flex;
          justify-content: center;
          padding: 10rem 0;
        }

        .ro-alert {
          background: rgba(13, 51, 25, 0.05);
          padding: 1.25rem 2rem;
          border-radius: 16px;
          display: flex;
          align-items: center;
          gap: 1rem;
          color: var(--ft-forest);
          font-weight: 800;
          margin-bottom: 2rem;
        }

        .ro-details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
        }

        .ro-item {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .ro-label {
          font-size: 0.75rem;
          font-weight: 850;
          color: var(--ft-text-muted);
          text-transform: uppercase;
        }

        .ro-val {
          font-size: 1.1rem;
          font-weight: 900;
          color: var(--ft-forest);
        }

        @media (max-width: 1024px) {
          .control-grid-premium { grid-template-columns: 1fr; }
          .nav-content { flex-direction: column; gap: 1rem; }
        }
      `}</style>
    </div>
  );
}
