import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import LocationAutocompleteInput from '../components/LocationAutocompleteInput';
import { fullLocationSuggestions } from '../lib/locationSuggestions';

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
    if (!logistics.destinationLocation?.trim()) {
      alert('Destination location fill karo');
      return;
    }

    try {
      setPlanningId(id);
      const res = await api.post(`/api/payment/logistics/${id}/preview`, {
        destinationLocation: logistics.destinationLocation,
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

    if (!logistics.destinationLocation?.trim()) {
      alert('Destination location required hai');
      return;
    }
    if (!logistics.slotDate || !logistics.slotLabel) {
      alert('Delivery slot select karo');
      return;
    }

    const fallbackTransporterId = selectedPlan?.matchedTransporters?.[0]?.transporterId || '';

    try {
      setBookingId(id);
      await api.post(`/api/payment/logistics/${id}/book-slot`, {
        destinationLocation: logistics.destinationLocation,
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
    PENDING_DISPATCH: { bg: '#f0f2f7', color: '#414f66', text: 'Pending Dispatch' },
    PICKUP_DISPATCHED: { bg: '#e8edff', color: '#2d3f9e', text: 'Pickup Dispatched' },
    IN_TRANSIT: { bg: '#ffeeda', color: '#8b5318', text: 'In Transit' },
    DELIVERED: { bg: '#e1f5ee', color: '#085041', text: 'Delivered' }
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
    <div style={styles.page}>
      <div style={styles.header}>
        <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>← Dashboard</button>
        <div>
          <h2 style={styles.title}>Dispatch & Delivery Control Center</h2>
          <p style={styles.subTitle}>Shipment planning, slot booking, transporter assignment aur live dispatch tracking ek hi jagah.</p>
        </div>
      </div>

      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <p style={styles.summaryLabel}>Total Shipments</p>
          <p style={styles.summaryValue}>{summary.total}</p>
        </div>
        <div style={styles.summaryCard}>
          <p style={styles.summaryLabel}>Pending Dispatch</p>
          <p style={styles.summaryValue}>{summary.pending}</p>
        </div>
        <div style={styles.summaryCard}>
          <p style={styles.summaryLabel}>In Transit</p>
          <p style={styles.summaryValue}>{summary.transit}</p>
        </div>
        <div style={styles.summaryCard}>
          <p style={styles.summaryLabel}>Delivered</p>
          <p style={styles.summaryValue}>{summary.delivered}</p>
        </div>
        <div style={styles.summaryCard}>
          <p style={styles.summaryLabel}>Slots Booked</p>
          <p style={styles.summaryValue}>{summary.slotBooked}</p>
        </div>
      </div>

      {loading ? (
        <div style={styles.empty}>Load ho raha hai...</div>
      ) : deliveries.length === 0 ? (
        <div style={styles.empty}>
          Payment verified deliveries abhi available nahi hain.
        </div>
      ) : (
        deliveries.map((d) => {
          const b = badge[d.deliveryStatus] || badge.PENDING_DISPATCH;
          const f = forms[d._id] || {};
          const lf = logisticsForms[d._id] || {};
          const plan = plans[d._id];

          const deliverySlotBooked = d.deliverySlotDate && d.deliverySlotLabel;
          const matched = d.matchedTransporter;
          const isExpanded = Boolean(expandedCards[d._id]);

          return (
            <div key={d._id} style={styles.card}>
              <div style={styles.cardHead}>
                <div>
                  <p style={styles.crop}>{d.produce?.cropType || 'Produce'}</p>
                  <p style={styles.info}>Lot: {d.produce?.lotCode || d.produceId}</p>
                  <p style={styles.info}>Qty: {d.produce?.quantity || 0} kg</p>
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
                <div style={styles.quickStatChip}><span style={styles.quickStatKey}>Slot</span><span style={styles.quickStatVal}>{deliverySlotBooked ? 'Booked' : 'Pending'}</span></div>
              </div>

              <div style={styles.metaGrid}>
                <div style={styles.metaCell}><p style={styles.metaLabel}>Source</p><p style={styles.metaValue}>{d.location || 'N/A'}</p></div>
                <div style={styles.metaCell}><p style={styles.metaLabel}>Current</p><p style={styles.metaValue}>{d.currentLocation || 'N/A'}</p></div>
                <div style={styles.metaCell}><p style={styles.metaLabel}>Destination</p><p style={styles.metaValue}>{d.destinationLocation || 'Not booked'}</p></div>
                <div style={styles.metaCell}><p style={styles.metaLabel}>Counterparty</p><p style={styles.metaValue}>{`${d.fromPhone} → ${d.toPhone}`}</p></div>
              </div>

              {matched && (
                <div style={styles.matchInfo}>
                  <p style={styles.matchTitle}>Matched Transporter</p>
                  <div style={styles.metaGrid}>
                    <div style={styles.metaCell}><p style={styles.metaLabel}>Name</p><p style={styles.metaValue}>{matched.name}</p></div>
                    <div style={styles.metaCell}><p style={styles.metaLabel}>Transporter ID</p><p style={styles.metaValue}>{matched.transporterId}</p></div>
                    <div style={styles.metaCell}><p style={styles.metaLabel}>Phone</p><p style={styles.metaValue}>{matched.phone}</p></div>
                    <div style={styles.metaCell}><p style={styles.metaLabel}>Vehicle</p><p style={styles.metaValue}>{matched.vehicleType}</p></div>
                  </div>
                </div>
              )}

              {deliverySlotBooked && (
                <div style={styles.slotInfo}>
                  Slot Booked: {prettyDate(d.deliverySlotDate)} | {d.deliverySlotLabel}
                </div>
              )}

              {isExpanded && d.canUpdate ? (
                <div style={styles.form}>
                  <div style={styles.panelWrap(isMobile)}>
                    <div style={styles.sectionCard}>
                      <div style={styles.panelTitle}>1) Logistics Matching + ETA</div>

                      <label style={styles.label}>Destination Location</label>
                      <LocationAutocompleteInput
                        inputStyle={styles.input}
                        placeholder="e.g. Jaipur, Rajasthan"
                        value={lf.destinationLocation || ''}
                        onChange={(e) => setLogisticsField(d._id, 'destinationLocation', e.target.value)}
                        suggestions={fullLocationSuggestions}
                      />

                      <label style={styles.label}>Preferred Vehicle</label>
                      <input
                        style={styles.input}
                        placeholder="e.g. Mini Truck"
                        value={lf.preferredVehicleType || ''}
                        onChange={(e) => setLogisticsField(d._id, 'preferredVehicleType', e.target.value)}
                      />

                      <button
                        style={styles.previewBtn}
                        onClick={() => previewPlan(d._id)}
                        disabled={planningId === d._id}
                      >
                        {planningId === d._id ? 'Planning...' : 'Preview Logistics Plan'}
                      </button>

                      {plan && (
                        <div style={styles.planBox}>
                          <p style={styles.metaLabel}>Estimated Route</p>
                          <p style={styles.planRoute}>{plan.origin} → {plan.destination}</p>
                          <div style={styles.quickStatsRow}>
                            <div style={styles.quickStatChip}><span style={styles.quickStatKey}>ETA</span><span style={styles.quickStatVal}>{formatEta(plan.route?.etaMinutes)}</span></div>
                            <div style={styles.quickStatChip}><span style={styles.quickStatKey}>Distance</span><span style={styles.quickStatVal}>{plan.route?.distanceKm || 0} km</span></div>
                            <div style={styles.quickStatChip}><span style={styles.quickStatKey}>Freight</span><span style={styles.quickStatVal}>{formatCurrency(plan.freight?.amount, plan.freight?.currency || 'INR')}</span></div>
                          </div>

                          <label style={styles.label}>Select Transporter</label>
                          <select
                            style={styles.input}
                            value={lf.selectedTransporterId || ''}
                            onChange={(e) => setLogisticsField(d._id, 'selectedTransporterId', e.target.value)}
                          >
                            {plan.matchedTransporters?.map((t) => (
                              <option key={t.transporterId} value={t.transporterId}>
                                {`${t.name} | ${t.vehicleType} | ${t.rating}★ | Pickup ETA ${t.pickupEtaMinutes}m`}
                              </option>
                            ))}
                          </select>

                          <div style={styles.inlineFieldGrid(isMobile)}>
                            <div>
                              <label style={styles.label}>Delivery Slot Date</label>
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
                              <label style={styles.label}>Delivery Slot Window</label>
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
                            style={styles.bookBtn}
                            onClick={() => bookSlot(d._id)}
                            disabled={bookingId === d._id}
                          >
                            {bookingId === d._id ? 'Booking...' : 'Book Delivery Slot'}
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={styles.sectionCard}>
                      <div style={styles.panelTitle}>2) Dispatch Tracking Updates</div>

                      <label style={styles.label}>Status</label>
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
                        <div>
                          <label style={styles.label}>Current Location</label>
                          <LocationAutocompleteInput
                            inputStyle={styles.input}
                            value={f.currentLocation || ''}
                            onChange={(e) => setField(d._id, 'currentLocation', e.target.value)}
                            suggestions={fullLocationSuggestions}
                            placeholder="Current location"
                          />
                        </div>
                        <div>
                          <label style={styles.label}>Expected Delivery Time</label>
                          <input type="datetime-local" style={styles.input} value={f.expectedDeliveryTime || ''} onChange={(e) => setField(d._id, 'expectedDeliveryTime', e.target.value)} />
                        </div>
                      </div>

                      <button style={styles.saveBtn} onClick={() => save(d._id)} disabled={savingId === d._id}>
                        {savingId === d._id ? 'Saving...' : 'Update Dispatch'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                isExpanded && <p style={styles.readOnly}>Aap read-only mode me ho. Dispatch sender update karega.</p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: 'radial-gradient(circle at top right, #e9f5df 0%, #f6f9f4 36%, #edf5ea 100%)', padding: '1rem' },
  header: { display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.9rem', background: '#fff', border: '1px solid #dbe5d8', borderRadius: '14px', padding: '1rem 1.1rem', boxShadow: '0 10px 26px rgba(18, 45, 23, 0.07)' },
  backBtn: { background: '#f4faef', border: '1px solid #d2e8c4', color: '#27500A', cursor: 'pointer', padding: '0.45rem 0.7rem', borderRadius: '8px', fontWeight: 700 },
  title: { margin: 0, color: '#19331d', fontSize: '1.25rem', letterSpacing: '0.02em' },
  subTitle: { margin: '0.3rem 0 0', color: '#607266', fontSize: '0.88rem' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.6rem', marginBottom: '0.8rem' },
  summaryCard: { background: '#fff', border: '1px solid #dbe5d8', borderRadius: '12px', padding: '0.7rem 0.8rem', boxShadow: '0 5px 14px rgba(18, 45, 23, 0.05)' },
  summaryLabel: { margin: 0, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6a7c72', fontWeight: 700 },
  summaryValue: { margin: '0.28rem 0 0', color: '#18351e', fontSize: '1.15rem', fontWeight: 800 },
  empty: { background: '#fff', border: '1px solid #dbe5d8', borderRadius: '12px', padding: '1rem', color: '#55655d' },
  card: { background: '#fff', border: '1px solid #dbe5d8', borderRadius: '14px', padding: '1rem', marginBottom: '0.85rem', boxShadow: '0 9px 24px rgba(18, 45, 23, 0.05)' },
  cardHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.35rem' },
  cardHeadRight: { display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap', justifyContent: 'flex-end' },
  toggleBtn: { border: '1px solid #d3dfd0', background: '#fff', color: '#33473a', borderRadius: '999px', fontSize: '0.75rem', padding: '0.3rem 0.6rem', cursor: 'pointer', fontWeight: 700 },
  crop: { margin: 0, color: '#223a26', fontWeight: 800, fontSize: '1rem' },
  status: { fontSize: '0.73rem', fontWeight: 800, borderRadius: '999px', padding: '0.26rem 0.7rem', letterSpacing: '0.01em' },
  info: { margin: '0.2rem 0', color: '#55655d', fontSize: '0.86rem' },
  quickStatsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.45rem', marginTop: '0.45rem' },
  quickStatChip: { border: '1px solid #dcead4', background: '#f7fcf3', borderRadius: '9px', padding: '0.4rem 0.55rem', display: 'flex', justifyContent: 'space-between', gap: '0.6rem' },
  quickStatKey: { color: '#708277', fontSize: '0.73rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' },
  quickStatVal: { color: '#224225', fontSize: '0.83rem', fontWeight: 800 },
  metaGrid: { marginTop: '0.55rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.45rem' },
  metaCell: { background: '#f9fcf7', border: '1px solid #deead7', borderRadius: '9px', padding: '0.45rem 0.55rem' },
  metaLabel: { margin: 0, fontSize: '0.69rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#72857b', fontWeight: 700 },
  metaValue: { margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#263d2b', fontWeight: 700 },
  form: { marginTop: '0.8rem', borderTop: '1px dashed #dbe5d8', paddingTop: '0.8rem' },
  panelWrap: (isMobile) => ({ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.06fr 1fr', gap: '0.75rem' }),
  sectionCard: { border: '1px solid #dde9d6', background: '#fcfefb', borderRadius: '11px', padding: '0.7rem' },
  panelTitle: { margin: '0.1rem 0 0.5rem', color: '#234126', fontSize: '0.79rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' },
  label: { display: 'block', margin: '0.35rem 0 0.2rem', color: '#3f5346', fontWeight: 700, fontSize: '0.78rem' },
  input: { width: '100%', boxSizing: 'border-box', border: '1px solid #d3dfd0', borderRadius: '8px', padding: '0.52rem 0.6rem', background: '#fff', fontSize: '0.84rem', color: '#243a2a' },
  inlineFieldGrid: (isMobile) => ({ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.55rem' }),
  previewBtn: { marginTop: '0.7rem', width: '100%', border: '1px solid #27500A', borderRadius: '9px', background: '#fff', color: '#27500A', padding: '0.68rem', fontWeight: 800, cursor: 'pointer' },
  planBox: { marginTop: '0.65rem', background: '#f6fbf4', border: '1px solid #d8e8d3', borderRadius: '9px', padding: '0.6rem' },
  planRoute: { margin: '0.16rem 0 0.35rem', color: '#1f3d24', fontSize: '0.86rem', fontWeight: 800 },
  bookBtn: { marginTop: '0.7rem', width: '100%', border: 'none', borderRadius: '9px', background: '#2f5d0c', color: '#fff', padding: '0.68rem', fontWeight: 800, cursor: 'pointer' },
  saveBtn: { marginTop: '0.72rem', width: '100%', border: 'none', borderRadius: '9px', background: '#27500A', color: '#fff', padding: '0.68rem', fontWeight: 800, cursor: 'pointer' },
  readOnly: { marginTop: '0.6rem', color: '#6a7388', fontSize: '0.82rem', fontWeight: 700 },
  matchInfo: { marginTop: '0.6rem', background: '#eef6ea', border: '1px solid #d4e7cd', borderRadius: '10px', padding: '0.6rem' },
  matchTitle: { margin: '0 0 0.25rem', color: '#1d3a1b', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' },
  slotInfo: { marginTop: '0.5rem', fontSize: '0.8rem', color: '#1d3a1b', background: '#e9f4e4', border: '1px solid #d4e7cd', borderRadius: '8px', padding: '0.45rem 0.55rem', fontWeight: 700 }
};
