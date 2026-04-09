import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { countryPhoneConfigs } from '../data/locationData';
import LanguageToggle from '../components/LanguageToggle';
import { useLanguage } from '../lib/language';
import { User, Mail, MapPin, Phone, Lock, LogIn, UserPlus, Eye, EyeOff, Shield } from 'lucide-react';
import LocationAutocompleteInput from '../components/LocationAutocompleteInput';
import {
  citySuggestions,
  getCitySuggestionsForState,
  getVillageSuggestionsForLocation,
  stateSuggestions
} from '../lib/locationSuggestions';
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
  const { t } = useLanguage();
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', countryCode: '+91', phone: '', password: '', role: 'FARMER', village: '', city: '', district: '', state: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID?.trim();

  const updateField = (f, v) => setForm(c => ({ ...c, [f]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const url = isRegister ? '/api/auth/register' : '/api/auth/login';
      const res = await api.post(url, { ...form, email: form.email.trim().toLowerCase() });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/dashboard');
    } catch (err) { setError(err.response?.data?.message || 'Authentication failed'); }
    finally { setLoading(false); }
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
                <select className="ft-input" value={form.role} onChange={e => updateField('role', e.target.value)}>
                  <option value="FARMER">I am a Farmer</option>
                  <option value="DISTRIBUTOR">I am a Distributor</option>
                  <option value="RETAILER">I am a Retailer</option>
                </select>
              </div>
            </div>
          )}

          <div className="auth-input-group">
            <Mail size={20} className="auth-input-icon" />
            <input className="ft-input" type="email" placeholder="Email Address" value={form.email} onChange={e => updateField('email', e.target.value)} required />
          </div>

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

        {googleClientId && <GoogleSignInButton clientId={googleClientId} disabled={loading} onCredential={() => {}} />}

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
