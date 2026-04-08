import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { countryPhoneConfigs } from '../data/locationData';
import LanguageToggle from '../components/LanguageToggle';
import { useLanguage } from '../lib/language';
import { User, Mail, MapPin, Phone, Lock, Hash, Activity, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';
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

        if (!googleSignInInitialized) {
          google.accounts.id.initialize({
            client_id: clientId,
            callback: ({ credential }) => {
              if (credential) {
                credentialHandlerRef.current(credential);
              }
            }
          });
          googleSignInInitialized = true;
        }

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
      className="google-btn-slot"
      style={{
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        display: 'flex',
        justifyContent: 'center',
        minHeight: '44px'
      }}
    />
  );
}


export default function Login() {
  const { t } = useLanguage();
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
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID?.trim();
  const selectedPhoneConfig = countryPhoneConfigs[form.countryCode];
  const states = stateSuggestions;
  const cities = getCitySuggestionsForState(form.state);
  const villages = getVillageSuggestionsForLocation(form.state, form.city);

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
    <div className="login-container">
      <div className="login-card animate-slide-up">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <LanguageToggle />
        </div>
        
        <div className="login-hero">
          <span className="login-brand-icon">🌱</span>
          <h1 className="login-title">FarmTrace</h1>
          <p className="login-subtitle">{t('login_subtitle')}</p>
        </div>

        <div className="login-mode-switch">
          <button
            type="button"
            className={`login-mode-btn ${!isRegister ? 'active' : ''}`}
            onClick={() => setIsRegister(false)}
          >
            {t('login_mode_login')}
          </button>
          <button
            type="button"
            className={`login-mode-btn ${isRegister ? 'active' : ''}`}
            onClick={() => setIsRegister(true)}
          >
            {t('login_mode_register')}
          </button>
        </div>

        <div className="login-form-header">
          <h2 className="login-form-title">
            {isRegister ? t('login_title_register') : t('login_title_login')}
          </h2>
          <p className="login-form-copy">
            {isRegister
              ? t('login_copy_register')
              : t('login_copy_login')}
          </p>
        </div>

        {error && <p className="ft-alert ft-alert-error">{error}</p>}
        
        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="animate-fade-in">
              <div className="auth-input-group">
                <User size={18} className="auth-input-icon" />
                <input placeholder={t('login_name')}
                  className="ft-input"
                  value={form.name}
                  onChange={e => updateField('name', e.target.value)} required />
              </div>

              <div className="auth-input-group">
                <Activity size={18} className="auth-input-icon" />
                <select 
                  className="ft-input"
                  value={form.role}
                  onChange={e => updateField('role', e.target.value)}>
                  <option value="FARMER">{t('login_role_farmer')}</option>
                  <option value="DISTRIBUTOR">{t('login_role_distributor')}</option>
                  <option value="RETAILER">{t('login_role_retailer')}</option>
                </select>
              </div>

              <div className="auth-input-group">
                <Mail size={18} className="auth-input-icon" />
                <input type="email" placeholder={t('login_email')}
                  className="ft-input"
                  value={form.email}
                  onChange={e => updateField('email', e.target.value)} required />
              </div>

              <div className="auth-input-group">
                <MapPin size={18} className="auth-input-icon" />
                <LocationAutocompleteInput
                  value={form.state}
                  onChange={(e) => setForm((current) => ({
                    ...current,
                    state: e.target.value
                  }))}
                  suggestions={states}
                  placeholder={t('login_state_select')}
                  inputStyle={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.75rem', border: '1.5px solid var(--ft-border)', borderRadius: 'var(--ft-radius)' }}
                  required={form.role === 'FARMER'}
                />
              </div>

              <div className="auth-input-group">
                <MapPin size={18} className="auth-input-icon" />
                <LocationAutocompleteInput
                  value={form.city}
                  onChange={(e) => setForm((current) => ({
                    ...current,
                    city: e.target.value,
                    district: e.target.value
                  }))}
                  suggestions={cities.length ? cities : citySuggestions}
                  placeholder={form.state ? t('login_city_select') : t('login_city_select_first')}
                  inputStyle={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.75rem', border: '1.5px solid var(--ft-border)', borderRadius: 'var(--ft-radius)' }}
                  disabled={!form.state && form.role === 'FARMER'}
                  required={form.role === 'FARMER'}
                />
              </div>

              <div className="auth-input-group">
                <MapPin size={18} className="auth-input-icon" />
                <LocationAutocompleteInput
                  value={form.village}
                  onChange={(e) => updateField('village', e.target.value)}
                  suggestions={villages.length ? villages : getVillageSuggestionsForLocation(form.state, form.city)}
                  placeholder={form.city ? t('login_village_select') : t('login_village_select_first')}
                  inputStyle={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.75rem', border: '1.5px solid var(--ft-border)', borderRadius: 'var(--ft-radius)' }}
                  disabled={!form.city && form.role === 'FARMER'}
                  required={form.role === 'FARMER'}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div className="auth-input-group" style={{ width: '100px', flexShrink: 0 }}>
                  <Hash size={18} className="auth-input-icon" />
                  <select 
                    className="ft-input"
                    style={{ paddingLeft: '2.5rem' }}
                    value={form.countryCode}
                    onChange={e => updateField('countryCode', e.target.value)}>
                    {Object.entries(countryPhoneConfigs).map(([code, config]) => (
                      <option key={code} value={code}>{code}</option>
                    ))}
                  </select>
                </div>
                <div className="auth-input-group" style={{ flex: 1 }}>
                  <Phone size={18} className="auth-input-icon" />
                  <input placeholder={selectedPhoneConfig.placeholder}
                    className="ft-input"
                    value={form.phone}
                    inputMode="numeric"
                    maxLength={selectedPhoneConfig.digits}
                    onChange={e => updateField('phone', e.target.value.replace(/\D/g, ''))} required />
                </div>
              </div>
            </div>
          )}

          {!isRegister && (
            <div className="animate-fade-in auth-input-group">
              <Mail size={18} className="auth-input-icon" />
              <input type="email" placeholder={t('login_email')}
                className="ft-input"
                value={form.email}
                onChange={e => updateField('email', e.target.value)} required />
            </div>
          )}

          <div className="auth-input-group password-group" style={{ position: 'relative' }}>
            <Lock size={18} className="auth-input-icon" />
            <input type={showPassword ? "text" : "password"} placeholder={t('login_password')}
              className="ft-input"
              value={form.password}
              onChange={e => updateField('password', e.target.value)} required />
            <div className="auth-input-eye" 
              style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', display: 'flex' }}
              onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </div>
          </div>

          {!isRegister && (
            <div className="login-forgot-wrap">
              <span className="login-forgot-link" onClick={() => navigate('/forgot-password')}>
                {t('login_forgot_password')} ?
              </span>
            </div>
          )}

          <button className="ft-btn ft-btn-primary ft-btn-full ft-btn-lg" type="submit" disabled={loading}>
            {loading ? <div className="ft-spinner" /> : (
              <>
                {isRegister ? <UserPlus size={18} /> : <LogIn size={18} />}
                <span style={{ marginLeft: '0.5rem' }}>
                  {isRegister ? t('login_register_action') : t('login_login_action')}
                </span>
              </>
            )}
          </button>
        </form>

        <div className="login-divider">
          <span>{t('login_or')}</span>
        </div>

        {googleClientId ? (
          <GoogleSignInButton
            clientId={googleClientId}
            disabled={loading}
            onCredential={handleGoogleLogin}
          />
        ) : (
          <p className="login-form-copy" style={{ textAlign: 'center' }}>
            {t('login_google_missing')}
          </p>
        )}

        <div className="login-footer">
           <p className="login-toggle-text">
            {isRegister ? t('login_have_account') : t('login_new_user')}
            <span className="login-toggle-link" onClick={() => setIsRegister(!isRegister)}>
              {isRegister ? t('login_login_action') : t('login_register_action')}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

