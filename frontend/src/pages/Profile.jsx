import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function Profile() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    village: '',
    city: '',
    state: '',
    avatar: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [avatarBroken, setAvatarBroken] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await api.get('/api/auth/me');
        const user = res.data.user || {};
        setForm({
          name: user.name || '',
          phone: user.phone || '',
          village: user.village || '',
          city: user.city || '',
          state: user.state || '',
          avatar: user.avatar || ''
        });
      } catch (err) {
        setError(err.response?.data?.message || 'Profile load nahi hua');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const updateField = (key, value) => {
    if (key === 'avatar') {
      setAvatarBroken(false);
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await api.put('/api/auth/me', form);
      if (res.data?.token && res.data?.user) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
      }
      setSuccess('Profile update ho gaya');
    } catch (err) {
      setError(err.response?.data?.message || 'Profile update nahi hua');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>← Dashboard</button>
        <h2 style={styles.title}>Profile Edit</h2>

        {loading ? (
          <p style={styles.loading}>Load ho raha hai...</p>
        ) : (
          <>
            {error && <p style={styles.error}>{error}</p>}
            {success && <p style={styles.success}>{success}</p>}

            <form onSubmit={handleSubmit}>
              <label style={styles.label}>Name</label>
              <input style={styles.input} value={form.name} onChange={(e) => updateField('name', e.target.value)} required />

              <label style={styles.label}>Phone</label>
              <input
                style={styles.input}
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="+91..."
                maxLength={20}
              />

              <label style={styles.label}>Village</label>
              <input style={styles.input} value={form.village} onChange={(e) => updateField('village', e.target.value)} />

              <label style={styles.label}>City</label>
              <input style={styles.input} value={form.city} onChange={(e) => updateField('city', e.target.value)} />

              <label style={styles.label}>State</label>
              <input style={styles.input} value={form.state} onChange={(e) => updateField('state', e.target.value)} />

              <label style={styles.label}>Avatar URL</label>
              <input style={styles.input} value={form.avatar} onChange={(e) => updateField('avatar', e.target.value)} placeholder="https://..." />

              {form.avatar && !avatarBroken && (
                <div style={styles.avatarPreviewWrap}>
                  <img
                    src={form.avatar}
                    alt="Avatar Preview"
                    style={styles.avatarPreview}
                    onError={() => setAvatarBroken(true)}
                  />
                </div>
              )}

              {form.avatar && avatarBroken && (
                <p style={styles.helperText}>Avatar URL valid image nahi lag raha, URL re-check karo.</p>
              )}

              <button type="submit" style={styles.primaryBtn} disabled={saving}>
                {saving ? 'Save ho raha hai...' : 'Save Profile'}
              </button>
            </form>

            <button onClick={() => navigate('/change-password')} style={styles.secondaryBtn}>
              Change Password
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #f6f9f4 0%, #edf5ea 100%)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '1rem'
  },
  card: {
    width: '100%',
    maxWidth: '500px',
    background: '#fff',
    border: '1px solid #dbe5d8',
    borderRadius: '14px',
    boxShadow: '0 10px 24px rgba(26, 44, 33, 0.09)',
    padding: '1.2rem'
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#27500A',
    fontSize: '0.9rem',
    cursor: 'pointer',
    padding: 0,
    marginBottom: '0.8rem'
  },
  title: { margin: '0 0 1rem', color: '#1f3320' },
  loading: { color: '#5f7167' },
  label: { display: 'block', marginBottom: '0.3rem', color: '#3f5346', fontWeight: 700, fontSize: '0.9rem' },
  input: {
    width: '100%',
    padding: '0.78rem 0.85rem',
    marginBottom: '0.9rem',
    border: '1px solid #d3dfd0',
    borderRadius: '10px',
    background: '#fbfdfb'
  },
  error: {
    color: '#a22929',
    background: '#fdecec',
    border: '1px solid #f4cfcf',
    borderRadius: '10px',
    padding: '0.6rem 0.75rem'
  },
  success: {
    color: '#27500A',
    background: '#eef5e9',
    border: '1px solid #dbe5d8',
    borderRadius: '10px',
    padding: '0.6rem 0.75rem'
  },
  primaryBtn: {
    width: '100%',
    padding: '0.8rem',
    border: 'none',
    borderRadius: '10px',
    background: '#27500A',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer'
  },
  secondaryBtn: {
    width: '100%',
    marginTop: '0.6rem',
    padding: '0.8rem',
    border: '1px solid #d3dfd0',
    borderRadius: '10px',
    background: '#f2f7ef',
    color: '#27500A',
    fontWeight: 700,
    cursor: 'pointer'
  },
  avatarPreviewWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '0.9rem'
  },
  avatarPreview: {
    width: '76px',
    height: '76px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '1px solid #d3dfd0'
  },
  helperText: {
    marginTop: '-0.5rem',
    marginBottom: '0.8rem',
    color: '#8a5a11',
    fontSize: '0.82rem'
  }
};
