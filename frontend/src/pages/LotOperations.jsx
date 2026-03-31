import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function LotOperations() {
  const navigate = useNavigate();

  const [splitLotId, setSplitLotId] = useState('');
  const [splitQuantities, setSplitQuantities] = useState('');
  const [splitResult, setSplitResult] = useState(null);

  const [mergeLotIds, setMergeLotIds] = useState('');
  const [mergeResult, setMergeResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const parseNumbers = (value) => value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((num) => Number.isFinite(num) && num > 0);

  const parseIds = (value) => value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const runSplit = async (e) => {
    e.preventDefault();
    setError('');
    setSplitResult(null);

    const quantities = parseNumbers(splitQuantities);
    if (!splitLotId.trim() || quantities.length < 2) {
      setError('Split ke liye lot ID aur kam se kam 2 valid quantities do');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post(`/api/produce/${splitLotId.trim()}/split`, {
        splits: quantities.map((quantity) => ({ quantity }))
      });
      setSplitResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Lot split fail ho gaya');
    } finally {
      setLoading(false);
    }
  };

  const runMerge = async (e) => {
    e.preventDefault();
    setError('');
    setMergeResult(null);

    const lotIds = parseIds(mergeLotIds);
    if (lotIds.length < 2) {
      setError('Merge ke liye kam se kam 2 lot IDs do');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/api/produce/merge', { lotIds });
      setMergeResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Lot merge fail ho gaya');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>← Dashboard</button>
        <h2 style={styles.title}>Lot Split / Merge Tracking</h2>
        <p style={styles.subTitle}>Supply chain ke hisaab se lot lineage manage karo.</p>

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Split Lot</h3>
          <form onSubmit={runSplit}>
            <label style={styles.label}>Source Lot ID</label>
            <input
              style={styles.input}
              placeholder="e.g. 661f..."
              value={splitLotId}
              onChange={(e) => setSplitLotId(e.target.value)}
              required
            />

            <label style={styles.label}>Child Quantities (comma separated)</label>
            <input
              style={styles.input}
              placeholder="e.g. 120, 80, 60"
              value={splitQuantities}
              onChange={(e) => setSplitQuantities(e.target.value)}
              required
            />

            <button style={styles.primaryBtn} type="submit" disabled={loading}>
              {loading ? 'Processing...' : 'Split Lot'}
            </button>
          </form>

          {splitResult?.childLots?.length > 0 && (
            <div style={styles.resultBox}>
              <p style={styles.resultTitle}>Split successful</p>
              <p style={styles.resultText}>Remaining Qty: {splitResult.remainingQty}</p>
              {splitResult.childLots.map((lot) => (
                <p key={lot._id} style={styles.resultText}>
                  {lot.lotCode} • Qty {lot.quantity}
                </p>
              ))}
            </div>
          )}
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Merge Lots</h3>
          <form onSubmit={runMerge}>
            <label style={styles.label}>Lot IDs (comma separated)</label>
            <input
              style={styles.input}
              placeholder="e.g. 661a..., 661b..."
              value={mergeLotIds}
              onChange={(e) => setMergeLotIds(e.target.value)}
              required
            />

            <button style={styles.primaryBtn} type="submit" disabled={loading}>
              {loading ? 'Processing...' : 'Merge Lots'}
            </button>
          </form>

          {mergeResult?.mergedLot && (
            <div style={styles.resultBox}>
              <p style={styles.resultTitle}>Merge successful</p>
              <p style={styles.resultText}>Merged Lot: {mergeResult.mergedLot.lotCode}</p>
              <p style={styles.resultText}>Quantity: {mergeResult.mergedLot.quantity}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #f6f9f4 0%, #edf5ea 100%)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '1rem'
  },
  card: {
    width: '100%',
    maxWidth: '640px',
    background: '#fff',
    border: '1px solid #dbe5d8',
    borderRadius: '14px',
    boxShadow: '0 10px 24px rgba(26, 44, 33, 0.09)',
    padding: '1.2rem'
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#27500A',
    fontSize: '0.9rem',
    cursor: 'pointer',
    padding: 0,
    marginBottom: '0.8rem'
  },
  title: { margin: 0, color: '#1f3320' },
  subTitle: { marginTop: '0.4rem', color: '#61705f', fontSize: '0.9rem' },
  section: {
    marginTop: '1rem',
    border: '1px solid #dbe5d8',
    borderRadius: '12px',
    padding: '0.9rem'
  },
  sectionTitle: { margin: '0 0 0.7rem', color: '#294232', fontSize: '1rem' },
  label: { display: 'block', marginBottom: '0.35rem', color: '#3f5346', fontWeight: 700, fontSize: '0.9rem' },
  input: {
    width: '100%',
    padding: '0.75rem 0.85rem',
    marginBottom: '0.75rem',
    border: '1px solid #d3dfd0',
    borderRadius: '10px',
    background: '#fbfdfb'
  },
  primaryBtn: {
    width: '100%',
    padding: '0.78rem',
    border: 'none',
    borderRadius: '10px',
    background: '#27500A',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer'
  },
  error: {
    color: '#a22929',
    background: '#fdecec',
    border: '1px solid #f4cfcf',
    borderRadius: '10px',
    padding: '0.6rem 0.75rem'
  },
  resultBox: {
    marginTop: '0.75rem',
    borderRadius: '10px',
    border: '1px solid #dbe5d8',
    background: '#eef5e9',
    padding: '0.65rem'
  },
  resultTitle: { margin: '0 0 0.3rem', color: '#27500A', fontWeight: 700 },
  resultText: { margin: '0.15rem 0', color: '#48604e', fontSize: '0.88rem' }
};
