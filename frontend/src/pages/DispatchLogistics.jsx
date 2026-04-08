import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function DispatchLogistics() {
  const [deliveries, setDeliveries] = useState([]);
  const [forms, setForms] = useState({});
  const [logisticsForms, setLogisticsForms] = useState({});
  const [plans, setPlans] = useState({});
  const [planningId, setPlanningId] = useState(null);
  const [bookingId, setBookingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDeliveries();
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

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>← Dashboard</button>
        <h2 style={styles.title}>Dispatch & Delivery</h2>
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

          return (
            <div key={d._id} style={styles.card}>
              <div style={styles.cardHead}>
                <div>
                  <p style={styles.crop}>{d.produce?.cropType || 'Produce'}</p>
                  <p style={styles.info}>Lot: {d.produce?.lotCode || d.produceId}</p>
                  <p style={styles.info}>Qty: {d.produce?.quantity || 0} kg</p>
                </div>
                <span style={{ ...styles.status, background: b.bg, color: b.color }}>{b.text}</span>
              </div>

              <p style={styles.info}><strong>Source:</strong> {d.location || 'N/A'}</p>
              <p style={styles.info}><strong>Current:</strong> {d.currentLocation || 'N/A'}</p>
              <p style={styles.info}><strong>Destination:</strong> {d.destinationLocation || 'Not booked'}</p>
              <p style={styles.info}><strong>From:</strong> {d.fromPhone} | <strong>To:</strong> {d.toPhone}</p>
              <p style={styles.info}><strong>Route ETA:</strong> {formatEta(d.routeEtaMinutes)} | <strong>Distance:</strong> {d.routeDistanceKm ? `${d.routeDistanceKm} km` : 'N/A'}</p>
              <p style={styles.info}><strong>Freight Estimate:</strong> {formatCurrency(d.freightEstimateAmount, d.freightCurrency || 'INR')}</p>

              {matched && (
                <div style={styles.matchInfo}>
                  <p style={styles.matchTitle}>Matched Transporter</p>
                  <p style={styles.info}><strong>{matched.name}</strong> ({matched.transporterId})</p>
                  <p style={styles.info}>Phone: {matched.phone} | Vehicle: {matched.vehicleType}</p>
                </div>
              )}

              {deliverySlotBooked && (
                <div style={styles.slotInfo}>
                  Slot Booked: {new Date(d.deliverySlotDate).toLocaleDateString()} | {d.deliverySlotLabel}
                </div>
              )}

              {d.canUpdate ? (
                <div style={styles.form}>
                  <div style={styles.panelTitle}>Logistics Matching + ETA</div>

                  <label style={styles.label}>Destination Location</label>
                  <input
                    style={styles.input}
                    placeholder="e.g. Jaipur"
                    value={lf.destinationLocation || ''}
                    onChange={(e) => setLogisticsField(d._id, 'destinationLocation', e.target.value)}
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
                      <p style={styles.info}><strong>Estimated Route:</strong> {plan.origin} → {plan.destination}</p>
                      <p style={styles.info}><strong>ETA:</strong> {formatEta(plan.route?.etaMinutes)} | <strong>Distance:</strong> {plan.route?.distanceKm || 0} km</p>
                      <p style={styles.info}><strong>Estimated Freight:</strong> {formatCurrency(plan.freight?.amount, plan.freight?.currency || 'INR')}</p>

                      <label style={styles.label}>Select Transporter</label>
                      <select
                        style={styles.input}
                        value={lf.selectedTransporterId || ''}
                        onChange={(e) => setLogisticsField(d._id, 'selectedTransporterId', e.target.value)}
                      >
                        {plan.matchedTransporters?.map((t) => (
                          <option key={t.transporterId} value={t.transporterId}>
                            {`${t.name} | ${t.vehicleType} | ${t.rating}★ | ETA ${t.pickupEtaMinutes}m`}
                          </option>
                        ))}
                      </select>

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

                      <button
                        style={styles.bookBtn}
                        onClick={() => bookSlot(d._id)}
                        disabled={bookingId === d._id}
                      >
                        {bookingId === d._id ? 'Booking...' : 'Book Delivery Slot'}
                      </button>
                    </div>
                  )}

                  <div style={styles.panelTitle}>Dispatch Tracking Updates</div>

                  <label style={styles.label}>Status</label>
                  <select style={styles.input} value={f.deliveryStatus || 'PENDING_DISPATCH'} onChange={(e) => setField(d._id, 'deliveryStatus', e.target.value)}>
                    <option value="PENDING_DISPATCH">Pending Dispatch</option>
                    <option value="PICKUP_DISPATCHED">Pickup Dispatched</option>
                    <option value="IN_TRANSIT">In Transit</option>
                    <option value="DELIVERED">Delivered</option>
                  </select>

                  <label style={styles.label}>Driver Name</label>
                  <input style={styles.input} value={f.driverName || ''} onChange={(e) => setField(d._id, 'driverName', e.target.value)} />

                  <label style={styles.label}>Driver Phone</label>
                  <input style={styles.input} value={f.driverPhone || ''} onChange={(e) => setField(d._id, 'driverPhone', e.target.value)} />

                  <label style={styles.label}>Vehicle Number</label>
                  <input style={styles.input} value={f.vehicleNumber || ''} onChange={(e) => setField(d._id, 'vehicleNumber', e.target.value)} />

                  <label style={styles.label}>Vehicle Type</label>
                  <input style={styles.input} value={f.vehicleType || ''} onChange={(e) => setField(d._id, 'vehicleType', e.target.value)} />

                  <label style={styles.label}>Current Location</label>
                  <input style={styles.input} value={f.currentLocation || ''} onChange={(e) => setField(d._id, 'currentLocation', e.target.value)} />

                  <label style={styles.label}>Expected Delivery Time</label>
                  <input type="datetime-local" style={styles.input} value={f.expectedDeliveryTime || ''} onChange={(e) => setField(d._id, 'expectedDeliveryTime', e.target.value)} />

                  <button style={styles.saveBtn} onClick={() => save(d._id)} disabled={savingId === d._id}>
                    {savingId === d._id ? 'Saving...' : 'Update Dispatch'}
                  </button>
                </div>
              ) : (
                <p style={styles.readOnly}>Aap read-only mode me ho. Dispatch sender update karega.</p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #f6f9f4 0%, #edf5ea 100%)', padding: '1rem' },
  header: { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', background: '#fff', border: '1px solid #dbe5d8', borderRadius: '12px', padding: '0.9rem 1rem' },
  backBtn: { background: 'none', border: 'none', color: '#27500A', cursor: 'pointer', padding: 0 },
  title: { margin: 0, color: '#1f3320' },
  empty: { background: '#fff', border: '1px solid #dbe5d8', borderRadius: '12px', padding: '1rem', color: '#55655d' },
  card: { background: '#fff', border: '1px solid #dbe5d8', borderRadius: '12px', padding: '1rem', marginBottom: '0.8rem' },
  cardHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' },
  crop: { margin: 0, color: '#2a3b31', fontWeight: 700 },
  status: { fontSize: '0.76rem', fontWeight: 700, borderRadius: '999px', padding: '0.2rem 0.6rem' },
  info: { margin: '0.2rem 0', color: '#55655d', fontSize: '0.86rem' },
  form: { marginTop: '0.7rem', borderTop: '1px dashed #dbe5d8', paddingTop: '0.7rem' },
  panelTitle: { margin: '0.6rem 0 0.35rem', color: '#234126', fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' },
  label: { display: 'block', margin: '0.35rem 0 0.2rem', color: '#3f5346', fontWeight: 700, fontSize: '0.8rem' },
  input: { width: '100%', boxSizing: 'border-box', border: '1px solid #d3dfd0', borderRadius: '8px', padding: '0.52rem 0.6rem', background: '#fbfdfb', fontSize: '0.85rem' },
  previewBtn: { marginTop: '0.7rem', width: '100%', border: '1px solid #27500A', borderRadius: '9px', background: '#fff', color: '#27500A', padding: '0.68rem', fontWeight: 700, cursor: 'pointer' },
  planBox: { marginTop: '0.65rem', background: '#f6fbf4', border: '1px solid #d8e8d3', borderRadius: '9px', padding: '0.6rem' },
  bookBtn: { marginTop: '0.7rem', width: '100%', border: 'none', borderRadius: '9px', background: '#2f5d0c', color: '#fff', padding: '0.68rem', fontWeight: 700, cursor: 'pointer' },
  saveBtn: { marginTop: '0.7rem', width: '100%', border: 'none', borderRadius: '9px', background: '#27500A', color: '#fff', padding: '0.68rem', fontWeight: 700, cursor: 'pointer' },
  readOnly: { marginTop: '0.6rem', color: '#6a7388', fontSize: '0.82rem' },
  matchInfo: { marginTop: '0.55rem', background: '#eef6ea', border: '1px solid #d4e7cd', borderRadius: '8px', padding: '0.55rem' },
  matchTitle: { margin: '0 0 0.2rem', color: '#1d3a1b', fontSize: '0.8rem', fontWeight: 700 },
  slotInfo: { marginTop: '0.45rem', fontSize: '0.8rem', color: '#1d3a1b', background: '#e9f4e4', border: '1px solid #d4e7cd', borderRadius: '8px', padding: '0.45rem 0.55rem', fontWeight: 700 }
};
