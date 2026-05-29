import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import LocationAutocompleteInput from '../components/LocationAutocompleteInput';
import { citySuggestions, stateSuggestions, villageSuggestions } from '../lib/locationSuggestions';

/* ─── Constants ─────────────────────────────────────────── */
const ROLE_META = {
  FARMER:      { emoji: '👨‍🌾', label: 'Farmer',      accent: '#166534', light: '#dcfce7', grad: 'linear-gradient(145deg,#0d3319,#1e5c30)' },
  DISTRIBUTOR: { emoji: '🚛',   label: 'Distributor', accent: '#1e40af', light: '#dbeafe', grad: 'linear-gradient(145deg,#0c1f4a,#1e3a8a)' },
  RETAILER:    { emoji: '🏪',   label: 'Retailer',    accent: '#92400e', light: '#fef3c7', grad: 'linear-gradient(145deg,#451a03,#7c3a0a)' },
};

const KYC_META = {
  VERIFIED:  { label: 'KYC Verified',  color: '#15803d', bg: '#dcfce7', icon: '✓' },
  SUBMITTED: { label: 'Under Review',  color: '#b45309', bg: '#fef3c7', icon: '⏳' },
  REJECTED:  { label: 'KYC Rejected',  color: '#b91c1c', bg: '#fee2e2', icon: '✕' },
  PENDING:   { label: 'KYC Pending',   color: '#6b7280', bg: '#f3f4f6', icon: '○' },
};

const TABS = [
  { id: 'profile',   label: 'Profile',  icon: '👤' },
  { id: 'location',  label: 'Location', icon: '📍' },
  { id: 'business',  label: 'Business', icon: '🏢' },
  { id: 'security',  label: 'Security', icon: '🔐' },
];

