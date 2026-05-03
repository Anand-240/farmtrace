import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { State, City } from 'country-state-city';
import { ArrowLeft, IndianRupee, ShieldCheck, ChevronDown } from 'lucide-react';
import { track } from '../lib/posthog';

const CROP_EMOJIS = {
  wheat: '🌾', gehu: '🌾', rice: '🌾', dhaan: '🌾', paddy: '🌾',
  tomato: '🍅', tamatar: '🍅', potato: '🥔', aloo: '🥔',
  onion: '🧅', pyaaz: '🧅', apple: '🍎', seb: '🍎',
  cotton: '🪴', kapas: '🪴', mustard: '🌻', sarson: '🌻',
  sugarcane: '🎋', ganna: '🎋', corn: '🌽', maize: '🌽', makka: '🌽',
  mango: '🥭', aam: '🥭',
};

function getCropEmoji(cropType = '') {
  const key = cropType.toLowerCase().split(' ')[0];
  return CROP_EMOJIS[key] || '🌱';
}

export default function Register() {
  const [form, setForm] = useState({ farmerName: '', cropType: '', originState: '', originCity: '', quantity: '', qualityGrade: 'A', farmPrice: '' });
  
  // Get all Indian States
  const indianStates = useMemo(() => {
    return State.getStatesOfCountry('IN').sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  // Get all Cities for selected State
  const citiesForSelectedState = useMemo(() => {
    if (!form.originState) return [];
    const stateObj = indianStates.find(s => s.name === form.originState);
    if (!stateObj) return [];
    const cities = City.getCitiesOfState('IN', stateObj.isoCode);
    // Remove duplicates and sort
    return Array.from(new Set(cities.map(c => c.name))).sort((a,b) => a.localeCompare(b));
  }, [form.originState, indianStates]);

  const [cropOptions, setCropOptions] = useState([]);
  const [loadingCrops, setLoadingCrops] = useState(true);
  const [result, setResult] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mandiRates, setMandiRates] = useState([]);
  const [mandiLoading, setMandiLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    const fetchCrops = async () => {
      setLoadingCrops(true);
      try {
        const res = await api.get(`/market/commodities${form.originState ? `?state=${form.originState}` : ''}`);
        if (res.data && res.data.commodities) {
          const fetchedCrops = res.data.commodities.map(c => ({ 
            value: c.name, 
            floorPrice: Number(c.price),
            label: `${getCropEmoji(c.name)} ${c.name} (Floor: ₹${c.price}/kg)` 
          }));
          if (fetchedCrops.length > 0) {
            setCropOptions(fetchedCrops);
            // Only set default if nothing is selected or current selected is not in new list
            if (!form.cropType || !fetchedCrops.find(c => c.value === form.cropType)) {
              setForm(prev => ({ ...prev, cropType: fetchedCrops[0].value }));
            }
          }
        }
      } catch (err) {
        console.error('Failed to load mandi crops', err);
      } finally {
        setLoadingCrops(false);
      }
    };
    fetchCrops();
  }, [form.originState]);

  useEffect(() => {
    const loadMandi = async () => {
      if (!form.originState) return;
      setMandiLoading(true);
      try {
        const mandiRes = await api.get('/market/mandi', {
          params: {
            state: form.originState,
            limit: 6
          }
        });
        setMandiRates(mandiRes.data?.records || []);
      } catch (err) {
        console.error('Mandi API Error:', err);
      } finally {
        setMandiLoading(false);
      }
    };
    loadMandi();
  }, [form.originState]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('revealed'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [result]);

  const selectedCrop = cropOptions.find(c => c.value === form.cropType);
  const currentFloorPrice = selectedCrop ? selectedCrop.floorPrice : 0;
  
  const isFormComplete = form.originState && form.originCity && form.quantity && form.farmPrice && form.cropType;
  const isPriceValid = Number(form.farmPrice) >= currentFloorPrice;
  const isFormValid = isFormComplete && isPriceValid;

  const priceWarning = (form.farmPrice !== '' && !isPriceValid) 
    ? `Kisan samman portal! You cannot register below the Floor/MSP rate of ₹${currentFloorPrice.toFixed(2)}/kg.` 
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.cropType) {
      setError('Please select a valid Mandi crop before registering.');
      return;
    }

    if (!isFormValid) {
      return;
    }

    const submitOrigin = `${form.originCity}, ${form.originState}`;

    setLoading(true);
    try {
      const res = await api.post('/produce/register', { ...form, origin: submitOrigin, farmerName: form.farmerName || user.name, quantity: Number(form.quantity), farmPrice: Number(form.farmPrice) });
      const verifyUrl = `${window.location.origin}/verify/${res.data.produce._id}`;
      setQrDataUrl(verifyUrl);

      const jobId = res.data.jobId;
      if (jobId) {
        toast.promise(
          new Promise((resolve, reject) => {
            const checkJob = setInterval(async () => {
              try {
                const jobRes = await api.get(`/jobs/${jobId}`);
                if (jobRes.data.state === 'completed') {
                  clearInterval(checkJob);
                  setResult({ ...res.data.produce, txHash: jobRes.data.result?.transactionHash || 'Verified on Ledger' });
                  resolve();
                } else if (jobRes.data.state === 'failed') {
                  clearInterval(checkJob);
                  reject(new Error(jobRes.data.failedReason || 'Transaction failed'));
                }
              } catch (e) {
                clearInterval(checkJob);
                reject(e);
              }
            }, 2000);
          }),
          {
            loading: 'Writing to Blockchain...',
            success: '✅ Done',
            error: (err) => `Blockchain writing failed: ${err.message}`
          }
        );
      } else {
        setResult(res.data.produce);
        track('crop_registered', { cropType: form.cropType, grade: form.qualityGrade, origin: form.origin });
      }
    } catch (err) { setError('Registration failed. Check network.'); }
    finally { setLoading(false); }
  };

  if (result) {
    return (
      <div className="ft-page planetono-flow">
        <nav className="ft-top-nav glass">
          <div className="ft-container nav-flex">
            <button onClick={() => navigate('/dashboard')} className="ft-btn ft-btn-ghost ft-btn-sm"><ArrowLeft size={18} /> Home</button>
            <span className="nav-title">Smart Harvest Success</span>
            <div style={{ width: 80 }} />
          </div>
        </nav>

        <div className="ft-container" style={{ paddingTop: '5rem' }}>
          <div className="ft-anim-reveal" style={{ maxWidth: 800, margin: '0 auto' }}>
            <div className="ft-card" style={{ background: 'var(--ft-forest)', color: '#fff', border: 'none', textAlign: 'center', padding: '5rem 3rem', borderRadius: '48px' }}>
              <div className="ft-anim-float" style={{ fontSize: '5rem', marginBottom: '1.5rem' }}>✨</div>
              <h1 style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '1rem' }}>Fasli Suraksha Live</h1>
              <p style={{ opacity: 0.8, fontSize: '1.2rem', marginBottom: '3rem' }}>Your harvest is now an immutable asset on the blockchain.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                <div className="ft-card" style={{ background: '#fff', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#000' }}>
                  <QRCodeSVG value={qrDataUrl} size={200} style={{ borderRadius: '12px' }} />
                  <p className="ft-label" style={{ marginTop: '1.5rem' }}>Product Passport</p>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ background: 'rgba(255,255,255,0.1)', padding: '1.5rem', borderRadius: '24px', backdropFilter: 'blur(10px)' }}>
                    <ShieldCheck size={32} style={{ marginBottom: '1rem' }} />
                    <p className="ft-label" style={{ color: '#fff' }}>Transaction Hash</p>
                    <p style={{ wordBreak: 'break-all', fontSize: '0.8rem', opacity: 0.7, fontFamily: 'monospace', marginTop: '0.5rem' }}>{result.txHash}</p>
                    <a href={result.etherscanUrl} target="_blank" rel="noreferrer" className="ft-btn ft-btn-ghost ft-btn-full" style={{ marginTop: '1.5rem', color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}>Explore Ledger</a>
                  </div>
                </div>
              </div>
              <button onClick={() => navigate('/dashboard')} className="ft-btn ft-btn-primary ft-btn-full" style={{ background: '#fff', color: '#000', marginTop: '3rem', height: '64px' }}>Back to Command Center</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ft-page planetono-flow">
      <div className="giant-bg-text">REGISTER</div>
      <nav className="ft-top-nav glass">
        <div className="ft-container nav-flex">
          <button onClick={() => navigate('/dashboard')} className="ft-btn ft-btn-ghost ft-btn-sm"><ArrowLeft size={18} /> Dashboard</button>
          <span className="nav-title">Smart Registration</span>
          <div style={{ width: 80 }} />
        </div>
      </nav>

      <div className="ft-container" style={{ paddingTop: '3rem', paddingBottom: '6rem' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          
          <div className="ft-card" style={{ background: 'var(--ft-forest)', color: '#fff', border: 'none', marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
              <div className="ft-anim-float" style={{ fontSize: '4rem' }}>🚜</div>
              <div>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '0.25rem' }}>Harvest Narrative</h1>
                <p style={{ opacity: 0.8 }}>Start your produce's journey by anchoring it to the global supply chain Ledger.</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="ft-card" style={{ marginBottom: '2rem' }} data-reveal>
              <h3 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 900 }}>Produce Identity</h3>
              {error && <p style={{ color: 'var(--ft-error)', marginBottom: '1rem', fontWeight: 'bold' }}>{error}</p>}
              <div className="ft-input-group">
                <label className="ft-label">Kisan ka Naam / Farmer Identity</label>
                <input className="ft-input" placeholder={user.name} value={form.farmerName} onChange={e => setForm({...form, farmerName: e.target.value})} />
              </div>
              <div className="ft-input-group">
                <label className="ft-label">Crop Type (Via Live Govt Mandi API) / फसल चयन</label>
                {loadingCrops ? (
                  <div className="ft-loading-pulse" style={{ padding: '1rem', border: '1.5px solid var(--ft-border)', borderRadius: '12px' }}>
                    Fetching available live Mandi crops...
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <select className="ft-input" value={form.cropType} onChange={e => setForm({...form, cropType: e.target.value})} required style={{ appearance: 'none' }}>
                      {cropOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown style={{ position: 'absolute', right: '1.25rem', top: '1.2rem', opacity: 0.5, pointerEvents: 'none' }} size={20} />
                  </div>
                )}
              </div>
            </div>

            <div className="ft-card" style={{ marginBottom: '2rem' }} data-reveal>
              <h3 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 900 }}>Volume & Origin</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div className="ft-input-group" style={{ marginBottom: 0 }}>
                  <label className="ft-label">Origin Location / उत्पत्ति स्थान</label>
                  <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                    {/* State Selector */}
                    <div style={{ flex: 1, position: 'relative', zIndex: 100 }}>
                      <select
                        className="ft-input"
                        value={form.originState}
                        onChange={(e) => setForm({ ...form, originState: e.target.value, originCity: '' })}
                        required
                        style={{ width: '100%', cursor: 'pointer', pointerEvents: 'auto', position: 'relative', zIndex: 101 }}
                      >
                        <option value="" disabled>Select State / राज्य</option>
                        {indianStates.map(st => (
                          <option key={st.isoCode} value={st.name}>{st.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* City Selector */}
                    <div style={{ flex: 1, position: 'relative', zIndex: 100 }}>
                      <select
                        className="ft-input"
                        value={form.originCity}
                        onChange={(e) => setForm({ ...form, originCity: e.target.value })}
                        required
                        disabled={!form.originState}
                        style={{ width: '100%', opacity: !form.originState ? 0.6 : 1, cursor: form.originState ? 'pointer' : 'not-allowed', pointerEvents: 'auto', position: 'relative', zIndex: 101 }}
                      >
                        <option value="" disabled>{form.originState ? `Select City (${citiesForSelectedState.length} available)` : 'Select State First'}</option>
                        {citiesForSelectedState.map(ct => (
                          <option key={ct} value={ct}>{ct}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="ft-input-group" style={{ marginBottom: 0 }}>
                  <label className="ft-label">Quantity / मात्नी (KG)</label>
                  <input className="ft-input" type="number" placeholder="e.g. 500" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} required />
                </div>
              </div>
            </div>

            <div className="ft-card" style={{ marginBottom: '2rem' }} data-reveal>
              <h3 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 900 }}>Economic Anchoring</h3>
              <div className="ft-input-group">
                <label className="ft-label">Farm Gate Price (₹/KG)</label>
                <div style={{ position: 'relative' }}>
                  <IndianRupee size={20} style={{ position: 'absolute', left: '1.25rem', top: '1.15rem', opacity: 0.5 }} />
                  <input className="ft-input" style={{ paddingLeft: '3.5rem', borderColor: priceWarning ? 'var(--ft-error)' : 'var(--ft-border)' }} type="number" placeholder="15" value={form.farmPrice} onChange={e => setForm({...form, farmPrice: e.target.value})} required />
                </div>
                {priceWarning && (
                  <p style={{ color: 'var(--ft-error)', marginTop: '0.75rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
                    {priceWarning}
                  </p>
                )}
              </div>
              <button className="ft-btn ft-btn-primary ft-btn-full ft-btn-lg" type="submit" disabled={loading} style={{ height: '64px', fontSize: '1.1rem' }}>
              {loading ? <div className="ft-spinner" style={{ margin: '0 auto' }} /> : 'Register & Write to Blockchain'}
            </button>
          </form>
        </div>

        {/* ── LIVE MANDI WIDGET ── */}
        <div style={{ marginTop: '3rem' }} className="ft-anim-slide-up">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🌤️</span>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: 'var(--ft-forest)' }}>
              Live Mandi Rates: {form.originState || 'Select State'}
            </h3>
          </div>
          
          {mandiLoading ? (
            <div className="ft-card" style={{ padding: '2rem', textAlign: 'center' }}>
              <div className="ft-loading-pulse">Fetching latest government rates...</div>
            </div>
          ) : mandiRates.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {mandiRates.map((record, i) => (
                <div key={i} className="ft-card" style={{ padding: '1.25rem', border: '1.5px solid rgba(0,0,0,0.03)', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 900, color: 'var(--ft-forest)' }}>{record.commodity}</span>
                    <span style={{ fontWeight: 900, color: 'var(--ft-forest)' }}>₹{(record.modal_price / 100).toFixed(2)}/kg</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--ft-text-muted)', fontWeight: 600 }}>
                    📍 {record.market}, {record.state}
                  </div>
                </div>
              ))}
            </div>
          ) : form.originState ? (
            <div className="ft-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--ft-text-muted)' }}>
              Is rajya ke liye abhi live rates available nahi hain.
            </div>
          ) : (
            <div className="ft-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--ft-text-muted)' }}>
              Upar state select karein live rates dekhne ke liye.
            </div>
          )}
        </div>

      </div>
      <style>{`
        .active-crop-p { background: var(--ft-sage-light) !important; color: var(--ft-forest) !important; transform: scale(1.05); }
      `}</style>
    </div>
  );
}
