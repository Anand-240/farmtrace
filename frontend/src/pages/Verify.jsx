import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';

export default function Verify() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/api/v1/produce/${id}`)
      .then(res => setData(res.data))
      .catch(() => setError('Produce nahi mila'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={styles.center}><p>Load ho raha hai...</p></div>;
  if (error) return <div style={styles.center}><p style={{color:'red'}}>{error}</p></div>;
  if (!data) return null;

  const transfers = data.dbTransfers || [];
  const lastPrice = transfers.length > 0
    ? transfers[transfers.length - 1].price
    : data.farmPrice;
  const priceGap = lastPrice - data.farmPrice;

  const transferLabel = {
    'FARM_TO_DISTRIBUTOR': 'Distributor',
    'DISTRIBUTOR_TO_RETAILER': 'Retailer',
    'RETAILER_TO_CONSUMER': 'Consumer'
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>FarmTrace</h1>

        {data.isBlockchainVerified && (
          <div style={styles.verifiedBadge}>
            Blockchain Verified — Data Tamper-proof Hai
          </div>
        )}

        {/* Produce Info */}
        <div style={styles.section}>
          <h2 style={styles.cropName}>{data.cropType}</h2>
          <p style={styles.detail}>Kisan: <strong>{data.farmerName}</strong></p>
          <p style={styles.detail}>Mool: {data.origin}</p>
          <p style={styles.detail}>Maatra: {data.quantity} kg</p>
          <p style={styles.detail}>Gunvatta: Grade {data.qualityGrade}</p>
          <p style={styles.detail}>
            Katai: {new Date(data.createdAt).toLocaleDateString('hi-IN')}
          </p>
        </div>

        {/* Price Journey */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Daam ka Safar — Khet se Aap Tak</h3>

          {/* Farm step */}
          <div style={styles.journeyStep}>
            <div style={styles.stepLeft}>
              <div style={{...styles.dot, background:'#27500A'}}/>
              {transfers.length > 0 && <div style={styles.line}/>}
            </div>
            <div style={styles.stepContent}>
              <p style={styles.stepTitle}>Khet — {data.farmerName}</p>
              <p style={styles.stepSub}>{data.origin}</p>
              <p style={{...styles.stepPrice, color:'#27500A'}}>
                ₹{data.farmPrice}/kg
              </p>
            </div>
          </div>

          {/* Transfer steps */}
          {transfers.map((t, i) => (
            <div key={i} style={styles.journeyStep}>
              <div style={styles.stepLeft}>
                <div style={{...styles.dot, background:'#085041'}}/>
                {i < transfers.length - 1 && <div style={styles.line}/>}
              </div>
              <div style={styles.stepContent}>
                <p style={styles.stepTitle}>
                  {transferLabel[t.transferType] || `Step ${i+1}`}
                </p>
                <p style={styles.stepSub}>{t.location}</p>
                <p style={{...styles.stepPrice, color:'#085041'}}>
                  ₹{t.price}/kg
                </p>
                {t.txHash && (
                  <a href={`https://sepolia.etherscan.io/tx/${t.txHash}`}
                    target="_blank" rel="noreferrer" style={styles.miniLink}>
                    Blockchain proof →
                  </a>
                )}
              </div>
            </div>
          ))}

          {/* Price gap */}
          {priceGap > 0 ? (
            <div style={styles.gapBox}>
              <p style={styles.gapText}>
                Beech mein gaya: ₹{priceGap}/kg
              </p>
              <p style={styles.gapSub}>
                Kisan ko mila ₹{data.farmPrice}/kg —
                Aakhri price ₹{lastPrice}/kg
              </p>
            </div>
          ) : (
            <div style={styles.noTransfer}>
              <p>Abhi sirf farm pe registered hai</p>
              <p style={{fontSize:'0.8rem', color:'#888'}}>
                Transfer hone par yahan dikhega
              </p>
            </div>
          )}
        </div>

        {/* Blockchain Proof */}
        {data.txHash && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Blockchain Proof</h3>
            <p style={styles.hashText}>{data.txHash.slice(0,35)}...</p>
            <a href={`https://sepolia.etherscan.io/tx/${data.txHash}`}
              target="_blank" rel="noreferrer" style={styles.ethLink}>
              Etherscan pe verify karo →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight:'100vh', background:'linear-gradient(180deg, #f6f9f4 0%, #edf5ea 100%)', display:'flex', justifyContent:'center', padding:'1rem' },
  center: { display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh' },
  card: { background:'#fff', padding:'1.3rem', borderRadius:'14px', width:'100%', maxWidth:'500px', height:'fit-content', border:'1px solid #dbe5d8', boxShadow:'0 10px 24px rgba(26, 44, 33, 0.09)' },
  title: { color:'#1f3320', textAlign:'center', marginBottom:'1rem' },
  verifiedBadge: { background:'#eef5e9', color:'#27500A', padding:'0.72rem', borderRadius:'10px', textAlign:'center', fontWeight:'700', marginBottom:'1rem', fontSize:'0.9rem', border:'1px solid #dbe5d8' },
  section: { borderTop:'1px solid #e7eee5', paddingTop:'1rem', marginTop:'1rem' },
  cropName: { color:'#1f3320', fontSize:'1.4rem', margin:'0 0 0.5rem' },
  detail: { color:'#4f6057', margin:'0.25rem 0', fontSize:'0.95rem' },
  sectionTitle: { color:'#34473b', marginBottom:'1rem', fontSize:'1rem', fontWeight:'700' },
  journeyStep: { display:'flex', gap:'1rem', marginBottom:'0.25rem' },
  stepLeft: { display:'flex', flexDirection:'column', alignItems:'center', width:'16px' },
  dot: { width:'14px', height:'14px', borderRadius:'50%', flexShrink:0, marginTop:'3px' },
  line: { width:'2px', flex:1, background:'#ddd', margin:'4px 0', minHeight:'30px' },
  stepContent: { flex:1, paddingBottom:'1rem' },
  stepTitle: { color:'#2a3b31', fontWeight:'700', margin:'0 0 0.2rem', fontSize:'0.95rem' },
  stepSub: { color:'#708078', fontSize:'0.85rem', margin:'0 0 0.2rem' },
  stepPrice: { fontWeight:'bold', fontSize:'1.1rem', margin:0 },
  miniLink: { color:'#0a5a79', fontSize:'0.75rem' },
  gapBox: { background:'#fdecec', padding:'0.75rem', borderRadius:'10px', marginTop:'0.5rem', border:'1px solid #f4d7d7' },
  gapText: { color:'#791F1F', fontWeight:'bold', margin:'0 0 0.25rem' },
  gapSub: { color:'#A32D2D', fontSize:'0.85rem', margin:0 },
  noTransfer: { background:'#f3f7f1', padding:'0.75rem', borderRadius:'10px', textAlign:'center', color:'#5f7167', border:'1px solid #e1e9de' },
  hashText: { fontFamily:'monospace', color:'#607169', fontSize:'0.8rem' },
  ethLink: { color:'#0a5a79', fontSize:'0.9rem', fontWeight:'700' }
};
