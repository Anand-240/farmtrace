import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.post('/auth/forgot-password', {
        email
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Request fail ho gayi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <button onClick={() => navigate('/login')} style={styles.backBtn}>← Login</button>
        <h2 style={styles.title}>Forgot Password</h2>

        {error && <p style={styles.error}>{error}</p>}
        {result?.message && <p style={styles.success}>{result.message}</p>}

        <form onSubmit={handleSubmit}>
          <label style={styles.label}>Registered Email</label>
          <input
            type="email"
            style={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <button type="submit" style={styles.primaryBtn} disabled={loading}>
            {loading ? 'Send ho raha hai...' : 'Send Reset Link'}
          </button>
        </form>

        {result?.devResetUrl && (
          <div style={styles.devBox}>
            <p style={styles.devText}>Dev reset link:</p>
            <a href={result.devResetUrl} style={styles.devLink}>{result.devResetUrl}</a>
          </div>
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
    maxWidth: '430px',
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
  },
  devBox: {
    marginTop: '0.9rem',
    borderRadius: '10px',
    border: '1px dashed #d3dfd0',
    padding: '0.65rem'
  },
  devText: { margin: '0 0 0.3rem', color: '#4f6057', fontSize: '0.85rem' },
  devLink: { color: '#0a5a79', fontSize: '0.8rem', wordBreak: 'break-all' }
};
