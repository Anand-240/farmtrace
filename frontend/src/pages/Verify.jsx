import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import { track } from '../lib/posthog';
import { VerticalTimeline, VerticalTimelineElement }  from 'react-vertical-timeline-component';
import 'react-vertical-timeline-component/style.min.css';
import { Sprout, Truck, Store, User as UserIcon, ArrowRight, ShieldCheck } from 'lucide-react';

export default function Verify() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/produce/${id}`)
      .then(res => {
        setData(res.data);
        console.log('🧐 Traceability Data:', res.data);
        track('traceability_viewed', { produceId: id, cropType: res.data?.cropType });
      })
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <p style={styles.detailLabel}>FARMER</p>
              <p style={styles.detailVal}>{data.farmerName}</p>
            </div>
            <div>
              <p style={styles.detailLabel}>ORIGIN</p>
              <p style={styles.detailVal}>{data.origin}</p>
            </div>
            <div>
              <p style={styles.detailLabel}>QUANTITY</p>
              <p style={styles.detailVal}>{data.quantity} kg</p>
            </div>
            <div>
              <p style={styles.detailLabel}>GRADE</p>
              <p style={styles.detailVal}>{data.qualityGrade}</p>
            </div>
          </div>
        </div>

        {/* Price Journey Timeline */}
        <div style={{ marginTop: '3rem' }}>
          <h3 style={{ color: '#0f172a', marginBottom: '1.5rem', fontSize: '1.25rem', fontWeight: 800, textAlign: 'center' }}>Immutable Supply Chain Journey</h3>
          
          <VerticalTimeline layout="1-column-left" lineColor="#e2e8f0">
            <VerticalTimelineElement
              className="vertical-timeline-element--work"
              contentStyle={{ background: '#fff', color: '#000', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
              contentArrowStyle={{ borderRight: '7px solid #fff' }}
              date={<span style={{ fontWeight: 700, color: '#64748b' }}>{new Date(data.createdAt).toLocaleDateString('en-IN')}</span>}
              iconStyle={{ background: '#22c55e', color: '#fff', boxShadow: '0 0 0 4px #dcfce7' }}
              icon={<Sprout />}
            >
              <h3 className="vertical-timeline-element-title" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#166534', margin: '0 0 0.5rem 0' }}>Origin Farm</h3>
              <h4 className="vertical-timeline-element-subtitle" style={{ fontSize: '1rem', color: '#475569', margin: '0 0 1rem 0' }}>{data.farmerName} — {data.origin}</h4>
              <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                Farm Price: ₹{data.farmPrice}/kg
              </p>
              {data.txHash && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                   <a href={`https://sepolia.etherscan.io/tx/${data.txHash}`} target="_blank" rel="noreferrer" style={{color: '#22c55e', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontSize: '0.85rem'}}>
                     <ShieldCheck size={16}/> Verified Genesis Block
                   </a>
                </div>
              )}
            </VerticalTimelineElement>

            {transfers.map((t, i) => {
              let icon = <Truck />;
              let bg = '#3b82f6';
              let shadow = '#dbeafe';
              if (t.transferType === 'DISTRIBUTOR_TO_RETAILER') { icon = <Store />; bg = '#8b5cf6'; shadow = '#ede9fe'; }
              if (t.transferType === 'RETAILER_TO_CONSUMER') { icon = <UserIcon />; bg = '#f59e0b'; shadow = '#fef3c7'; }

              return (
                  <VerticalTimelineElement
                    key={i}
                    className="vertical-timeline-element--work"
                    contentStyle={{ background: '#fff', color: '#000', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                    contentArrowStyle={{ borderRight: '7px solid #fff' }}
                    date={t.txHash ? <a href={`https://sepolia.etherscan.io/tx/${t.txHash}`} target="_blank" rel="noreferrer" style={{color: bg, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', background: shadow, padding: '4px 10px', borderRadius: '99px'}}>View Proof <ArrowRight size={14}/></a> : <span style={{ color: '#94a3b8', fontWeight: 600 }}>Processing...</span>}
                    iconStyle={{ background: bg, color: '#fff', boxShadow: `0 0 0 4px ${shadow}` }}
                    icon={icon}
                  >
                    <h3 className="vertical-timeline-element-title" style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.5rem 0' }}>
                      {transferLabel[t.transferType] || `Transfer ${i+1}`}
                    </h3>
                    <h4 className="vertical-timeline-element-subtitle" style={{ fontSize: '0.95rem', color: '#64748b', margin: '0 0 1rem 0' }}>{t.location}</h4>
                    <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: bg }}>
                      Price: ₹{t.price}/kg
                    </p>
                  </VerticalTimelineElement>
              );
            })}
          </VerticalTimeline>

          {/* Price gap */}
          {priceGap > 0 && (
            <div style={styles.gapBox}>
              <p style={styles.gapText}>
                Value Added / Middlemen Margin: ₹{priceGap}/kg
              </p>
              <p style={styles.gapSub}>
                Farm Rate: ₹{data.farmPrice}/kg — Current Rate: ₹{lastPrice}/kg
              </p>
            </div>
          )}
          {transfers.length === 0 && (
            <div style={styles.noTransfer}>
              <p>Presently at the origin farm.</p>
              <p style={{fontSize:'0.8rem', color:'#888'}}>
                Subsequent supply chain movements will appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight:'100vh', background:'#f8fafc', display:'flex', justifyContent:'center', padding:'2rem 1rem' },
  center: { display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', background:'#f8fafc' },
  card: { background:'#fff', padding:'2.5rem', borderRadius:'24px', width:'100%', maxWidth:'600px', height:'fit-content', border:'1px solid #e2e8f0', boxShadow:'0 10px 40px rgba(0, 0, 0, 0.04)' },
  title: { color:'#0f172a', textAlign:'center', marginBottom:'1.5rem', fontSize:'2rem', fontWeight:900, letterSpacing:'-0.03em' },
  verifiedBadge: { background:'#f0fdf4', color:'#166534', padding:'0.75rem', borderRadius:'12px', textAlign:'center', fontWeight:'800', marginBottom:'2rem', fontSize:'0.9rem', border:'1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' },
  section: { borderTop:'1px solid #f1f5f9', paddingTop:'2rem' },
  cropName: { color:'#0f172a', fontSize:'1.75rem', margin:'0 0 1rem', fontWeight: 900, textAlign: 'center' },
  detailLabel: { fontSize: '0.7rem', color: '#64748b', fontWeight: 800, margin: '0 0 0.25rem', letterSpacing: '0.1em' },
  detailVal: { fontSize: '1rem', color: '#0f172a', fontWeight: 700, margin: 0 },
  gapBox: { background:'#fff1f2', padding:'1.5rem', borderRadius:'16px', marginTop:'2rem', border:'1px solid #ffe4e6', textAlign: 'center' },
  gapText: { color:'#be123c', fontWeight:'800', margin:'0 0 0.5rem', fontSize: '1.1rem' },
  gapSub: { color:'#e11d48', fontSize:'0.9rem', margin:0, fontWeight: 600 },
  noTransfer: { background:'#f8fafc', padding:'2rem', borderRadius:'16px', textAlign:'center', color:'#64748b', border:'1px solid #e2e8f0', marginTop: '2rem' },
};
