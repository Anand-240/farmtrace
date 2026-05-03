import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import LanguageToggle from '../components/LanguageToggle';
import { User, Mail, Lock, Eye, EyeOff, Shield, Phone } from 'lucide-react';
import StateCitySelector from '../components/StateCitySelector';
import './Login.css';

const GOOGLE_SCRIPT_ID = 'google-identity-services';
let googleSignInInitialized = false;

const loadGoogleScript = () => new Promise((resolve, reject) => {
  if (window.google?.accounts?.id) return resolve(window.google);
  const script = document.createElement('script');
  script.id = GOOGLE_SCRIPT_ID;
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true; script.defer = true;
  script.onload = () => resolve(window.google);
  script.onerror = () => reject(new Error('Google Load Fail'));
  document.body.appendChild(script);
});

function GoogleSignInButton({ clientId, disabled, onCredential }) {
  const containerRef = useRef(null);
  useEffect(() => {
    loadGoogleScript().then((google) => {
      if (!googleSignInInitialized) {
        google.accounts.id.initialize({ client_id: clientId, callback: ({ credential }) => onCredential(credential) });
        googleSignInInitialized = true;
      }
      google.accounts.id.renderButton(containerRef.current, { theme: 'outline', size: 'large', shape: 'pill', width: 320 });
    }).catch((err) => {
      console.warn('Google Sign-In disabled or failed to load:', err);
    });
  }, [clientId, onCredential]);
  return <div ref={containerRef} style={{ display: 'flex', justifyContent: 'center', opacity: disabled ? 0.6 : 1 }} />;
}

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', countryCode: '+91', phone: '', password: '', role: 'FARMER', village: '', city: '', district: '', state: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { search } = window.location;
  const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID?.trim();

  useEffect(() => {
    if (search.includes('expired=true')) {
      setError('Aapka session khatam ho gaya hai. Dobara login karein.');
    }
  }, [search]);

  const updateField = (f, v) => setForm(c => ({ ...c, [f]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isRegister && (!form.state || !form.city)) {
      setError('Pleas select your complete Home State and City');
      return;
    }
    setError('');
    setLoading(true);
    try {
      console.log('Attempting Login with BaseURL:', api.defaults.baseURL);
      if (isRegister) {
        const fullPhone = `${form.countryCode}${form.phone}`;
        await api.post('/auth/register', { ...form, phone: fullPhone });
      }
      const res = await api.post('/auth/login', { identifier: form.email, password: form.password });
      console.log('Login Success:', res.data);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/dashboard');
    } catch (err) {
      if (!isRegister && err.response?.status === 400) {
         setError('password or email dono galat hai');
      } else {
         setError(err.response?.data?.message || 'Error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card ft-anim-reveal">
        <nav style={{ position: 'absolute', top: '1.5rem', right: '1.5rem' }}><LanguageToggle /></nav>

        <div className="login-hero">
          <span className="login-brand-icon">🌱</span>
          <h1 className="login-title">FarmTrace</h1>
          <p className="login-subtitle">Securing India's Agriculture</p>
        </div>

        <div className="login-mode-switch glass">
          <button className={`login-mode-btn ${!isRegister ? 'active' : ''}`} onClick={() => setIsRegister(false)}>Log In</button>
          <button className={`login-mode-btn ${isRegister ? 'active' : ''}`} onClick={() => setIsRegister(true)}>Sign Up</button>
        </div>

        {error && <div className="ft-alert ft-alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="ft-anim-reveal-delay-1">
              <div className="auth-input-group">
                <User size={20} className="auth-input-icon" />
                <input className="ft-input" placeholder="Full Name" value={form.name} onChange={e => updateField('name', e.target.value)} required />
              </div>
              <div className="auth-input-group">
                <Shield size={20} className="auth-input-icon" />
                <select className="ft-input" value={form.role} onChange={e => updateField('role', e.target.value)} style={{ appearance: 'none', paddingLeft: '3rem' }}>
                  <option value="FARMER">I am a Farmer</option>
                  <option value="DISTRIBUTOR">I am a Distributor</option>
                  <option value="RETAILER">I am a Retailer</option>
                </select>
              </div>
              <div className="auth-input-group" style={{ marginBottom: '1.5rem' }}>
                 <StateCitySelector
                   stateValue={form.state}
                   cityValue={form.city}
                   onStateChange={val => updateField('state', val)}
                   onCityChange={val => updateField('city', val)}
                 />
              </div>
            </div>
          )}

          <div className="auth-input-group">
            <Mail size={20} className="auth-input-icon" />
            <input className="ft-input" type="email" placeholder="Email Address" value={form.email} onChange={e => updateField('email', e.target.value)} required />
          </div>

          {isRegister && (
            <div className="auth-input-group ft-anim-reveal-delay-1" style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ position: 'relative', width: '110px' }}>
                <Phone size={20} className="auth-input-icon" style={{ left: '1rem' }} />
                <select 
                  className="ft-input" 
                  style={{ width: '100%', paddingLeft: '3rem' }}
                  value={form.countryCode}
                  onChange={e => updateField('countryCode', e.target.value)}
                >
                  <option value="+91">+91</option>
                  <option value="+1">+1</option>
                  <option value="+44">+44</option>
                </select>
              </div>
              <input 
                className="ft-input" 
                type="tel" 
                style={{ flex: 1, paddingLeft: '1.25rem' }}
                placeholder="Phone Number" 
                value={form.phone} 
                onChange={e => updateField('phone', e.target.value)} 
                required={isRegister}
              />
            </div>
          )}

          <div className="auth-input-group">
            <Lock size={20} className="auth-input-icon" />
            <input className="ft-input" type={showPassword ? "text" : "password"} placeholder="Password" value={form.password} onChange={e => updateField('password', e.target.value)} required />
            <div onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '1.25rem', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', opacity: 0.5 }}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </div>
          </div>

          <button className="ft-btn ft-btn-primary ft-btn-full ft-btn-lg" type="submit" disabled={loading} style={{ height: '64px', fontSize: '1.1rem' }}>
            {loading ? <div className="ft-spinner" style={{ margin: '0 auto' }} /> : (isRegister ? 'Create Account' : 'Secure Login')}
          </button>
        </form>

        <div className="login-divider"><span>OR</span></div>

        {googleClientId && (
          <GoogleSignInButton 
            clientId={googleClientId} 
            disabled={loading} 
            onCredential={async (credential) => {
              setError('');
              setLoading(true);
              try {
                const res = await api.post('/auth/google', {
                  idToken: credential,
                  mode: isRegister ? 'register' : 'login',
                  role: form.role,
                  state: form.state,
                  city: form.city,
                  phone: `${form.countryCode}${form.phone}`
                });
                localStorage.setItem('token', res.data.token);
                localStorage.setItem('user', JSON.stringify(res.data.user));
                navigate('/dashboard');
              } catch (err) {
                setError(err.response?.data?.message || 'Google Sign-In fail ho gaya');
              } finally {
                setLoading(false);
              }
            }} 
          />
        )}

        <div className="login-footer">
          <p className="login-toggle-text">
            {isRegister ? "Already have an account?" : "New to FarmTrace?"}
            <span className="login-toggle-link" onClick={() => setIsRegister(!isRegister)}>{isRegister ? 'Log In' : 'Sign Up'}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
