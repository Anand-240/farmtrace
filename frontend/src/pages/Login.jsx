import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import LanguageToggle from '../components/LanguageToggle';
import { User, Mail, Lock, Eye, EyeOff, Shield, Phone } from 'lucide-react';
import StateCitySelector from '../components/StateCitySelector';
import './Login.css';

/* ── Google helpers ───────────────────────────────────────────── */
const GOOGLE_SCRIPT_ID = 'google-identity-services';

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

function decodeGoogleJWT(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch { return {}; }
}

function GoogleSignInButton({ clientId, disabled, onCredential }) {
  const containerRef = useRef(null);
  const onCredentialRef = useRef(onCredential);
  useEffect(() => { onCredentialRef.current = onCredential; });
  useEffect(() => {
    if (!clientId) return;
    loadGoogleScript().then(google => {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: ({ credential }) => onCredentialRef.current(credential),
      });
      if (containerRef.current) {
        google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline', size: 'large', shape: 'pill', width: 320,
        });
      }
    }).catch(err => console.warn('Google Sign-In disabled:', err));
  }, [clientId]);
  return <div ref={containerRef} style={{ display: 'flex', justifyContent: 'center', opacity: disabled ? 0.6 : 1 }} />;
}

/* ── Wheat field data ─────────────────────────────────────────── */
// Wave-based delays: stalk at x=0 moves at t=0, x=520 moves at t=2s
const wave = x => `${((x / 520) * 2.2).toFixed(2)}s`;

const MAIN_STALKS = [
  { x: 20,  h: 105 }, { x: 48,  h: 132 }, { x: 75,  h: 112 },
  { x: 100, h: 150 }, { x: 126, h: 120 }, { x: 153, h: 98  },
  { x: 180, h: 145 }, { x: 206, h: 116 }, { x: 232, h: 136 },
  { x: 258, h: 156 }, { x: 284, h: 122 }, { x: 310, h: 144 },
  { x: 336, h: 110 }, { x: 362, h: 138 }, { x: 388, h: 102 },
  { x: 414, h: 130 }, { x: 440, h: 118 }, { x: 467, h: 146 },
  { x: 493, h: 108 },
];

const BACK_STALKS = [
  { x: 34,  h: 82  }, { x: 88,  h: 95  }, { x: 140, h: 78  },
  { x: 194, h: 90  }, { x: 246, h: 100 }, { x: 297, h: 85  },
  { x: 350, h: 92  }, { x: 400, h: 78  }, { x: 453, h: 88  },
  { x: 505, h: 80  },
];

const POLLEN = [
  { x: 55,  y: 155, r: 1.8, delay: '0s'   }, { x: 140, y: 130, r: 1.4, delay: '1.8s' },
  { x: 210, y: 145, r: 2.0, delay: '0.7s' }, { x: 295, y: 125, r: 1.5, delay: '3.0s' },
  { x: 370, y: 140, r: 1.8, delay: '1.3s' }, { x: 445, y: 130, r: 1.4, delay: '2.4s' },
  { x: 100, y: 120, r: 1.2, delay: '4.0s' }, { x: 330, y: 115, r: 1.6, delay: '2.9s' },
];

const SHAPES = [
  { cls: 'fsh-circle',  top: '10%',  left: '14%',   delay: '0s'   },
  { cls: 'fsh-dot',     top: '21%',  right: '16%',  delay: '1.1s' },
  { cls: 'fsh-diamond', top: '13%',  right: '30%',  delay: '0.5s' },
  { cls: 'fsh-tri',     top: '42%',  left: '7%',    delay: '1.7s' },
  { cls: 'fsh-dot',     top: '55%',  right: '20%',  delay: '0.9s' },
  { cls: 'fsh-circle',  top: '31%',  left: '46%',   delay: '2.2s' },
  { cls: 'fsh-dot',     top: '17%',  left: '28%',   delay: '0.3s' },
  { cls: 'fsh-diamond', bottom:'40%',right: '11%',  delay: '1.4s' },
  { cls: 'fsh-tri',     top: '64%',  left: '18%',   delay: '0.6s' },
];

