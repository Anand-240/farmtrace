import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function ChangePassword() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 6) {
      setError('Naya password kam se kam 6 characters ka hona chahiye');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Confirm password match nahi kar raha');
      return;
    }

    setLoading(true);
    try {
      const res = await api.put('/auth/change-password', {
        currentPassword,
        newPassword
      });
      setSuccess(res.data?.message || 'Password change ho gaya');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Password change nahi hua');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <button onClick={() => navigate('/profile')} style={styles.backBtn}>← Profile</button>
        <h2 style={styles.title}>Change Password</h2>

        {error && <p style={styles.error}>{error}</p>}
        {success && <p style={styles.success}>{success}</p>}

        <form onSubmit={handleSubmit}>
          <label style={styles.label}>Current Password</label>
          <input
            type="password"
            style={styles.input}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Agar Google account hai to blank chhod sakte ho"
          />

          <label style={styles.label}>New Password</label>
          <input
            type="password"
            style={styles.input}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />

          <label style={styles.label}>Confirm New Password</label>
          <input
            type="password"
            style={styles.input}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <button type="submit" style={styles.primaryBtn} disabled={loading}>
            {loading ? 'Update ho raha hai...' : 'Update Password'}
          </button>
        </form>
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
    maxWidth: '460px',
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
  }
};
