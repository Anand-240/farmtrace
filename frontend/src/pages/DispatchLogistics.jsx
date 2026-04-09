import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import StateCitySelector from '../components/StateCitySelector';

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
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 980);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDeliveries();
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 980);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const fetchDeliveries = async () => {
    try {
      const res = await api.get('/api/payment/deliveries/my');
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
            : ''
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
      await api.put(`/api/payment/deliveries/${id}`, forms[id]);
      await fetchDeliveries();
    } catch (err) {
      alert(err.response?.data?.message || 'Dispatch update fail ho gaya');
    } finally {
      setSavingId(null);
    }
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
      const res = await api.post(`/api/payment/logistics/${id}/preview`, {
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
      await api.post(`/api/payment/logistics/${id}/book-slot`, {
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

  const formatCurrency = (value, currency = 'INR') => {
    try {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(Number(value || 0));
    } catch (_err) {
      return `₹${Number(value || 0).toLocaleString()}`;
    }
  };

  const formatEta = (minutes) => {
    const mins = Number(minutes || 0);
    if (!mins) return 'N/A';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (!h) return `${m} min`;
    return `${h}h ${m}m`;
  };

  const badge = {
    PENDING_DISPATCH: { bg: 'var(--ft-sage-light)', color: 'var(--ft-forest)', text: 'Pending Dispatch' },
    PICKUP_DISPATCHED: { bg: '#e8edff', color: '#2d3f9e', text: 'Pickup Dispatched' },
    IN_TRANSIT: { bg: '#ffeeda', color: '#8b5318', text: 'In Transit' },
    DELIVERED: { bg: 'var(--ft-white)', color: 'var(--ft-forest)', text: 'Delivered' }
  };

  const summary = useMemo(() => {
    const base = {
      total: deliveries.length,
      pending: 0,
      transit: 0,
      delivered: 0,
      slotBooked: 0
    };

    deliveries.forEach((d) => {
      if (d.deliveryStatus === 'DELIVERED') base.delivered += 1;
      else if (d.deliveryStatus === 'IN_TRANSIT') base.transit += 1;
      else base.pending += 1;
      if (d.deliverySlotDate && d.deliverySlotLabel) base.slotBooked += 1;
    });

    return base;
  }, [deliveries]);

  const toggleCard = (id) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const prettyDate = (value) => {
    if (!value) return 'Not set';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not set';
    return date.toLocaleString();
  };

  return (
    <div className="ft-page planetono-flow">
      <nav className="ft-top-nav glass">
        <div className="ft-container" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate('/dashboard')} className="ft-btn ft-btn-ghost ft-btn-sm" style={{ border: 'none', background: 'none' }}>
            ← Dashboard
          </button>
          <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>Dispatch & Logistics Control</span>
        </div>
      </nav>

      <div className="ft-container" style={{ paddingTop: '6rem', paddingBottom: '4rem' }}>

      <div style={styles.summaryGrid}>
        {[
          { label: 'Total Shipments', val: summary.total },
          { label: 'Pending Dispatch', val: summary.pending },
          { label: 'In Transit', val: summary.transit },
          { label: 'Delivered', val: summary.delivered },
          { label: 'Slots Booked', val: summary.slotBooked }
        ].map(s => (
          <div key={s.label} style={styles.summaryCard}>
            <p style={styles.summaryLabel}>{s.label}</p>
            <p style={styles.summaryValue}>{s.val}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={styles.empty}><div className="ft-spinner" style={{ margin: '0 auto' }} /></div>
      ) : deliveries.length === 0 ? (
        <div style={styles.empty}>
          Payment verified deliveries abhi available nahi hain.
        </div>
      ) : (
        deliveries.map((d, idx) => {
          const b = badge[d.deliveryStatus] || badge.PENDING_DISPATCH;
          const f = forms[d._id] || {};
          const lf = logisticsForms[d._id] || {};
          const plan = plans[d._id];

          const deliverySlotBooked = d.deliverySlotDate && d.deliverySlotLabel;
          const matched = d.matchedTransporter;
          const isExpanded = Boolean(expandedCards[d._id]);

          return (
            <div key={d._id} className="animate-slide-up" style={{ ...styles.card, animationDelay: `${idx * 0.05}s` }}>
              <div style={styles.cardHead}>
                <div style={{ flex: 1 }}>
                  <p style={styles.crop}>{d.produce?.cropType || 'Produce'}</p>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                    <p style={styles.info}>Lot: <strong>{d.produce?.lotCode || d.produceId}</strong></p>
                    <p style={styles.info}>Qty: <strong>{d.produce?.quantity || 0} kg</strong></p>
                  </div>
                </div>
                <div style={styles.cardHeadRight}>
                  <span style={{ ...styles.status, background: b.bg, color: b.color }}>{b.text}</span>
                  <button style={styles.toggleBtn} onClick={() => toggleCard(d._id)}>
                    {isExpanded ? 'Hide Details' : 'Show Details'}
                  </button>
                </div>
              </div>

              <div style={styles.quickStatsRow}>
                <div style={styles.quickStatChip}><span style={styles.quickStatKey}>ETA</span><span style={styles.quickStatVal}>{formatEta(d.routeEtaMinutes)}</span></div>
                <div style={styles.quickStatChip}><span style={styles.quickStatKey}>Distance</span><span style={styles.quickStatVal}>{d.routeDistanceKm ? `${d.routeDistanceKm} km` : 'N/A'}</span></div>
                <div style={styles.quickStatChip}><span style={styles.quickStatKey}>Freight</span><span style={styles.quickStatVal}>{formatCurrency(d.freightEstimateAmount, d.freightCurrency || 'INR')}</span></div>
                <div style={styles.quickStatChip}><span style={styles.quickStatKey}>Slot</span><span style={styles.quickStatVal}>{deliverySlotBooked ? '✅ Booked' : '⏳ Pending'}</span></div>
              </div>

              <div style={styles.metaGrid}>
                <div style={styles.metaCell}><p style={styles.metaLabel}>Source</p><p style={styles.metaValue}>{d.location || 'N/A'}</p></div>
                <div style={styles.metaCell}><p style={styles.metaLabel}>Current</p><p style={styles.metaValue}>{d.currentLocation || 'N/A'}</p></div>
                <div style={styles.metaCell}><p style={styles.metaLabel}>Destination</p><p style={styles.metaValue}>{d.destinationLocation || 'Not booked'}</p></div>
                <div style={styles.metaCell}><p style={styles.metaLabel}>Exchange</p><p style={styles.metaValue}>{`${d.fromPhone.slice(-4)} → ${d.toPhone.slice(-4)}`}</p></div>
              </div>

              {matched && (
                <div style={styles.matchInfo}>
                  <p style={styles.matchTitle}>Matched Transporter</p>
                  <div style={styles.metaGrid}>
                    <div style={styles.metaCell}><p style={styles.metaLabel}>Name</p><p style={styles.metaValue}>{matched.name}</p></div>
                    <div style={styles.metaCell}><p style={styles.metaLabel}>ID</p><p style={styles.metaValue}>{matched.transporterId}</p></div>
                    <div style={styles.metaCell}><p style={styles.metaLabel}>Phone</p><p style={styles.metaValue}>{matched.phone}</p></div>
                    <div style={styles.metaCell}><p style={styles.metaLabel}>Vehicle</p><p style={styles.metaValue}>{matched.vehicleType}</p></div>
                  </div>
                </div>
              )}

              {deliverySlotBooked && (
                <div style={styles.slotInfo}>
                  Slot Booked: <strong>{prettyDate(d.deliverySlotDate).split(',')[0]}</strong> at <strong>{d.deliverySlotLabel}</strong>
                </div>
              )}

              {isExpanded && d.canUpdate ? (
                <div style={styles.form}>
                  <div style={styles.panelWrap(isMobile)}>
                    <div style={styles.sectionCard}>
                      <div style={styles.panelTitle}>1) Logistics Matching + ETA</div>

                      <label style={styles.label}>Destination Location / गंतव्य स्थान</label>
                      <div style={{ marginBottom: '1rem' }}>
                        <StateCitySelector
                          stateValue={lf.destinationState || ''}
                          cityValue={lf.destinationCity || ''}
                          onStateChange={(state) => setLogisticsField(d._id, 'destinationState', state)}
                          onCityChange={(city) => setLogisticsField(d._id, 'destinationCity', city)}
                        />
                      </div>

                      <label style={styles.label}>Preferred Vehicle</label>
                      <input
                        style={styles.input}
                        placeholder="e.g. Mini Truck"
                        value={lf.preferredVehicleType || ''}
                        onChange={(e) => setLogisticsField(d._id, 'preferredVehicleType', e.target.value)}
                      />

                      <button
                        className="ft-btn ft-btn-secondary ft-btn-full"
                        style={{ marginTop: '1rem' }}
                        onClick={() => previewPlan(d._id)}
                        disabled={planningId === d._id}
                      >
                        {planningId === d._id ? <div className="ft-spinner" /> : 'Preview Logistics Plan'}
                      </button>

                      {plan && (
                        <div style={styles.planBox}>
                          <p style={styles.metaLabel}>Estimated Route</p>
                          <p style={styles.planRoute}>{plan.origin} → {plan.destination}</p>
                          <div style={styles.quickStatsRow}>
                            <div style={styles.quickStatChip}><span style={styles.quickStatKey}>ETA</span><span style={styles.quickStatVal}>{formatEta(plan.route?.etaMinutes)}</span></div>
                            <div style={styles.quickStatChip}><span style={styles.quickStatKey}>Dist</span><span style={styles.quickStatVal}>{plan.route?.distanceKm || 0} km</span></div>
                            <div style={styles.quickStatChip}><span style={styles.quickStatKey}>Cost</span><span style={styles.quickStatVal}>{formatCurrency(plan.freight?.amount, plan.freight?.currency || 'INR')}</span></div>
                          </div>

                          <label style={styles.label}>Select Transporter</label>
                          <select
                            style={styles.input}
                            value={lf.selectedTransporterId || ''}
                            onChange={(e) => setLogisticsField(d._id, 'selectedTransporterId', e.target.value)}
                          >
                            {plan.matchedTransporters?.map((t) => (
                              <option key={t.transporterId} value={t.transporterId}>
                                {`${t.name} | ${t.vehicleType} | ${t.rating}★`}
                              </option>
                            ))}
                          </select>

                          <div style={styles.inlineFieldGrid(isMobile)}>
                            <div>
                              <label style={styles.label}>Date</label>
                              <select
                                style={styles.input}
                                value={lf.slotDate || ''}
                                onChange={(e) => setLogisticsField(d._id, 'slotDate', e.target.value)}
                              >
                                {Array.from(new Set((plan.availableSlots || []).map((slot) => slot.slotDate))).map((dateValue) => (
                                  <option key={dateValue} value={dateValue}>{dateValue}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label style={styles.label}>Slot Window</label>
                              <select
                                style={styles.input}
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
                            className="ft-btn ft-btn-primary ft-btn-full"
                            style={{ marginTop: '1rem' }}
                            onClick={() => bookSlot(d._id)}
                            disabled={bookingId === d._id}
                          >
                            {bookingId === d._id ? <div className="ft-spinner" /> : 'Book Delivery Slot'}
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={styles.sectionCard}>
                      <div style={styles.panelTitle}>2) Dispatch Tracking Updates</div>

                      <label style={styles.label}>Current Delivery Status</label>
                      <select style={styles.input} value={f.deliveryStatus || 'PENDING_DISPATCH'} onChange={(e) => setField(d._id, 'deliveryStatus', e.target.value)}>
                        <option value="PENDING_DISPATCH">Pending Dispatch</option>
                        <option value="PICKUP_DISPATCHED">Pickup Dispatched</option>
                        <option value="IN_TRANSIT">In Transit</option>
                        <option value="DELIVERED">Delivered</option>
                      </select>

                      <div style={styles.inlineFieldGrid(isMobile)}>
                        <div>
                          <label style={styles.label}>Driver Name</label>
                          <input style={styles.input} value={f.driverName || ''} onChange={(e) => setField(d._id, 'driverName', e.target.value)} />
                        </div>
                        <div>
                          <label style={styles.label}>Driver Phone</label>
                          <input style={styles.input} value={f.driverPhone || ''} onChange={(e) => setField(d._id, 'driverPhone', e.target.value)} />
                        </div>
                      </div>

                      <div style={styles.inlineFieldGrid(isMobile)}>
                        <div>
                          <label style={styles.label}>Vehicle Number</label>
                          <input style={styles.input} value={f.vehicleNumber || ''} onChange={(e) => setField(d._id, 'vehicleNumber', e.target.value)} />
                        </div>
                        <div>
                          <label style={styles.label}>Vehicle Type</label>
                          <input style={styles.input} value={f.vehicleType || ''} onChange={(e) => setField(d._id, 'vehicleType', e.target.value)} />
                        </div>
                      </div>

                      <div style={styles.inlineFieldGrid(isMobile)}>
                        <div style={{ flex: 1.5 }}>
                          <label style={styles.label}>Current Location</label>
                          <input
                            style={styles.input}
                            value={f.currentLocation || ''}
                            onChange={(e) => setField(d._id, 'currentLocation', e.target.value)}
                            placeholder="Current highway or city name"
                          />
                        </div>
                        <div>
                          <label style={styles.label}>Expected Delivery</label>
                          <input type="datetime-local" style={styles.input} value={f.expectedDeliveryTime || ''} onChange={(e) => setField(d._id, 'expectedDeliveryTime', e.target.value)} />
                        </div>
                      </div>

                      <button className="ft-btn ft-btn-primary ft-btn-full" style={{ marginTop: '1.25rem' }} onClick={() => save(d._id)} disabled={savingId === d._id}>
                        {savingId === d._id ? <div className="ft-spinner" /> : 'Update Dispatch Info'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                isExpanded && <p style={styles.readOnly}>ℹ️ Aap read-only mode me ho. Dispatch sender update karega.</p>
              )}
            </div>
          );
        })
      )}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: 'var(--ft-bg)', padding: '1.5rem', fontFamily: 'var(--ft-font-main)', color: 'var(--ft-text)' },
  header: { display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', border: '1px solid var(--ft-border)', borderRadius: 'var(--ft-radius-lg)', padding: '1.5rem', boxShadow: 'var(--ft-shadow-sm)', position: 'sticky', top: '1rem', zIndex: 10 },
  backBtn: { background: 'var(--ft-white)', border: '1px solid var(--ft-border)', color: 'var(--ft-forest)', cursor: 'pointer', padding: '0.6rem 1rem', borderRadius: '12px', fontWeight: 800, transition: 'var(--ft-transition)' },
  title: { margin: 0, color: 'var(--ft-forest)', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' },
  subTitle: { margin: '0.25rem 0 0', color: 'var(--ft-text-muted)', fontSize: '0.9rem' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' },
  summaryCard: { background: 'var(--ft-white)', border: '1px solid var(--ft-border)', borderRadius: 'var(--ft-radius)', padding: '1.25rem', boxShadow: 'var(--ft-shadow-sm)' },
  summaryLabel: { margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ft-text-muted)', fontWeight: 800 },
  summaryValue: { margin: '0.5rem 0 0', color: 'var(--ft-forest)', fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' },
  empty: { background: 'var(--ft-white)', border: '1px solid var(--ft-border)', borderRadius: 'var(--ft-radius)', padding: '3rem', textAlign: 'center', color: 'var(--ft-text-muted)', fontWeight: 600 },
  card: { background: 'var(--ft-white)', border: '1px solid var(--ft-border)', borderRadius: 'var(--ft-radius-lg)', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: 'var(--ft-shadow-sm)', transition: 'var(--ft-transition)' },
  cardHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.5rem', marginBottom: '1rem' },
  cardHeadRight: { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'flex-end' },
  toggleBtn: { border: '1.5px solid var(--ft-border)', background: 'var(--ft-white)', color: 'var(--ft-forest)', borderRadius: '12px', fontSize: '0.85rem', padding: '0.4rem 1rem', cursor: 'pointer', fontWeight: 800, transition: 'var(--ft-transition)' },
  crop: { margin: 0, color: 'var(--ft-forest)', fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.02em' },
  status: { fontSize: '0.7rem', fontWeight: 800, borderRadius: '999px', padding: '0.25rem 0.85rem', letterSpacing: '0.05em', textTransform: 'uppercase' },
  info: { margin: 0, color: 'var(--ft-text-muted)', fontSize: '0.9rem' },
  quickStatsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginTop: '1rem' },
  quickStatChip: { border: '1.5px solid var(--ft-border)', background: 'var(--ft-bg)', borderRadius: '12px', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', gap: '0.75rem' },
  quickStatKey: { color: 'var(--ft-text-muted)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' },
  quickStatVal: { color: 'var(--ft-forest)', fontSize: '0.9rem', fontWeight: 800 },
  metaGrid: { marginTop: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' },
  metaCell: { background: 'var(--ft-white)', border: '1px solid var(--ft-border)', borderRadius: '12px', padding: '1rem' },
  metaLabel: { margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ft-text-muted)', fontWeight: 800 },
  metaValue: { margin: '0.4rem 0 0', fontSize: '0.95rem', color: 'var(--ft-text)', fontWeight: 700 },
  form: { marginTop: '1.5rem', borderTop: '1px dashed var(--ft-border)', paddingTop: '1.5rem' },
  panelWrap: (isMobile) => ({ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.5rem' }),
  sectionCard: { border: '1.5px solid var(--ft-border)', background: 'var(--ft-bg)', borderRadius: 'var(--ft-radius-lg)', padding: '1.5rem' },
  panelTitle: { margin: '0 0 1.25rem', color: 'var(--ft-forest)', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', borderLeft: '3px solid var(--ft-forest)', paddingLeft: '0.75rem' },
  label: { display: 'block', margin: '0.75rem 0 0.4rem', color: 'var(--ft-text)', fontWeight: 700, fontSize: '0.85rem' },
  input: { width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--ft-border)', borderRadius: '12px', padding: '0.75rem 1rem', background: 'var(--ft-white)', fontSize: '0.95rem', color: 'var(--ft-text)', outline: 'none', transition: 'var(--ft-transition)' },
  inlineFieldGrid: (isMobile) => ({ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }),
  planBox: { marginTop: '1.25rem', background: 'var(--ft-white)', border: '1.5px solid var(--ft-border)', borderRadius: '16px', padding: '1.25rem', boxShadow: 'var(--ft-shadow-sm)' },
  planRoute: { margin: '0.25rem 0 1rem', color: 'var(--ft-forest)', fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em' },
  readOnly: { marginTop: '1rem', color: 'var(--ft-text-muted)', fontSize: '0.9rem', fontWeight: 600, textAlign: 'center', background: 'var(--ft-bg)', padding: '1rem', borderRadius: '12px' },
  matchInfo: { marginTop: '1.25rem', background: 'var(--ft-sage-light)', border: '1px solid var(--ft-border)', borderRadius: 'var(--ft-radius-lg)', padding: '1.5rem' },
  matchTitle: { margin: '0 0 0.75rem', color: 'var(--ft-forest)', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em' },
  slotInfo: { marginTop: '1rem', fontSize: '0.9rem', color: 'var(--ft-forest)', background: 'var(--ft-sage-light)', border: '1px solid var(--ft-border)', borderRadius: '12px', padding: '0.75rem 1rem', fontWeight: 600 }
};
