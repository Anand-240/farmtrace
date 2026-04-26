import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useNotification } from '../context/NotificationContext';
import { getMandiFloorForProduce } from '../lib/market';
import LocationAutocompleteInput from '../components/LocationAutocompleteInput';
import { fullLocationSuggestions } from '../lib/locationSuggestions';

export default function Transfer() {
  const { showNotification } = useNotification();
  const [produceId, setProduceId] = useState('');
  const [produce, setProduce] = useState(null);

  const [showSplitForm, setShowSplitForm] = useState(false);
  const [splitQuantity, setSplitQuantity] = useState('');
  const [splitError, setSplitError] = useState('');
  const [splitLoading, setSplitLoading] = useState(false);
  const [splitResult, setSplitResult] = useState(null);

  const [form, setForm] = useState({
    toEmail: '',
    price: '',
    location: '',
    transferType: 'FARM_TO_DISTRIBUTOR'
  });
  const [transferLotId, setTransferLotId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [transferProduceDetails, setTransferProduceDetails] = useState(null);
  const [marketFloor, setMarketFloor] = useState(null);
  const [priceError, setPriceError] = useState('');
  const [marketLoading, setMarketLoading] = useState(false);

  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const getDefaultTransferType = () => {
    if (user.role === 'FARMER') return 'FARM_TO_DISTRIBUTOR';
    if (user.role === 'DISTRIBUTOR') return 'DISTRIBUTOR_TO_RETAILER';
    return 'RETAILER_TO_CONSUMER';
  };

  const fetchProduce = async () => {
    if (!produceId.trim()) { setError('ID daalo pehle'); return; }
    try {
      setError(''); setPriceError(''); setSplitError(''); setSplitResult(null); setShowSplitForm(false); setSplitQuantity(''); setTransferLotId('');
      const res = await api.get(`/api/produce/${produceId.trim()}`);
      setProduce(res.data);
      setTransferLotId(res.data._id);
      const defaultTransferType = getDefaultTransferType();
      setForm((prev) => ({ ...prev, transferType: defaultTransferType, price: res.data.farmPrice || '' }));
    } catch (err) { setError('Produce nahi mila — sahi ID daalo'); }
  };

  useEffect(() => {
    const refreshFloor = async () => {
      if (!produce || form.transferType !== 'FARM_TO_DISTRIBUTOR') {
        setMarketFloor(null);
        setPriceError('');
        return;
      }

      setMarketLoading(true);
      try {
        const floorInfo = await getMandiFloorForProduce(produce);
        setMarketFloor(floorInfo);
      } catch (err) {
        setMarketFloor(null);
        setPriceError(err.response?.data?.message || err.message || 'Mandi rate check nahi ho paya');
      } finally {
        setMarketLoading(false);
      }
    };

    refreshFloor();
  }, [produce, form.transferType]);

  useEffect(() => {
    if (!produce || form.transferType !== 'FARM_TO_DISTRIBUTOR' || marketLoading) {
      return;
    }

    const priceValue = Number(form.price);
    const floorPrice = marketFloor?.floorPrice ?? marketFloor?.mandiPrice;
    if (!floorPrice) {
      setPriceError(`${produce.cropType} ka mandi rate ya MSP abhi available nahi hai, isliye sale allow nahi hai.`);
    } else if (Number.isFinite(priceValue) && priceValue > 0 && priceValue < floorPrice) {
      setPriceError(`Kisan samman portal! You cannot sell below the Floor/MSP rate of ₹${floorPrice.toFixed(2)}/kg.`);
    } else {
      setPriceError('');
    }
  }, [produce, form.transferType, form.price, marketFloor, marketLoading]);

  const runSplit = async () => {
    setError(''); setSplitError('');
    const qty = Number(splitQuantity);
    const availableQty = Number(produce?.quantity || 0);
    if (!Number.isFinite(qty) || qty <= 0) { setSplitError('Valid split quantity daalo'); return; }
    if (qty >= availableQty) { setSplitError(`Split quantity ${availableQty} kg se kam honi chahiye`); return; }
    setSplitLoading(true);
    try {
      const res = await api.post(`/api/produce/${produce._id}/split`, { quantity: qty });
      const childLot = res.data.childLot || res.data.childLots?.[0];
      if (!childLot?._id) throw new Error('Child lot create nahi hua');
      setSplitResult(res.data);
      setSplitQuantity('');
      setTransferLotId(childLot._id);
      setProduce((prev) => ({ ...prev, quantity: res.data.remainingQty, childLots: [...(prev.childLots || []), childLot._id] }));
    } catch (err) {
      setSplitError(err.response?.data?.message || err.message || 'Split fail ho gaya');
    } finally { setSplitLoading(false); }
  };

  const handleRequest = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      if (!transferLotId) { setError('Transfer lot select nahi hua'); setLoading(false); return; }
      const enteredPrice = Number(form.price);
      if (form.transferType === 'FARM_TO_DISTRIBUTOR') {
        const floorPrice = marketFloor?.floorPrice ?? marketFloor?.mandiPrice;
        if (!floorPrice) {
          setError(`${produce?.cropType || 'Is fasal'} ka mandi rate ya MSP available nahi hai, sale allow nahi hai.`);
          setLoading(false);
          return;
        }

        if (!Number.isFinite(enteredPrice) || enteredPrice < floorPrice) {
          setError(`Price ${marketFloor?.floorLabel || `₹${floorPrice.toFixed(2)}/kg`} se kam nahi ho sakta.`);
          setLoading(false);
          return;
        }
      }

      const produceRes = await api.get(`/api/produce/${transferLotId}`);
      setTransferProduceDetails(produceRes.data);
      const res = await api.post('/api/payment/request', {
        produceMongoId: transferLotId,
        toEmail: form.toEmail,
        pricePerKg: Number(form.price),
        location: form.location,
        transferType: form.transferType
      });
      setResult(res.data);
      showNotification(`Zabardast! Transfer Request ${form.toEmail} ko bhej di gayi hai.`, { title: 'FarmTrace', type: 'whatsapp' });
    } catch (err) { setError(err.response?.data?.message || 'Kuch galat hua'); }
    setLoading(false);
  };

  if (result) {
    const transferredLot = transferProduceDetails || produce;
    const transferredLotCode = transferredLot?.lotCode || 'N/A';
    const transferredQty = transferredLot?.quantity || 'N/A';
    const remainingQty = splitResult ? splitResult.remainingQty : 0;

    return (
      <div style={s.page}>
        <div style={s.topbar}>
          <button onClick={() => navigate('/dashboard')} style={s.backBtn}>←</button>
          <span style={s.topbarText}>🚛 Transfer Request</span>
        </div>
        <div style={s.inner}>
          <div style={s.successCard}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🎉</div>
            <h2 style={s.successTitle}>Transfer Request Bheji Gayi!</h2>
            <div style={s.successInfo}>
              <p>🌾 <strong>{transferredLot?.cropType}</strong> — {transferredLot?.origin}</p>
              <p>💰 Price: ₹{form.price}/kg</p>
              <p>📧 Ko: {form.toEmail}</p>
              <p>⚖️ Transfer Quantity: <strong>{transferredQty} kg</strong></p>
              <p style={{ fontSize: '0.85rem', color: '#5a7050', marginTop: '0.5rem' }}>Jab woh payment karega tab blockchain pe confirm hoga</p>
            </div>
            <div style={s.summaryBox}>
              <p style={s.summaryTitle}>📋 Transfer Summary</p>
              <p style={s.summaryRow}><strong>Lot ID:</strong> {transferLotId || 'N/A'}</p>
              <p style={s.summaryRow}><strong>Lot Code:</strong> {transferredLotCode}</p>
              <p style={s.summaryRow}><strong>Transferred Qty:</strong> {transferredQty} kg</p>
              {remainingQty > 0 && <p style={s.summaryRow}><strong>Remaining Qty:</strong> {remainingQty} kg</p>}
            </div>
            <button onClick={() => navigate('/dashboard')} style={s.primaryBtn}>🏠 Dashboard pe Wapas Jao</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.topbar}>
        <button onClick={() => navigate('/dashboard')} style={s.backBtn}>←</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
          <span style={{ fontSize: '1.2rem' }}>🚛</span>
          <span style={s.topbarText}>Transfer Request Bhejo</span>
        </div>
        <span style={s.rolePill}>{user.role}</span>
      </div>

      <div style={s.inner}>
        {!produce ? (
          <div style={s.card}>
            <p style={s.sectionLabel}>🔍 Produce ID Daalo</p>
            <p style={s.helpText}>Dashboard se apni fasal ki ID copy karke yahan paste karo</p>
            <label style={s.label}>Produce ID</label>
            <input
              style={s.input}
              placeholder="ID paste karo yahan..."
              value={produceId}
              onChange={(e) => setProduceId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchProduce()}
            />
            {error && <div style={s.alertErr}>⚠️ {error}</div>}
            <button onClick={fetchProduce} style={s.primaryBtn} disabled={!produceId.trim()}>
              🔍 Produce Dhundo
            </button>
          </div>
        ) : (
          <>
            <div style={s.produceCard}>
              <div style={s.produceHeader}>
                <h3 style={s.cropName}>🌾 {produce.cropType}</h3>
                <span style={s.gradeBadge}>Grade: {produce.qualityGrade}</span>
              </div>
              <div style={s.produceGrid}>
                {[
                  { label: 'Lot Code', val: produce.lotCode || 'N/A' },
                  { label: 'Maatra', val: `${produce.quantity} kg` },
                  { label: 'Kisan', val: produce.farmerName },
                  { label: 'Mool', val: produce.origin },
                  { label: 'Farm Price', val: `₹${produce.farmPrice}/kg` },
                  { label: 'Status', val: produce.lotStatus },
                ].map(({ label, val }) => (
                  <div key={label} style={s.produceDetail}>
                    <span style={s.detailLabel}>{label}</span>
                    <span style={s.detailVal}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {error && <div style={s.alertErr}>⚠️ {error}</div>}
            {loading && <div style={s.alertWarn}>⏳ Request bheji ja rahi hai...</div>}

            <div style={s.card}>
              <button
                type="button"
                onClick={() => setShowSplitForm(!showSplitForm)}
                style={{ ...s.splitToggle, background: showSplitForm ? '#7c3aed' : '#ede9fe', color: showSplitForm ? '#fff' : '#7c3aed' }}
              >
                ✂️ {showSplitForm ? 'Split Form Band Karo' : 'Quantity Split Karni Hai?'}
              </button>

              {showSplitForm && (
                <div style={{ marginTop: '1rem' }}>
                  <p style={{ fontSize: '0.85rem', color: '#7c3aed', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                    Ek quantity dalo — utna lot split hoga aur transfer hoga. Baaki aapke paas rahegi.
                  </p>
                  <label style={s.label}>Split Quantity (kg)</label>
                  <input style={s.input} type="number" min="0" step="0.001" placeholder="e.g. 40" value={splitQuantity} onChange={(e) => setSplitQuantity(e.target.value)} />
                  {splitError && <div style={s.alertErr}>⚠️ {splitError}</div>}
                  <button type="button" onClick={runSplit} style={{ ...s.primaryBtn, background: '#7c3aed' }} disabled={splitLoading || !splitQuantity.trim()}>
                    {splitLoading ? '⏳ Split ho raha hai...' : '✂️ Split Karo'}
                  </button>
                </div>
              )}
              {splitResult?.childLot && (
                <div style={{ ...s.alertOk, marginTop: '0.75rem' }}>
                  ✅ Split kaamyab! Transfer Lot: <strong>{splitResult.childLot.lotCode}</strong> ({splitResult.childLot.quantity} kg) | Remaining: {splitResult.remainingQty} kg
                </div>
              )}
            </div>

            <div style={{ ...s.card, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
              <p style={{ fontSize: '0.85rem', color: '#0369a1', fontWeight: 600 }}>
                📤 Transfer ke liye selected Lot ID: <strong>{transferLotId || 'N/A'}</strong>
                {splitResult?.childLot && ` (${splitResult.childLot.quantity} kg)`}
              </p>
            </div>

            <div style={s.card}>
              <p style={s.sectionLabel}>📝 Transfer Details</p>
              <form onSubmit={handleRequest}>
                <label style={s.label}>Transfer Type</label>
                <select style={s.input} value={form.transferType} onChange={(e) => setForm({ ...form, transferType: e.target.value })}>
                  {user.role === 'FARMER' && <option value="FARM_TO_DISTRIBUTOR">👨‍🌾 → 🚛 Farmer to Distributor</option>}
                  {user.role === 'DISTRIBUTOR' && <option value="DISTRIBUTOR_TO_RETAILER">🚛 → 🏪 Distributor to Retailer</option>}
                  {user.role === 'RETAILER' && <option value="RETAILER_TO_CONSUMER">🏪 → 👥 Retailer to Consumer</option>}
                </select>

                <label style={s.label}>
                  {user.role === 'FARMER' ? '🚛 Distributor' : user.role === 'DISTRIBUTOR' ? '🏪 Retailer' : '👥 Consumer'} ka Email
                </label>
                <input style={s.input} type="email" placeholder="Email address" value={form.toEmail} onChange={(e) => setForm({ ...form, toEmail: e.target.value })} required />

                <label style={s.label}>💰 Aapka Price (₹/kg)</label>
                <input
                  style={s.input}
                  type="number"
                  placeholder="Price per kg"
                  value={form.price}
                  onChange={(e) => {
                    const nextPrice = e.target.value;
                    setForm({ ...form, price: nextPrice });
                      const floorPrice = marketFloor?.floorPrice ?? marketFloor?.mandiPrice;
                      if (form.transferType === 'FARM_TO_DISTRIBUTOR' && floorPrice) {
                      const numericPrice = Number(nextPrice);
                        if (Number.isFinite(numericPrice) && numericPrice > 0 && numericPrice < floorPrice) {
                          setPriceError(`Price ${marketFloor?.floorLabel || `₹${floorPrice.toFixed(2)}/kg`} se kam nahi ho sakta.`);
                      } else {
                        setPriceError('');
                      }
                    }
                  }}
                  required
                />
                {marketLoading && form.transferType === 'FARM_TO_DISTRIBUTOR' && (
                  <div style={s.alertWarn}>⏳ Mandi rate verify kiya ja raha hai...</div>
                )}
                  {form.transferType === 'FARM_TO_DISTRIBUTOR' && (marketFloor?.floorPrice || marketFloor?.mandiPrice) && (
                  <div style={s.marketHint}>
                      {marketFloor.floorLabel || `Current floor: ₹${(marketFloor.floorPrice || marketFloor.mandiPrice).toFixed(2)}/kg`}
                      {marketFloor.commodity ? ` (${marketFloor.commodity})` : ''}
                  </div>
                )}
                {priceError && <div style={s.alertErr}>⚠️ {priceError}</div>}

                <label style={s.label}>📍 Location</label>
                <LocationAutocompleteInput
                  inputStyle={s.input}
                  placeholder="Jaise: Pune, Maharashtra"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  suggestions={fullLocationSuggestions}
                  required
                />

                <button
                  type="submit"
                  style={{
                    ...s.primaryBtn,
                    ...(loading || Boolean(priceError) ? s.primaryBtnDisabled : {})
                  }}
                  disabled={loading || Boolean(priceError)}
                >
                  {loading ? '⏳ Bheji ja rahi hai...' : priceError ? '🚫 Transfer Request Locked' : '🚀 Transfer Request Bhejo'}
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: 'var(--ft-bg)', fontFamily: 'var(--ft-font-main)' },
  topbar: { position: 'sticky', top: 0, zIndex: 30, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(15px)', borderBottom: '1px solid var(--ft-border)', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' },
  backBtn: { width: 44, height: 44, borderRadius: 12, background: 'var(--ft-white)', border: '1px solid var(--ft-border)', color: 'var(--ft-forest)', cursor: 'pointer', fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'var(--ft-transition)' },
  topbarText: { fontWeight: 800, fontSize: '1.25rem', color: 'var(--ft-forest)', letterSpacing: '-0.02em', flex: 1 },
  rolePill: { background: 'var(--ft-forest)', color: '#fff', borderRadius: 999, padding: '0.25rem 0.85rem', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.05em' },
  inner: { maxWidth: 640, margin: '0 auto', padding: '1.5rem 1.5rem 4rem' },
  card: { background: 'var(--ft-white)', borderRadius: 'var(--ft-radius-lg)', padding: '2rem', marginBottom: '1.5rem', border: '1px solid var(--ft-border)', boxShadow: 'var(--ft-shadow-sm)', transition: 'var(--ft-transition)' },
  sectionLabel: { fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--ft-text-muted)', marginBottom: '1.75rem', borderLeft: '3px solid var(--ft-forest)', paddingLeft: '0.75rem' },
  helpText: { fontSize: '0.95rem', color: 'var(--ft-text-muted)', marginBottom: '1.5rem', lineHeight: 1.6 },
  label: { display: 'block', color: 'var(--ft-text)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.6rem', marginTop: '0.5rem' },
  input: { width: '100%', padding: '0.9rem 1.25rem', border: '1.5px solid var(--ft-border)', borderRadius: '12px', background: 'var(--ft-white)', fontSize: '1rem', color: 'var(--ft-text)', outline: 'none', boxSizing: 'border-box', marginBottom: '0.5rem', transition: 'var(--ft-transition)' },
  primaryBtn: { width: '100%', padding: '1rem', border: 'none', borderRadius: '12px', background: 'var(--ft-forest)', color: '#fff', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', boxShadow: 'var(--ft-shadow)', marginTop: '1rem', transition: 'var(--ft-transition)' },
  primaryBtnDisabled: { background: 'var(--ft-sage)', boxShadow: 'none', cursor: 'not-allowed', opacity: 0.7 },
  alertErr: { background: 'rgba(239, 68, 68, 0.05)', border: '1px solid var(--ft-error)', color: 'var(--ft-error)', borderRadius: '12px', padding: '1rem', fontWeight: 600, fontSize: '0.9rem', marginTop: '0.75rem' },
  alertOk: { background: 'rgba(16, 185, 129, 0.05)', border: '1px solid var(--ft-sage)', color: 'var(--ft-forest)', borderRadius: '12px', padding: '1rem', fontWeight: 600, fontSize: '0.9rem' },
  alertWarn: { background: 'rgba(245, 158, 11, 0.05)', border: '1px solid #f59e0b', color: '#b45309', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', fontWeight: 600, fontSize: '0.9rem' },
  marketHint: { background: 'var(--ft-sage-light)', border: '1px solid var(--ft-border)', color: 'var(--ft-forest)', borderRadius: '12px', padding: '0.9rem 1.1rem', marginTop: '0.5rem', fontSize: '0.9rem', fontWeight: 600 },
  produceCard: { background: 'var(--ft-white)', borderRadius: 'var(--ft-radius-lg)', padding: '2rem', marginBottom: '1.5rem', border: '1px solid var(--ft-border)', boxShadow: 'var(--ft-shadow-sm)' },
  produceHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  cropName: { color: 'var(--ft-forest)', fontWeight: 800, fontSize: '1.5rem', margin: 0, letterSpacing: '-0.03em' },
  gradeBadge: { background: 'var(--ft-sage-light)', color: 'var(--ft-forest)', borderRadius: 999, padding: '0.25rem 0.85rem', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' },
  produceGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: 'var(--ft-bg)', borderRadius: '16px', padding: '1.25rem', border: '1px solid var(--ft-border)' },
  produceDetail: { display: 'flex', flexDirection: 'column', gap: '0.2rem' },
  detailLabel: { fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ft-text-muted)', fontWeight: 700 },
  detailVal: { fontSize: '1rem', fontWeight: 700, color: 'var(--ft-forest)' },
  splitToggle: { width: '100%', padding: '0.85rem', border: '2px solid var(--ft-border)', borderRadius: '12px', cursor: 'pointer', fontWeight: 800, fontSize: '0.95rem', transition: 'var(--ft-transition)', background: 'var(--ft-white)' },
  successCard: { background: 'var(--ft-white)', borderRadius: 'var(--ft-radius-lg)', padding: '3rem 2rem', textAlign: 'center', border: '1px solid var(--ft-border)', boxShadow: 'var(--ft-shadow-lg)' },
  successTitle: { fontWeight: 800, fontSize: '1.75rem', color: 'var(--ft-forest)', margin: '0 0 1.25rem', letterSpacing: '-0.03em' },
  successInfo: { background: 'var(--ft-bg)', borderRadius: '20px', padding: '1.5rem', textAlign: 'left', marginBottom: '1.5rem', lineHeight: 2, fontSize: '1rem', color: 'var(--ft-forest)', border: '1px solid var(--ft-border)' },
  summaryBox: { background: 'rgba(3, 105, 161, 0.03)', border: '1px solid #bae6fd', borderRadius: '16px', padding: '1.5rem', textAlign: 'left', marginBottom: '2rem' },
  summaryTitle: { fontWeight: 800, fontSize: '0.9rem', color: '#0369a1', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' },
  summaryRow: { fontSize: '0.9rem', color: '#0c4a6e', margin: '0.4rem 0' },
};
