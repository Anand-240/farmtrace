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
        const res = await api.get('/api/v1/auth/me');
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
      const res = await api.put('/api/v1/auth/me', form);
      if (res.data?.token && res.data?.user) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
      }
      setSuccess('✅ Profile update ho gaya!');
    } catch (err) {
      setError(err.response?.data?.message || 'Profile update nahi hua');
    } finally { setSaving(false); }
  };

  const roleColor = { FARMER: 'var(--ft-forest)', DISTRIBUTOR: '#0c4a6e', RETAILER: '#78350f' };
  const roleEmoji = { FARMER: '👨‍🌾', DISTRIBUTOR: '🚛', RETAILER: '🏪' };

  return (
    <div style={s.page}>
      {/* TOP BAR */}
      <div style={s.topbar}>
        <button onClick={() => navigate('/dashboard')} style={s.backBtn}>←</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
          <span style={s.topbarText}>Mera Profile</span>
        </div>
      </div>

      <div style={s.inner}>
        {loading ? (
          <div style={s.loadingWrap}><div className="ft-spinner" style={{ margin: '0 auto 1rem' }} /><p style={s.loadingText}>Profile load ho raha hai...</p></div>
        ) : (
          <>
            {/* AVATAR CARD */}
            <div style={s.avatarCard} className="animate-slide-up">
              <div style={s.avatarCircle}>
                {form.avatar && !avatarBroken ? (
                  <img src={form.avatar} alt="Avatar" style={s.avatarImg} onError={() => setAvatarBroken(true)} />
                ) : (
                  <span style={{ fontSize: '3rem' }}>{roleEmoji[user.role] || '👤'}</span>
                )}
              </div>
              <div>
                <div style={s.avatarName}>{form.name || user.name}</div>
                <div style={s.avatarEmail}>{user.email}</div>
                <span style={{ ...s.roleBadge, background: roleColor[user.role] || 'var(--ft-forest)' }}>
                  {user.role}
                </span>
              </div>
            </div>

            {error && <div className="ft-alert ft-alert-error">{error}</div>}
            {success && <div className="ft-alert ft-alert-success">{success}</div>}

            {/* FORM CARD */}
            <div style={s.formCard} className="animate-slide-up">
              <p style={s.sectionLabel}>EDIT PROFILE</p>
              <form onSubmit={handleSubmit}>
                {[
                  { label: 'Aapka Naam', key: 'name', icon: '👤', placeholder: 'Jaise: Ram Singh' },
                  { label: 'Phone Number', key: 'phone', icon: '📱', placeholder: '+91...' },
                ].map(({ label, key, icon, placeholder }) => (
                  <div key={key} style={s.fieldWrap}>
                    <label style={s.label}>{icon} {label}</label>
                    <input
                      style={s.input}
                      className="ft-input"
                      value={form[key]}
                      onChange={(e) => updateField(key, e.target.value)}
                      placeholder={placeholder}
                    />
                  </div>
                ))}

                <div style={s.fieldWrap}>
                  <label style={s.label}>🏘️ Village / Gaon</label>
                  <LocationAutocompleteInput
                    inputStyle={{ width: '100%', padding: '0.9rem 1.25rem', border: '1.5px solid var(--ft-border)', borderRadius: '12px', background: 'var(--ft-white)', fontSize: '1rem', color: 'var(--ft-text)', outline: 'none' }}
                    value={form.village}
                    onChange={(e) => updateField('village', e.target.value)}
                    suggestions={villageSuggestions}
                    placeholder="Aapka gaon"
                  />
                </div>

                <div style={s.fieldWrap}>
                  <label style={s.label}>🏙️ City / Shahar</label>
                  <LocationAutocompleteInput
                    inputStyle={{ width: '100%', padding: '0.9rem 1.25rem', border: '1.5px solid var(--ft-border)', borderRadius: '12px', background: 'var(--ft-white)', fontSize: '1rem', color: 'var(--ft-text)', outline: 'none' }}
                    value={form.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    suggestions={citySuggestions}
                    placeholder="Aapka shahar"
                  />
                </div>

                <div style={s.fieldWrap}>
                  <label style={s.label}>📍 State / Pradesh</label>
                  <LocationAutocompleteInput
                    inputStyle={{ width: '100%', padding: '0.9rem 1.25rem', border: '1.5px solid var(--ft-border)', borderRadius: '12px', background: 'var(--ft-white)', fontSize: '1rem', color: 'var(--ft-text)', outline: 'none' }}
                    value={form.state}
                    onChange={(e) => updateField('state', e.target.value)}
                    suggestions={stateSuggestions}
                    placeholder="Jaise: Uttar Pradesh"
                  />
                </div>

                <div style={s.fieldWrap}>
                  <label style={s.label}>🖼️ Avatar URL (optional)</label>
                  <input style={s.input} className="ft-input" value={form.avatar} onChange={(e) => updateField('avatar', e.target.value)} placeholder="https://..." />
                  {form.avatar && avatarBroken && <p style={s.helperErr}>URL se image load nahi hui, sahi URL daalo</p>}
                </div>

                <button type="submit" className="ft-btn ft-btn-primary ft-btn-full ft-btn-lg" disabled={saving}>
                  {saving ? <div className="ft-spinner" /> : '💾 Profile Save Karo'}
                </button>
              </form>
            </div>

            {/* SECONDARY ACTIONS */}
            <div style={s.formCard} className="animate-slide-up">
              <p style={s.sectionLabel}>SECURITY</p>
              <button onClick={() => navigate('/change-password')} className="ft-btn ft-btn-secondary ft-btn-full">
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
  page: { minHeight: '100vh', background: 'var(--ft-bg)', fontFamily: 'var(--ft-font-main)' },
  topbar: { position: 'sticky', top: 0, zIndex: 30, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(15px)', borderBottom: '1px solid var(--ft-border)', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' },
  backBtn: { width: 44, height: 44, borderRadius: 12, background: 'var(--ft-white)', border: '1px solid var(--ft-border)', color: 'var(--ft-forest)', cursor: 'pointer', fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'var(--ft-transition)' },
  topbarText: { fontWeight: 800, fontSize: '1.25rem', color: 'var(--ft-forest)', letterSpacing: '-0.02em' },
  inner: { maxWidth: 640, margin: '0 auto', padding: '1.5rem 1.5rem 4rem' },
  loadingWrap: { textAlign: 'center', marginTop: '6rem' },
  loadingText: { color: 'var(--ft-text-muted)', fontWeight: 600, fontSize: '1rem', marginTop: '1rem' },
  avatarCard: { background: 'var(--ft-white)', borderRadius: 'var(--ft-radius-lg)', padding: '2rem', marginBottom: '1.5rem', border: '1px solid var(--ft-border)', boxShadow: 'var(--ft-shadow-sm)', display: 'flex', alignItems: 'center', gap: '1.5rem' },
  avatarCircle: { width: 96, height: 96, borderRadius: '24px', background: 'var(--ft-sage-light)', border: '2px solid var(--ft-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarName: { fontWeight: 800, fontSize: '1.5rem', color: 'var(--ft-forest)', marginBottom: '0.25rem', letterSpacing: '-0.03em' },
  avatarEmail: { fontSize: '0.9rem', color: 'var(--ft-text-muted)', marginBottom: '0.75rem' },
  roleBadge: { color: '#fff', borderRadius: 999, padding: '0.25rem 0.85rem', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' },
  formCard: { background: 'var(--ft-white)', borderRadius: 'var(--ft-radius-lg)', padding: '2rem', marginBottom: '1.5rem', border: '1px solid var(--ft-border)', boxShadow: 'var(--ft-shadow-sm)' },
  sectionLabel: { fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--ft-text-muted)', marginBottom: '1.75rem', borderLeft: '3px solid var(--ft-forest)', paddingLeft: '0.75rem' },
  fieldWrap: { marginBottom: '1.5rem' },
  label: { display: 'block', color: 'var(--ft-text)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.6rem' },
  input: { border: 'none', background: 'transparent', padding: 0 },
  helperErr: { fontSize: '0.85rem', color: 'var(--ft-error)', marginTop: '0.5rem', fontWeight: 600 },
};