/* ─── Main Component ─────────────────────────────────────── */
export default function Profile() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const roleMeta = ROLE_META[user.role] || ROLE_META.FARMER;
  const kycMeta  = KYC_META[user.kycStatus] || KYC_META.PENDING;

  const [form, setForm] = useState({
    name: '', phone: '', village: '', city: '', district: '', state: '', pincode: '',
    businessName: '', gstin: '', pan: '', avatar: '',
  });
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast,     setToast]     = useState(null); // { type: 'success'|'error', msg }
  const [avatarErr, setAvatarErr] = useState(false);
  const [tab,       setTab]       = useState('profile');
  const fileRef = useRef(null);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    api.get('/auth/me')
      .then(res => {
        const u = res.data.user || {};
        setForm({
          name: u.name || '', phone: u.phone || '',
          village: u.village || '', city: u.city || '',
          district: u.district || '', state: u.state || '', pincode: u.pincode || '',
          businessName: u.businessName || '', gstin: u.gstin || '', pan: u.pan || '',
          avatar: u.avatar || '',
        });
      })
      .catch(() => showToast('error', 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const set = (key, val) => {
    if (key === 'avatar') setAvatarErr(false);
    setForm(p => ({ ...p, [key]: val }));
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
      return showToast('error', 'Only JPG, PNG or WEBP allowed');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await api.post('/upload', fd);
      if (res.data.thumbnailUrl) { set('avatar', res.data.thumbnailUrl); showToast('success', 'Photo uploaded — save to apply'); }
    } catch { showToast('error', 'Upload failed'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const res = await api.put('/auth/me', form);
      if (res.data?.token && res.data?.user) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
      }
      showToast('success', 'Profile saved successfully');
    } catch (err) { showToast('error', err.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const avatarSrc = form.avatar && !avatarErr ? form.avatar : null;
  const initials  = (form.name || user.name || '?').charAt(0).toUpperCase();

  /* ─── Loading ─── */
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#0d3319', animation: 'spin .8s linear infinite', margin: '0 auto 1rem' }} />
        <p style={{ color: '#64748b', fontWeight: 600, fontSize: '0.9rem' }}>Loading your profile…</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  /* ─── Main Layout ─── */
  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: "'Outfit', sans-serif" }}>
      <style>{`
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes toastIn{ from { opacity:0; transform:translateY(20px) scale(.95); } to { opacity:1; transform:translateY(0) scale(1); } }
        .pf-tab { transition: all .2s ease; }
        .pf-tab:hover { background: rgba(255,255,255,.06) !important; }
        .pf-inp:focus { border-color: #0d3319 !important; background: #fff !important; box-shadow: 0 0 0 3px rgba(13,51,25,.08); }
        .pf-btn-sec:hover { background: #f0fdf4 !important; border-color: #0d3319 !important; color: #0d3319 !important; }
      `}</style>

      {/* ── Top Nav ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,.96)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', padding: '0 2rem', height: 58,
        gap: '1rem',
      }}>
        <button onClick={() => navigate('/dashboard')} style={{ display:'flex', alignItems:'center', gap:6, background:'#f8fafc', border:'1px solid #e2e8f0', color:'#374151', padding:'6px 14px', borderRadius:8, fontWeight:700, fontSize:'0.8rem', cursor:'pointer' }}>
          ← Dashboard
        </button>
        <div style={{ flex: 1, display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: roleMeta.grad, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.9rem' }}>
            {roleMeta.emoji}
          </div>
          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>Account Settings</span>
        </div>
        <button
          form="profile-form" type="submit" disabled={saving}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 20px', borderRadius:9, border:'none', background: saving ? '#94a3b8' : '#0d3319', color:'#fff', fontWeight:700, fontSize:'0.82rem', cursor: saving ? 'wait' : 'pointer', transition:'background .2s' }}
        >
          {saving ? <><span style={{ width:14, height:14, borderRadius:'50%', border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', animation:'spin .7s linear infinite', display:'inline-block' }} /> Saving…</> : '💾 Save Changes'}
        </button>
      </header>

      {/* ── Body ── */}
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '2rem 1.5rem 5rem', display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* ══ LEFT SIDEBAR ══ */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: 74 }}>

          {/* Profile Card */}
          <div style={{ borderRadius: 20, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06), 0 4px 20px rgba(0,0,0,.06)', border: '1px solid #e2e8f0' }}>
            {/* Banner */}
            <div style={{ height: 80, background: roleMeta.grad, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(circle at 30% 120%, rgba(255,255,255,.15) 0%, transparent 55%), radial-gradient(circle at 80% -10%, rgba(255,255,255,.1) 0%, transparent 50%)' }} />
            </div>

            {/* Avatar area */}
            <div style={{ background: '#fff', padding: '0 1.5rem 1.5rem' }}>
              <div style={{ marginTop: -42, marginBottom: '1rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div style={{ position: 'relative' }}>
                  {/* Avatar ring */}
                  <div style={{ width: 80, height: 80, borderRadius: '50%', padding: 3, background: '#fff', boxShadow: '0 0 0 1px #e2e8f0, 0 4px 16px rgba(0,0,0,.12)' }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: avatarSrc ? 'transparent' : roleMeta.light, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: avatarSrc ? 0 : '1.8rem' }}>
                      {avatarSrc
                        ? <img src={avatarSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setAvatarErr(true)} />
                        : <span style={{ fontSize: '1.5rem' }}>{roleMeta.emoji}</span>
                      }
                    </div>
                  </div>
                  {/* Camera button */}
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} title="Change photo"
                    style={{ position:'absolute', bottom:0, right:0, width:26, height:26, borderRadius:'50%', background: uploading ? '#94a3b8' : '#0d3319', color:'#fff', border:'2px solid #fff', cursor: uploading ? 'wait' : 'pointer', fontSize:'0.65rem', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 6px rgba(0,0,0,.2)' }}>
                    {uploading ? '⏳' : '✎'}
                  </button>
                  <input ref={fileRef} type="file" style={{ display:'none' }} accept="image/jpeg,image/png,image/webp" onChange={handleUpload} />
                </div>

                {/* KYC badge */}
                <span style={{ display:'inline-flex', alignItems:'center', gap:4, background: kycMeta.bg, color: kycMeta.color, padding:'4px 10px', borderRadius:999, fontSize:'0.66rem', fontWeight:800, letterSpacing:'0.04em' }}>
                  {kycMeta.icon} {kycMeta.label}
                </span>
              </div>

              {/* Name + details */}
              <h2 style={{ margin:'0 0 3px', fontSize:'1.15rem', fontWeight:900, color:'#0f172a', letterSpacing:'-0.02em', lineHeight:1.2 }}>
                {form.name || user.name || '—'}
              </h2>
              <p style={{ margin:'0 0 3px', fontSize:'0.8rem', color:'#64748b', fontWeight:500 }}>{user.email}</p>
              {form.phone && <p style={{ margin:'0 0 10px', fontSize:'0.78rem', color:'#94a3b8', fontWeight:600 }}>{form.phone}</p>}

              {/* Role badge */}
              <span style={{ display:'inline-flex', alignItems:'center', gap:5, background: roleMeta.light, color: roleMeta.accent, padding:'4px 11px', borderRadius:999, fontSize:'0.7rem', fontWeight:800, letterSpacing:'0.06em', textTransform:'uppercase' }}>
                {roleMeta.emoji} {roleMeta.label}
              </span>

              {/* Location */}
              {(form.city || form.state) && (
                <p style={{ margin:'10px 0 0', fontSize:'0.78rem', color:'#64748b', display:'flex', alignItems:'center', gap:4, fontWeight:500 }}>
                  <span>📍</span> {[form.city, form.state].filter(Boolean).join(', ')}
                </p>
              )}
            </div>

            {/* Info rows */}
            <div style={{ borderTop: '1px solid #f1f5f9' }}>
              {[
                { icon: '✉️', label: 'Email', val: user.email },
                { icon: '📱', label: 'Phone', val: form.phone || '—' },
                { icon: '🏘️', label: 'Village', val: form.village || '—' },
              ].map(row => (
                <div key={row.label} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 1.5rem', borderBottom:'1px solid #f8fafc' }}>
                  <span style={{ fontSize:'0.85rem', width:20, textAlign:'center', flexShrink:0 }}>{row.icon}</span>
                  <div style={{ minWidth:0 }}>
                    <p style={{ margin:0, fontSize:'0.65rem', color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{row.label}</p>
                    <p style={{ margin:0, fontSize:'0.8rem', color:'#374151', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.val}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tab Nav */}
          <div style={{ background: '#1e293b', borderRadius: 16, padding: '0.5rem', boxShadow: '0 2px 12px rgba(0,0,0,.1)' }}>
            {TABS.map(t => (
              <button key={t.id} className="pf-tab"
                onClick={() => setTab(t.id)}
                style={{
                  width:'100%', display:'flex', alignItems:'center', gap:10,
                  padding:'10px 14px', borderRadius:10, border:'none', cursor:'pointer', textAlign:'left',
                  background: tab === t.id ? 'rgba(255,255,255,.12)' : 'transparent',
                  color: tab === t.id ? '#fff' : 'rgba(255,255,255,.55)',
                  fontWeight: tab === t.id ? 700 : 500, fontSize:'0.85rem',
                  marginBottom: '2px',
                  transition: 'all .15s ease',
                  outline: 'none',
                }}
              >
                <span style={{ fontSize:'1rem', width:22, textAlign:'center' }}>{t.icon}</span>
                {t.label}
                {tab === t.id && <span style={{ marginLeft:'auto', width:6, height:6, borderRadius:'50%', background:'#4ade80', flexShrink:0 }} />}
              </button>
            ))}
          </div>
        </aside>

        {/* ══ RIGHT CONTENT ══ */}
        <main style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'fadeUp .3s ease' }}>

          {/* Toast */}
          {toast && (
            <div style={{
              display:'flex', alignItems:'center', gap:'0.75rem',
              padding:'0.875rem 1.25rem', borderRadius:14,
              background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
              color: toast.type === 'success' ? '#15803d' : '#dc2626',
              fontWeight:700, fontSize:'0.85rem', animation:'toastIn .3s ease',
              boxShadow: '0 4px 16px rgba(0,0,0,.06)'
            }}>
              <span style={{ fontSize:'1.1rem' }}>{toast.type === 'success' ? '✅' : '⚠️'}</span>
              {toast.msg}
            </div>
          )}

          <form id="profile-form" onSubmit={handleSave}>

            {/* ── Profile Tab ── */}
            {tab === 'profile' && (
              <Section title="Personal Information" desc="Your public name and contact details">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.25rem' }}>
                  <Field label="Full Name" required hint="As shown to buyers & sellers">
                    <Inp value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your full name" required />
                  </Field>
                  <Field label="Phone Number" hint="10-digit mobile number">
                    <Inp value={form.phone} onChange={e => set('phone', e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="e.g. 9876543210" inputMode="numeric" maxLength={10} />
                  </Field>
                </div>

                <Divider />

                <Field label="Profile Photo" hint="JPG, PNG or WEBP · Recommended 400×400px">
                  <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginTop:2 }}>
                    <div style={{ width:52, height:52, borderRadius:14, overflow:'hidden', background: roleMeta.light, border:'1.5px solid #e2e8f0', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {avatarSrc
                        ? <img src={avatarSrc} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        : <span style={{ fontSize:'1.4rem' }}>{roleMeta.emoji}</span>}
                    </div>
                    <div>
                      <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                        style={{ padding:'8px 16px', borderRadius:9, border:'1.5px solid #e2e8f0', background:'#fff', color:'#374151', fontWeight:700, fontSize:'0.8rem', cursor: uploading ? 'wait' : 'pointer' }}>
                        {uploading ? '⏳ Uploading…' : '↑ Upload Photo'}
                      </button>
                      {avatarErr && <p style={{ margin:'4px 0 0', fontSize:'0.72rem', color:'#dc2626', fontWeight:600 }}>⚠ Current photo is broken — upload a new one</p>}
                    </div>
                  </div>
                </Field>
              </Section>
            )}

            {/* ── Location Tab ── */}
            {tab === 'location' && (
              <Section title="Location Details" desc="Your farm or business address">
                <Field label="Village / Town">
                  <LocationAutocompleteInput inputStyle={inpStyle} value={form.village} onChange={e => set('village', e.target.value)} suggestions={villageSuggestions} placeholder="Your village or town" />
                </Field>
                <Divider />
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.25rem' }}>
                  <Field label="District">
                    <Inp value={form.district} onChange={e => set('district', e.target.value)} placeholder="Your district" />
                  </Field>
                  <Field label="Pincode" hint="6-digit postal code">
                    <Inp value={form.pincode} onChange={e => set('pincode', e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="e.g. 226001" inputMode="numeric" maxLength={6} />
                  </Field>
                </div>
                <Divider />
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.25rem' }}>
                  <Field label="City">
                    <LocationAutocompleteInput inputStyle={inpStyle} value={form.city} onChange={e => set('city', e.target.value)} suggestions={citySuggestions} placeholder="Your city" />
                  </Field>
                  <Field label="State">
                    <LocationAutocompleteInput inputStyle={inpStyle} value={form.state} onChange={e => set('state', e.target.value)} suggestions={stateSuggestions} placeholder="Your state" />
                  </Field>
                </div>
              </Section>
            )}

            {/* ── Business Tab ── */}
            {tab === 'business' && (
              <Section title="Business & Tax Details" desc="Used for invoices, challans and compliance documents">
                <Field label="Business / Farm Name" hint="Shown on official documents">
                  <Inp value={form.businessName} onChange={e => set('businessName', e.target.value)} placeholder="e.g. Ram Kisan Farms" />
                </Field>
                <Divider />
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.25rem' }}>
                  <Field label="GSTIN" hint="15-character GST number">
                    <Inp value={form.gstin} onChange={e => set('gstin', e.target.value.toUpperCase().slice(0,15))} placeholder="e.g. 27AAPFU0939F1ZV" style={{ fontFamily:'monospace', letterSpacing:'0.05em' }} />
                  </Field>
                  <Field label="PAN Number" hint="10-character PAN">
                    <Inp value={form.pan} onChange={e => set('pan', e.target.value.toUpperCase().slice(0,10))} placeholder="e.g. ABCDE1234F" style={{ fontFamily:'monospace', letterSpacing:'0.05em' }} />
                  </Field>
                </div>

                <div style={{ marginTop:'1.5rem', padding:'1rem 1.25rem', background:'#f8fafc', borderRadius:12, border:'1px solid #e2e8f0', display:'flex', gap:'0.75rem', alignItems:'flex-start' }}>
                  <span style={{ fontSize:'1.1rem', flexShrink:0, marginTop:1 }}>ℹ️</span>
                  <p style={{ margin:0, fontSize:'0.78rem', color:'#64748b', lineHeight:1.6 }}>
                    GSTIN and PAN are used to auto-fill official compliance documents (invoices, challans, settlement statements). They are never shared with third parties.
                  </p>
                </div>
              </Section>
            )}

            {/* ── Security Tab (no submit via main form) ── */}
            {tab === 'security' && (
              <Section title="Security Settings" desc="Manage your password and account access">
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1rem 0', borderBottom:'1px solid #f1f5f9' }}>
                  <div>
                    <p style={{ margin:0, fontWeight:700, fontSize:'0.9rem', color:'#0f172a' }}>Password</p>
                    <p style={{ margin:'3px 0 0', fontSize:'0.78rem', color:'#94a3b8' }}>Update your login password</p>
                  </div>
                  <button type="button" className="pf-btn-sec" onClick={() => navigate('/change-password')}
                    style={{ padding:'8px 18px', borderRadius:9, border:'1.5px solid #e2e8f0', background:'#f8fafc', color:'#374151', fontWeight:700, fontSize:'0.8rem', cursor:'pointer', transition:'all .2s' }}>
                    🔑 Change Password
                  </button>
                </div>

                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1rem 0', borderBottom:'1px solid #f1f5f9' }}>
                  <div>
                    <p style={{ margin:0, fontWeight:700, fontSize:'0.9rem', color:'#0f172a' }}>KYC Status</p>
                    <p style={{ margin:'3px 0 0', fontSize:'0.78rem', color:'#94a3b8' }}>Identity verification for payments and transfers</p>
                  </div>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:5, background: kycMeta.bg, color: kycMeta.color, padding:'6px 14px', borderRadius:999, fontSize:'0.75rem', fontWeight:800 }}>
                    {kycMeta.icon} {kycMeta.label}
                  </span>
                </div>

                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1rem 0' }}>
                  <div>
                    <p style={{ margin:0, fontWeight:700, fontSize:'0.9rem', color:'#0f172a' }}>Account Type</p>
                    <p style={{ margin:'3px 0 0', fontSize:'0.78rem', color:'#94a3b8' }}>Your registered role on FarmTrace</p>
                  </div>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:5, background: roleMeta.light, color: roleMeta.accent, padding:'6px 14px', borderRadius:999, fontSize:'0.75rem', fontWeight:800, textTransform:'uppercase' }}>
                    {roleMeta.emoji} {roleMeta.label}
                  </span>
                </div>
              </Section>
            )}

            {/* Save button — only show when not on security tab */}
            {tab !== 'security' && (
              <button type="submit" disabled={saving} style={{
                width:'100%', padding:'0.9rem', borderRadius:14, border:'none',
                background: saving ? '#94a3b8' : 'linear-gradient(135deg,#0d3319,#1e5c30)',
                color:'#fff', fontWeight:800, fontSize:'0.9rem', cursor: saving ? 'wait' : 'pointer',
                boxShadow: saving ? 'none' : '0 4px 18px rgba(13,51,25,.28)',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                transition:'all .2s',
              }}>
                {saving
                  ? <><span style={{ width:16, height:16, borderRadius:'50%', border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', animation:'spin .7s linear infinite', display:'inline-block' }} /> Saving…</>
                  : '💾 Save Changes'
                }
              </button>
            )}
          </form>
        </main>
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────── */
function Section({ title, desc, children }) {
  return (
    <div style={{ background:'#fff', borderRadius:20, border:'1px solid #e2e8f0', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.04)' }}>
      <div style={{ padding:'1.25rem 1.75rem', borderBottom:'1px solid #f1f5f9', background:'#fafbfc' }}>
        <h3 style={{ margin:0, fontSize:'0.9rem', fontWeight:800, color:'#0f172a' }}>{title}</h3>
        {desc && <p style={{ margin:'3px 0 0', fontSize:'0.76rem', color:'#94a3b8', fontWeight:500 }}>{desc}</p>}
      </div>
      <div style={{ padding:'1.75rem' }}>{children}</div>
    </div>
  );
}

function Field({ label, hint, required, children }) {
  return (
    <div>
      <div style={{ marginBottom:7 }}>
        <label style={{ fontSize:'0.75rem', fontWeight:700, color:'#374151', letterSpacing:'0.04em' }}>
          {label}
          {required && <span style={{ color:'#dc2626', marginLeft:3 }}>*</span>}
        </label>
        {hint && <span style={{ marginLeft:6, fontSize:'0.68rem', color:'#94a3b8', fontWeight:500 }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Inp({ style: extraStyle = {}, ...props }) {
  return (
    <input
      className="pf-inp"
      style={{ ...inpStyle, ...extraStyle }}
      {...props}
    />
  );
}

function Divider() {
  return <div style={{ height:1, background:'#f1f5f9', margin:'1.25rem 0' }} />;
}

const inpStyle = {
  width:'100%', padding:'0.7rem 0.9rem',
  border:'1.5px solid #e2e8f0', borderRadius:10,
  background:'#fafbfc', fontSize:'0.88rem', color:'#0f172a',
  outline:'none', fontFamily:'inherit', transition:'border-color .2s, box-shadow .2s, background .2s',
  boxSizing:'border-box',
};
