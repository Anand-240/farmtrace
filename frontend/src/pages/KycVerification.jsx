import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Upload, CheckCircle, Clock, XCircle, ArrowLeft, AlertTriangle, FileText, CreditCard, HardHat, RefreshCw } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const DOC_TYPES = [
  {
    id: 'AADHAAR',
    label: 'Aadhaar Card',
    labelHi: 'आधार कार्ड',
    icon: <HardHat size={28} />,
    description: 'UIDAI ka 12-digit unique ID',
    placeholder: 'XXXX XXXX XXXX',
    hint: '12 digits — 2 se 9 se start hota hai',
    hasDob: true,
    hasBack: true,
    color: '#FF7043'
  },
  {
    id: 'PAN',
    label: 'PAN Card',
    labelHi: 'पैन कार्ड',
    icon: <CreditCard size={28} />,
    description: 'Income Tax Department ka 10-char ID',
    placeholder: 'ABCDE1234F',
    hint: '5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)',
    hasDob: false,
    hasBack: false,
    color: '#1565C0'
  },
  {
    id: 'ESHRAM',
    label: 'eShram Card',
    labelHi: 'ई-श्रम कार्ड',
    icon: <FileText size={28} />,
    description: 'Unorganised worker ka Universal Account Number',
    placeholder: 'XXXXXXXXXXXX',
    hint: '12-digit UAN number — eShram portal se milta hai',
    hasDob: false,
    hasBack: false,
    color: '#2E7D32'
  }
];

function StatusBadge({ status }) {
  if (status === 'VERIFIED') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#2E7D32', background: '#E8F5E9', padding: '0.75rem 1.25rem', borderRadius: '12px', fontWeight: 700 }}>
      <CheckCircle size={20} /> KYC Verified Ho Gaya!
    </div>
  );
  if (status === 'SUBMITTED') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#E65100', background: '#FFF3E0', padding: '0.75rem 1.25rem', borderRadius: '12px', fontWeight: 700 }}>
      <Clock size={20} /> Review Mein Hai — 24 ghante lagenge
    </div>
  );
  if (status === 'REJECTED') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#B71C1C', background: '#FFEBEE', padding: '0.75rem 1.25rem', borderRadius: '12px', fontWeight: 700 }}>
      <XCircle size={20} /> Reject Hua — Dobara Submit Karo
    </div>
  );
  return null;
}

