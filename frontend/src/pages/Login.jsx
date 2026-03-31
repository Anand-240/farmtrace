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
      <div style={styles.backgroundGlowTop} />
      <div style={styles.backgroundGlowBottom} />
      <div style={styles.card}>
        <div style={styles.hero}>
          <span style={styles.badge}>Traceable Supply Chain</span>
          <h1 style={styles.title}>FarmTrace</h1>
          <p style={styles.subtitle}>Kisan se grahak tak har step ko verify karo, trust build karo.</p>
        </div>

        <div style={styles.modeSwitch}>
          <button
            type="button"
            style={{
              ...styles.modeButton,
              ...(isRegister ? null : styles.modeButtonActive)
            }}
            onClick={() => setIsRegister(false)}
          >
            Login
          </button>
          <button
            type="button"
            style={{
              ...styles.modeButton,
              ...(isRegister ? styles.modeButtonActive : null)
            }}
            onClick={() => setIsRegister(true)}
          >
            Register
          </button>
        </div>

        <div style={styles.formHeader}>
          <h2 style={styles.formTitle}>
            {isRegister ? 'Naya Account Banao' : 'Wapas Swagat Hai'}
          </h2>
          <p style={styles.formCopy}>
            {isRegister
              ? 'Basic profile bharo ya Google se instant onboarding karo.'
              : 'Apna account access karo aur dashboard se kaam continue karo.'}
          </p>
        </div>
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
          {!isRegister && (
            <div style={styles.forgotWrap}>
              <span style={styles.forgotLink} onClick={() => navigate('/forgot-password')}>
                Password bhool gaye?
              </span>
            </div>
          )}
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
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #f6f9f4 0%, #edf5ea 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    position: 'relative',
    overflow: 'hidden'
  },
  backgroundGlowTop: {
    position: 'absolute',
    width: '260px',
    height: '260px',
    borderRadius: '999px',
    background: 'radial-gradient(circle, rgba(39,80,10,0.12) 0%, rgba(39,80,10,0) 68%)',
    top: '-90px',
    left: '-80px'
  },
  backgroundGlowBottom: {
    position: 'absolute',
    width: '300px',
    height: '300px',
    borderRadius: '999px',
    background: 'radial-gradient(circle, rgba(10,90,121,0.12) 0%, rgba(10,90,121,0) 70%)',
    right: '-120px',
    bottom: '-120px'
  },
  card: {
    background: '#ffffff',
    padding: '24px',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '460px',
    boxShadow: '0 10px 24px rgba(26, 44, 33, 0.09)',
    border: '1px solid #dbe5d8',
    position: 'relative',
    zIndex: 1
  },
  hero: { marginBottom: '20px' },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '7px 12px',
    borderRadius: '999px',
    background: '#eef5e9',
    color: '#27500A',
    fontSize: '0.75rem',
    fontWeight: '700',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    marginBottom: '14px'
  },
  title: { color: '#17330A', fontSize: '2.4rem', lineHeight: 1, margin: '0 0 0.6rem', fontWeight: 800 },
  subtitle: { color: '#5e6b57', margin: 0, fontSize: '0.95rem', lineHeight: 1.5 },
  modeSwitch: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    background: '#edf1e8',
    padding: '6px',
    borderRadius: '12px',
    marginBottom: '20px'
  },
  modeButton: {
    border: 'none',
    background: 'transparent',
    color: '#61705b',
    padding: '10px 14px',
    borderRadius: '10px',
    fontSize: '0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  modeButtonActive: {
    background: '#ffffff',
    color: '#17330A',
    boxShadow: '0 4px 10px rgba(23, 51, 10, 0.08)'
  },
  formHeader: { marginBottom: '14px' },
  formTitle: { color: '#223119', margin: '0 0 0.35rem', fontSize: '1.35rem' },
  formCopy: { color: '#6a7564', margin: 0, fontSize: '0.92rem', lineHeight: 1.45 },
  input: {
    width: '100%',
    padding: '0.92rem 1rem',
    marginBottom: '0.85rem',
    border: '1px solid #d7dfcf',
    borderRadius: '10px',
    fontSize: '0.98rem',
    boxSizing: 'border-box',
    background: '#fbfdfb',
    color: '#1d2718',
    outline: 'none'
  },
  phoneRow: { display: 'flex', gap: '0.75rem', alignItems: 'flex-start' },
  codeInput: { width: '42%', flexShrink: 0 },
  phoneInput: { marginBottom: 0 },
  hint: { margin: '0 0 0.85rem', color: '#6d7668', fontSize: '0.84rem' },
  forgotWrap: { display: 'flex', justifyContent: 'flex-end', marginTop: '-0.2rem', marginBottom: '0.5rem' },
  forgotLink: { color: '#27500A', fontSize: '0.84rem', fontWeight: 700, cursor: 'pointer' },
  button: {
    width: '100%',
    padding: '0.95rem',
    background: '#27500A',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '0.65rem',
    boxShadow: 'none'
  },
  error: {
    color: '#9f2121',
    marginBottom: '1rem',
    fontSize: '0.9rem',
    background: '#fdecec',
    border: '1px solid #f2c8c8',
    padding: '12px 14px',
    borderRadius: '12px'
  },
  toggle: { textAlign: 'center', marginTop: '1rem', color: '#5e6b57', fontSize: '0.94rem' },
  link: { color: '#27500A', cursor: 'pointer', fontWeight: 'bold' },
  divider: { display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.2rem 0 1rem' },
  dividerLine: { flex: 1, height: '1px', background: '#d9e0d3' },
  dividerText: { color: '#7b8574', fontSize: '0.82rem', textTransform: 'uppercase', fontWeight: 700 },
  googleButtonSlot: { display: 'flex', justifyContent: 'center', minHeight: '44px' },
  googleHint: { color: '#66705f', textAlign: 'center', marginTop: '0.85rem', fontSize: '0.85rem', lineHeight: 1.45 }
};
