import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function Payment() {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState(null);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    try {
      const res = await api.get('/api/payment/pending');
      setPendingRequests(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (transfer) => {
    setPayingId(transfer._id);
    try {
      // Step 1: Razorpay order banao
      const orderRes = await api.post('/api/payment/create-order', {
        transferId: transfer._id
      });

      const { orderId, amount, produce } = orderRes.data;

      // Step 2: Razorpay checkout kholo
      const options = {
        key: process.env.REACT_APP_RAZORPAY_KEY_ID,
        amount: amount,
        currency: 'INR',
        name: 'FarmTrace',
        description: `${produce.cropType} — ${produce.origin}`,
        order_id: orderId,
        handler: async (response) => {
          try {
            // Step 3: Payment verify karo
            const verifyRes = await api.post('/api/payment/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              transferId: transfer._id
            });

            if (verifyRes.data.success) {
              alert(`Payment ho gayi! Blockchain pe transfer ho gaya!\nTX: ${verifyRes.data.txHash?.slice(0,20)}...`);
              fetchPending();
              navigate('/dashboard');
            }
          } catch (err) {
            alert('Payment verify nahi hua: ' + err.message);
          }
        },
        prefill: {
          contact: user.phone
        },
        theme: {
          color: '#27500A'
        },
        modal: {
          ondismiss: () => setPayingId(null)
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (err) {
      alert('Payment shuru nahi hua: ' + err.message);
      setPayingId(null);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>
          ← Dashboard
        </button>
        <h2 style={styles.title}>Pending Payment Requests</h2>
      </div>

      {loading ? (
        <p style={styles.loading}>Load ho raha hai...</p>
      ) : pendingRequests.length === 0 ? (
        <div style={styles.empty}>
          <p>Koi pending request nahi hai</p>
          <p style={{fontSize:'0.85rem', color:'#888'}}>
            Jab farmer transfer request bhejega tab yahan dikhega
          </p>
        </div>
      ) : (
        <div style={styles.grid}>
          {pendingRequests.map(t => (
            <div key={t._id} style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cropName}>{t.produce?.cropType}</h3>
                <span style={styles.pendingBadge}>Payment Pending</span>
              </div>

              <p style={styles.detail}>Kisan: {t.produce?.farmerName}</p>
              <p style={styles.detail}>Mool: {t.produce?.origin}</p>
              <p style={styles.detail}>Maatra: {t.produce?.quantity} kg</p>
              <p style={styles.detail}>Grade: {t.produce?.qualityGrade}</p>
              <p style={styles.detail}>From: {t.fromPhone}</p>
              <p style={styles.detail}>Location: {t.location}</p>

              <div style={styles.priceBox}>
                <div>
                  <p style={styles.priceLabel}>Price per kg</p>
                  <p style={styles.price}>₹{t.price}/kg</p>
                </div>
                <div style={{textAlign:'right'}}>
                  <p style={styles.priceLabel}>Total amount</p>
                  <p style={styles.totalPrice}>
                    ₹{(t.price * (t.produce?.quantity || 0)).toLocaleString()}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handlePayment(t)}
                style={styles.payBtn}
                disabled={payingId === t._id}>
                {payingId === t._id ? 'Processing...' : `Pay ₹${(t.price * (t.produce?.quantity || 0)).toLocaleString()}`}
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
  header: { display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1.5rem', background:'white', padding:'1rem 1.5rem', borderRadius:'12px' },
  backBtn: { background:'none', border:'none', color:'#27500A', cursor:'pointer', fontSize:'0.9rem' },
  title: { color:'#27500A', margin:0, fontSize:'1.3rem' },
  loading: { textAlign:'center', color:'#666', marginTop:'2rem' },
  empty: { textAlign:'center', color:'#666', marginTop:'3rem', padding:'2rem', background:'white', borderRadius:'12px' },
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'1rem' },
  card: { background:'white', padding:'1.5rem', borderRadius:'12px', boxShadow:'0 2px 8px rgba(0,0,0,0.08)' },
  cardHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' },
  cropName: { margin:0, color:'#27500A', fontSize:'1.2rem' },
  pendingBadge: { background:'#FAEEDA', color:'#854F0B', padding:'0.25rem 0.75rem', borderRadius:'20px', fontSize:'0.8rem', fontWeight:'bold' },
  detail: { color:'#666', fontSize:'0.9rem', margin:'0.2rem 0' },
  priceBox: { display:'flex', justifyContent:'space-between', background:'#EAF3DE', padding:'0.75rem', borderRadius:'8px', margin:'1rem 0' },
  priceLabel: { color:'#666', fontSize:'0.75rem', margin:'0 0 0.25rem' },
  price: { color:'#27500A', fontWeight:'bold', fontSize:'1rem', margin:0 },
  totalPrice: { color:'#27500A', fontWeight:'bold', fontSize:'1.2rem', margin:0 },
  payBtn: { width:'100%', padding:'0.75rem', background:'#27500A', color:'white', border:'none', borderRadius:'8px', fontSize:'1rem', cursor:'pointer', fontWeight:'bold' }
};
