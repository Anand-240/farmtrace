import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { countryPhoneConfigs, locationData } from '../data/locationData';

const GOOGLE_SCRIPT_ID = 'google-identity-services';

const loadGoogleScript = () => new Promise((resolve, reject) => {
  if (window.google?.accounts?.id) {
    resolve(window.google);
    return;
  }

  const existingScript = document.getElementById(GOOGLE_SCRIPT_ID);
  if (existingScript) {
    existingScript.addEventListener('load', () => resolve(window.google), { once: true });
    existingScript.addEventListener('error', () => reject(new Error('Google script load nahi hua')), { once: true });
    return;
  }

  const script = document.createElement('script');
  script.id = GOOGLE_SCRIPT_ID;
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.onload = () => resolve(window.google);
  script.onerror = () => reject(new Error('Google script load nahi hua'));
  document.body.appendChild(script);
});

function GoogleSignInButton({ clientId, disabled, onCredential }) {
  const containerRef = useRef(null);
  const credentialHandlerRef = useRef(onCredential);

  useEffect(() => {
    credentialHandlerRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    let isCancelled = false;

    if (!clientId || !containerRef.current) {
      return undefined;
    }

    loadGoogleScript()
      .then((google) => {
        if (isCancelled || !google?.accounts?.id || !containerRef.current) {
          return;
        }

        google.accounts.id.initialize({
          client_id: clientId,
          callback: ({ credential }) => {
            if (credential) {
              credentialHandlerRef.current(credential);
            }
          }
        });

        containerRef.current.innerHTML = '';
        google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          width: 320,
          text: 'continue_with'
        });
      })
      .catch(() => {
        if (!isCancelled && containerRef.current) {
          containerRef.current.innerHTML = '';
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [clientId, disabled]);

  return (
    <div
      ref={containerRef}
      style={{
        ...styles.googleButtonSlot,
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? 'none' : 'auto'
      }}
    />
  );
}

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
  const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID?.trim();
  const selectedPhoneConfig = countryPhoneConfigs[form.countryCode];
  const states = Object.keys(locationData);
  const cities = form.state ? Object.keys(locationData[form.state] || {}) : [];
  const villages = form.state && form.city
    ? locationData[form.state]?.[form.city] || []
    : [];

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const validatePhone = () => {
    if (!selectedPhoneConfig) {
      throw new Error('Country code select karo');
    }

    const phoneDigits = form.phone.replace(/\D/g, '');
    if (phoneDigits.length !== selectedPhoneConfig.digits) {
      throw new Error(`${selectedPhoneConfig.country} number mein ${selectedPhoneConfig.digits} digits chahiye`);
    }

    return `${form.countryCode}${phoneDigits}`;
  };

  const validateRegisterProfile = () => {
    const phone = validatePhone();

    if (!form.name.trim()) {
      throw new Error('Naam required hai');
    }

    if (!form.role) {
      throw new Error('Role required hai');
    }

    if (form.role === 'FARMER' && (!form.state || !form.city || !form.village)) {
      throw new Error('Farmer account ke liye state, city aur village select karo');
    }

    return {
      name: form.name.trim(),
      role: form.role,
      state: form.state,
      city: form.city,
      district: form.city,
      village: form.village,
      phone
    };
  };

  const persistAuth = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    navigate('/dashboard');
  };

  const handleGoogleLogin = async (credential) => {
    setLoading(true);
    setError('');

    try {
      const payload = {
        idToken: credential,
        mode: isRegister ? 'register' : 'login'
      };

      if (isRegister) {
        Object.assign(payload, validateRegisterProfile());
      }

      const res = await api.post('/api/auth/google', payload);
      persistAuth(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Google login fail ho gaya');
    }

    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = isRegister ? '/api/auth/register' : '/api/auth/login';
      const payload = isRegister
        ? {
            ...validateRegisterProfile(),
            email: form.email.trim().toLowerCase(),
            password: form.password
          }
        : {
            email: form.email.trim().toLowerCase(),
            password: form.password
          };

      const res = await api.post(url, payload);
      persistAuth(res.data);
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
                <select style={{ ...styles.input, ...styles.codeInput }} value={form.countryCode}
                  onChange={e => updateField('countryCode', e.target.value)}>
                  {Object.entries(countryPhoneConfigs).map(([code, config]) => (
                    <option key={code} value={code}>{config.country} ({code})</option>
                  ))}
                </select>
                <input style={{ ...styles.input, ...styles.phoneInput }} placeholder={selectedPhoneConfig.placeholder}
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

        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>ya</span>
          <span style={styles.dividerLine} />
        </div>

        {googleClientId ? (
          <GoogleSignInButton
            clientId={googleClientId}
            disabled={loading}
            onCredential={handleGoogleLogin}
          />
        ) : (
          <p style={styles.hint}>
            Google OAuth enable karne ke liye `REACT_APP_GOOGLE_CLIENT_ID` set karo.
          </p>
        )}

        <p style={styles.googleHint}>
          {isRegister
            ? 'Google se register karne se yahi role aur location details save hongi.'
            : 'Existing Google account se seedha login kar sakte ho.'}
        </p>

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
  link: { color: '#27500A', cursor: 'pointer', fontWeight: 'bold' },
  divider: { display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1rem 0' },
  dividerLine: { flex: 1, height: '1px', background: '#ddd' },
  dividerText: { color: '#777', fontSize: '0.85rem', textTransform: 'uppercase' },
  googleButtonSlot: { display: 'flex', justifyContent: 'center', minHeight: '44px' },
  googleHint: { color: '#666', textAlign: 'center', marginTop: '0.75rem', fontSize: '0.85rem' }
};
