import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Banknote, Plus, X, Clock, CheckCircle2, XCircle, AlertCircle, Upload, FileText, ExternalLink } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const LOAN_TYPES = {
  CROP_LOAN: { label: 'Crop Loan', icon: '🌾', rate: 7, desc: 'Short-term loan for crop cultivation (PM interest subvention up to ₹3L)' },
  KISAN_CREDIT_CARD: { label: 'Kisan Credit Card', icon: '💳', rate: 4, desc: 'Revolving credit up to ₹3L at 4% p.a. with interest subvention' },
  INVOICE_DISCOUNTING: { label: 'Invoice Discounting', icon: '📄', rate: 12, desc: 'Get instant cash against verified trade invoices' },
  WAREHOUSE_RECEIPT_LOAN: { label: 'Warehouse Receipt Loan', icon: '🏭', rate: 9, desc: 'Loan against WDRA warehouse receipts (up to 75% of produce value)' },
  EQUIPMENT_LOAN: { label: 'Equipment Loan', icon: '🚜', rate: 10, desc: 'Finance for farm machinery, irrigation, solar pumps etc.' }
};

const STATUS_CONFIG = {
  DRAFT: { color: '#6b7280', icon: <Clock size={14} />, label: 'Draft' },
  SUBMITTED: { color: '#3b82f6', icon: <AlertCircle size={14} />, label: 'Submitted' },
  UNDER_REVIEW: { color: '#d97706', icon: <AlertCircle size={14} />, label: 'Under Review' },
  APPROVED: { color: '#16a34a', icon: <CheckCircle2 size={14} />, label: 'Approved' },
  DISBURSED: { color: '#059669', icon: <CheckCircle2 size={14} />, label: 'Disbursed' },
  REJECTED: { color: '#dc2626', icon: <XCircle size={14} />, label: 'Rejected' },
  CLOSED: { color: '#6b7280', icon: <CheckCircle2 size={14} />, label: 'Closed' }
};

