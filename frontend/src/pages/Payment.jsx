import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { track } from '../lib/posthog';
import RouteMap from '../components/RouteMap';

const getRazorpayKeyId = () => {
  if (typeof window !== 'undefined' && window.__FARMTRACE_CONFIG__?.REACT_APP_RAZORPAY_KEY_ID) {
    return window.__FARMTRACE_CONFIG__.REACT_APP_RAZORPAY_KEY_ID;
  }
  return process.env.REACT_APP_RAZORPAY_KEY_ID;
};

const getApiErrorMessage = (err, fallback) => {
  return err?.response?.data?.message || err?.message || fallback;
};

const VEHICLE_OPTIONS = [
  'Pickup Van',
  'Mini Truck',
  'Medium Truck',
  'Heavy Truck',
  'Reefer Truck',
  'Tractor Trolley',
];

function RouteCostPanel({ transfer }) {
  const [destination, setDestination] = useState('');
  const [vehicleType, setVehicleType] = useState('Mini Truck');
  const [routeData, setRouteData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const origin = transfer.location || transfer.produce?.origin || '';

  const fetchRoute = async () => {
    if (!destination.trim()) {
      toast.error('Destination city daalo');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/market/route-cost', {
        params: { from: origin, to: destination.trim(), vehicleType }
      });
      setRouteData(res.data);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Route nahi mila';
      setError(msg);
      if (err?.response?.data?.availableCities) {
        setError(msg + '. Available cities: ' + err.response.data.availableCities.slice(0, 8).join(', ') + '...');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.routePanel}>
      <h4 style={s.routeTitle}>🗺️ Rasta & Transport Lagat</h4>

      <div style={s.routeRow}>
        <div style={s.routeField}>
          <label style={s.routeLabel}>Mool (Origin)</label>
          <div style={s.routeOriginBox}>{origin || 'N/A'}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: '1.2rem', paddingTop: '1.4rem' }}>→</div>
        <div style={s.routeField}>
          <label style={s.routeLabel}>Manzil (Destination)</label>
          <input
            type="text"
            placeholder="e.g. mumbai"
            value={destination}
            onChange={e => setDestination(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchRoute()}
            style={s.routeInput}
          />
        </div>
      </div>

      <div style={s.routeRow}>
        <div style={s.routeField}>
          <label style={s.routeLabel}>Gaadi ka Prakar</label>
          <select value={vehicleType} onChange={e => setVehicleType(e.target.value)} style={s.routeSelect}>
            {VEHICLE_OPTIONS.map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
        <button
          onClick={fetchRoute}
          disabled={loading || !origin}
          style={{ ...s.calcBtn, alignSelf: 'flex-end' }}
        >
          {loading ? 'Dhundh raha hai...' : '📍 Rasta Dekho'}
        </button>
      </div>

      {error && (
        <div style={s.errorBox}>{error}</div>
      )}

      {routeData && (
        <div style={s.resultBox}>
          {/* Map */}
          <RouteMap routeData={routeData} style={{ marginBottom: '1rem' }} />

          {/* Route summary */}
          <div style={s.summaryGrid}>
            <div style={s.summaryCard}>
              <span style={s.summaryIcon}>📏</span>
              <span style={s.summaryValue}>{routeData.route.distanceKm} km</span>
              <span style={s.summaryLabel}>Doori</span>
            </div>
            <div style={s.summaryCard}>
              <span style={s.summaryIcon}>⏱️</span>
              <span style={s.summaryValue}>{routeData.route.durationHours}</span>
              <span style={s.summaryLabel}>Aanuma Samay</span>
            </div>
            <div style={s.summaryCard}>
              <span style={s.summaryIcon}>{routeData.transport.fuelType === 'petrol' ? '⛽' : '🛢️'}</span>
              <span style={s.summaryValue}>₹{routeData.fuelPrices[routeData.transport.fuelType]}/L</span>
              <span style={s.summaryLabel}>{routeData.transport.fuelType === 'diesel' ? 'Diesel' : 'Petrol'} Aaj Ka Bhaav</span>
            </div>
            <div style={s.summaryCard}>
              <span style={s.summaryIcon}>💧</span>
              <span style={s.summaryValue}>{routeData.transport.litersNeeded}L</span>
              <span style={s.summaryLabel}>Indhan Chahiye</span>
            </div>
          </div>

          {/* Cost breakdown */}
          <div style={s.breakdownBox}>
            <h5 style={s.breakdownTitle}>Lagat ka Hisaab ({routeData.transport.vehicleType})</h5>
            {routeData.transport.breakdown.map((item, i) => (
              <div key={i} style={s.breakdownRow}>
                <span style={{ color: '#54645b', fontSize: '0.88rem' }}>{item.label}</span>
                <span style={{ fontWeight: 600, color: '#1f3320' }}>₹{item.amount.toLocaleString('en-IN')}</span>
              </div>
            ))}
            <div style={{ height: 1, background: '#dbe5d8', margin: '0.5rem 0' }} />
            <div style={{ ...s.breakdownRow, fontWeight: 700, fontSize: '1rem' }}>
              <span style={{ color: '#1f3320' }}>Kul Transport Lagat</span>
              <span style={{ color: '#27500A' }}>₹{routeData.transport.totalTransportCost.toLocaleString('en-IN')}</span>
            </div>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#888' }}>
              {routeData.route.source === 'haversine' ? '⚠️ Aanuma distance (real route map uplabdh nahi)' : `✅ Route: ${routeData.route.source}`} · Fuel bhaav: {routeData.fuelPrices.asOf}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Payment() {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState(null);
  const [expandedRoute, setExpandedRoute] = useState(null);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    try {
      const res = await api.get('/payment/pending');
      setPendingRequests(res.data);
    } catch (err) {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (transfer) => {
    setPayingId(transfer._id);
    try {
      const orderRes = await api.post('/payment/create-order', { transferId: transfer._id });
      const { orderId, amount, produce, razorpayKeyId: serverRazorpayKeyId } = orderRes.data;
      const razorpayKeyId = serverRazorpayKeyId || getRazorpayKeyId();

      console.log('🚀 Razorpay Order Created:', { orderId, amount, key: razorpayKeyId });

      if (!razorpayKeyId) throw new Error('Razorpay key missing.');
      if (!window.Razorpay) throw new Error('Razorpay SDK load nahi hua.');

      const options = {
        key: razorpayKeyId,
        amount: Math.round(amount),
        currency: 'INR',
        name: 'FarmTrace',
        description: `${produce.cropType} — ${produce.origin} (Booking Amount)`,
        order_id: orderId,
        handler: async (response) => {
          try {
            const verifyRes = await api.post('/payment/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              transferId: transfer._id
            });

            if (verifyRes.data.success) {
              track('payment_verified', { transferId: transfer._id, cropType: produce?.cropType });
              const jobId = verifyRes.data.jobId;
              if (jobId) {
                const toastId = toast.loading('Writing to Blockchain...');
                const checkJob = setInterval(async () => {
                  try {
                    const jobRes = await api.get(`/jobs/${jobId}`);
                    if (jobRes.data.state === 'completed') {
                      clearInterval(checkJob);
                      const tx = jobRes.data.result?.txHash || 'Verified';
                      toast.success(`✅ Done! Booking ho gayi!\nTX: ${tx.slice(0, 20)}...`, { id: toastId });
                      fetchPending();
                      navigate('/dashboard');
                    } else if (jobRes.data.state === 'failed') {
                      clearInterval(checkJob);
                      toast.error(`Blockchain failed: ${jobRes.data.failedReason || 'Unknown error'}`, { id: toastId });
                      fetchPending();
                      navigate('/dashboard');
                    }
                  } catch (e) {
                    clearInterval(checkJob);
                    toast.error('Network error checking job status', { id: toastId });
                    fetchPending();
                    navigate('/dashboard');
                  }
                }, 2000);
              } else {
                toast.success('Booking ho gayi!');
                fetchPending();
                navigate('/dashboard');
              }
            }
          } catch (err) {
            toast.error('Payment verify nahi hua: ' + getApiErrorMessage(err, 'Verification failed'));
            setPayingId(null);
          }
        },
        prefill: { contact: user.phone },
        theme: { color: '#27500A' },
        modal: { ondismiss: () => setPayingId(null) }
      };

      const rzp = new window.Razorpay(options);
      track('razorpay_opened', { transferId: transfer._id, cropType: produce?.cropType, amount });
      rzp.open();
    } catch (err) {
      toast.error('Payment shuru nahi hua: ' + getApiErrorMessage(err, 'Checkout start failed'));
      setPayingId(null);
    }
  };

  return (
    <div style={s.container}>
      <div style={s.header}>
        <button onClick={() => navigate('/dashboard')} style={s.backBtn}>← Dashboard</button>
        <h2 style={s.title}>Pending Payment Requests</h2>
      </div>

      {loading ? (
        <p style={s.loading}>Load ho raha hai...</p>
      ) : pendingRequests.length === 0 ? (
        <div style={s.empty}>
          <p>Koi pending request nahi hai</p>
          <p style={{ fontSize: '0.85rem', color: '#888' }}>Jab farmer transfer request bhejega tab yahan dikhega</p>
        </div>
      ) : (
        <div style={s.grid}>
          {pendingRequests.map(t => (
            <div key={t._id}>
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <h3 style={s.cropName}>{t.produce?.cropType}</h3>
                  <span style={s.pendingBadge}>Payment Pending</span>
                </div>

                <p style={s.detail}>Kisan: {t.produce?.farmerName}</p>
                <p style={s.detail}>Mool: {t.produce?.origin}</p>
                <p style={s.detail}>Maatra: {t.produce?.quantity} kg</p>
                <p style={s.detail}>Grade: {t.produce?.qualityGrade}</p>
                <p style={s.detail}>From: {t.fromPhone}</p>
                <p style={s.detail}>Location: {t.location}</p>

                <div style={s.priceBox}>
                  <div>
                    <p style={s.priceLabel}>Price per kg</p>
                    <p style={s.price}>₹{t.price}/kg</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={s.priceLabel}>Total amount</p>
                    <p style={s.totalPrice}>₹{(t.price * (t.produce?.quantity || 0)).toLocaleString()}</p>
                  </div>
                </div>

                <div style={s.milestoneBox}>
                  <h4 style={{ margin: '0 0 0.7rem', color: '#27500A', fontSize: '0.95rem' }}>Milestone Payments:</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <div style={s.milestoneItem}>
                      <p style={{ margin: '0 0 0.2rem', color: '#666', fontSize: '0.75rem' }}>Booking (40%)</p>
                      <p style={{ margin: 0, color: '#27500A', fontWeight: 'bold' }}>₹{Math.round((t.price * (t.produce?.quantity || 0)) * 0.40).toLocaleString()}</p>
                    </div>
                    <div style={s.milestoneItem}>
                      <p style={{ margin: '0 0 0.2rem', color: '#666', fontSize: '0.75rem' }}>Dispatch (30%)</p>
                      <p style={{ margin: 0, color: '#888' }}>₹{Math.round((t.price * (t.produce?.quantity || 0)) * 0.30).toLocaleString()}</p>
                    </div>
                    <div style={s.milestoneItem}>
                      <p style={{ margin: '0 0 0.2rem', color: '#666', fontSize: '0.75rem' }}>Delivery (30%)</p>
                      <p style={{ margin: 0, color: '#888' }}>₹{((t.price * (t.produce?.quantity || 0)) - Math.round((t.price * (t.produce?.quantity || 0)) * 0.40) - Math.round((t.price * (t.produce?.quantity || 0)) * 0.30)).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Route toggle button */}
                <button
                  onClick={() => setExpandedRoute(expandedRoute === t._id ? null : t._id)}
                  style={s.routeToggleBtn}
                >
                  {expandedRoute === t._id ? '▲ Route band karo' : '🗺️ Rasta & Transport Lagat dekhein'}
                </button>

                <button
                  onClick={() => handlePayment(t)}
                  style={s.payBtn}
                  disabled={payingId === t._id}
                >
                  {payingId === t._id ? 'Processing...' : `Pay Booking ₹${Math.round((t.price * (t.produce?.quantity || 0)) * 0.40).toLocaleString()}`}
                </button>
              </div>

              {/* Route panel — outside card so map z-index works */}
              {expandedRoute === t._id && (
                <RouteCostPanel transfer={t} key={`route-${t._id}`} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s = {
  container: { minHeight: '100vh', background: 'linear-gradient(180deg, #f6f9f4 0%, #edf5ea 100%)', padding: '1rem' },
  header: { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', background: '#fff', padding: '1rem 1.2rem', borderRadius: '14px', border: '1px solid #dbe5d8', boxShadow: '0 8px 22px rgba(26,44,33,0.08)' },
  backBtn: { background: 'none', border: 'none', color: '#27500A', cursor: 'pointer', fontSize: '0.9rem', padding: 0 },
  title: { color: '#1f3320', margin: 0, fontSize: '1.2rem' },
  loading: { textAlign: 'center', color: '#5f7167', marginTop: '2rem' },
  empty: { textAlign: 'center', color: '#5f7167', marginTop: '2.4rem', padding: '1.5rem', background: '#fff', borderRadius: '14px', border: '1px solid #dbe5d8' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' },
  card: { background: '#fff', padding: '1.2rem', borderRadius: '14px', border: '1px solid #dbe5d8', boxShadow: '0 8px 22px rgba(26,44,33,0.08)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  cropName: { margin: 0, color: '#1f3320', fontSize: '1.1rem' },
  pendingBadge: { background: '#fff1df', color: '#8b5318', padding: '0.25rem 0.7rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '700' },
  detail: { color: '#54645b', fontSize: '0.9rem', margin: '0.2rem 0' },
  priceBox: { display: 'flex', justifyContent: 'space-between', background: '#eef5e9', padding: '0.72rem', borderRadius: '10px', margin: '1rem 0', border: '1px solid #dbe5d8' },
  priceLabel: { color: '#61726a', fontSize: '0.75rem', margin: '0 0 0.25rem' },
  price: { color: '#27500A', fontWeight: 'bold', fontSize: '1rem', margin: 0 },
  totalPrice: { color: '#27500A', fontWeight: 'bold', fontSize: '1.1rem', margin: 0 },
  milestoneBox: { background: '#f8faf7', padding: '0.85rem', borderRadius: '10px', border: '1px solid #dbe5d8', margin: '1rem 0' },
  milestoneItem: { background: '#fff', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e5e5e5', textAlign: 'center' },
  routeToggleBtn: { width: '100%', padding: '0.6rem', background: '#eef5e9', color: '#27500A', border: '1.5px solid #c3ddb8', borderRadius: '10px', fontSize: '0.9rem', cursor: 'pointer', fontWeight: '600', marginBottom: '0.6rem' },
  payBtn: { width: '100%', padding: '0.78rem', background: '#27500A', color: 'white', border: 'none', borderRadius: '10px', fontSize: '0.97rem', cursor: 'pointer', fontWeight: '700' },

  // Route panel styles
  routePanel: { background: '#fff', border: '1.5px solid #c3ddb8', borderRadius: '14px', padding: '1.2rem', marginTop: '0.5rem', boxShadow: '0 4px 16px rgba(26,44,33,0.10)' },
  routeTitle: { margin: '0 0 1rem', color: '#1f3320', fontSize: '1rem', fontWeight: 700 },
  routeRow: { display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '0.75rem', flexWrap: 'wrap' },
  routeField: { flex: 1, minWidth: '120px' },
  routeLabel: { display: 'block', fontSize: '0.75rem', color: '#61726a', marginBottom: '0.3rem', fontWeight: 600 },
  routeOriginBox: { background: '#eef5e9', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #dbe5d8', fontSize: '0.9rem', color: '#1f3320', fontWeight: 600 },
  routeInput: { width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid #c3ddb8', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', background: '#fafffe' },
  routeSelect: { width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid #c3ddb8', fontSize: '0.9rem', outline: 'none', background: '#fafffe', cursor: 'pointer' },
  calcBtn: { padding: '0.55rem 1.2rem', background: '#27500A', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' },
  errorBox: { background: '#fff1f1', border: '1px solid #f8b4b4', borderRadius: '8px', padding: '0.6rem 0.8rem', color: '#c0392b', fontSize: '0.85rem', marginBottom: '0.75rem' },
  resultBox: { marginTop: '0.75rem' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' },
  summaryCard: { background: '#f6f9f4', border: '1px solid #dbe5d8', borderRadius: '10px', padding: '0.6rem 0.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' },
  summaryIcon: { fontSize: '1.2rem' },
  summaryValue: { fontWeight: 700, color: '#1f3320', fontSize: '0.9rem' },
  summaryLabel: { fontSize: '0.68rem', color: '#61726a' },
  breakdownBox: { background: '#f8faf7', border: '1px solid #dbe5d8', borderRadius: '10px', padding: '0.9rem' },
  breakdownTitle: { margin: '0 0 0.6rem', color: '#27500A', fontSize: '0.9rem', fontWeight: 700 },
  breakdownRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0' },
};
