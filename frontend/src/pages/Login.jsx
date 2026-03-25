import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { countryPhoneConfigs, locationData } from '../data/locationData';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    countryCode: '+91',
    phone: '',
    password: '',
    role: 'FARMER',
    village: '',
    city: '',
    district: '',
    state: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const selectedPhoneConfig = countryPhoneConfigs[form.countryCode];
  const states = Object.keys(locationData);
  const cities = form.state ? Object.keys(locationData[form.state] || {}) : [];
  const villages = form.state && form.city
    ? locationData[form.state]?.[form.city] || []
    : [];

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const url = isRegister ? '/api/auth/register' : '/api/auth/login';
      const payload = isRegister
        ? {
            name: form.name.trim(),
            email: form.email.trim().toLowerCase(),
            password: form.password,
            role: form.role,
            state: form.state,
            city: form.city,
            district: form.city,
            village: form.village,
            phone: `${form.countryCode}${form.phone}`
          }
        : {
            email: form.email.trim().toLowerCase(),
            password: form.password
          };

      if (isRegister) {
        if (!selectedPhoneConfig) {
          throw new Error('Country code select karo');
        }

        const phoneDigits = form.phone.replace(/\D/g, '');
        if (phoneDigits.length !== selectedPhoneConfig.digits) {
          throw new Error(`${selectedPhoneConfig.country} number mein ${selectedPhoneConfig.digits} digits chahiye`);
        }

        payload.phone = `${form.countryCode}${phoneDigits}`;
      }

      const res = await api.post(url, payload);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Kuch galat hua');
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
                onChange={e => updateField('name', e.target.value)} required />
              <select style={styles.input} value={form.role}
                onChange={e => updateField('role', e.target.value)}>
                <option value="FARMER">Kisan</option>
                <option value="DISTRIBUTOR">Distributor</option>
                <option value="RETAILER">Retailer</option>
              </select>
              <input style={styles.input} type="email" placeholder="Email Address"
                value={form.email}
                onChange={e => updateField('email', e.target.value)} required />
              <select style={styles.input} value={form.state}
                onChange={e => setForm((current) => ({
                  ...current,
                  state: e.target.value,
                  city: '',
                  district: '',
                  village: ''
                }))}
                required={form.role === 'FARMER'}>
                <option value="">Rajya select karo</option>
                {states.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
              <select style={styles.input} value={form.city}
                onChange={e => setForm((current) => ({
                  ...current,
                  city: e.target.value,
                  district: e.target.value,
                  village: ''
                }))}
                disabled={!form.state}
                required={form.role === 'FARMER'}>
                <option value="">{form.state ? 'City select karo' : 'Pehle state select karo'}</option>
                {cities.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
              <select style={styles.input} value={form.village}
                onChange={e => updateField('village', e.target.value)}
                disabled={!form.city}
                required={form.role === 'FARMER'}>
                <option value="">{form.city ? 'Gaon select karo' : 'Pehle city select karo'}</option>
                {villages.map((village) => (
                  <option key={village} value={village}>{village}</option>
                ))}
              </select>
              <div style={styles.phoneRow}>
                <select style={{...styles.input, ...styles.codeInput}} value={form.countryCode}
                  onChange={e => updateField('countryCode', e.target.value)}>
                  {Object.entries(countryPhoneConfigs).map(([code, config]) => (
                    <option key={code} value={code}>{config.country} ({code})</option>
                  ))}
                </select>
                <input style={{...styles.input, ...styles.phoneInput}} placeholder={selectedPhoneConfig.placeholder}
                  value={form.phone}
                  inputMode="numeric"
                  maxLength={selectedPhoneConfig.digits}
                  onChange={e => updateField('phone', e.target.value.replace(/\D/g, ''))} required />
              </div>
              <p style={styles.hint}>
                Number format: {form.countryCode} + {selectedPhoneConfig.placeholder}
              </p>
            </>
          )}
          {!isRegister && (
            <input style={styles.input} type="email" placeholder="Email Address"
              value={form.email}
              onChange={e => updateField('email', e.target.value)} required />
          )}
          <input style={styles.input} type="password" placeholder="Password"
            value={form.password}
            onChange={e => updateField('password', e.target.value)} required />
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
  phoneRow: { display: 'flex', gap: '0.75rem', alignItems: 'flex-start' },
  codeInput: { width: '42%', flexShrink: 0 },
  phoneInput: { marginBottom: 0 },
  hint: { margin: '0 0 0.75rem', color: '#666', fontSize: '0.85rem' },
  button: { width: '100%', padding: '0.75rem', background: '#27500A', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', marginTop: '0.5rem' },
  error: { color: 'red', marginBottom: '1rem', fontSize: '0.9rem' },
  toggle: { textAlign: 'center', marginTop: '1rem', color: '#666' },
  link: { color: '#27500A', cursor: 'pointer', fontWeight: 'bold' }
};
