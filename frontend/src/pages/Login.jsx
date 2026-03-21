import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', password: '', role: 'FARMER',
    village: '', district: '', state: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const url = isRegister ? '/api/auth/register' : '/api/auth/login';
      const res = await api.post(url, form);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Kuch galat hua');
    }
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>FarmTrace</h1>
        <p style={styles.subtitle}>Kisan se Grahak tak — Poori Sachai</p>
        <h2 style={styles.formTitle}>
          {isRegister ? 'Naya Account Banao' : 'Login Karo'}
        </h2>
        {error && <p style={styles.error}>{error}</p>}
        <form onSubmit={handleSubmit}>
          {isRegister && (
            <>
              <input style={styles.input} placeholder="Poora Naam"
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})} required />
              <select style={styles.input} value={form.role}
                onChange={e => setForm({...form, role: e.target.value})}>
                <option value="FARMER">Kisan</option>
                <option value="DISTRIBUTOR">Distributor</option>
                <option value="RETAILER">Retailer</option>
              </select>
              <input style={styles.input} placeholder="Gaon"
                value={form.village}
                onChange={e => setForm({...form, village: e.target.value})} />
              <input style={styles.input} placeholder="Jila"
                value={form.district}
                onChange={e => setForm({...form, district: e.target.value})} />
              <input style={styles.input} placeholder="Rajya"
                value={form.state}
                onChange={e => setForm({...form, state: e.target.value})} />
            </>
          )}
          <input style={styles.input} placeholder="Phone Number"
            value={form.phone}
            onChange={e => setForm({...form, phone: e.target.value})} required />
          <input style={styles.input} type="password" placeholder="Password"
            value={form.password}
            onChange={e => setForm({...form, password: e.target.value})} required />
          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? 'Wait karo...' : (isRegister ? 'Register Karo' : 'Login Karo')}
          </button>
        </form>
        <p style={styles.toggle}>
          {isRegister ? 'Pehle se account hai?' : 'Naya user ho?'}
          <span style={styles.link} onClick={() => setIsRegister(!isRegister)}>
            {isRegister ? ' Login Karo' : ' Register Karo'}
          </span>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#f0f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  card: { background: 'white', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 2px 20px rgba(0,0,0,0.1)' },
  title: { color: '#27500A', textAlign: 'center', fontSize: '2rem', margin: '0 0 0.5rem' },
  subtitle: { color: '#666', textAlign: 'center', marginBottom: '1.5rem', fontSize: '0.9rem' },
  formTitle: { color: '#333', marginBottom: '1rem', fontSize: '1.2rem' },
  input: { width: '100%', padding: '0.75rem', marginBottom: '0.75rem', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' },
  button: { width: '100%', padding: '0.75rem', background: '#27500A', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', marginTop: '0.5rem' },
  error: { color: 'red', marginBottom: '1rem', fontSize: '0.9rem' },
  toggle: { textAlign: 'center', marginTop: '1rem', color: '#666' },
  link: { color: '#27500A', cursor: 'pointer', fontWeight: 'bold' }
};
