import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function DispatchLogistics() {
  const [deliveries, setDeliveries] = useState([]);
  const [forms, setForms] = useState({});
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
      res.data.forEach((d) => {
        next[d._id] = {
          deliveryStatus: d.deliveryStatus || 'PENDING_DISPATCH',
          driverName: d.driverName || '',
          driverPhone: d.driverPhone || '',
          vehicleNumber: d.vehicleNumber || '',
          vehicleType: d.vehicleType || '',
          currentLocation: d.currentLocation || d.location || '',
          expectedDeliveryTime: d.expectedDeliveryTime
            ? new Date(d.expectedDeliveryTime).toISOString().slice(0, 16)
            : ''
        };
      });
      setForms(next);
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
              <p style={styles.info}><strong>From:</strong> {d.fromPhone} | <strong>To:</strong> {d.toPhone}</p>

              {d.canUpdate ? (
                <div style={styles.form}>
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
  label: { display: 'block', margin: '0.35rem 0 0.2rem', color: '#3f5346', fontWeight: 700, fontSize: '0.8rem' },
  input: { width: '100%', boxSizing: 'border-box', border: '1px solid #d3dfd0', borderRadius: '8px', padding: '0.52rem 0.6rem', background: '#fbfdfb', fontSize: '0.85rem' },
  saveBtn: { marginTop: '0.7rem', width: '100%', border: 'none', borderRadius: '9px', background: '#27500A', color: '#fff', padding: '0.68rem', fontWeight: 700, cursor: 'pointer' },
  readOnly: { marginTop: '0.6rem', color: '#6a7388', fontSize: '0.82rem' }
};
