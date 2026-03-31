import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function LotOperations() {
  const navigate = useNavigate();

  // Tab state
  const [activeTab, setActiveTab] = useState('split');

  // ===== SPLIT STATE =====
  const [splitLotId, setSplitLotId] = useState('');
  const [splitSourceLot, setSplitSourceLot] = useState(null);
  const [splitQuantities, setSplitQuantities] = useState('');
  const [splitResult, setSplitResult] = useState(null);
  const [splitLoadingLot, setSplitLoadingLot] = useState(false);

  // ===== MERGE STATE =====
  const [mergeLotIds, setMergeLotIds] = useState('');
  const [mergeLots, setMergeLots] = useState([]);
  const [mergeResult, setMergeResult] = useState(null);
  const [mergeLoadingLots, setMergeLoadingLots] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const parseNumbers = (value) =>
    value
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((num) => Number.isFinite(num) && num > 0);

  const parseIds = (value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  // ===== SPLIT HANDLERS =====
  const fetchSplitLot = async () => {
    if (!splitLotId.trim()) {
      setError('Lot ID enter karo');
      return;
    }

    setSplitLoadingLot(true);
    setError('');
    try {
      const res = await api.get(`/api/produce/${splitLotId.trim()}`);
      if (res.data.lotStatus !== 'ACTIVE') {
        setError('Sirf ACTIVE lots ko split kar sakte ho');
        setSplitSourceLot(null);
      } else {
        setSplitSourceLot(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Lot load nahi ho saka');
      setSplitSourceLot(null);
    } finally {
      setSplitLoadingLot(false);
    }
  };

  const runSplit = async (e) => {
    e.preventDefault();
    setError('');
    setSplitResult(null);

    const quantities = parseNumbers(splitQuantities);

    if (!splitSourceLot) {
      setError('Pehle lot details load karo');
      return;
    }

    if (quantities.length < 2) {
      setError('Kam se kam 2 quantities dalni hain');
      return;
    }

    const totalQuantity = quantities.reduce((a, b) => a + b, 0);

    if (totalQuantity > splitSourceLot.quantity) {
      setError(
        `Total quantity ${totalQuantity} nahi ho sakti. Available: ${splitSourceLot.quantity}`
      );
      return;
    }

    setLoading(true);
    try {
      const res = await api.post(`/api/produce/${splitSourceLot._id}/split`, {
        splits: quantities.map((quantity) => ({ quantity }))
      });
      setSplitResult(res.data);
      setSplitQuantities('');
      setSplitLotId('');
      setSplitSourceLot(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Split fail ho gaya');
    } finally {
      setLoading(false);
    }
  };

  // ===== MERGE HANDLERS =====
  const fetchMergeLots = async () => {
    const lotIds = parseIds(mergeLotIds);
    if (lotIds.length < 2) {
      setError('Kam se kam 2 lot IDs enter karo');
      return;
    }

    setMergeLoadingLots(true);
    setError('');
    try {
      const lotsData = await Promise.all(
        lotIds.map((id) => api.get(`/api/produce/${id}`))
      );
      const lots = lotsData.map((res) => res.data);

      // Basic validation
      if (lots.some((l) => l.lotStatus !== 'ACTIVE')) {
        setError('Sirf ACTIVE lots merge kar sakte ho');
        setMergeLots([]);
        return;
      }

      setMergeLots(lots);
    } catch (err) {
      setError(err.response?.data?.message || 'Lots load nahi ho sake');
      setMergeLots([]);
    } finally {
      setMergeLoadingLots(false);
    }
  };

  const runMerge = async (e) => {
    e.preventDefault();
    setError('');
    setMergeResult(null);

    if (mergeLots.length < 2) {
      setError('Kam se kam 2 lots merge ke liye chahiye');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/api/produce/merge', {
        lotIds: mergeLots.map((l) => l._id)
      });
      setMergeResult(res.data);
      setMergeLotIds('');
      setMergeLots([]);
    } catch (err) {
      setError(err.response?.data?.message || 'Merge fail ho gaya');
    } finally {
      setLoading(false);
    }
  };

  const totalSplitQuantity = parseNumbers(splitQuantities).reduce((a, b) => a + b, 0);
  const totalMergeQuantity = mergeLots.reduce((sum, lot) => sum + lot.quantity, 0);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>
          ← Dashboard
        </button>
        <h2 style={styles.title}>Lot Split / Merge Tracking</h2>
        <p style={styles.subTitle}>
          Supply chain ke hisaab se lot lineage manage karo.
        </p>

        {/* TAB NAVIGATION */}
        <div style={styles.tabNav}>
          <button
            style={{
              ...styles.tabBtn,
              ...(activeTab === 'split' ? styles.tabBtnActive : {})
            }}
            onClick={() => {
              setActiveTab('split');
              setError('');
              setMergeLots([]);
            }}
          >
            🔀 Split Lot
          </button>
          <button
            style={{
              ...styles.tabBtn,
              ...(activeTab === 'merge' ? styles.tabBtnActive : {})
            }}
            onClick={() => {
              setActiveTab('merge');
              setError('');
              setSplitSourceLot(null);
            }}
          >
            🔗 Merge Lots
          </button>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        {/* ===== SPLIT TAB ===== */}
        {activeTab === 'split' && (
          <div style={styles.tabContent}>
            <div style={styles.formContainer}>
              {/* Left: Form */}
              <div style={styles.formLeft}>
                <h3 style={styles.sectionTitle}>Lot Split करो</h3>
                <p style={styles.sectionDesc}>एक lot को कई lots में divide करो</p>

                <label style={styles.label}>Source Lot ID</label>
                <div style={styles.inputGroup}>
                  <input
                    style={styles.input}
                    placeholder="e.g. 661f3a1b..."
                    value={splitLotId}
                    onChange={(e) => setSplitLotId(e.target.value)}
                  />
                  <button
                    style={styles.fetchBtn}
                    onClick={fetchSplitLot}
                    disabled={splitLoadingLot || !splitLotId.trim()}
                  >
                    {splitLoadingLot ? 'Loading...' : 'Load'}
                  </button>
                </div>

                {splitSourceLot && (
                  <>
                    <label style={styles.label}>Child Quantities (comma separated)</label>
                    <input
                      style={styles.input}
                      placeholder="e.g. 120, 80, 60"
                      value={splitQuantities}
                      onChange={(e) => setSplitQuantities(e.target.value)}
                    />

                    <button
                      style={styles.primaryBtn}
                      onClick={runSplit}
                      disabled={loading || !splitQuantities.trim()}
                    >
                      {loading ? 'Processing...' : '✓ Split करो'}
                    </button>
                  </>
                )}
              </div>

              {/* Right: Lot Details */}
              <div style={styles.formRight}>
                {splitSourceLot ? (
                  <div style={styles.lotDetails}>
                    <h4 style={styles.detailsTitle}>📦 Lot Details</h4>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Lot Code:</span>
                      <span style={styles.detailValue}>{splitSourceLot.lotCode}</span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Total Qty:</span>
                      <span style={styles.detailValue}>{splitSourceLot.quantity} kg</span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Price:</span>
                      <span style={styles.detailValue}>₹{splitSourceLot.price}</span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Crop:</span>
                      <span style={styles.detailValue}>{splitSourceLot.cropType}</span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Status:</span>
                      <span style={styles.detailValue}>{splitSourceLot.lotStatus}</span>
                    </div>

                    {splitQuantities && (
                      <div style={styles.splitValidation}>
                        <p style={styles.validationLabel}>Split Summary:</p>
                        <p style={styles.validationText}>
                          Total split: <strong>{totalSplitQuantity} kg</strong> / {splitSourceLot.quantity} kg
                        </p>
                        {totalSplitQuantity > splitSourceLot.quantity ? (
                          <p style={styles.validationError}>❌ Baki: {totalSplitQuantity - splitSourceLot.quantity} kg ज्यादा</p>
                        ) : (
                          <p style={styles.validationSuccess}>
                            ✓ Baki: {splitSourceLot.quantity - totalSplitQuantity} kg
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={styles.placeholderBox}>
                    <p style={styles.placeholderText}>📝 Lot ID enter करो और Load पर क्लिक करो</p>
                  </div>
                )}
              </div>
            </div>

            {splitResult?.childLots?.length > 0 && (
              <div style={styles.resultBox}>
                <p style={styles.resultTitle}>✅ Split successful!</p>
                <p style={styles.resultText}>
                  {splitResult.childLots.length} नए lots create हुए:
                </p>
                {splitResult.childLots.map((lot) => (
                  <p key={lot._id} style={styles.resultItem}>
                    🏷️ {lot.lotCode} • {lot.quantity} kg
                  </p>
                ))}
                {splitResult.remainingQty > 0 && (
                  <p style={styles.resultText}>
                    Original में remaining: {splitResult.remainingQty} kg
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== MERGE TAB ===== */}
        {activeTab === 'merge' && (
          <div style={styles.tabContent}>
            <div style={styles.formContainer}>
              {/* Left: Form */}
              <div style={styles.formLeft}>
                <h3 style={styles.sectionTitle}>Lots Merge करो</h3>
                <p style={styles.sectionDesc}>कई lots को एक में combine करो</p>

                <label style={styles.label}>Lot IDs (comma separated)</label>
                <div style={styles.inputGroup}>
                  <input
                    style={styles.input}
                    placeholder="e.g. 661a..., 661b..., 661c..."
                    value={mergeLotIds}
                    onChange={(e) => setMergeLotIds(e.target.value)}
                  />
                  <button
                    style={styles.fetchBtn}
                    onClick={fetchMergeLots}
                    disabled={mergeLoadingLots || !mergeLotIds.trim()}
                  >
                    {mergeLoadingLots ? 'Loading...' : 'Load'}
                  </button>
                </div>

                {mergeLots.length > 0 && (
                  <button
                    style={styles.primaryBtn}
                    onClick={runMerge}
                    disabled={loading || mergeLots.length < 2}
                  >
                    {loading ? 'Processing...' : `✓ Merge करो (${mergeLots.length} lots)`}
                  </button>
                )}
              </div>

              {/* Right: Lot Details */}
              <div style={styles.formRight}>
                {mergeLots.length > 0 ? (
                  <div style={styles.lotDetails}>
                    <h4 style={styles.detailsTitle}>📦 Selected Lots</h4>
                    <div style={styles.lotsList}>
                      {mergeLots.map((lot, idx) => (
                        <div key={lot._id} style={styles.lotItem}>
                          <p style={styles.lotItemCode}>{idx + 1}. {lot.lotCode}</p>
                          <p style={styles.lotItemText}>{lot.quantity} kg • ₹{lot.price}</p>
                        </div>
                      ))}
                    </div>

                    <div style={styles.mergeValidation}>
                      <p style={styles.validationLabel}>Merge Summary:</p>
                      <p style={styles.validationText}>
                        Total qty: <strong>{totalMergeQuantity} kg</strong>
                      </p>
                      <p style={styles.validationSuccess}>✓ सभी lots valid हैं merge के लिए</p>
                    </div>
                  </div>
                ) : (
                  <div style={styles.placeholderBox}>
                    <p style={styles.placeholderText}>📝 Lot IDs enter करो और Load पर क्लिक करो</p>
                  </div>
                )}
              </div>
            </div>

            {mergeResult?.mergedLot && (
              <div style={styles.resultBox}>
                <p style={styles.resultTitle}>✅ Merge successful!</p>
                <p style={styles.resultItem}>
                  🏷️ {mergeResult.mergedLot.lotCode} • {mergeResult.mergedLot.quantity} kg
                </p>
                <p style={styles.resultText}>
                  Average Price: ₹{mergeResult.mergedLot.price}
                </p>
              </div>
            )}
          </div>
        )}
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
    padding: '1rem',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  card: {
    width: '100%',
    maxWidth: '1000px',
    background: '#fff',
    border: '1px solid #dbe5d8',
    borderRadius: '14px',
    boxShadow: '0 10px 24px rgba(26, 44, 33, 0.09)',
    padding: '1.5rem'
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#27500A',
    fontSize: '0.95rem',
    cursor: 'pointer',
    padding: 0,
    marginBottom: '1rem',
    fontWeight: 600
  },
  title: { margin: 0, color: '#1f3320', fontSize: '1.8rem', fontWeight: 700 },
  subTitle: { marginTop: '0.5rem', color: '#61705f', fontSize: '0.95rem' },

  // ===== TAB STYLES =====
  tabNav: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '1.5rem',
    borderBottom: '2px solid #eee',
    paddingBottom: '0rem'
  },
  tabBtn: {
    flex: 1,
    padding: '0.9rem 1rem',
    background: '#f5f5f5',
    border: 'none',
    borderBottom: '3px solid transparent',
    borderRadius: '8px 8px 0 0',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#666',
    transition: 'all 0.2s ease'
  },
  tabBtnActive: {
    background: '#fff',
    borderBottom: '3px solid #27500A',
    color: '#27500A'
  },

  tabContent: {
    marginTop: '1.5rem'
  },

  // ===== FORM LAYOUT =====
  formContainer: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.5rem',
    '@media (max-width: 800px)': {
      gridTemplateColumns: '1fr'
    }
  },
  formLeft: {
    display: 'flex',
    flexDirection: 'column'
  },
  formRight: {
    display: 'flex',
    flexDirection: 'column'
  },

  sectionTitle: {
    margin: '0 0 0.4rem',
    color: '#294232',
    fontSize: '1.1rem',
    fontWeight: 700
  },
  sectionDesc: {
    margin: '0 0 1rem',
    color: '#999',
    fontSize: '0.85rem'
  },

  label: {
    display: 'block',
    marginBottom: '0.4rem',
    color: '#3f5346',
    fontWeight: 700,
    fontSize: '0.9rem'
  },

  input: {
    width: '100%',
    padding: '0.75rem 0.85rem',
    border: '1px solid #d3dfd0',
    borderRadius: '10px',
    background: '#fbfdfb',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    boxSizing: 'border-box'
  },

  inputGroup: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '0.9rem'
  },

  fetchBtn: {
    padding: '0.75rem 1rem',
    background: '#5a3f86',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.85rem',
    whiteSpace: 'nowrap'
  },

  primaryBtn: {
    width: '100%',
    padding: '0.85rem',
    border: 'none',
    borderRadius: '10px',
    background: '#27500A',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: '0.95rem',
    transition: 'background 0.2s ease',
    marginTop: '0.5rem'
  },

  // ===== LOT DETAILS =====
  lotDetails: {
    background: '#f9fcf7',
    border: '1px solid #dbe5d8',
    borderRadius: '12px',
    padding: '1rem'
  },
  detailsTitle: {
    margin: '0 0 0.8rem',
    color: '#27500A',
    fontSize: '1rem',
    fontWeight: 700
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    paddingBottom: '0.6rem',
    borderBottom: '1px solid #e4ede0',
    marginBottom: '0.6rem'
  },
  detailLabel: {
    color: '#666',
    fontWeight: 600,
    fontSize: '0.85rem'
  },
  detailValue: {
    color: '#27500A',
    fontWeight: 700,
    fontSize: '0.9rem'
  },

  // ===== VALIDATION =====
  splitValidation: {
    marginTop: '1rem',
    padding: '0.8rem',
    background: '#fff',
    border: '1px solid #d3dfd0',
    borderRadius: '10px'
  },
  mergeValidation: {
    marginTop: '1rem',
    padding: '0.8rem',
    background: '#fff',
    border: '1px solid #d3dfd0',
    borderRadius: '10px'
  },
  validationLabel: {
    margin: '0 0 0.4rem',
    color: '#27500A',
    fontWeight: 700,
    fontSize: '0.85rem'
  },
  validationText: { margin: '0.3rem 0', color: '#555', fontSize: '0.85rem' },
  validationSuccess: {
    margin: '0.3rem 0',
    color: '#27500A',
    fontSize: '0.85rem',
    fontWeight: 600
  },
  validationError: {
    margin: '0.3rem 0',
    color: '#a22929',
    fontSize: '0.85rem',
    fontWeight: 600
  },

  // ===== LOT ITEMS LIST =====
  lotsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    marginBottom: '0.8rem'
  },
  lotItem: {
    padding: '0.6rem 0.8rem',
    background: '#fff',
    border: '1px solid #dbe5d8',
    borderRadius: '8px'
  },
  lotItemCode: {
    margin: 0,
    color: '#27500A',
    fontWeight: 700,
    fontSize: '0.9rem'
  },
  lotItemText: {
    margin: '0.2rem 0 0',
    color: '#999',
    fontSize: '0.8rem'
  },

  placeholderBox: {
    background: '#f9fcf7',
    border: '2px dashed #dbe5d8',
    borderRadius: '12px',
    padding: '2rem 1rem',
    textAlign: 'center'
  },
  placeholderText: {
    margin: 0,
    color: '#999',
    fontSize: '0.9rem'
  },

  error: {
    color: '#a22929',
    background: '#fdecec',
    border: '1px solid #f4cfcf',
    borderRadius: '10px',
    padding: '0.75rem 0.9rem',
    fontSize: '0.9rem',
    marginTop: '0.5rem',
    marginBottom: '0.8rem'
  },

  resultBox: {
    marginTop: '1.5rem',
    borderRadius: '12px',
    border: '2px solid #27500A',
    background: '#eef5e9',
    padding: '1rem'
  },
  resultTitle: { margin: '0 0 0.6rem', color: '#27500A', fontWeight: 700, fontSize: '0.95rem' },
  resultText: { margin: '0.4rem 0', color: '#48604e', fontSize: '0.9rem' },
  resultItem: { margin: '0.3rem 0', color: '#27500A', fontSize: '0.9rem', fontWeight: 600 }
};
