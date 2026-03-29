import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import api from '../lib/api';

export default function Register() {
  const [form, setForm] = useState({
    farmerName: '', cropType: 'Tamatar', origin: '',
    quantity: '', qualityGrade: 'A', farmPrice: ''
  });
  const [result, setResult] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/api/produce/register', {
        ...form,
        farmerName: form.farmerName || user.name,
        quantity: Number(form.quantity),
        farmPrice: Number(form.farmPrice)
      });

      // Frontend se QR generate karo — window.location use karo
      const verifyUrl = `${window.location.origin}/verify/${res.data.produce._id}`;
      const qr = await QRCode.toDataURL(verifyUrl, { width: 300 });

      setResult(res.data);
      setQrDataUrl(qr);
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
            Blockchain pe Register Ho Gaya!
          </h2>
          <div style={styles.qrBox}>
            <img src={qrDataUrl} alt="QR Code"
              style={{width:'220px', height:'220px'}} />
          </div>
          <p style={styles.verifyUrl}>
            {window.location.origin}/verify/{result.produce._id}
          </p>
          <p style={styles.detail}>
            TX: <span style={styles.hash}>{result.txHash?.slice(0,25)}...</span>
          </p>
          <a href={result.etherscanUrl} target="_blank"
            rel="noreferrer" style={styles.ethLink}>
            Etherscan pe verify karo →
          </a>
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
        <h2 style={styles.title}>Nayi Fasal Register Karo</h2>
        {error && <p style={styles.error}>{error}</p>}
        {loading && (
          <p style={styles.loading}>
            Blockchain pe register ho raha hai... (15-30 second)
          </p>
        )}
        <form onSubmit={handleSubmit}>
          <label style={styles.label}>Kisan ka Naam</label>
          <input style={styles.input} placeholder={user.name}
            value={form.farmerName}
            onChange={e => setForm({...form, farmerName: e.target.value})} />

          <label style={styles.label}>Fasal ka Prakar</label>
          <select style={styles.input} value={form.cropType}
            onChange={e => setForm({...form, cropType: e.target.value})}>
            <option>Tamatar</option>
            <option>Pyaaz</option>
            <option>Aalu</option>
            <option>Gehun</option>
            <option>Chawal</option>
            <option>Other</option>
          </select>

          <label style={styles.label}>Mool Sthan</label>
          <input style={styles.input} placeholder="Nashik, Maharashtra"
            value={form.origin}
            onChange={e => setForm({...form, origin: e.target.value})} required />

          <label style={styles.label}>Maatra (kg)</label>
          <input style={styles.input} type="number" placeholder="500"
            value={form.quantity}
            onChange={e => setForm({...form, quantity: e.target.value})} required />

          <label style={styles.label}>Gunvatta Grade</label>
          <div style={styles.gradeRow}>
            {['A', 'B', 'C'].map(g => (
              <button type="button" key={g}
                style={{
                  ...styles.gradeBtn,
                  background: form.qualityGrade === g ? '#27500A' : '#EAF3DE',
                  color: form.qualityGrade === g ? 'white' : '#27500A'
                }}
                onClick={() => setForm({...form, qualityGrade: g})}>
                Grade {g}
              </button>
            ))}
          </div>

          <label style={styles.label}>Khet par Mool (₹/kg)</label>
          <input style={styles.input} type="number" placeholder="12"
            value={form.farmPrice}
            onChange={e => setForm({...form, farmPrice: e.target.value})} required />

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Register ho raha hai...' : 'Blockchain pe Register Karo'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight:'100vh', background:'linear-gradient(180deg, #f6f9f4 0%, #edf5ea 100%)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' },
  card: { background:'#fff', padding:'1.5rem', borderRadius:'16px', width:'100%', maxWidth:'480px', border:'1px solid #dbe5d8', boxShadow:'0 10px 24px rgba(26, 44, 33, 0.09)' },
  title: { color:'#1f3320', marginBottom:'1.2rem' },
  label: { display:'block', color:'#3f5346', marginBottom:'0.32rem', fontSize:'0.9rem', fontWeight:'700' },
  input: { width:'100%', padding:'0.78rem 0.85rem', marginBottom:'0.95rem', border:'1px solid #d3dfd0', borderRadius:'10px', fontSize:'0.98rem', boxSizing:'border-box', background:'#fbfdfb' },
  button: { width:'100%', padding:'0.8rem', background:'#27500A', color:'white', border:'none', borderRadius:'10px', fontSize:'0.98rem', cursor:'pointer', marginTop:'0.4rem', fontWeight:'700' },
  backBtn: { background:'none', border:'none', color:'#27500A', cursor:'pointer', marginBottom:'1rem', fontSize:'0.9rem', padding:0 },
  error: { color:'#a22929', marginBottom:'1rem', background:'#fdecec', border:'1px solid #f4cfcf', borderRadius:'10px', padding:'0.6rem 0.75rem' },
  loading: { color:'#8b5318', background:'#fff1df', padding:'0.72rem', borderRadius:'10px', marginBottom:'1rem', fontSize:'0.9rem' },
  gradeRow: { display:'flex', gap:'0.5rem', marginBottom:'1rem' },
  gradeBtn: { flex:1, padding:'0.6rem', border:'1px solid #d3dfd0', borderRadius:'10px', cursor:'pointer', fontWeight:'700' },
  qrBox: { display:'flex', justifyContent:'center', margin:'1.5rem 0' },
  verifyUrl: { color:'#6f7d74', fontSize:'0.75rem', textAlign:'center', margin:'0 0 1rem', wordBreak:'break-all' },
  detail: { color:'#526259', fontSize:'0.9rem' },
  hash: { fontFamily:'monospace', color:'#27500A' },
  ethLink: { display:'block', color:'#0a5a79', marginBottom:'1rem', fontWeight:'700' }
};
