import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { track } from '../lib/posthog';

const getRazorpayKeyId = () => {
  if (typeof window !== 'undefined' && window.__FARMTRACE_CONFIG__?.REACT_APP_RAZORPAY_KEY_ID) {
    return window.__FARMTRACE_CONFIG__.REACT_APP_RAZORPAY_KEY_ID;
  }

  return process.env.REACT_APP_RAZORPAY_KEY_ID;
};

const getApiErrorMessage = (err, fallback) => {
  return err?.response?.data?.message || err?.message || fallback;
};

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
      const res = await api.get('/api/v1/payment/pending');
      setPendingRequests(res.data);
    } catch (err) {
      // silent — Payment page will show empty state
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (transfer) => {
    setPayingId(transfer._id);
    try {
      // Step 1: Razorpay order banao
      const orderRes = await api.post('/api/v1/payment/create-order', {
        transferId: transfer._id
      });

      const { orderId, amount, produce, razorpayKeyId: serverRazorpayKeyId } = orderRes.data;
      const razorpayKeyId = serverRazorpayKeyId || getRazorpayKeyId();

      if (!razorpayKeyId) {
        throw new Error('Razorpay key missing. Server ya frontend config check karo.');
      }

      if (!window.Razorpay) {
        throw new Error('Razorpay SDK load nahi hua. Internet ya script block check karo.');
      }

      // Step 2: Razorpay checkout kholo
      const options = {
        key: razorpayKeyId,
        amount: amount,
        currency: 'INR',
        name: 'FarmTrace',
        description: `${produce.cropType} — ${produce.origin} (Booking Amount)`,
        order_id: orderId,
        handler: async (response) => {
          try {
            // Step 3: Payment verify karo
            const verifyRes = await api.post('/api/v1/payment/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              transferId: transfer._id
            });

            if (verifyRes.data.success) {
              track('payment_verified', { transferId: transfer._id, cropType: produce?.cropType });
              const jobId = verifyRes.data.jobId;
              if (jobId) {
                toast.promise(
                  new Promise((resolve, reject) => {
                    const checkJob = setInterval(async () => {
                      try {
                        const jobRes = await api.get(`/api/v1/jobs/${jobId}`);
                        if (jobRes.data.state === 'completed') {
                          clearInterval(checkJob);
                          resolve(jobRes.data.result?.transactionHash || 'Verified');
                        } else if (jobRes.data.state === 'failed') {
                          clearInterval(checkJob);
                          reject(new Error(jobRes.data.failedReason || 'Transaction failed'));
                        }
                      } catch (e) {
                        clearInterval(checkJob);
                        reject(e);
                      }
                    }, 2000);
                  }),
                  {
                    loading: 'Writing to Blockchain...',
                    success: (tx) => `✅ Done! Booking ho gayi!\nTX: ${tx.slice(0, 20)}...`,
                    error: (err) => `Blockchain failed: ${err.message}`
                  }
                ).then(() => {
                  fetchPending();
                  navigate('/dashboard');
                });
              } else {
                toast.success('Booking ho gayi!');
                fetchPending();
                navigate('/dashboard');
              }
            }
          } catch (err) {
            toast.error('Payment verify nahi hua: ' + getApiErrorMessage(err, 'Verification failed'));
            setPayingId(null);
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
      track('razorpay_opened', { transferId: transfer._id, cropType: produce?.cropType, amount });
      rzp.open();

    } catch (err) {
      toast.error('Payment shuru nahi hua: ' + getApiErrorMessage(err, 'Checkout start failed'));
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

              <div style={styles.milestoneBox}>
                <h4 style={{margin:'0 0 0.7rem', color:'#27500A', fontSize:'0.95rem'}}>Milestone Payments:</h4>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.5rem', fontSize:'0.85rem'}}>
                  <div style={styles.milestoneItem}>
                    <p style={{margin:'0 0 0.2rem', color:'#666', fontSize:'0.75rem'}}>Booking (40%)</p>
                    <p style={{margin:0, color:'#27500A', fontWeight:'bold'}}>₹{Math.round((t.price * (t.produce?.quantity || 0)) * 0.40).toLocaleString()}</p>
                  </div>
                  <div style={styles.milestoneItem}>
                    <p style={{margin:'0 0 0.2rem', color:'#666', fontSize:'0.75rem'}}>Dispatch (30%)</p>
                    <p style={{margin:0, color:'#888'}}>₹{Math.round((t.price * (t.produce?.quantity || 0)) * 0.30).toLocaleString()}</p>
                  </div>
                  <div style={styles.milestoneItem}>
                    <p style={{margin:'0 0 0.2rem', color:'#666', fontSize:'0.75rem'}}>Delivery (30%)</p>
                    <p style={{margin:0, color:'#888'}}>₹{((t.price * (t.produce?.quantity || 0)) - Math.round((t.price * (t.produce?.quantity || 0)) * 0.40) - Math.round((t.price * (t.produce?.quantity || 0)) * 0.30)).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handlePayment(t)}
                style={styles.payBtn}
                disabled={payingId === t._id}>
                {payingId === t._id ? 'Processing...' : `Pay Booking ₹${Math.round((t.price * (t.produce?.quantity || 0)) * 0.40).toLocaleString()}`}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { minHeight:'100vh', background:'linear-gradient(180deg, #f6f9f4 0%, #edf5ea 100%)', padding:'1rem' },
  header: { display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1rem', background:'#fff', padding:'1rem 1.2rem', borderRadius:'14px', border:'1px solid #dbe5d8', boxShadow:'0 8px 22px rgba(26, 44, 33, 0.08)' },
  backBtn: { background:'none', border:'none', color:'#27500A', cursor:'pointer', fontSize:'0.9rem', padding:0 },
  title: { color:'#1f3320', margin:0, fontSize:'1.2rem' },
  loading: { textAlign:'center', color:'#5f7167', marginTop:'2rem' },
  empty: { textAlign:'center', color:'#5f7167', marginTop:'2.4rem', padding:'1.5rem', background:'#fff', borderRadius:'14px', border:'1px solid #dbe5d8' },
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'1rem' },
  card: { background:'#fff', padding:'1.2rem', borderRadius:'14px', border:'1px solid #dbe5d8', boxShadow:'0 8px 22px rgba(26, 44, 33, 0.08)' },
  cardHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' },
  cropName: { margin:0, color:'#1f3320', fontSize:'1.1rem' },
  pendingBadge: { background:'#fff1df', color:'#8b5318', padding:'0.25rem 0.7rem', borderRadius:'20px', fontSize:'0.78rem', fontWeight:'700' },
  detail: { color:'#54645b', fontSize:'0.9rem', margin:'0.2rem 0' },
  priceBox: { display:'flex', justifyContent:'space-between', background:'#eef5e9', padding:'0.72rem', borderRadius:'10px', margin:'1rem 0', border:'1px solid #dbe5d8' },
  priceLabel: { color:'#61726a', fontSize:'0.75rem', margin:'0 0 0.25rem' },
  price: { color:'#27500A', fontWeight:'bold', fontSize:'1rem', margin:0 },
  totalPrice: { color:'#27500A', fontWeight:'bold', fontSize:'1.1rem', margin:0 },
  milestoneBox: { background:'#f8faf7', padding:'0.85rem', borderRadius:'10px', border:'1px solid #dbe5d8', margin:'1rem 0' },
  milestoneItem: { background:'#fff', padding:'0.5rem', borderRadius:'8px', border:'1px solid #e5e5e5', textAlign:'center' },
  payBtn: { width:'100%', padding:'0.78rem', background:'#27500A', color:'white', border:'none', borderRadius:'10px', fontSize:'0.97rem', cursor:'pointer', fontWeight:'700' }
};