export default function KycVerification() {
  const navigate = useNavigate();
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docNumber, setDocNumber] = useState('');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [frontFile, setFrontFile] = useState(null);
  const [backFile, setBackFile] = useState(null);
  const [frontPreview, setFrontPreview] = useState(null);
  const [backPreview, setBackPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [kycStatus, setKycStatus] = useState(null);
  const [kycRecord, setKycRecord] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const frontRef = useRef();
  const backRef = useRef();

  const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
  const docConfig = DOC_TYPES.find(d => d.id === selectedDoc);

  const fetchStatus = useCallback(async (showToast = false) => {
    setStatusLoading(true);
    try {
      const res = await api.get('/kyc/status');
      const freshStatus = res.data.kycStatus;
      const freshKyc = res.data.kyc;
      setKycStatus(freshStatus);
      setKycRecord(freshKyc);
      // Sync localStorage so Dashboard banner stays accurate
      const stored = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
      if (stored.kycStatus !== freshStatus) {
        localStorage.setItem('user', JSON.stringify({ ...stored, kycStatus: freshStatus }));
      }
      if (showToast) {
        if (freshStatus === 'VERIFIED') {
          toast.success('KYC approved ho gaya! Ab sare features unlock hain.');
        } else if (freshStatus === 'REJECTED') {
          toast.error('KYC reject hua — dobara submit karo.');
        } else {
          toast('Abhi bhi review mein hai — thoda wait karo.', { icon: '⏳' });
        }
      }
      return freshStatus;
    } catch {
      // fall back to localStorage on network error
      setKycStatus(user.kycStatus || 'PENDING');
    } finally {
      setStatusLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleFileChange = (e, side) => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    if (side === 'front') { setFrontFile(file); setFrontPreview(preview); }
    else { setBackFile(file); setBackPreview(preview); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDoc || !docNumber.trim()) {
      toast.error('Document type aur number zaroori hai');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('documentType', selectedDoc);
      formData.append('documentNumber', docNumber.trim());
      if (name.trim()) formData.append('nameAsPerDoc', name.trim());
      if (dob) formData.append('dob', dob);
      if (frontFile) formData.append('frontImage', frontFile);
      if (backFile) formData.append('backImage', backFile);

      const res = await api.post('/kyc/submit', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Update localStorage user with new kycStatus
      const updatedUser = { ...user, kycStatus: res.data.status };
      localStorage.setItem('user', JSON.stringify(updatedUser));

      setKycStatus(res.data.status);
      setSubmitted(true);

      if (res.data.autoVerified) {
        toast.success('KYC automatically verify ho gaya!');
      } else {
        toast.success('KYC submit ho gaya! Review mein hai.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submit fail hua, dobara try karo');
    } finally {
      setLoading(false);
    }
  };

  // Loading state while fetching real status
  if (statusLoading) {
    return (
      <div className="ft-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="ft-spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  // Already verified (from API)
  if (kycStatus === 'VERIFIED' && !submitted) {
    return (
      <div className="ft-page" style={{ minHeight: '100vh', background: '#F1F8E9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="ft-card" style={{ maxWidth: 480, width: '100%', textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
          <h2 style={{ color: '#2E7D32', marginBottom: '0.5rem' }}>KYC Verified Hai!</h2>
          {kycRecord && (
            <p style={{ color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
              {kycRecord.documentType} — {kycRecord.documentNumberMasked}
            </p>
          )}
          <p style={{ color: '#666', marginBottom: '2rem' }}>Aapka account fully verified hai. Sare features available hain.</p>
          <button className="ft-btn ft-btn-primary ft-btn-full" onClick={() => navigate('/dashboard')}>Dashboard pe Jao</button>
        </div>
      </div>
    );
  }

  // Post-submit success screen / already-submitted status screen
  if (submitted || kycStatus === 'SUBMITTED') {
    const displayStatus = kycStatus || 'SUBMITTED';
    return (
      <div className="ft-page" style={{ minHeight: '100vh', background: '#FFFDE7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="ft-card" style={{ maxWidth: 480, width: '100%', textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>{displayStatus === 'VERIFIED' ? '🎉' : '⏳'}</div>
          <h2 style={{ marginBottom: '1rem', color: displayStatus === 'VERIFIED' ? '#2E7D32' : '#E65100' }}>
            {displayStatus === 'VERIFIED' ? 'KYC Verified!' : 'Review Mein Hai'}
          </h2>
          <StatusBadge status={displayStatus} />
          {kycRecord && (
            <p style={{ color: '#777', marginTop: '1rem', fontSize: '0.88rem' }}>
              {kycRecord.documentType} — {kycRecord.documentNumberMasked}
            </p>
          )}
          <p style={{ color: '#666', marginTop: '1rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            {displayStatus === 'VERIFIED'
              ? 'Aapka account ab fully verified hai. Transfer, payment sab kuch use kar sakte hain.'
              : 'Hamare team 24 ghante ke andar aapka document review karegi. Verify hone par email aayega.'}
          </p>
          {displayStatus !== 'VERIFIED' && (
            <button
              className="ft-btn ft-btn-ghost ft-btn-full"
              style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              onClick={() => fetchStatus(true)}
              disabled={statusLoading}
            >
              <RefreshCw size={16} />
              Status Refresh Karo
            </button>
          )}
          <button className="ft-btn ft-btn-primary ft-btn-full" onClick={() => navigate('/dashboard')}>
            Dashboard pe Jao
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ft-page" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #E8F5E9 0%, #F3E5F5 100%)', paddingBottom: '4rem' }}>

      {/* Nav */}
      <nav className="ft-top-nav glass">
        <div className="ft-container nav-flex">
          <button className="ft-btn ft-btn-ghost ft-btn-sm" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={18} /> Dashboard
          </button>
          <span className="nav-title" style={{ fontWeight: 900 }}>KYC Verification</span>
          <div style={{ width: 80 }} />
        </div>
      </nav>

      <div className="ft-container" style={{ paddingTop: '5rem', maxWidth: 600, margin: '0 auto' }}>

        {/* Header Card */}
        <div className="ft-card" style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32)', color: '#fff', border: 'none', marginBottom: '1.5rem', padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <ShieldCheck size={40} />
            <div>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Identity Verify Karo</h2>
              <p style={{ margin: '0.25rem 0 0', opacity: 0.85, fontSize: '0.95rem' }}>
                Ek baar verify hone ke baad transfer aur payment unlock ho jaata hai
              </p>
            </div>
          </div>
        </div>

        {/* Rejected banner */}
        {kycStatus === 'REJECTED' && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', background: '#FFEBEE', border: '1.5px solid #EF9A9A', borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
            <AlertTriangle size={20} style={{ color: '#C62828', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: '#C62828' }}>Pichla KYC reject hua</p>
              {kycRecord?.rejectionReason && (
                <p style={{ margin: '0.25rem 0 0.25rem', color: '#C62828', fontSize: '0.88rem', fontStyle: 'italic' }}>
                  Reason: {kycRecord.rejectionReason}
                </p>
              )}
              <p style={{ margin: '0.25rem 0 0', color: '#B71C1C', fontSize: '0.9rem' }}>
                Sahi document dobara submit karo
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>

          {/* Step 1: Document Type Select */}
          <div className="ft-card" style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem', fontWeight: 900 }}>
              Step 1 — Document Choose Karo
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {DOC_TYPES.map(doc => (
                <button
                  type="button"
                  key={doc.id}
                  onClick={() => { setSelectedDoc(doc.id); setDocNumber(''); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    padding: '1rem 1.25rem', borderRadius: '14px', border: 'none', cursor: 'pointer',
                    textAlign: 'left', width: '100%',
                    background: selectedDoc === doc.id ? doc.color : '#F5F5F5',
                    color: selectedDoc === doc.id ? '#fff' : '#333',
                    fontWeight: selectedDoc === doc.id ? 700 : 500,
                    transition: 'all 0.2s',
                    outline: selectedDoc === doc.id ? `3px solid ${doc.color}` : 'none'
                  }}
                >
                  <div style={{ opacity: selectedDoc === doc.id ? 1 : 0.6 }}>{doc.icon}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{doc.label} — {doc.labelHi}</div>
                    <div style={{ fontSize: '0.82rem', opacity: 0.85, marginTop: '0.1rem' }}>{doc.description}</div>
                  </div>
                  {selectedDoc === doc.id && <CheckCircle size={20} style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Document Details */}
          {docConfig && (
            <div className="ft-card" style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem', fontWeight: 900 }}>
                Step 2 — {docConfig.label} Details
              </h3>

              <div className="ft-input-group">
                <label className="ft-label">{docConfig.label} Number *</label>
                <input
                  className="ft-input"
                  style={{ fontFamily: 'monospace', letterSpacing: '0.1em', fontSize: '1.1rem' }}
                  placeholder={docConfig.placeholder}
                  value={docNumber}
                  onChange={e => setDocNumber(e.target.value.toUpperCase())}
                  required
                  autoComplete="off"
                />
                <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', color: '#888' }}>
                  {docConfig.hint}
                </p>
              </div>

              <div className="ft-input-group">
                <label className="ft-label">Naam (Document ke anusaar)</label>
                <input
                  className="ft-input"
                  placeholder={user.name || 'Jaise document mein likha hai'}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoComplete="off"
                />
              </div>

              {docConfig.hasDob && (
                <div className="ft-input-group">
                  <label className="ft-label">Date of Birth (Aadhaar ke anusaar)</label>
                  <input
                    className="ft-input"
                    type="date"
                    value={dob}
                    onChange={e => setDob(e.target.value)}
                    max={new Date(Date.now() - 18 * 365.25 * 24 * 3600 * 1000).toISOString().split('T')[0]}
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 3: Document Upload */}
          {docConfig && (
            <div className="ft-card" style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 900 }}>
                Step 3 — Photo Upload Karo
              </h3>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: '#888' }}>
                Clear photo lo — dono taraf readable hona chahiye
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: docConfig.hasBack ? '1fr 1fr' : '1fr', gap: '1rem' }}>
                {/* Front */}
                <div>
                  <p style={{ margin: '0 0 0.5rem', fontWeight: 700, fontSize: '0.9rem' }}>
                    {docConfig.hasBack ? 'Aage ki Side (Front)' : 'Document Photo'}
                  </p>
                  <input
                    type="file" accept="image/*" ref={frontRef}
                    onChange={e => handleFileChange(e, 'front')}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => frontRef.current.click()}
                    style={{
                      width: '100%', height: 130, border: '2px dashed #C8E6C9',
                      borderRadius: '14px', background: frontPreview ? 'transparent' : '#F1F8E9',
                      cursor: 'pointer', overflow: 'hidden', position: 'relative', padding: 0
                    }}
                  >
                    {frontPreview
                      ? <img src={frontPreview} alt="front" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '0.5rem', color: '#2E7D32' }}>
                          <Upload size={24} />
                          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Upload</span>
                        </div>
                    }
                  </button>
                </div>

                {/* Back */}
                {docConfig.hasBack && (
                  <div>
                    <p style={{ margin: '0 0 0.5rem', fontWeight: 700, fontSize: '0.9rem' }}>Peeche ki Side (Back)</p>
                    <input
                      type="file" accept="image/*" ref={backRef}
                      onChange={e => handleFileChange(e, 'back')}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => backRef.current.click()}
                      style={{
                        width: '100%', height: 130, border: '2px dashed #C8E6C9',
                        borderRadius: '14px', background: backPreview ? 'transparent' : '#F1F8E9',
                        cursor: 'pointer', overflow: 'hidden', padding: 0
                      }}
                    >
                      {backPreview
                        ? <img src={backPreview} alt="back" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '0.5rem', color: '#2E7D32' }}>
                            <Upload size={24} />
                            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Upload</span>
                          </div>
                      }
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Privacy Note */}
          {docConfig && (
            <div style={{ display: 'flex', gap: '0.75rem', background: '#E3F2FD', borderRadius: '12px', padding: '0.875rem 1rem', marginBottom: '1.25rem' }}>
              <ShieldCheck size={18} style={{ color: '#1565C0', flexShrink: 0, marginTop: 2 }} />
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#1565C0', lineHeight: 1.5 }}>
                Aapka document number <strong>encrypted</strong> rakha jaata hai. Hum sirf verification ke liye use karte hain. Kisi third party ko nahi diya jaata.
              </p>
            </div>
          )}

          {/* Submit */}
          {docConfig && (
            <button
              type="submit"
              className="ft-btn ft-btn-primary ft-btn-full"
              style={{ height: 56, fontSize: '1.05rem', fontWeight: 800 }}
              disabled={loading || !docNumber.trim()}
            >
              {loading
                ? <div className="ft-spinner" style={{ margin: '0 auto' }} />
                : '🛡️  KYC Submit Karo'}
            </button>
          )}

          {/* Locked features warning — replaces the old skip button */}
          <div style={{ marginTop: '1rem', background: '#fef9c3', border: '1.5px solid #fde047', borderRadius: '14px', padding: '1rem 1.25rem' }}>
            <p style={{ margin: '0 0 0.5rem', fontWeight: 800, fontSize: '0.9rem', color: '#854d0e' }}>
              ⚠️ KYC ke bina ye features band rahenge:
            </p>
            <ul style={{ margin: '0 0 0.75rem', paddingLeft: '1.25rem', fontSize: '0.84rem', color: '#713f12', lineHeight: 1.7 }}>
              <li>Produce transfer (farmer → distributor → retailer)</li>
              <li>Payment & escrow</li>
              <li>Auction bidding</li>
              <li>GST invoice generation</li>
            </ul>
            <button
              type="button"
              style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.82rem', color: '#92400e', cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => navigate('/dashboard')}
            >
              Dashboard pe jao (restricted access)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
