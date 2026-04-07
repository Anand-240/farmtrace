import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useNotification } from '../context/NotificationContext';
import { getMandiFloorForProduce } from '../lib/market';

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
      setPriceError(`Price ${marketFloor.floorLabel || `₹${floorPrice.toFixed(2)}/kg`} se kam nahi ho sakta.`);
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
                <input style={s.input} placeholder="Jaise: Pune, Maharashtra" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required />

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
  page: { minHeight: '100vh', background: 'linear-gradient(160deg, #f4f8f0 0%, #eef5e7 50%, #e8f0e0 100%)', fontFamily: "'Outfit', sans-serif" },
  topbar: { position: 'sticky', top: 0, zIndex: 30, background: 'rgba(255,255,255,0.93)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #d4e4c8', padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', boxShadow: '0 2px 10px rgba(15,45,9,0.07)' },
  backBtn: { width: 38, height: 38, borderRadius: 10, background: '#f3fae8', border: '1px solid #d4e4c8', color: '#27500a', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  topbarText: { fontWeight: 800, fontSize: '1.05rem', color: '#0f1f0d', flex: 1 },
  rolePill: { background: '#1a4a0f', color: '#fff', borderRadius: 999, padding: '0.2rem 0.7rem', fontSize: '0.72rem', fontWeight: 800 },
  inner: { maxWidth: 580, margin: '0 auto', padding: '1rem 1rem 3rem' },
  card: { background: '#fff', borderRadius: 18, padding: '1.25rem', marginBottom: '1rem', border: '1.5px solid #d4e4c8', boxShadow: '0 4px 16px rgba(15,45,9,0.10)' },
  sectionLabel: { fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#5a7050', marginBottom: '0.85rem' },
  helpText: { fontSize: '0.88rem', color: '#5a7050', marginBottom: '0.85rem', lineHeight: 1.5 },
  label: { display: 'block', color: '#2d4428', fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.35rem', marginTop: '0.6rem' },
  input: { width: '100%', padding: '0.8rem 1rem', border: '1.5px solid #d4e4c8', borderRadius: 10, background: '#f3fae8', fontSize: '0.95rem', color: '#0f1f0d', outline: 'none', boxSizing: 'border-box', marginBottom: '0.1rem' },
  primaryBtn: { width: '100%', padding: '0.9rem', border: 'none', borderRadius: 12, background: 'linear-gradient(135deg, #27500a, #3a7510)', color: '#fff', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(39,80,10,0.3)', marginTop: '0.75rem', transition: 'all 0.2s' },
  primaryBtnDisabled: { background: '#9ca3af', boxShadow: 'none', cursor: 'not-allowed', opacity: 0.75 },
  alertErr: { background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: 10, padding: '0.7rem 0.9rem', fontWeight: 600, fontSize: '0.88rem', marginTop: '0.5rem' },
  alertOk: { background: '#dcfce7', border: '1px solid #86efac', color: '#166534', borderRadius: 10, padding: '0.7rem 0.9rem', fontWeight: 600, fontSize: '0.88rem' },
  alertWarn: { background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e', borderRadius: 10, padding: '0.7rem 0.9rem', marginBottom: '0.75rem', fontWeight: 600, fontSize: '0.88rem' },
  marketHint: { background: '#eef5e9', border: '1px solid #dbe5d8', color: '#4f6b45', borderRadius: 10, padding: '0.65rem 0.9rem', marginTop: '0.35rem', fontSize: '0.85rem', fontWeight: 600 },
  produceCard: { background: '#fff', borderRadius: 18, padding: '1.25rem', marginBottom: '1rem', border: '1.5px solid #d4e4c8', boxShadow: '0 4px 16px rgba(15,45,9,0.10)' },
  produceHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' },
  cropName: { color: '#0f1f0d', fontWeight: 900, fontSize: '1.15rem', margin: 0 },
  gradeBadge: { background: '#dcfce7', color: '#166534', borderRadius: 999, padding: '0.2rem 0.7rem', fontSize: '0.75rem', fontWeight: 800 },
  produceGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', background: '#f3fae8', borderRadius: 12, padding: '0.85rem' },
  produceDetail: { display: 'flex', flexDirection: 'column', gap: '0.1rem' },
  detailLabel: { fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#5a7050', fontWeight: 700 },
  detailVal: { fontSize: '0.88rem', fontWeight: 700, color: '#0f1f0d' },
  splitToggle: { width: '100%', padding: '0.75rem', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', transition: 'all 0.2s' },
  successCard: { background: '#fff', borderRadius: 20, padding: '2rem 1.5rem', textAlign: 'center', border: '1.5px solid #d4e4c8', boxShadow: '0 8px 28px rgba(15,45,9,0.12)' },
  successTitle: { fontWeight: 900, fontSize: '1.3rem', color: '#0f1f0d', margin: '0 0 1rem' },
  successInfo: { background: '#f3fae8', borderRadius: 14, padding: '1rem', textAlign: 'left', marginBottom: '1rem', lineHeight: 2, fontSize: '0.9rem', color: '#2d4428' },
  summaryBox: { background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 12, padding: '1rem', textAlign: 'left', marginBottom: '1.25rem' },
  summaryTitle: { fontWeight: 800, fontSize: '0.88rem', color: '#0369a1', marginBottom: '0.5rem' },
  summaryRow: { fontSize: '0.85rem', color: '#0c4a6e', margin: '0.25rem 0' },
};