function ApplyModal({ onClose, onApplied }) {
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState('');
  const [form, setForm] = useState({ amount: '', purpose: '', tenure: '', cropType: '', collateral: '', bankName: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedType || !form.amount || !form.purpose) return toast.error('Required fields fill karein');
    setSaving(true);
    try {
      await api.post('/finance/apply', { loanType: selectedType, ...form, amount: Number(form.amount), tenure: form.tenure ? Number(form.tenure) : undefined });
      toast.success('Application submit ho gaya! Bank review karega.');
      onApplied(); onClose();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: '20px', padding: '2rem', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontWeight: 900, color: 'var(--ft-forest)' }}>{step === 1 ? 'Select Loan Type' : 'Loan Details'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={22} /></button>
        </div>

        {step === 1 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Object.entries(LOAN_TYPES).map(([k, v]) => (
              <div key={k} onClick={() => { setSelectedType(k); setStep(2); }} style={{ padding: '1.25rem', borderRadius: '14px', border: `2px solid ${selectedType === k ? 'var(--ft-forest)' : 'var(--ft-border)'}`, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'flex-start', gap: '1rem', background: selectedType === k ? '#f0fdf4' : '#fff' }}>
                <span style={{ fontSize: '2rem' }}>{v.icon}</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--ft-forest)', marginBottom: '0.2rem' }}>{v.label}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--ft-text-muted)', marginBottom: '0.4rem' }}>{v.desc}</div>
                  <span style={{ background: '#dcfce7', color: '#16a34a', padding: '0.15rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 800 }}>{v.rate}% p.a.</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>{LOAN_TYPES[selectedType]?.icon}</span>
              <div>
                <div style={{ fontWeight: 800 }}>{LOAN_TYPES[selectedType]?.label}</div>
                <div style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: 600 }}>{LOAN_TYPES[selectedType]?.rate}% p.a.</div>
              </div>
              <button type="button" onClick={() => setStep(1)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--ft-text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}>Change</button>
            </div>

            {[{ label: 'Loan Amount (₹) *', key: 'amount', type: 'number', placeholder: 'e.g. 100000' }, { label: 'Purpose *', key: 'purpose', placeholder: 'Describe why you need this loan' }, { label: 'Tenure (months)', key: 'tenure', type: 'number', placeholder: 'e.g. 12' }, { label: 'Crop Type', key: 'cropType', placeholder: 'e.g. Wheat (optional)' }, { label: 'Collateral', key: 'collateral', placeholder: 'e.g. Land, warehouse receipt' }, { label: 'Preferred Bank', key: 'bankName', placeholder: 'e.g. SBI, PNB, NABARD' }].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ft-text-muted)' }}>{f.label}</label>
                <input type={f.type || 'text'} placeholder={f.placeholder} value={form[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1.5px solid var(--ft-border)', marginTop: '0.35rem', fontSize: '0.95rem', boxSizing: 'border-box' }} />
              </div>
            ))}

            <button type="submit" disabled={saving} style={{ padding: '0.9rem', background: 'var(--ft-forest)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' }}>
              {saving ? 'Submitting...' : 'Submit Application'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function DocUploadSection({ loanId, existingDocs, onUploaded }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const fd = new FormData();
    files.forEach(f => fd.append('docs', f));
    try {
      const res = await api.post(`/finance/${loanId}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`${files.length} document(s) upload ho gaye!`);
      onUploaded(res.data.documents);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div style={{ borderTop: '1px solid var(--ft-border)', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', cursor: 'pointer', color: '#1d4ed8', fontWeight: 700, fontSize: '0.85rem', padding: 0 }}
      >
        <FileText size={15} /> Documents {existingDocs.length > 0 ? `(${existingDocs.length} uploaded)` : '(required)'} {open ? '▲' : '▼'}
      </button>
      {open && (
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {existingDocs.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
              {existingDocs.map((d, i) => (
                <a key={i} href={d.url} target="_blank" rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#eff6ff', color: '#1d4ed8', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700 }}>
                  <FileText size={12} /> {d.name} <ExternalLink size={10} />
                </a>
              ))}
            </div>
          )}
          <p style={{ fontSize: '0.78rem', color: 'var(--ft-text-muted)', marginBottom: '0.25rem' }}>
            Upload: Aadhaar, PAN, Land Record, Bank Passbook (JPG/PNG/PDF, max 5MB each)
          </p>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', background: uploading ? '#d1fae5' : '#fff', border: '1.5px dashed #16a34a', borderRadius: '10px', cursor: uploading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.85rem', color: '#166534', width: 'fit-content' }}>
            {uploading ? <><div className="ft-spinner-sm" /> Uploading...</> : <><Upload size={15} /> Choose Files</>}
            <input ref={fileRef} type="file" multiple accept="image/*,.pdf" onChange={handleUpload} disabled={uploading} style={{ display: 'none' }} />
          </label>
        </div>
      )}
    </div>
  );
}

export default function Finance() {
  const navigate = useNavigate();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showApply, setShowApply] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/finance/my'); setLoans(r.data.loans || []); } catch { toast.error('Load failed'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const totalDisbursed = loans.filter(l => l.status === 'DISBURSED').reduce((s, l) => s + (l.approvedAmount || l.amount), 0);

  return (
    <div className="ft-page planetono-flow">
      {showApply && <ApplyModal onClose={() => setShowApply(false)} onApplied={load} />}

      <nav className="ft-top-nav glass" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="ft-container nav-flex">
          <button onClick={() => navigate('/dashboard')} className="ft-btn ft-btn-ghost ft-btn-sm"><ArrowLeft size={18} /> Dashboard</button>
          <span className="nav-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Banknote size={20} /> Finance & Credit</span>
          <button onClick={() => setShowApply(true)} className="ft-btn ft-btn-sm" style={{ background: 'var(--ft-forest)', color: '#fff', border: 'none' }}><Plus size={16} /> Apply</button>
        </div>
      </nav>

      <div className="ft-container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--ft-forest)' }}>Agri Credit & Finance</h1>
          <p style={{ color: 'var(--ft-text-muted)' }}>Kisan Credit Card · Crop Loans · Invoice Discounting · Warehouse Receipt Loans</p>
        </div>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
          {[{ label: 'Total Applications', value: loans.length, icon: '📋', color: '#3b82f6' }, { label: 'Active Loans', value: loans.filter(l => l.status === 'DISBURSED').length, icon: '✅', color: '#16a34a' }, { label: 'Pending Review', value: loans.filter(l => ['SUBMITTED', 'UNDER_REVIEW'].includes(l.status)).length, icon: '⏳', color: '#d97706' }, { label: 'Total Disbursed', value: `₹${(totalDisbursed / 100000).toFixed(1)}L`, icon: '💰', color: '#059669' }].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: '14px', padding: '1.25rem', border: '1px solid var(--ft-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{s.icon}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--ft-text-muted)', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Loan Options Info */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
          {Object.entries(LOAN_TYPES).map(([k, v]) => (
            <div key={k} style={{ background: '#fff', borderRadius: '14px', padding: '1.25rem', border: '1px solid var(--ft-border)', cursor: 'pointer' }} onClick={() => setShowApply(true)}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{v.icon}</div>
              <div style={{ fontWeight: 800, color: 'var(--ft-forest)', marginBottom: '0.25rem' }}>{v.label}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--ft-text-muted)', marginBottom: '0.75rem' }}>{v.desc}</div>
              <span style={{ background: '#dcfce7', color: '#16a34a', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 800 }}>{v.rate}% p.a.</span>
            </div>
          ))}
        </div>

        {/* Applications */}
        <h2 style={{ fontWeight: 900, color: 'var(--ft-forest)', marginBottom: '1rem' }}>My Applications</h2>
        {loading ? <div style={{ textAlign: 'center', padding: '3rem' }}><div className="ft-spinner" style={{ margin: '0 auto' }} /></div> : loans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', background: '#fff', borderRadius: '16px', border: '1px solid var(--ft-border)' }}>
            <p style={{ fontSize: '2.5rem' }}>💳</p>
            <p style={{ fontWeight: 700, color: 'var(--ft-text-muted)', marginBottom: '1rem' }}>Abhi tak koi application nahi</p>
            <button onClick={() => setShowApply(true)} style={{ padding: '0.75rem 2rem', background: 'var(--ft-forest)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>Apply Now</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {loans.map(loan => {
              const sc = STATUS_CONFIG[loan.status] || STATUS_CONFIG.DRAFT;
              const lt = LOAN_TYPES[loan.loanType];
              return (
                <div key={loan._id} style={{ background: '#fff', borderRadius: '14px', padding: '1.5rem', border: '1px solid var(--ft-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '2rem' }}>{lt?.icon || '💰'}</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--ft-forest)' }}>{lt?.label || loan.loanType}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--ft-text-muted)', marginBottom: '0.4rem' }}>{loan.purpose}</div>
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                        <span>Amount: <strong>₹{loan.amount.toLocaleString()}</strong></span>
                        {loan.approvedAmount && <span>Approved: <strong style={{ color: '#16a34a' }}>₹{loan.approvedAmount.toLocaleString()}</strong></span>}
                        {loan.interestRate && <span>Rate: <strong>{loan.interestRate}%</strong></span>}
                        {loan.cropType && <span>Crop: <strong>{loan.cropType}</strong></span>}
                      </div>
                      {loan.rejectionReason && <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: '#dc2626' }}>Reason: {loan.rejectionReason}</p>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.8rem', borderRadius: '999px', background: `${sc.color}15`, color: sc.color, fontWeight: 700, fontSize: '0.85rem' }}>
                      {sc.icon} {sc.label}
                    </span>
                    <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', color: 'var(--ft-text-muted)' }}>{new Date(loan.createdAt).toLocaleDateString('hi-IN')}</p>
                  </div>
                  {['SUBMITTED', 'UNDER_REVIEW', 'DRAFT'].includes(loan.status) && (
                    <div style={{ width: '100%' }}>
                      <DocUploadSection
                        loanId={loan._id}
                        existingDocs={loan.documents || []}
                        onUploaded={(docs) => setLoans(prev => prev.map(l => l._id === loan._id ? { ...l, documents: docs } : l))}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
