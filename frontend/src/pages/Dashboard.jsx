import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import api from '../lib/api';
import './Dashboard.css';

export default function Dashboard() {
  const [myProduces, setMyProduces] = useState([]);
  const [receivedProduces, setReceivedProduces] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
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
          const pending = await api.get('/api/payment/pending');
          setPendingCount(pending.data.length);
        }
        const notifRes = await api.get('/api/payment/notifications');
        setUnreadNotifs(notifRes.data.filter(n => !n.isRead).length);
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

  const roleLabel = user.role || 'USER';

  return (
    <div className="dashboard-page">
      <div className="dashboard-bg-orb dashboard-bg-orb-a" />
      <div className="dashboard-bg-orb dashboard-bg-orb-b" />

      {qrModal && (
        <div className="dashboard-modal-overlay" onClick={() => setQrModal(null)}>
          <div className="dashboard-modal-card" onClick={e => e.stopPropagation()}>
            <h3 className="dashboard-modal-title">QR Code - Scan Karo</h3>
            <p className="dashboard-modal-sub">Yeh QR scan karne par poori supply chain history dikhegi</p>
            <img src={qrModal.qr} alt="QR Code"
              className="dashboard-modal-qr" />
            <p className="dashboard-modal-url">{qrModal.url}</p>
            <button onClick={() => setQrModal(null)} className="btn btn-solid btn-full">
              Band Karo
            </button>
          </div>
        </div>
      )}

      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">FarmTrace Control Hub</h1>
          <p className="dashboard-welcome">
            Namaste, {user.name}
            <span className="dashboard-role-badge" style={{ background: roleColor[user.role] || '#27500A' }}>
              {roleLabel}
            </span>
          </p>
        </div>
        <button onClick={logout} className="btn btn-ghost">Logout</button>
      </div>

      <div className="dashboard-actions-row">
        {user.role === 'FARMER' && (
          <button onClick={() => navigate('/register-produce')} className="btn btn-solid btn-farmer">
            + Nayi Fasal Register Karo
          </button>
        )}
        {user.role !== 'CONSUMER' && (
          <button onClick={() => navigate('/transfer')} className="btn btn-solid btn-transfer">
            Transfer Request Bhejo
          </button>
        )}
        {user.role !== 'FARMER' && (
          <button onClick={() => navigate('/payment')} className="btn btn-solid btn-payment">
            Pending Payments {pendingCount > 0 && `(${pendingCount})`}
          </button>
        )}
        <button onClick={() => navigate('/transactions')} className="btn btn-solid btn-history">
          History & Notifications
          {unreadNotifs > 0 && (
            <span className="notif-badge">{unreadNotifs}</span>
          )}
        </button>
        {user.role === 'FARMER' && (
          <button onClick={() => navigate('/ai')} className="btn btn-solid btn-ai">
            AI Assistant
          </button>
        )}
      </div>

      {loading ? (
        <p className="dashboard-loading">Load ho raha hai...</p>
      ) : (
        <div className="dashboard-grid">

          {user.role === 'FARMER' && myProduces.length === 0 && (
            <div className="dashboard-empty"><p>Abhi koi fasal register nahi ki</p></div>
          )}

          {user.role === 'FARMER' && myProduces.map(p => (
            <div key={p._id} className="produce-card">
              <div className="produce-card-header">
                <h3 className="produce-name">{p.cropType}</h3>
                <span className={`status-badge ${p.blockchainStatus === 'CONFIRMED' ? 'status-ok' : 'status-pending'}`}>
                  {p.blockchainStatus === 'CONFIRMED' ? 'Verified' : 'Pending'}
                </span>
              </div>
              <p className="produce-detail">Mool: {p.origin}</p>
              <p className="produce-detail">Maatra: {p.quantity} kg</p>
              <p className="produce-detail">Grade: {p.qualityGrade}</p>
              <p className="produce-price">Rs {p.farmPrice}/kg</p>
              <button onClick={() => showQR(p._id)} className="btn btn-action-primary">
                QR Code Dekho / Print Karo
              </button>
              <button onClick={() => copyId(p._id)} className="btn btn-action-secondary">
                ID Copy Karo
              </button>
              {p.txHash && (
                <a href={`https://sepolia.etherscan.io/tx/${p.txHash}`}
                  target="_blank" rel="noreferrer" className="chain-link">
                  Blockchain pe dekho →
                </a>
              )}
              <button onClick={() => navigate(`/verify/${p._id}`)} className="btn btn-verify">
                Poori Journey Dekho
              </button>
            </div>
          ))}

          {user.role !== 'FARMER' && receivedProduces.length === 0 && (
            <div className="dashboard-empty">
              <p>Abhi koi produce receive nahi hua</p>
              <p className="dashboard-empty-sub">
                Jab payment complete hogi tab yahan dikhega
              </p>
            </div>
          )}

          {user.role !== 'FARMER' && receivedProduces.map(p => (
            <div key={p._id} className="produce-card">
              <div className="produce-card-header">
                <h3 className="produce-name">{p.cropType}</h3>
                <span className="status-badge status-received">
                  Received
                </span>
              </div>
              <p className="produce-detail">Kisan: {p.farmerName}</p>
              <p className="produce-detail">Mool: {p.origin}</p>
              <p className="produce-detail">Maatra: {p.quantity} kg</p>
              <p className="produce-detail">Grade: {p.qualityGrade}</p>
              <div className="price-row">
                <div>
                  <p className="price-label">Farm price</p>
                  <p className="farm-price">Rs {p.farmPrice}/kg</p>
                </div>
                <div className="price-right">
                  <p className="price-label">Tumne diya</p>
                  <p className="received-price">Rs {p.receivedPrice}/kg</p>
                </div>
              </div>
              <button onClick={() => showQR(p._id)} className="btn btn-action-primary">
                QR Code Dekho / Print Karo
              </button>
              <button onClick={() => copyId(p._id)} className="btn btn-action-secondary">
                ID Copy Karo
              </button>
              <button onClick={() => navigate(`/verify/${p._id}`)} className="btn btn-verify">
                Poori Journey Dekho
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