/* One detailed wheat head (position relative to stalk group origin 0,0) */
function WheatHead({ h, bright }) {
  const base = -h - 3;
  const grainY = [base - 4, base - 9, base - 14, base - 19];
  const grainOpacity = bright ? [0.78, 0.82, 0.86, 0.9] : [0.42, 0.46, 0.50, 0.55];

  return (
    <g>
      {/* Spine */}
      <line x1="0" y1={base} x2="0" y2={base - 23}
        stroke={bright ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.28)'}
        strokeWidth="1" />
      {/* Grain pairs */}
      {grainY.map((y, i) => (
        <g key={i}>
          <ellipse cx="-4.5" cy={y} rx="3" ry="6"
            fill={`rgba(255,255,255,${grainOpacity[i]})`}
            transform={`rotate(-26 -4.5 ${y})`} />
          <ellipse cx="4.5" cy={y} rx="3" ry="6"
            fill={`rgba(255,255,255,${grainOpacity[i]})`}
            transform={`rotate(26 4.5 ${y})`} />
        </g>
      ))}
      {/* Tip */}
      <ellipse cx="0" cy={base - 25} rx="2.5" ry="5.5"
        fill={bright ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)'} />
    </g>
  );
}

function WheatIllustration() {
  return (
    <div className="wheat-scene">
      {/* Sun */}
      <div className="wheat-sun" />

      {/* Floating shapes */}
      {SHAPES.map((s, i) => (
        <div key={i} className={`fsh ${s.cls}`}
          style={{ top: s.top, left: s.left, right: s.right, bottom: s.bottom, animationDelay: s.delay }} />
      ))}

      {/* Brand */}
      <div className="wheat-brand">
        <div className="wheat-logo-box">🌾</div>
        <h2 className="wheat-brand-name">FARMTRACE</h2>
        <p className="wheat-brand-tag">Khet se ghar tak,<br />har kadam surakshit</p>
        <div className="wheat-stats">
          {[['12K+','Farmers'],['₹48Cr','Volume'],['8','States']].map(([v,l]) => (
            <div key={l} className="wheat-stat"><span>{v}</span>{l}</div>
          ))}
        </div>
      </div>

      {/* Wheat field SVG */}
      <svg className="wheat-svg" viewBox="0 0 520 210" preserveAspectRatio="xMidYMax slice">
        {/* Sky gradient */}
        <defs>
          <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(22,163,74,0.12)" />
            <stop offset="100%" stopColor="rgba(22,163,74,0.28)" />
          </linearGradient>
        </defs>

        {/* Ground fill */}
        <path d="M0,190 Q130,175 260,185 Q390,195 520,178 L520,210 L0,210 Z"
          fill="url(#groundGrad)" />
        <path d="M0,200 Q260,192 520,198 L520,210 L0,210 Z"
          fill="rgba(22,163,74,0.15)" />

        {/* ── Background stalks (lighter, slower) ── */}
        {BACK_STALKS.map((s, i) => (
          <g key={`b${i}`} transform={`translate(${s.x},195)`}>
            <g className="stalk-back"
              style={{ animationDelay: wave(s.x), animationDuration: `${4.2 + (i % 3) * 0.4}s` }}>
              <line x1="0" y1="0" x2="0" y2={-s.h}
                stroke="rgba(255,255,255,0.28)" strokeWidth="1.4" strokeLinecap="round" />
              {/* leaf */}
              <line x1="0" y1={-s.h * 0.45} x2={-11} y2={-s.h * 0.58}
                stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeLinecap="round" />
              <WheatHead h={s.h} bright={false} />
            </g>
          </g>
        ))}

        {/* ── Main stalks ── */}
        {MAIN_STALKS.map((s, i) => (
          <g key={`f${i}`} transform={`translate(${s.x},200)`}>
            <g className="stalk-front"
              style={{ animationDelay: wave(s.x), animationDuration: `${3.2 + (i % 4) * 0.3}s` }}>
              {/* Stem */}
              <line x1="0" y1="0" x2="0" y2={-s.h}
                stroke="rgba(255,255,255,0.65)" strokeWidth="1.8" strokeLinecap="round" />
              {/* Left leaf */}
              <line x1="0" y1={-s.h * 0.32} x2={-16} y2={-s.h * 0.45}
                stroke="rgba(255,255,255,0.38)" strokeWidth="1.3" strokeLinecap="round" />
              {/* Right leaf */}
              <line x1="0" y1={-s.h * 0.58} x2={14} y2={-s.h * 0.70}
                stroke="rgba(255,255,255,0.38)" strokeWidth="1.3" strokeLinecap="round" />
              <WheatHead h={s.h} bright={true} />
            </g>
          </g>
        ))}

        {/* ── Pollen particles ── */}
        {POLLEN.map((p, i) => (
          <circle key={`p${i}`} cx={p.x} cy={p.y} r={p.r}
            fill="rgba(255,255,255,0.65)"
            className="pollen"
            style={{ animationDelay: p.delay }} />
        ))}
      </svg>
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────── */
export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', countryCode: '+91', phone: '',
    password: '', role: 'FARMER', village: '', city: '', district: '', state: '',
  });
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [showPwd, setShowPwd]       = useState(false);
  const [googleCred, setGoogleCred] = useState(null);
  const [fading, setFading]         = useState(false);   // form box fade on mode switch
  const navigate    = useNavigate();
  const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID?.trim();

  useEffect(() => {
    if (window.location.search.includes('expired=true'))
      setError('Aapka session khatam ho gaya hai. Dobara login karein.');
  }, []);

  const upd = (f, v) => setForm(c => ({ ...c, [f]: v }));

  // Smooth switch: fade form out → swap state → fade back in
  const switchMode = (toReg) => {
    if (fading) return;
    setFading(true);
    setTimeout(() => {
      setIsRegister(toReg);
      setGoogleCred(null);
      setError('');
      if (!toReg) setForm(c => ({ ...c, name: '', phone: '', password: '' }));
      setTimeout(() => setFading(false), 40); // tiny delay so React re-renders first
    }, 220);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isRegister && (!form.state || !form.city)) {
      setError('Please select your Home State and City'); return;
    }
    setError(''); setLoading(true);
    try {
      if (isRegister) {
        if (googleCred) {
          const res = await api.post('/auth/google', {
            idToken: googleCred, mode: 'register', role: form.role,
            state: form.state, city: form.city, phone: `${form.countryCode}${form.phone}`,
          });
          localStorage.setItem('token', res.data.token);
          localStorage.setItem('user', JSON.stringify(res.data.user));
          navigate('/kyc');
        } else {
          await api.post('/auth/register', { ...form, phone: `${form.countryCode}${form.phone}` });
          const res = await api.post('/auth/login', { identifier: form.email, password: form.password });
          localStorage.setItem('token', res.data.token);
          localStorage.setItem('user', JSON.stringify(res.data.user));
          navigate('/kyc');
        }
      } else {
        const res = await api.post('/auth/login', { identifier: form.email, password: form.password });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        navigate('/dashboard');
      }
    } catch (err) {
      setError(!isRegister && err.response?.status === 400
        ? 'Password ya email galat hai'
        : err.response?.data?.message || 'Error occurred');
    } finally { setLoading(false); }
  };

  const handleGoogleCred = async (credential) => {
    setError(''); setLoading(true);
    try {
      const res = await api.post('/auth/google', { idToken: credential, mode: 'login' });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/dashboard');
    } catch (err) {
      if (err.response?.status === 404) {
        const profile = decodeGoogleJWT(credential);
        setGoogleCred(credential);
        setForm(c => ({ ...c, name: profile.name || '', email: profile.email || '' }));
        setIsRegister(true);
      } else {
        setError(err.response?.data?.message || 'Google Sign-In fail ho gaya');
      }
    } finally { setLoading(false); }
  };

  return (
    <div className={`auth-root ${isRegister ? 'mode-reg' : 'mode-log'}`}>

      {/* ── ILLUSTRATION PANEL (slides with CSS transform) ── */}
      <div className="auth-illus">
        <WheatIllustration />
      </div>

      {/* ── FORM PANEL (slides opposite direction) ── */}
      <div className="auth-form-side">
        <div className={`auth-form-box ${fading ? 'fading' : ''}`}>

          <div className="auth-topnav">
            <button className="auth-back" onClick={() => navigate('/')}>← Home</button>
            <LanguageToggle />
          </div>

          <div className="auth-heading">
            <h1 className="auth-title">
              {isRegister ? <><span>Join</span> FarmTrace Today</> : <>Welcome <span>Back</span></>}
            </h1>
            <p className="auth-subtitle">
              {isRegister
                ? 'Khet se consumer tak, apna safar shuru karein'
                : 'India ki agri supply chain mein login karein'}
            </p>
          </div>

          <div className="auth-tabs">
            <button className={`auth-tab ${!isRegister ? 'active' : ''}`} onClick={() => switchMode(false)}>Log In</button>
            <button className={`auth-tab ${isRegister ? 'active' : ''}`} onClick={() => switchMode(true)}>Sign Up</button>
          </div>

          {googleCred && isRegister && (
            <div className="auth-alert info">Google se naam aur email bhar gaya — baaki details aap bharo</div>
          )}
          {error && <div className="auth-alert error">{error}</div>}

          <form onSubmit={handleSubmit}>
            {isRegister && (
              <>
                <div className="afield">
                  <User size={17} className="afield-icon" />
                  <input className="ainput" type="text" placeholder="Full Name"
                    value={form.name} onChange={e => upd('name', e.target.value)}
                    required readOnly={!!googleCred} />
                </div>
                <div className="afield">
                  <Shield size={17} className="afield-icon" />
                  <select className="ainput" value={form.role} onChange={e => upd('role', e.target.value)}>
                    <option value="FARMER">I am a Farmer</option>
                    <option value="DISTRIBUTOR">I am a Distributor</option>
                    <option value="RETAILER">I am a Retailer</option>
                  </select>
                </div>
                <div className="afield" style={{ marginBottom: '1.4rem' }}>
                  <StateCitySelector
                    stateValue={form.state} cityValue={form.city}
                    onStateChange={v => upd('state', v)} onCityChange={v => upd('city', v)} />
                </div>
              </>
            )}

            <div className="afield">
              <Mail size={17} className="afield-icon" />
              <input className="ainput" type="email" placeholder="Email Address"
                value={form.email} onChange={e => upd('email', e.target.value)}
                required readOnly={!!googleCred} />
            </div>

            {isRegister && (
              <div className="afield afield-phone">
                <Phone size={17} className="afield-icon" />
                <select className="ainput phone-code" value={form.countryCode} onChange={e => upd('countryCode', e.target.value)}>
                  <option value="+91">+91</option>
                  <option value="+1">+1</option>
                  <option value="+44">+44</option>
                </select>
                <input className="ainput phone-num" type="tel" placeholder="Phone Number"
                  value={form.phone} maxLength={10}
                  onChange={e => { const v = e.target.value.replace(/\D/g, ''); if (v.length <= 10) upd('phone', v); }}
                  required={isRegister} />
              </div>
            )}

            {!googleCred && (
              <div className="afield">
                <Lock size={17} className="afield-icon" />
                <input className="ainput" type={showPwd ? 'text' : 'password'}
                  placeholder="Password" value={form.password}
                  onChange={e => upd('password', e.target.value)} required />
                <button type="button" className="eye-btn" onClick={() => setShowPwd(s => !s)}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            )}

            {!isRegister && (
              <div style={{ textAlign: 'right', marginBottom: '1.4rem', marginTop: '-0.2rem' }}>
                <span className="forgot-link" onClick={() => navigate('/forgot-password')}>Forgot Password?</span>
              </div>
            )}

            <button className="auth-submit" type="submit" disabled={loading}>
              {loading
                ? <div className="ft-spinner" style={{ margin: '0 auto' }} />
                : (isRegister ? 'Create Account →' : 'Login →')}
            </button>
          </form>

          {!googleCred && (
            <>
              <div className="auth-divider"><span>OR</span></div>
              {googleClientId && (
                <GoogleSignInButton clientId={googleClientId} disabled={loading} onCredential={handleGoogleCred} />
              )}
            </>
          )}

          <p className="auth-switch">
            {isRegister ? 'Already have an account?' : 'New to FarmTrace?'}
            <span className="auth-switch-link" onClick={() => switchMode(!isRegister)}>
              {isRegister ? ' Log In' : ' Sign Up'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
