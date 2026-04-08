import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import LocationAutocompleteInput from '../components/LocationAutocompleteInput';
import {
  citySuggestions,
  stateSuggestions,
  villageSuggestions
} from '../lib/locationSuggestions';

export default function Profile() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [form, setForm] = useState({ name: '', phone: '', village: '', city: '', state: '', avatar: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [avatarBroken, setAvatarBroken] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await api.get('/api/auth/me');
        const u = res.data.user || {};
        setForm({ name: u.name || '', phone: u.phone || '', village: u.village || '', city: u.city || '', state: u.state || '', avatar: u.avatar || '' });
      } catch (err) {
        setError(err.response?.data?.message || 'Profile load nahi hua');
      } finally { setLoading(false); }
    };
    loadProfile();
  }, []);

  const updateField = (key, value) => {
    if (key === 'avatar') setAvatarBroken(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await api.put('/api/auth/me', form);
      if (res.data?.token && res.data?.user) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
      }
      setSuccess('✅ Profile update ho gaya!');
    } catch (err) {
      setError(err.response?.data?.message || 'Profile update nahi hua');
    } finally { setSaving(false); }
  };

  const roleColor = { FARMER: '#1a4a0f', DISTRIBUTOR: '#0c4a6e', RETAILER: '#78350f' };
  const roleEmoji = { FARMER: '👨‍🌾', DISTRIBUTOR: '🚛', RETAILER: '🏪' };

  return (
    <div style={s.page}>
      {/* TOP BAR */}
      <div style={s.topbar}>
        <button onClick={() => navigate('/dashboard')} style={s.backBtn}>←</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
          <span style={{ fontSize: '1.2rem' }}>👤</span>
          <span style={s.topbarText}>Mera Profile</span>
        </div>
      </div>

      <div style={s.inner}>
        {loading ? (
          <div style={s.loadingWrap}><p style={s.loadingText}>Profile load ho raha hai...</p></div>
        ) : (
          <>
            {/* AVATAR CARD */}
            <div style={s.avatarCard}>
              <div style={s.avatarCircle}>
                {form.avatar && !avatarBroken ? (
                  <img src={form.avatar} alt="Avatar" style={s.avatarImg} onError={() => setAvatarBroken(true)} />
                ) : (
                  <span style={{ fontSize: '2.8rem' }}>{roleEmoji[user.role] || '👤'}</span>
                )}
              </div>
              <div>
                <div style={s.avatarName}>{form.name || user.name}</div>
                <div style={s.avatarEmail}>{user.email}</div>
                <span style={{ ...s.roleBadge, background: roleColor[user.role] || '#1a4a0f' }}>
                  {user.role}
                </span>
              </div>
            </div>

            {error && <div style={s.alertErr}>⚠️ {error}</div>}
            {success && <div style={s.alertOk}>{success}</div>}

            {/* FORM CARD */}
            <div style={s.formCard}>
              <p style={s.sectionLabel}>✏️ Profile Edit Karo</p>
              <form onSubmit={handleSubmit}>
                {[
                  { label: 'Aapka Naam', key: 'name', icon: '👤', placeholder: 'Jaise: Ram Singh' },
                  { label: 'Phone Number', key: 'phone', icon: '📱', placeholder: '+91...' },
                ].map(({ label, key, icon, placeholder }) => (
                  <div key={key} style={s.fieldWrap}>
                    <label style={s.label}>{icon} {label}</label>
                    <input
                      style={s.input}
                      value={form[key]}
                      onChange={(e) => updateField(key, e.target.value)}
                      placeholder={placeholder}
                    />
                  </div>
                ))}

                <div style={s.fieldWrap}>
                  <label style={s.label}>🏘️ Village / Gaon</label>
                  <LocationAutocompleteInput
                    inputStyle={s.input}
                    value={form.village}
                    onChange={(e) => updateField('village', e.target.value)}
                    suggestions={villageSuggestions}
                    placeholder="Aapka gaon"
                  />
                </div>

                <div style={s.fieldWrap}>
                  <label style={s.label}>🏙️ City / Shahar</label>
                  <LocationAutocompleteInput
                    inputStyle={s.input}
                    value={form.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    suggestions={citySuggestions}
                    placeholder="Aapka shahar"
                  />
                </div>

                <div style={s.fieldWrap}>
                  <label style={s.label}>📍 State / Pradesh</label>
                  <LocationAutocompleteInput
                    inputStyle={s.input}
                    value={form.state}
                    onChange={(e) => updateField('state', e.target.value)}
                    suggestions={stateSuggestions}
                    placeholder="Jaise: Uttar Pradesh"
                  />
                </div>

                <div style={s.fieldWrap}>
                  <label style={s.label}>🖼️ Avatar URL (optional)</label>
                  <input style={s.input} value={form.avatar} onChange={(e) => updateField('avatar', e.target.value)} placeholder="https://..." />
                  {form.avatar && avatarBroken && <p style={s.helperErr}>URL se image load nahi hui, sahi URL daalo</p>}
                </div>

                <button type="submit" style={s.primaryBtn} disabled={saving}>
                  {saving ? '⏳ Save ho raha hai...' : '💾 Profile Save Karo'}
                </button>
              </form>
            </div>

            {/* SECONDARY ACTIONS */}
            <div style={s.formCard}>
              <p style={s.sectionLabel}>🔐 Security</p>
              <button onClick={() => navigate('/change-password')} style={s.secondaryBtn}>
                🔑 Password Change Karo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: 'linear-gradient(160deg, #f4f8f0 0%, #eef5e7 50%, #e8f0e0 100%)', fontFamily: "'Outfit', sans-serif" },
  topbar: { position: 'sticky', top: 0, zIndex: 30, background: 'rgba(255,255,255,0.93)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #d4e4c8', padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', boxShadow: '0 2px 10px rgba(15,45,9,0.07)' },
  backBtn: { width: 38, height: 38, borderRadius: 10, background: '#f3fae8', border: '1px solid #d4e4c8', color: '#27500a', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  topbarText: { fontWeight: 800, fontSize: '1.05rem', color: '#0f1f0d' },
  inner: { maxWidth: 560, margin: '0 auto', padding: '1rem 1rem 3rem' },
  loadingWrap: { textAlign: 'center', marginTop: '4rem' },
  loadingText: { color: '#5a7050', fontWeight: 600, fontSize: '1rem' },
  avatarCard: { background: '#fff', borderRadius: 18, padding: '1.5rem', marginBottom: '1rem', border: '1.5px solid #d4e4c8', boxShadow: '0 4px 16px rgba(15,45,9,0.10)', display: 'flex', alignItems: 'center', gap: '1.25rem' },
  avatarCircle: { width: 80, height: 80, borderRadius: '50%', background: '#f3fae8', border: '3px solid #d4e4c8', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarName: { fontWeight: 900, fontSize: '1.2rem', color: '#0f1f0d', marginBottom: '0.25rem' },
  avatarEmail: { fontSize: '0.82rem', color: '#5a7050', marginBottom: '0.4rem' },
  roleBadge: { color: '#fff', borderRadius: 999, padding: '0.2rem 0.7rem', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' },
  alertErr: { background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: 12, padding: '0.75rem 1rem', marginBottom: '0.85rem', fontWeight: 600, fontSize: '0.9rem' },
  alertOk:  { background: '#dcfce7', border: '1px solid #86efac', color: '#166534', borderRadius: 12, padding: '0.75rem 1rem', marginBottom: '0.85rem', fontWeight: 600, fontSize: '0.9rem' },
  formCard: { background: '#fff', borderRadius: 18, padding: '1.25rem', marginBottom: '1rem', border: '1.5px solid #d4e4c8', boxShadow: '0 4px 16px rgba(15,45,9,0.10)' },
  sectionLabel: { fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#5a7050', marginBottom: '1rem' },
  fieldWrap: { marginBottom: '0.85rem' },
  label: { display: 'block', color: '#2d4428', fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.35rem' },
  input: { width: '100%', padding: '0.8rem 1rem', border: '1.5px solid #d4e4c8', borderRadius: 10, background: '#f3fae8', fontSize: '0.95rem', color: '#0f1f0d', outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box' },
  helperErr: { fontSize: '0.8rem', color: '#b45309', marginTop: '0.3rem', fontWeight: 600 },
  primaryBtn: { width: '100%', padding: '0.9rem', border: 'none', borderRadius: 12, background: 'linear-gradient(135deg, #27500a, #3a7510)', color: '#fff', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(39,80,10,0.3)', marginTop: '0.5rem', transition: 'all 0.2s' },
  secondaryBtn: { width: '100%', padding: '0.85rem', border: '1.5px solid #d4e4c8', borderRadius: 12, background: '#f3fae8', color: '#27500a', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', transition: 'all 0.2s' },
};
