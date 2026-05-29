import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { track } from '../lib/posthog';
import RouteMap from '../components/RouteMap';

/* ─── helpers ────────────────────────────────────────────── */
const getRazorpayKeyId = () =>
  window.__FARMTRACE_CONFIG__?.REACT_APP_RAZORPAY_KEY_ID ||
  process.env.REACT_APP_RAZORPAY_KEY_ID;

const getApiErr = (err, fallback) =>
  err?.response?.data?.message || err?.message || fallback;

const VEHICLE_OPTIONS = ['Pickup Van','Mini Truck','Medium Truck','Heavy Truck','Reefer Truck','Tractor Trolley'];

function milestones(total, transferType) {
  if (transferType === 'DISTRIBUTOR_TO_RETAILER') {
    const b = Math.round(total * 0.20);
    return [{ label:'Booking', pct:'20%', amt:b, active:true }, { label:'Dispatch', pct:'0%', amt:0, active:false }, { label:'Delivery', pct:'80%', amt:total-b, active:false }];
  }
  if (transferType === 'RETAILER_TO_CONSUMER') {
    return [{ label:'Booking', pct:'100%', amt:total, active:true }, { label:'Dispatch', pct:'0%', amt:0, active:false }, { label:'Delivery', pct:'0%', amt:0, active:false }];
  }
  const b = Math.round(total * 0.40), d = Math.round(total * 0.30);
  return [{ label:'Booking', pct:'40%', amt:b, active:true }, { label:'Dispatch', pct:'30%', amt:d, active:false }, { label:'Delivery', pct:'30%', amt:total-b-d, active:false }];
}

