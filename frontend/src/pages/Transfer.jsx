import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function Transfer() {
  const [produceId, setProduceId] = useState('');
  const [produce, setProduce] = useState(null);
  const [form, setForm] = useState({
    toEmail: '', price: '', location: '', transferType: 'FARM_TO_DISTRIBUTOR'
  });
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
    if (!produceId.trim()) { setError('ID daalo pehle'); return; }
    try {
      setError('');
      const res = await api.get(`/api/produce/${produceId.trim()}`);
      setProduce(res.data);
      setForm(f => ({...f, transferType: getDefaultTransferType()}));
    } catch (err) {
      setError('Produce nahi mila — sahi ID daalo');
    }
  };

  const handleRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/api/payment/request', {
        produceMongoId: produceId.trim(),
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
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h2 style={{color:'#27500A', textAlign:'center'}}>
            Transfer Request Bheji Gayi!
          </h2>
          <div style={styles.successBox}>
            <p style={styles.successText}>{produce?.cropType} — {produce?.origin}</p>
            <p style={styles.successDetail}>Price: ₹{form.price}/kg</p>
            <p style={styles.successDetail}>Ko: {form.toEmail}</p>
            <p style={styles.successDetail}>
              Jab woh payment karega tab blockchain pe transfer hoga
            </p>
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
      <div style={styles.card}>
        <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>
          ← Wapas
        </button>
        <h2 style={styles.title}>Transfer Request Bhejo</h2>
        <p style={styles.roleText}>{user.name} ({user.role})</p>

        {!produce ? (
          <div>
            <label style={styles.label}>Produce ID daalo</label>
            <input style={styles.input}
              placeholder="Dashboard se ID Copy Karo"
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
            <div style={styles.produceBox}>
              <h3 style={styles.cropName}>{produce.cropType}</h3>
              <p style={styles.detail}>Kisan: {produce.farmerName}</p>
              <p style={styles.detail}>Mool: {produce.origin}</p>
              <p style={styles.detail}>Grade: {produce.qualityGrade}</p>
              <p style={styles.detail}>Farm Price: ₹{produce.farmPrice}/kg</p>
            </div>

            {error && <p style={styles.error}>{error}</p>}
            {loading && <p style={styles.loadingText}>Request bheji ja rahi hai...</p>}

            <form onSubmit={handleRequest}>
              <label style={styles.label}>Transfer Type</label>
              <select style={styles.input} value={form.transferType}
                onChange={e => setForm({...form, transferType: e.target.value})}>
                {user.role === 'FARMER' && (
                  <option value="FARM_TO_DISTRIBUTOR">Farmer → Distributor</option>
                )}
                {user.role === 'DISTRIBUTOR' && (
                  <option value="DISTRIBUTOR_TO_RETAILER">Distributor → Retailer</option>
                )}
                {user.role === 'RETAILER' && (
                  <option value="RETAILER_TO_CONSUMER">Retailer → Consumer</option>
                )}
              </select>

              <label style={styles.label}>
                {user.role === 'FARMER' ? 'Distributor' :
                 user.role === 'DISTRIBUTOR' ? 'Retailer' : 'Consumer'} ka Email
              </label>
              <input style={styles.input} type="email" placeholder="Email address"
                value={form.toEmail}
                onChange={e => setForm({...form, toEmail: e.target.value})} required />

              <label style={styles.label}>Aapka Price (₹/kg)</label>
              <input style={styles.input} type="number"
                placeholder={user.role === 'FARMER' ? '22' : user.role === 'DISTRIBUTOR' ? '30' : '38'}
                value={form.price}
                onChange={e => setForm({...form, price: e.target.value})} required />

              <label style={styles.label}>Location</label>
              <input style={styles.input} placeholder="Pune, Maharashtra"
                value={form.location}
                onChange={e => setForm({...form, location: e.target.value})} required />

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
  container: { minHeight:'100vh', background:'linear-gradient(180deg, #f6f9f4 0%, #edf5ea 100%)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' },
  card: { background:'#fff', padding:'1.5rem', borderRadius:'16px', width:'100%', maxWidth:'500px', border:'1px solid #dbe5d8', boxShadow:'0 10px 24px rgba(26, 44, 33, 0.09)' },
  title: { color:'#1f3320', marginBottom:'0.4rem' },
  roleText: { color:'#5f7167', fontSize:'0.85rem', marginBottom:'1.2rem' },
  label: { display:'block', color:'#3f5346', marginBottom:'0.32rem', fontSize:'0.9rem', fontWeight:'700' },
  input: { width:'100%', padding:'0.78rem 0.85rem', marginBottom:'0.95rem', border:'1px solid #d3dfd0', borderRadius:'10px', fontSize:'0.98rem', boxSizing:'border-box', background:'#fbfdfb' },
  button: { width:'100%', padding:'0.8rem', background:'#27500A', color:'white', border:'none', borderRadius:'10px', fontSize:'0.98rem', cursor:'pointer', marginTop:'0.4rem', fontWeight:'700' },
  backBtn: { background:'none', border:'none', color:'#27500A', cursor:'pointer', marginBottom:'1rem', fontSize:'0.9rem', padding:0 },
  error: { color:'#a22929', marginBottom:'1rem', fontSize:'0.9rem', background:'#fdecec', border:'1px solid #f4cfcf', borderRadius:'10px', padding:'0.6rem 0.75rem' },
  loadingText: { color:'#8b5318', background:'#fff1df', padding:'0.72rem', borderRadius:'10px', marginBottom:'1rem', fontSize:'0.9rem' },
  produceBox: { background:'#eef5e9', padding:'0.95rem', borderRadius:'10px', marginBottom:'1.2rem', border:'1px solid #dbe5d8' },
  cropName: { color:'#27500A', margin:'0 0 0.5rem' },
  detail: { color:'#4f6057', fontSize:'0.9rem', margin:'0.2rem 0' },
  successBox: { background:'#eef5e9', padding:'1rem', borderRadius:'10px', margin:'1rem 0', border:'1px solid #dbe5d8' },
  successText: { color:'#27500A', fontWeight:'bold', margin:'0 0 0.5rem' },
  successDetail: { color:'#4f6057', fontSize:'0.9rem', margin:'0.2rem 0' }
};
