import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import api from '../lib/api';

export default function Dashboard() {
  const [myProduces, setMyProduces] = useState([]);
  const [receivedProduces, setReceivedProduces] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [qrModal, setQrModal] = useState(null);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (user.role === 'FARMER') {
          const res = await api.get('/api/produce/farmer/my');
          setMyProduces(res.data);
        } else {
          const res = await api.get('/api/produce/received/my');
          setReceivedProduces(res.data);
          // Pending payments count
          const pending = await api.get('/api/payment/pending');
          setPendingCount(pending.data.length);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user.role]);

  const logout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const copyId = (id) => {
    navigator.clipboard.writeText(id);
    alert('ID copy ho gayi!');
  };

  const showQR = async (produceId) => {
    try {
      const verifyUrl = `${window.location.origin}/verify/${produceId}`;
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 300 });
      setQrModal({ qr: qrDataUrl, url: verifyUrl });
    } catch (err) {
      alert('QR load nahi hua');
    }
  };

  const roleColor = { FARMER: '#27500A', DISTRIBUTOR: '#085041', RETAILER: '#854F0B' };

  return (
    <div style={styles.container}>

      {/* QR Modal */}
      {qrModal && (
        <div style={styles.modalOverlay} onClick={() => setQrModal(null)}>
          <div style={styles.modalCard} onClick={e => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>QR Code — Scan Karo</h3>
            <p style={styles.modalSub}>Yeh QR scan karne par poori supply chain history dikhegi</p>
            <img src={qrModal.qr} alt="QR Code"
              style={{width:'220px', height:'220px', display:'block', margin:'0 auto'}} />
            <p style={styles.modalUrl}>{qrModal.url}</p>
            <button onClick={() => setQrModal(null)} style={styles.closeBtn}>
              Band Karo
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>FarmTrace</h1>
          <p style={styles.welcome}>
            Namaste, {user.name}
            <span style={{...styles.roleBadge, background: roleColor[user.role] || '#27500A'}}>
              {user.role}
            </span>
          </p>
        </div>
        <button onClick={logout} style={styles.logoutBtn}>Logout</button>
      </div>

      {/* Action buttons */}
      <div style={styles.btnRow}>
        {user.role === 'FARMER' && (
          <button onClick={() => navigate('/register-produce')} style={styles.addBtn}>
            + Nayi Fasal Register Karo
          </button>
        )}
        {user.role !== 'CONSUMER' && (
          <button onClick={() => navigate('/transfer')} style={styles.transferBtn}>
            Transfer Request Bhejo
          </button>
        )}
        {user.role !== 'FARMER' && (
          <button onClick={() => navigate('/payment')} style={styles.paymentBtn}>
            Pending Payments {pendingCount > 0 && `(${pendingCount})`}
          </button>
        )}
      </div>

      {loading ? (
        <p style={styles.loading}>Load ho raha hai...</p>
      ) : (
        <div style={styles.grid}>

          {/* FARMER */}
          {user.role === 'FARMER' && myProduces.length === 0 && (
            <div style={styles.empty}><p>Abhi koi fasal register nahi ki</p></div>
          )}

          {user.role === 'FARMER' && myProduces.map(p => (
            <div key={p._id} style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cropName}>{p.cropType}</h3>
                <span style={{
                  ...styles.badge,
                  background: p.blockchainStatus === 'CONFIRMED' ? '#EAF3DE' : '#FAEEDA',
                  color: p.blockchainStatus === 'CONFIRMED' ? '#27500A' : '#854F0B'
                }}>
                  {p.blockchainStatus === 'CONFIRMED' ? 'Verified' : 'Pending'}
                </span>
              </div>
              <p style={styles.detail}>Mool: {p.origin}</p>
              <p style={styles.detail}>Maatra: {p.quantity} kg</p>
              <p style={styles.detail}>Grade: {p.qualityGrade}</p>
              <p style={styles.price}>₹{p.farmPrice}/kg</p>
              <button onClick={() => showQR(p._id)} style={styles.qrBtn}>
                QR Code Dekho / Print Karo
              </button>
              <button onClick={() => copyId(p._id)} style={styles.copyBtn}>
                ID Copy Karo
              </button>
              {p.txHash && (
                <a href={`https://sepolia.etherscan.io/tx/${p.txHash}`}
                  target="_blank" rel="noreferrer" style={styles.ethLink}>
                  Blockchain pe dekho →
                </a>
              )}
              <button onClick={() => navigate(`/verify/${p._id}`)} style={styles.verifyBtn}>
                Poori Journey Dekho
              </button>
            </div>
          ))}

          {/* DISTRIBUTOR / RETAILER */}
          {user.role !== 'FARMER' && receivedProduces.length === 0 && (
            <div style={styles.empty}>
              <p>Abhi koi produce receive nahi hua</p>
              <p style={{fontSize:'0.85rem', color:'#888'}}>
                Jab payment complete hogi tab yahan dikhega
              </p>
            </div>
          )}

          {user.role !== 'FARMER' && receivedProduces.map(p => (
            <div key={p._id} style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cropName}>{p.cropType}</h3>
                <span style={{...styles.badge, background:'#E1F5EE', color:'#085041'}}>
                  Received
                </span>
              </div>
              <p style={styles.detail}>Kisan: {p.farmerName}</p>
              <p style={styles.detail}>Mool: {p.origin}</p>
              <p style={styles.detail}>Maatra: {p.quantity} kg</p>
              <p style={styles.detail}>Grade: {p.qualityGrade}</p>
              <div style={styles.priceRow}>
                <div>
                  <p style={styles.priceLabel}>Farm price</p>
                  <p style={styles.farmPrice}>₹{p.farmPrice}/kg</p>
                </div>
                <div style={{textAlign:'right'}}>
                  <p style={styles.priceLabel}>Tumne diya</p>
                  <p style={styles.receivedPrice}>₹{p.receivedPrice}/kg</p>
                </div>
              </div>
              <button onClick={() => showQR(p._id)} style={styles.qrBtn}>
                QR Code Dekho / Print Karo
              </button>
              <button onClick={() => copyId(p._id)} style={styles.copyBtn}>
                ID Copy Karo
              </button>
              <button onClick={() => navigate(`/verify/${p._id}`)} style={styles.verifyBtn}>
                Poori Journey Dekho
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { minHeight:'100vh', background:'#f0f4f0', padding:'1rem' },
  modalOverlay: { position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 },
  modalCard: { background:'white', padding:'2rem', borderRadius:'16px', width:'90%', maxWidth:'340px', textAlign:'center' },
  modalTitle: { color:'#27500A', margin:'0 0 0.5rem' },
  modalSub: { color:'#666', fontSize:'0.85rem', margin:'0 0 1.5rem' },
  modalUrl: { color:'#888', fontSize:'0.7rem', margin:'1rem 0 1.5rem', wordBreak:'break-all' },
  closeBtn: { width:'100%', padding:'0.75rem', background:'#27500A', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'1rem' },
  header: { display:'flex', justifyContent:'space-between', alignItems:'center', background:'white', padding:'1rem 1.5rem', borderRadius:'12px', marginBottom:'1rem' },
  title: { color:'#27500A', margin:0, fontSize:'1.5rem' },
  welcome: { color:'#666', margin:0, fontSize:'0.9rem', display:'flex', alignItems:'center', gap:'0.5rem' },
  roleBadge: { color:'white', padding:'0.15rem 0.6rem', borderRadius:'20px', fontSize:'0.75rem', fontWeight:'bold' },
  logoutBtn: { background:'none', border:'1px solid #ddd', padding:'0.5rem 1rem', borderRadius:'8px', cursor:'pointer' },
  btnRow: { display:'flex', gap:'0.75rem', marginBottom:'1rem', flexWrap:'wrap' },
  addBtn: { flex:1, padding:'1rem', background:'#27500A', color:'white', border:'none', borderRadius:'12px', fontSize:'0.95rem', cursor:'pointer', minWidth:'150px' },
  transferBtn: { flex:1, padding:'1rem', background:'#085041', color:'white', border:'none', borderRadius:'12px', fontSize:'0.95rem', cursor:'pointer', minWidth:'150px' },
  paymentBtn: { flex:1, padding:'1rem', background:'#854F0B', color:'white', border:'none', borderRadius:'12px', fontSize:'0.95rem', cursor:'pointer', minWidth:'150px' },
  loading: { textAlign:'center', color:'#666', marginTop:'2rem' },
  empty: { textAlign:'center', color:'#666', marginTop:'2rem', padding:'2rem', background:'white', borderRadius:'12px', gridColumn:'1/-1' },
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'1rem' },
  card: { background:'white', padding:'1.25rem', borderRadius:'12px', boxShadow:'0 2px 8px rgba(0,0,0,0.08)' },
  cardHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' },
  cropName: { margin:0, color:'#27500A', fontSize:'1.2rem' },
  badge: { padding:'0.25rem 0.75rem', borderRadius:'20px', fontSize:'0.8rem', fontWeight:'bold' },
  detail: { color:'#666', fontSize:'0.9rem', margin:'0.2rem 0' },
  priceRow: { display:'flex', justifyContent:'space-between', margin:'0.75rem 0', padding:'0.75rem', background:'#f0f4f0', borderRadius:'8px' },
  priceLabel: { color:'#888', fontSize:'0.75rem', margin:'0 0 0.25rem' },
  price: { color:'#27500A', fontSize:'1.3rem', fontWeight:'bold', margin:'0.5rem 0' },
  farmPrice: { color:'#27500A', fontWeight:'bold', fontSize:'1rem', margin:0 },
  receivedPrice: { color:'#085041', fontWeight:'bold', fontSize:'1rem', margin:0 },
  qrBtn: { width:'100%', padding:'0.6rem', background:'#27500A', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'0.9rem', marginBottom:'0.5rem' },
  copyBtn: { width:'100%', padding:'0.4rem', background:'#f0f4f0', color:'#444', border:'1px solid #ddd', borderRadius:'6px', cursor:'pointer', fontSize:'0.85rem', marginBottom:'0.5rem' },
  ethLink: { display:'block', color:'#085041', fontSize:'0.8rem', marginBottom:'0.5rem' },
  verifyBtn: { width:'100%', padding:'0.5rem', background:'#EAF3DE', color:'#27500A', border:'none', borderRadius:'8px', cursor:'pointer' }
};
