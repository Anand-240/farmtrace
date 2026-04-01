import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function Transfer() {
  const [produceId, setProduceId] = useState('');
  const [produce, setProduce] = useState(null);

  // Split state
  const [showSplitForm, setShowSplitForm] = useState(false);
  const [splitQuantity, setSplitQuantity] = useState('');
  const [splitError, setSplitError] = useState('');
  const [splitLoading, setSplitLoading] = useState(false);
  const [splitResult, setSplitResult] = useState(null);

  // Transfer form state
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

  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const getDefaultTransferType = () => {
    if (user.role === 'FARMER') return 'FARM_TO_DISTRIBUTOR';
    if (user.role === 'DISTRIBUTOR') return 'DISTRIBUTOR_TO_RETAILER';
    return 'RETAILER_TO_CONSUMER';
  };

  const fetchProduce = async () => {
    if (!produceId.trim()) {
      setError('ID daalo pehle');
      return;
    }

    try {
      setError('');
      setSplitError('');
      setSplitResult(null);
      setShowSplitForm(false);
      setSplitQuantity('');
      setTransferLotId('');

      const res = await api.get(`/api/produce/${produceId.trim()}`);
      setProduce(res.data);
      setTransferLotId(res.data._id);
      setForm((prev) => ({
        ...prev,
        transferType: getDefaultTransferType(),
        price: res.data.farmPrice || ''
      }));
    } catch (err) {
      setError('Produce nahi mila — sahi ID daalo');
    }
  };

  const runSplit = async () => {
    setError('');
    setSplitError('');

    const qty = Number(splitQuantity);
    const availableQty = Number(produce?.quantity || 0);

    if (!Number.isFinite(qty) || qty <= 0) {
      setSplitError('Valid split quantity daalo');
      return;
    }

    // User requirement: split quantity transfer ho, baki source lot owner ke paas rahe.
    if (qty >= availableQty) {
      setSplitError(`Split quantity ${availableQty} kg se kam honi chahiye`);
      return;
    }

    setSplitLoading(true);
    try {
      const res = await api.post(`/api/produce/${produce._id}/split`, { quantity: qty });
      const childLot = res.data.childLot || res.data.childLots?.[0];

      if (!childLot?._id) {
        throw new Error('Child lot create nahi hua');
      }

      setSplitResult(res.data);
      setSplitQuantity('');
      setTransferLotId(childLot._id);

      setProduce((prev) => ({
        ...prev,
        quantity: res.data.remainingQty,
        childLots: [...(prev.childLots || []), childLot._id]
      }));
    } catch (err) {
      setSplitError(err.response?.data?.message || err.message || 'Split fail ho gaya');
    } finally {
      setSplitLoading(false);
    }
  };

  const handleRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!transferLotId) {
        setError('Transfer lot select nahi hua');
        setLoading(false);
        return;
      }

      const res = await api.post('/api/payment/request', {
        produceMongoId: transferLotId,
        toEmail: form.toEmail,
        pricePerKg: Number(form.price),
        location: form.location,
        transferType: form.transferType
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Kuch galat hua');
    }

    setLoading(false);
  };

  if (result) {
    const transferredLotCode = splitResult?.childLot?.lotCode || produce?.lotCode || 'N/A';
    const transferredQty = splitResult?.childLot?.quantity ?? produce?.quantity ?? 'N/A';
    const remainingQty = splitResult ? splitResult.remainingQty : 0;

    return (
      <div style={styles.container}>
        <div style={styles.card} className="animate-slide-up">
          <h2 style={{ color: '#27500A', textAlign: 'center' }}>Transfer Request Bheji Gayi!</h2>
          <div style={styles.successBox}>
            <p style={styles.successText}>{produce?.cropType} - {produce?.origin}</p>
            <p style={styles.successDetail}>Price: Rs {form.price}/kg</p>
            <p style={styles.successDetail}>Ko: {form.toEmail}</p>
            {splitResult?.childLot && (
              <p style={styles.successDetail}>Split Transfer Qty: {splitResult.childLot.quantity} kg</p>
            )}
            <p style={styles.successDetail}>Jab woh payment karega tab blockchain pe transfer hoga</p>
          </div>

          <div style={styles.summaryCard}>
            <h3 style={styles.summaryTitle}>Transfer Summary</h3>
            <p style={styles.summaryRow}><strong>Transferred Lot ID:</strong> {transferLotId || 'N/A'}</p>
            <p style={styles.summaryRow}><strong>Transferred Lot Code:</strong> {transferredLotCode}</p>
            <p style={styles.summaryRow}><strong>Transferred Quantity:</strong> {transferredQty} kg</p>
            <p style={styles.summaryRow}><strong>Remaining Quantity (source lot):</strong> {remainingQty} kg</p>
          </div>

          <button onClick={() => navigate('/dashboard')} style={styles.button}>
            Dashboard pe Wapas Jao
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card} className="animate-slide-up">
        <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>← Wapas</button>
        <h2 style={styles.title}>Transfer Request Bhejo</h2>
        <p style={styles.roleText}>{user.name} ({user.role})</p>

        {!produce ? (
          <div>
            <label style={styles.label}>Produce ID daalo</label>
            <input
              style={styles.input}
              placeholder="Dashboard se ID Copy Karo"
              value={produceId}
              onChange={(e) => setProduceId(e.target.value)}
            />
            {error && <p style={styles.error}>{error}</p>}
            <button onClick={fetchProduce} style={styles.button} disabled={!produceId.trim()}>
              Produce Dhundo
            </button>
          </div>
        ) : (
          <div>
            <div style={styles.produceBox}>
              <h3 style={styles.cropName}>{produce.cropType}</h3>
              <p style={styles.detail}><strong>Lot Code:</strong> {produce.lotCode || 'N/A'}</p>
              <p style={styles.detail}><strong>Total Quantity:</strong> {produce.quantity} kg</p>
              <p style={styles.detail}><strong>Farmer:</strong> {produce.farmerName}</p>
              <p style={styles.detail}><strong>Current Owner:</strong> {produce.currentOwner}</p>
              <p style={styles.detail}><strong>Origin:</strong> {produce.origin}</p>
              <p style={styles.detail}><strong>Grade:</strong> {produce.qualityGrade}</p>
              <p style={styles.detail}><strong>Lot Status:</strong> {produce.lotStatus}</p>
              <p style={styles.detail}><strong>Source Type:</strong> {produce.sourceType}</p>
              <p style={styles.detail}><strong>Farm Price:</strong> Rs {produce.farmPrice}/kg</p>
            </div>

            {error && <p style={styles.error}>{error}</p>}
            {loading && <p style={styles.loadingText}>Request bheji ja rahi hai...</p>}

            <div style={styles.splitSection}>
              <button
                type="button"
                onClick={() => setShowSplitForm(!showSplitForm)}
                style={{ ...styles.splitToggle, ...(showSplitForm ? { background: '#5a3f86', color: '#fff' } : {}) }}
              >
                {showSplitForm ? 'Split form hide karo' : 'Split quantity dalni hai?'}
              </button>

              {showSplitForm && (
                <div style={styles.splitForm}>
                  <p style={styles.splitDesc}>
                    Ek quantity dalo. Utna lot split hoga aur utna hi transfer hoga. Baaki quantity aapke paas rahegi.
                  </p>
                  <label style={styles.label}>Split Quantity (kg)</label>
                  <input
                    style={styles.input}
                    type="number"
                    min="0"
                    step="0.001"
                    placeholder="e.g. 40"
                    value={splitQuantity}
                    onChange={(e) => setSplitQuantity(e.target.value)}
                  />
                  {splitError && <p style={styles.error}>{splitError}</p>}
                  <button
                    type="button"
                    onClick={runSplit}
                    style={styles.splitBtn}
                    disabled={splitLoading || !splitQuantity.trim()}
                  >
                    {splitLoading ? 'Split ho raha hai...' : 'Split karo'}
                  </button>
                </div>
              )}

              {splitResult?.childLot && (
                <div style={styles.splitSuccess}>
                  <p style={styles.successMsg}>Split successful.</p>
                  <p style={styles.successMsgSmall}>Transfer lot: {splitResult.childLot.lotCode} ({splitResult.childLot.quantity} kg)</p>
                  <p style={styles.successMsgSmall}>Remaining source lot quantity: {splitResult.remainingQty} kg</p>
                </div>
              )}
            </div>

            <div style={styles.selectionBox}>
              <p style={styles.selectionText}>Transfer ke liye selected lot ID: <strong>{transferLotId || 'N/A'}</strong></p>
              {splitResult?.childLot && (
                <p style={styles.selectionText}>Selected transfer quantity: <strong>{splitResult.childLot.quantity} kg</strong></p>
              )}
            </div>

            <form onSubmit={handleRequest}>
              <label style={styles.label}>Transfer Type</label>
              <select
                style={styles.input}
                value={form.transferType}
                onChange={(e) => setForm({ ...form, transferType: e.target.value })}
              >
                {user.role === 'FARMER' && (
                  <option value="FARM_TO_DISTRIBUTOR">Farmer to Distributor</option>
                )}
                {user.role === 'DISTRIBUTOR' && (
                  <option value="DISTRIBUTOR_TO_RETAILER">Distributor to Retailer</option>
                )}
                {user.role === 'RETAILER' && (
                  <option value="RETAILER_TO_CONSUMER">Retailer to Consumer</option>
                )}
              </select>

              <label style={styles.label}>
                {user.role === 'FARMER' ? 'Distributor' : user.role === 'DISTRIBUTOR' ? 'Retailer' : 'Consumer'} ka Email
              </label>
              <input
                style={styles.input}
                type="email"
                placeholder="Email address"
                value={form.toEmail}
                onChange={(e) => setForm({ ...form, toEmail: e.target.value })}
                required
              />

              <label style={styles.label}>Aapka Price (Rs/kg)</label>
              <input
                style={styles.input}
                type="number"
                placeholder={user.role === 'FARMER' ? '22' : user.role === 'DISTRIBUTOR' ? '30' : '38'}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
              />

              <label style={styles.label}>Location</label>
              <input
                style={styles.input}
                placeholder="Pune, Maharashtra"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                required
              />

              <button type="submit" style={styles.button} disabled={loading}>
                {loading ? 'Bheji ja rahi hai...' : 'Transfer Request Bhejo'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #f6f9f4 0%, #edf5ea 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem'
  },
  card: {
    background: '#fff',
    padding: '1.5rem',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '560px',
    border: '1px solid #dbe5d8',
    boxShadow: '0 10px 24px rgba(26, 44, 33, 0.09)'
  },
  title: { color: '#1f3320', marginBottom: '0.4rem' },
  roleText: { color: '#5f7167', fontSize: '0.85rem', marginBottom: '1.2rem' },
  label: { display: 'block', color: '#3f5346', marginBottom: '0.32rem', fontSize: '0.9rem', fontWeight: '700' },
  input: {
    width: '100%',
    padding: '0.78rem 0.85rem',
    marginBottom: '0.95rem',
    border: '1px solid #d3dfd0',
    borderRadius: '10px',
    fontSize: '0.98rem',
    boxSizing: 'border-box',
    background: '#fbfdfb'
  },
  button: {
    width: '100%',
    padding: '0.8rem',
    background: '#27500A',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '0.98rem',
    cursor: 'pointer',
    marginTop: '0.4rem',
    fontWeight: '700'
  },
  backBtn: { background: 'none', border: 'none', color: '#27500A', cursor: 'pointer', marginBottom: '1rem', fontSize: '0.9rem', padding: 0 },
  error: {
    color: '#a22929',
    marginBottom: '1rem',
    fontSize: '0.9rem',
    background: '#fdecec',
    border: '1px solid #f4cfcf',
    borderRadius: '10px',
    padding: '0.6rem 0.75rem'
  },
  loadingText: {
    color: '#8b5318',
    background: '#fff1df',
    padding: '0.72rem',
    borderRadius: '10px',
    marginBottom: '1rem',
    fontSize: '0.9rem'
  },
  produceBox: {
    background: '#eef5e9',
    padding: '0.95rem',
    borderRadius: '10px',
    marginBottom: '1.2rem',
    border: '1px solid #dbe5d8'
  },
  cropName: { color: '#27500A', margin: '0 0 0.5rem' },
  detail: { color: '#4f6057', fontSize: '0.9rem', margin: '0.2rem 0' },
  splitSection: {
    background: '#f9fcf7',
    border: '2px solid #5a3f86',
    borderRadius: '12px',
    padding: '0.8rem',
    marginBottom: '1rem'
  },
  splitToggle: {
    width: '100%',
    padding: '0.7rem',
    background: '#e8dff5',
    color: '#5a3f86',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '0.9rem'
  },
  splitForm: { marginTop: '0.8rem' },
  splitDesc: { color: '#5a3f86', fontSize: '0.85rem', margin: '0 0 0.6rem' },
  splitBtn: {
    width: '100%',
    padding: '0.7rem',
    background: '#5a3f86',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '0.9rem'
  },
  splitSuccess: {
    marginTop: '0.8rem',
    background: '#e8f5e9',
    border: '1px solid #27500A',
    borderRadius: '8px',
    padding: '0.7rem'
  },
  successMsg: { color: '#27500A', fontSize: '0.9rem', fontWeight: '600', margin: '0' },
  successMsgSmall: { color: '#27500A', fontSize: '0.85rem', fontWeight: '500', margin: '0.3rem 0 0' },
  selectionBox: {
    marginBottom: '1rem',
    background: '#f2f7ff',
    border: '1px solid #cad9f4',
    borderRadius: '10px',
    padding: '0.7rem'
  },
  selectionText: { margin: '0.2rem 0', color: '#27406b', fontSize: '0.85rem' },
  successBox: {
    background: '#eef5e9',
    padding: '1rem',
    borderRadius: '10px',
    margin: '1rem 0',
    border: '1px solid #dbe5d8'
  },
  summaryCard: {
    background: '#f2f7ff',
    border: '1px solid #cad9f4',
    borderRadius: '10px',
    padding: '0.9rem',
    marginBottom: '1rem'
  },
  summaryTitle: {
    margin: '0 0 0.5rem',
    color: '#27406b',
    fontSize: '1rem'
  },
  summaryRow: {
    margin: '0.3rem 0',
    color: '#27406b',
    fontSize: '0.9rem'
  },
  successText: { color: '#27500A', fontWeight: 'bold', margin: '0 0 0.5rem' },
  successDetail: { color: '#4f6057', fontSize: '0.9rem', margin: '0.2rem 0' }
};