/* ─── Route Panel ────────────────────────────────────────── */
function RouteCostPanel({ transfer, onClose }) {
  const [destination, setDestination] = useState('');
  const [vehicleType, setVehicleType] = useState('Mini Truck');
  const [routeData, setRouteData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const origin = transfer.location || '';

  const fetchRoute = async () => {
    if (!destination.trim()) return toast.error('Enter a destination city');
    setLoading(true); setError(null);
    try {
      const res = await api.get('/market/route-cost', { params: { from: origin, to: destination.trim(), vehicleType } });
      setRouteData(res.data);
    } catch (err) {
      let msg = err?.response?.data?.message || err?.message || 'Route not found';
      if (err?.response?.data?.availableCities) msg += '. Try: ' + err.response.data.availableCities.slice(0,6).join(', ');
      setError(msg);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:18, overflow:'hidden', marginTop:'1rem', boxShadow:'0 4px 24px rgba(0,0,0,.06)' }}>
      {/* Panel header */}
      <div style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between', background:'#fafbfc' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:'1rem' }}>🗺️</span>
          <span style={{ fontWeight:800, fontSize:'0.85rem', color:'#0f172a' }}>Route & Transport Cost</span>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:'1rem', padding:'2px 6px' }}>✕</button>
      </div>

      <div style={{ padding:'1.25rem' }}>
        {/* Inputs */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:'0.75rem', alignItems:'flex-end', marginBottom:'0.75rem' }}>
          <div>
            <label style={rLabel}>Origin</label>
            <div style={{ padding:'0.6rem 0.9rem', background:'#f1f5f9', borderRadius:9, border:'1px solid #e2e8f0', fontSize:'0.85rem', color:'#374151', fontWeight:600 }}>
              {origin || 'N/A'}
            </div>
          </div>
          <div style={{ paddingBottom:'0.5rem', color:'#94a3b8', fontSize:'1.2rem' }}>→</div>
          <div>
            <label style={rLabel}>Destination</label>
            <input placeholder="e.g. mumbai" value={destination} onChange={e => setDestination(e.target.value)} onKeyDown={e => e.key==='Enter' && fetchRoute()}
              style={{ width:'100%', padding:'0.6rem 0.9rem', borderRadius:9, border:'1.5px solid #e2e8f0', fontSize:'0.85rem', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }} />
          </div>
        </div>

        <div style={{ display:'flex', gap:'0.75rem', alignItems:'flex-end', marginBottom:'1rem' }}>
          <div style={{ flex:1 }}>
            <label style={rLabel}>Vehicle Type</label>
            <select value={vehicleType} onChange={e => setVehicleType(e.target.value)}
              style={{ width:'100%', padding:'0.6rem 0.9rem', borderRadius:9, border:'1.5px solid #e2e8f0', fontSize:'0.85rem', outline:'none', fontFamily:'inherit', background:'#fff' }}>
              {VEHICLE_OPTIONS.map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <button onClick={fetchRoute} disabled={loading || !origin}
            style={{ padding:'0.6rem 1.25rem', background:'#0d3319', color:'#fff', border:'none', borderRadius:9, fontWeight:700, fontSize:'0.82rem', cursor:loading ? 'wait' : 'pointer', whiteSpace:'nowrap' }}>
            {loading ? '…' : '📍 Calculate'}
          </button>
        </div>

        {error && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:9, padding:'0.75rem', color:'#dc2626', fontSize:'0.8rem', marginBottom:'0.75rem' }}>{error}</div>}

        {routeData && (
          <>
            <RouteMap routeData={routeData} style={{ marginBottom:'1rem' }} />
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.5rem', marginBottom:'0.75rem' }}>
              {[
                { icon:'📏', val:`${routeData.route.distanceKm} km`, label:'Distance' },
                { icon:'⏱️', val:routeData.route.durationHours, label:'Est. Time' },
                { icon:routeData.transport.fuelType==='petrol'?'⛽':'🛢️', val:`₹${routeData.fuelPrices[routeData.transport.fuelType]}/L`, label:'Fuel Rate' },
                { icon:'💧', val:`${routeData.transport.litersNeeded}L`, label:'Fuel Needed' },
              ].map(c => (
                <div key={c.label} style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'0.65rem 0.5rem', textAlign:'center' }}>
                  <div style={{ fontSize:'1.1rem' }}>{c.icon}</div>
                  <div style={{ fontWeight:800, fontSize:'0.82rem', color:'#0f172a', marginTop:2 }}>{c.val}</div>
                  <div style={{ fontSize:'0.65rem', color:'#94a3b8', marginTop:1 }}>{c.label}</div>
                </div>
              ))}
            </div>
            <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:12, padding:'0.875rem' }}>
              <p style={{ margin:'0 0 0.6rem', fontWeight:800, fontSize:'0.82rem', color:'#15803d' }}>Cost Breakdown — {routeData.transport.vehicleType}</p>
              {routeData.transport.breakdown.map((item,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'0.25rem 0', borderBottom:'1px solid rgba(0,0,0,.04)' }}>
                  <span style={{ fontSize:'0.8rem', color:'#64748b' }}>{item.label}</span>
                  <span style={{ fontSize:'0.82rem', fontWeight:700, color:'#0f172a' }}>₹{item.amount.toLocaleString('en-IN')}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:'0.5rem', paddingTop:'0.5rem', borderTop:'1.5px solid #bbf7d0' }}>
                <span style={{ fontWeight:800, color:'#15803d', fontSize:'0.85rem' }}>Total Transport Cost</span>
                <span style={{ fontWeight:900, color:'#15803d', fontSize:'1rem' }}>₹{routeData.transport.totalTransportCost.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function Payment() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [payingId, setPayingId] = useState(null);
  const [expandedRoute, setExpandedRoute] = useState(null);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const intervalsRef = useRef([]);

  useEffect(() => {
    fetchPending();
    return () => { intervalsRef.current.forEach(clearInterval); intervalsRef.current = []; };
  }, []);

  const fetchPending = async () => {
    try { const res = await api.get('/payment/pending'); setRequests(res.data); }
    catch { /* silent */ }
    finally { setLoading(false); }
  };

  const handlePayment = async (transfer) => {
    setPayingId(transfer._id);
    try {
      const orderRes = await api.post('/payment/create-order', { transferId: transfer._id });
      const { orderId, amount, produce, razorpayKeyId: srvKey } = orderRes.data;
      const key = srvKey || getRazorpayKeyId();
      if (!key) throw new Error('Razorpay key missing.');
      if (!window.Razorpay) throw new Error('Razorpay SDK not loaded.');

      const rzp = new window.Razorpay({
        key, amount: Math.round(amount), currency: 'INR',
        name: 'FarmTrace',
        description: `${produce.cropType} — Booking Amount`,
        order_id: orderId,
        handler: async (response) => {
          try {
            const vRes = await api.post('/payment/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              transferId: transfer._id,
            });
            if (vRes.data.success) {
              track('payment_verified', { transferId: transfer._id, cropType: produce?.cropType });
              const jobId = vRes.data.jobId;
              if (jobId) {
                const tid = toast.loading('Writing to Blockchain…');
                const check = setInterval(async () => {
                  try {
                    const jRes = await api.get(`/jobs/${jobId}`);
                    if (jRes.data.state === 'completed') {
                      clearInterval(check); intervalsRef.current = intervalsRef.current.filter(i => i !== check);
                      toast.success(`Booking confirmed! TX: ${(jRes.data.result?.txHash||'').slice(0,20)}…`, { id: tid });
                      fetchPending(); navigate('/dashboard');
                    } else if (jRes.data.state === 'failed') {
                      clearInterval(check); intervalsRef.current = intervalsRef.current.filter(i => i !== check);
                      toast.error(`Blockchain failed: ${jRes.data.failedReason||'Unknown'}`, { id: tid });
                      fetchPending(); navigate('/dashboard');
                    }
                  } catch { clearInterval(check); toast.error('Network error', { id: tid }); fetchPending(); navigate('/dashboard'); }
                }, 2000);
                intervalsRef.current.push(check);
              } else { toast.success('Booking confirmed!'); fetchPending(); navigate('/dashboard'); }
            }
          } catch (err) { toast.error('Verification failed: ' + getApiErr(err, 'Please retry')); setPayingId(null); }
        },
        prefill: { contact: user.phone },
        theme: { color: '#0d3319' },
        modal: { ondismiss: () => setPayingId(null) },
      });
      track('razorpay_opened', { transferId: transfer._id, cropType: produce?.cropType, amount });
      rzp.open();
    } catch (err) { toast.error('Payment failed: ' + getApiErr(err, 'Checkout error')); setPayingId(null); }
  };

  return (
    <div style={{ minHeight:'100vh', background:'#f1f5f9', fontFamily:"'Outfit',sans-serif" }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .pay-card { transition: box-shadow .2s; }
        .pay-card:hover { box-shadow: 0 8px 40px rgba(13,51,25,.12) !important; }
        .pay-route-btn:hover { background:#e8f5e9 !important; border-color:#0d3319 !important; color:#0d3319 !important; }
        .pay-cta:hover:not(:disabled) { background:linear-gradient(135deg,#0d3319,#1e5c30) !important; transform:translateY(-1px); box-shadow:0 8px 24px rgba(13,51,25,.35) !important; }
      `}</style>

      {/* ── Nav ── */}
      <nav style={{ position:'sticky', top:0, zIndex:100, background:'rgba(255,255,255,.96)', backdropFilter:'blur(20px)', borderBottom:'1px solid #e2e8f0', padding:'0 1.5rem', height:58, display:'flex', alignItems:'center', gap:'1rem' }}>
        <button onClick={() => navigate('/dashboard')} style={{ display:'flex', alignItems:'center', gap:6, background:'#f8fafc', border:'1px solid #e2e8f0', color:'#374151', padding:'6px 14px', borderRadius:8, fontWeight:700, fontSize:'0.8rem', cursor:'pointer' }}>
          ← Dashboard
        </button>
        <div style={{ flex:1, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontWeight:800, fontSize:'0.95rem', color:'#0f172a' }}>Pending Payment Requests</span>
          {!loading && requests.length > 0 && (
            <span style={{ background:'#0d3319', color:'#fff', borderRadius:999, fontSize:'0.68rem', fontWeight:800, padding:'2px 9px' }}>{requests.length}</span>
          )}
        </div>
      </nav>

      <div style={{ maxWidth:1100, margin:'0 auto', padding:'2rem 1.5rem 5rem' }}>

        {/* ── Loading ── */}
        {loading && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(360px,1fr))', gap:'1.25rem' }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ height:420, borderRadius:20, background:'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)', backgroundSize:'200% 100%', animation:'shimmer 1.5s infinite' }} />
            ))}
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && requests.length === 0 && (
          <div style={{ textAlign:'center', padding:'5rem 2rem', background:'#fff', borderRadius:20, border:'1px solid #e2e8f0', boxShadow:'0 2px 12px rgba(0,0,0,.04)' }}>
            <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>📭</div>
            <h3 style={{ margin:'0 0 0.5rem', color:'#0f172a' }}>No Pending Requests</h3>
            <p style={{ color:'#64748b', maxWidth:320, margin:'0 auto', lineHeight:1.6 }}>When a farmer sends you a transfer request, it will appear here for payment.</p>
          </div>
        )}

        {/* ── Cards ── */}
        {!loading && requests.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(380px,1fr))', gap:'1.5rem' }}>
            {requests.map((t, idx) => {
              const total      = t.price * (t.produce?.quantity || 0);
              const ms         = milestones(total, t.transferType);
              const bookingAmt = ms[0].amt;
              const isPaying   = payingId === t._id;
              const routeOpen  = expandedRoute === t._id;

              return (
                <div key={t._id} style={{ animation:`fadeUp .35s ease both`, animationDelay:`${idx*0.07}s` }}>
                  <div className="pay-card" style={{ background:'#fff', borderRadius:20, border:'1px solid #e2e8f0', boxShadow:'0 2px 16px rgba(0,0,0,.05)', overflow:'hidden' }}>

                    {/* ── Card Header Banner ── */}
                    <div style={{ background:'linear-gradient(135deg,#0d3319,#1a5e30)', padding:'1.25rem 1.5rem', position:'relative', overflow:'hidden' }}>
                      <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(circle at 80% 20%, rgba(255,255,255,.08) 0%, transparent 55%)' }} />
                      <div style={{ position:'relative', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                        <div>
                          <h3 style={{ margin:0, fontSize:'1.4rem', fontWeight:900, color:'#fff', letterSpacing:'-0.03em' }}>
                            {t.produce?.cropType || 'Produce'}
                          </h3>
                          <p style={{ margin:'4px 0 0', fontSize:'0.78rem', color:'rgba(255,255,255,.65)', fontWeight:600 }}>
                            {t.transferType?.replace(/_/g,' ') || 'Transfer Request'}
                          </p>
                        </div>
                        <span style={{ background:'rgba(255,255,255,.15)', color:'#fde68a', border:'1px solid rgba(253,230,138,.3)', padding:'4px 12px', borderRadius:999, fontSize:'0.68rem', fontWeight:800, letterSpacing:'0.05em', backdropFilter:'blur(4px)' }}>
                          ⏳ PENDING
                        </span>
                      </div>

                      {/* Total amount */}
                      <div style={{ marginTop:'1rem', display:'flex', alignItems:'baseline', gap:6 }}>
                        <span style={{ fontSize:'0.72rem', color:'rgba(255,255,255,.55)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Total Value</span>
                        <span style={{ fontSize:'1.6rem', fontWeight:900, color:'#fff', letterSpacing:'-0.03em' }}>₹{total.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* ── Info Grid ── */}
                    <div style={{ padding:'1.25rem 1.5rem', borderBottom:'1px solid #f1f5f9' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
                        {[
                          { icon:'👨‍🌾', label:'Farmer',   val: t.produce?.farmerName || '—' },
                          { icon:'📱', label:'Contact',  val: t.fromPhone },
                          { icon:'⚖️', label:'Quantity', val: `${t.produce?.quantity || '—'} kg` },
                          { icon:'🏅', label:'Grade',    val: t.produce?.qualityGrade || '—' },
                          { icon:'📍', label:'Origin',   val: t.produce?.origin || t.location || '—' },
                          { icon:'🏙️', label:'Location', val: t.location || '—' },
                        ].map(row => (
                          <div key={row.label} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                            <span style={{ fontSize:'0.9rem', marginTop:1, flexShrink:0 }}>{row.icon}</span>
                            <div style={{ minWidth:0 }}>
                              <p style={{ margin:0, fontSize:'0.65rem', color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{row.label}</p>
                              <p style={{ margin:0, fontSize:'0.82rem', color:'#374151', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.val}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ── Price Row ── */}
                    <div style={{ padding:'1rem 1.5rem', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8fafc' }}>
                      <div>
                        <p style={{ margin:0, fontSize:'0.65rem', color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>Price per kg</p>
                        <p style={{ margin:'2px 0 0', fontSize:'1.15rem', fontWeight:900, color:'#0d3319' }}>₹{t.price}<span style={{ fontSize:'0.75rem', fontWeight:600, color:'#64748b' }}>/kg</span></p>
                      </div>
                      <div style={{ width:1, height:36, background:'#e2e8f0' }} />
                      <div style={{ textAlign:'right' }}>
                        <p style={{ margin:0, fontSize:'0.65rem', color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>Quantity</p>
                        <p style={{ margin:'2px 0 0', fontSize:'1.15rem', fontWeight:900, color:'#0d3319' }}>{t.produce?.quantity || 0}<span style={{ fontSize:'0.75rem', fontWeight:600, color:'#64748b' }}> kg</span></p>
                      </div>
                    </div>

                    {/* ── Milestone Steps ── */}
                    <div style={{ padding:'1.25rem 1.5rem', borderBottom:'1px solid #f1f5f9' }}>
                      <p style={{ margin:'0 0 0.875rem', fontSize:'0.7rem', fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.07em' }}>Payment Milestones</p>
                      <div style={{ display:'flex', position:'relative' }}>
                        {ms.map((m, i) => (
                          <div key={m.label} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', position:'relative' }}>
                            {i < ms.length - 1 && (
                              <div style={{ position:'absolute', top:14, left:'50%', right:'-50%', height:2, background: m.active ? '#0d3319' : '#e2e8f0', zIndex:0 }} />
                            )}
                            <div style={{ width:28, height:28, borderRadius:'50%', zIndex:1, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem', fontWeight:900, background: m.active ? '#0d3319' : m.amt === 0 ? '#e2e8f0' : '#f1f5f9', color: m.active ? '#fff' : '#94a3b8', border:`2px solid ${m.active ? '#0d3319' : '#e2e8f0'}` }}>
                              {m.active ? '✓' : m.amt === 0 ? '—' : i+1}
                            </div>
                            <p style={{ margin:'5px 0 1px', fontSize:'0.62rem', fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.04em', textAlign:'center' }}>{m.label}</p>
                            <p style={{ margin:0, fontSize:'0.75rem', fontWeight:800, color: m.active ? '#0d3319' : m.amt === 0 ? '#cbd5e1' : '#64748b', textAlign:'center' }}>
                              {m.amt === 0 ? 'N/A' : `₹${m.amt.toLocaleString()}`}
                            </p>
                            <span style={{ marginTop:2, fontSize:'0.58rem', fontWeight:700, color: m.active ? '#15803d' : '#94a3b8' }}>{m.pct}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ── Actions ── */}
                    <div style={{ padding:'1.25rem 1.5rem', display:'flex', flexDirection:'column', gap:'0.625rem' }}>
                      <button className="pay-route-btn"
                        onClick={() => setExpandedRoute(routeOpen ? null : t._id)}
                        style={{ width:'100%', padding:'0.65rem', background:'#f8fafc', border:'1.5px solid #e2e8f0', borderRadius:12, fontSize:'0.82rem', fontWeight:700, cursor:'pointer', color:'#374151', display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all .2s' }}>
                        {routeOpen ? '✕ Close Route' : '🗺️ View Route & Transport Cost'}
                      </button>

                      <button className="pay-cta"
                        onClick={() => handlePayment(t)}
                        disabled={isPaying}
                        style={{ width:'100%', padding:'0.875rem', background:'linear-gradient(135deg,#0d3319 0%,#1a4a26 100%)', color:'#fff', border:'none', borderRadius:12, fontWeight:800, fontSize:'0.9rem', cursor: isPaying ? 'wait' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'0 4px 18px rgba(13,51,25,.25)', transition:'all .2s', opacity: isPaying ? 0.75 : 1 }}>
                        {isPaying
                          ? <><span style={{ width:16, height:16, borderRadius:'50%', border:'2.5px solid rgba(255,255,255,.35)', borderTopColor:'#fff', animation:'spin .7s linear infinite', display:'inline-block' }} /> Processing…</>
                          : <><span style={{ fontSize:'1rem' }}>💳</span> Pay Booking — ₹{bookingAmt.toLocaleString()}</>
                        }
                      </button>

                      <p style={{ margin:0, textAlign:'center', fontSize:'0.7rem', color:'#94a3b8', lineHeight:1.4 }}>
                        Remaining ₹{(total - bookingAmt).toLocaleString()} released in milestones after dispatch & delivery
                      </p>
                    </div>
                  </div>

                  {/* Route panel below card */}
                  {routeOpen && <RouteCostPanel transfer={t} onClose={() => setExpandedRoute(null)} key={`route-${t._id}`} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const rLabel = { display:'block', fontSize:'0.72rem', fontWeight:700, color:'#64748b', marginBottom:5, letterSpacing:'0.04em' };
