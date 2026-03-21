import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function Transfer() {
  const [produceId, setProduceId] = useState('');
  const [produce, setProduce] = useState(null);
  const [form, setForm] = useState({
    toPhone: '', price: '', location: '', transferType: 'FARM_TO_DISTRIBUTOR'
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Role ke hisaab se default transfer type
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
      const res = await api.get(`/api/produce/${produceId.trim()}`);
      setProduce(res.data);
      // Role ke hisaab se transfer type set karo
      setForm(f => ({...f, transferType: getDefaultTransferType()}));
    } catch (err) {
      console.error(err);
      setError('Produce nahi mila — sahi ID daalo');
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/api/transfer', {
        produceMongoId: produceId.trim(),
        toPhone: form.toPhone,
        price: Number(form.price),
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
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h2 style={{color:'#27500A', textAlign:'center'}}>
            Transfer Ho Gaya!
          </h2>
          <div style={styles.successBox}>
            <p style={styles.successText}>
              {produce?.cropType} — {produce?.origin}
            </p>
            <p style={styles.successDetail}>Price: ₹{form.price}/kg</p>
            <p style={styles.successDetail}>Location: {form.location}</p>
            <p style={styles.successDetail}>Transfer: {form.transferType.replace(/_/g,' ')}</p>
          </div>
          {result.txHash && (
            <>
              <p style={styles.hashText}>TX: {result.txHash?.slice(0,30)}...</p>
              <a href={`https://sepolia.etherscan.io/tx/${result.txHash}`}
                target="_blank" rel="noreferrer" style={styles.ethLink}>
                Blockchain pe verify karo →
              </a>
            </>
          )}
          {!result.txHash && (
            <p style={styles.pendingText}>
              MongoDB mein save hua — blockchain pending
            </p>
          )}
          <button onClick={() => navigate('/dashboard')} style={styles.button}>
            Dashboard pe Wapas Jao
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>
          ← Wapas
        </button>
        <h2 style={styles.title}>Produce Transfer Karo</h2>
        <p style={styles.roleText}>
          Login: {user.name} ({user.role})
        </p>

        {!produce ? (
          <div>
            <label style={styles.label}>Produce ID daalo</label>
            <p style={styles.hint}>
              Dashboard mein produce card ke "ID Copy Karo" button se copy karo
            </p>
            <input style={styles.input}
              placeholder="69beab2e44b44da98c9354d8"
              value={produceId}
              onChange={e => setProduceId(e.target.value)} />
            {error && <p style={styles.error}>{error}</p>}
            <button onClick={fetchProduce} style={styles.button}
              disabled={!produceId.trim()}>
              Produce Dhundo
            </button>
          </div>
        ) : (
          <div>
            {/* Produce info */}
            <div style={styles.produceBox}>
              <div style={styles.produceHeader}>
                <h3 style={styles.cropName}>{produce.cropType}</h3>
                <span style={styles.verifiedBadge}>
                  {produce.isBlockchainVerified ? 'Verified' : 'Unverified'}
                </span>
              </div>
              <p style={styles.detail}>Kisan: {produce.farmerName}</p>
              <p style={styles.detail}>Mool: {produce.origin}</p>
              <p style={styles.detail}>Grade: {produce.qualityGrade}</p>
              <p style={styles.detail}>
                Farm Price: <strong>₹{produce.farmPrice}/kg</strong>
              </p>

              {/* Existing transfers */}
              {produce.dbTransfers?.length > 0 && (
                <div style={styles.existingTransfers}>
                  <p style={styles.existingTitle}>Abhi tak ka safar:</p>
                  {produce.dbTransfers.map((t, i) => (
                    <p key={i} style={styles.existingStep}>
                      → {t.transferType.replace(/_/g,' ')}: ₹{t.price}/kg ({t.location})
                    </p>
                  ))}
                </div>
              )}
            </div>

            {error && <p style={styles.error}>{error}</p>}
            {loading && (
              <p style={styles.loadingText}>
                Blockchain pe record ho raha hai... (15-30 second)
              </p>
            )}

            <form onSubmit={handleTransfer}>
              <label style={styles.label}>Transfer Type</label>
              <select style={styles.input} value={form.transferType}
                onChange={e => setForm({...form, transferType: e.target.value})}>
                {user.role === 'FARMER' && (
                  <option value="FARM_TO_DISTRIBUTOR">
                    Farmer → Distributor
                  </option>
                )}
                {user.role === 'DISTRIBUTOR' && (
                  <option value="DISTRIBUTOR_TO_RETAILER">
                    Distributor → Retailer
                  </option>
                )}
                {user.role === 'RETAILER' && (
                  <option value="RETAILER_TO_CONSUMER">
                    Retailer → Consumer
                  </option>
                )}
              </select>

              <label style={styles.label}>
                {user.role === 'FARMER' ? 'Distributor' :
                 user.role === 'DISTRIBUTOR' ? 'Retailer' : 'Consumer'} ka Phone
              </label>
              <input style={styles.input}
                placeholder="Phone number"
                value={form.toPhone}
                onChange={e => setForm({...form, toPhone: e.target.value})}
                required />

              <label style={styles.label}>Aapka Price (₹/kg)</label>
              <input style={styles.input} type="number"
                placeholder={user.role === 'FARMER' ? '22' :
                             user.role === 'DISTRIBUTOR' ? '30' : '38'}
                value={form.price}
                onChange={e => setForm({...form, price: e.target.value})}
                required />

              <label style={styles.label}>Aapki Location</label>
              <input style={styles.input}
                placeholder="Pune, Maharashtra"
                value={form.location}
                onChange={e => setForm({...form, location: e.target.value})}
                required />

              <button type="submit" style={styles.button} disabled={loading}>
                {loading ? 'Record ho raha hai...' : 'Blockchain pe Transfer Karo'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight:'100vh', background:'#f0f4f0', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' },
  card: { background:'white', padding:'2rem', borderRadius:'12px', width:'100%', maxWidth:'450px' },
  title: { color:'#27500A', marginBottom:'0.5rem' },
  roleText: { color:'#666', fontSize:'0.85rem', marginBottom:'1.5rem' },
  hint: { color:'#888', fontSize:'0.8rem', marginBottom:'0.5rem' },
  label: { display:'block', color:'#444', marginBottom:'0.25rem', fontSize:'0.9rem', fontWeight:'bold' },
  input: { width:'100%', padding:'0.75rem', marginBottom:'1rem', border:'1px solid #ddd', borderRadius:'8px', fontSize:'1rem', boxSizing:'border-box' },
  button: { width:'100%', padding:'0.75rem', background:'#27500A', color:'white', border:'none', borderRadius:'8px', fontSize:'1rem', cursor:'pointer', marginTop:'0.5rem' },
  backBtn: { background:'none', border:'none', color:'#27500A', cursor:'pointer', marginBottom:'1rem', fontSize:'0.9rem' },
  error: { color:'red', marginBottom:'1rem', fontSize:'0.9rem' },
  loadingText: { color:'#854F0B', background:'#FAEEDA', padding:'0.75rem', borderRadius:'8px', marginBottom:'1rem', fontSize:'0.9rem' },
  produceBox: { background:'#EAF3DE', padding:'1rem', borderRadius:'8px', marginBottom:'1.5rem' },
  produceHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem' },
  cropName: { color:'#27500A', margin:0 },
  verifiedBadge: { background:'#27500A', color:'white', padding:'0.2rem 0.6rem', borderRadius:'20px', fontSize:'0.75rem' },
  detail: { color:'#555', fontSize:'0.9rem', margin:'0.2rem 0' },
  existingTransfers: { marginTop:'0.75rem', borderTop:'1px solid #C0DD97', paddingTop:'0.75rem' },
  existingTitle: { color:'#27500A', fontSize:'0.85rem', fontWeight:'bold', margin:'0 0 0.25rem' },
  existingStep: { color:'#555', fontSize:'0.8rem', margin:'0.15rem 0' },
  successBox: { background:'#EAF3DE', padding:'1rem', borderRadius:'8px', margin:'1rem 0' },
  successText: { color:'#27500A', fontWeight:'bold', margin:'0 0 0.5rem' },
  successDetail: { color:'#555', fontSize:'0.9rem', margin:'0.2rem 0' },
  pendingText: { color:'#854F0B', fontSize:'0.85rem', margin:'0.5rem 0' },
  hashText: { color:'#666', fontFamily:'monospace', fontSize:'0.8rem', margin:'0.5rem 0' },
  ethLink: { display:'block', color:'#085041', marginBottom:'1rem' }
};
