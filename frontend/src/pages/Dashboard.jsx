import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import api from '../lib/api';
import LanguageToggle from '../components/LanguageToggle';
import { useLanguage } from '../lib/language';
import { useNotification } from '../context/NotificationContext';
import {
  Sprout, Truck, Coins, History, User, Layers,
  PackageCheck, ShieldCheck, Bot, LogOut, Microscope,
  Sun, Cloud, CloudRain, Thermometer, Info,
  QrCode, Copy, Eye, X,
  Search, ExternalLink, ShoppingCart,
  AlertTriangle, Menu, Bell, ChevronRight, Home,
  TrendingUp, Star, Gavel, FlaskConical, CreditCard,
  Scale, BarChart3, FileText, ArrowRight, Building2
} from 'lucide-react';
import './Dashboard.css';

const CROP_EMOJIS = {
  wheat: '🌾', gehu: '🌾', rice: '🌾', dhaan: '🌾', paddy: '🌾',
  tomato: '🍅', tamatar: '🍅',
  potato: '🥔', aloo: '🥔',
  onion: '🧅', pyaaz: '🧅',
  apple: '🍎', seb: '🍎',
  cotton: '🪴', kapas: '🪴',
  mustard: '🌻', sarson: '🌻',
  sugarcane: '🎋', ganna: '🎋',
  corn: '🌽', maize: '🌽', makka: '🌽',
  mango: '🥭', aam: '🥭',
};

function getCropEmoji(cropType = '') {
  const key = cropType.toLowerCase().split(' ')[0];
  return CROP_EMOJIS[key] || '🌱';
}

const GOVT_SCHEMES = [
  { icon: '💰', name: 'PM-KISAN', desc: 'Samman Nidhi — ₹6000/saal' },
  { icon: '🌾', name: 'PM Fasal Bima', desc: 'Fasal ka insurance' },
  { icon: '💳', name: 'Kisan Credit Card', desc: 'Kam byaj par loan' },
  { icon: '💧', name: 'PM Krishi Sinchai', desc: 'Har khet ko paani' },
];

export default function Dashboard() {
  const { t } = useLanguage();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const [myProduces, setMyProduces] = useState([]);
  const [receivedProduces, setReceivedProduces] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [qrModal, setQrModal] = useState(null);

  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const [kycStatus, setKycStatus] = useState(storedUser.kycStatus || 'PENDING');
  const user = storedUser;
  const hasShownNotifRef = useRef(false);

  // Weather state
  const [weather, setWeather] = useState(null);
  const [mandiRates, setMandiRates] = useState([]);
  const [mandiLoading, setMandiLoading] = useState(false);
  const [cropFilter, setCropFilter] = useState('');
  const [liveState, setLiveState] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [locationPermission, setLocationPermission] = useState('checking');
  const [weatherPromptMessage, setWeatherPromptMessage] = useState('');
  const mandiCacheRef = useRef({});

  // ── FETCH DATA ──
  const fetchData = useCallback(async () => {
    try {
      if (user.role === 'FARMER') {
        const [produceRes, notifRes, kycRes] = await Promise.allSettled([
          api.get('/produce/farmer/my'),
          api.get('/payment/notifications'),
          api.get('/kyc/status')
        ]);
        if (produceRes.status === 'fulfilled') setMyProduces(produceRes.value.data);
        if (notifRes.status === 'fulfilled') {
          const unreads = notifRes.value.data.filter(n => !n.isRead);
          setUnreadNotifs(unreads.length);
          if (unreads.length > 0 && !hasShownNotifRef.current) {
            hasShownNotifRef.current = true;
            setTimeout(() => {
              showNotification(`Namaste ${user.name}, aapke paas ${unreads.length} naye updates hain!`, {
                title: 'FarmTrace', type: 'sms', duration: 7000
              });
            }, 1500);
          }
        }
        if (kycRes.status === 'fulfilled') {
          const freshKyc = kycRes.value.data.kycStatus;
          if (freshKyc !== kycStatus) {
            setKycStatus(freshKyc);
            localStorage.setItem('user', JSON.stringify({ ...storedUser, kycStatus: freshKyc }));
          }
        }
      } else {
        const [produceRes, pendingRes, notifRes, kycRes] = await Promise.allSettled([
          api.get('/produce/received/my'),
          api.get('/payment/pending'),
          api.get('/payment/notifications'),
          api.get('/kyc/status')
        ]);
        if (produceRes.status === 'fulfilled') setReceivedProduces(produceRes.value.data);
        if (pendingRes.status === 'fulfilled') setPendingCount(pendingRes.value.data.length);
        if (notifRes.status === 'fulfilled') {
          const unreads = notifRes.value.data.filter(n => !n.isRead);
          setUnreadNotifs(unreads.length);
          if (unreads.length > 0 && !hasShownNotifRef.current) {
            hasShownNotifRef.current = true;
            setTimeout(() => {
              showNotification(`Namaste ${user.name}, aapke paas ${unreads.length} naye updates hain!`, {
                title: 'FarmTrace', type: 'sms', duration: 7000
              });
            }, 1500);
          }
        }
        if (kycRes.status === 'fulfilled') {
          const freshKyc = kycRes.value.data.kycStatus;
          if (freshKyc !== kycStatus) {
            setKycStatus(freshKyc);
            localStorage.setItem('user', JSON.stringify({ ...storedUser, kycStatus: freshKyc }));
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user.role, user.name, showNotification]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData();
    const handleVisibility = () => { if (!document.hidden) fetchData(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchData]);

  // ── WEATHER ──
  useEffect(() => {
    const fetchWeatherByCoords = async (latitude, longitude) => {
      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
      const weatherData = await weatherRes.json();
      if (!weatherData?.current_weather) throw new Error('Weather data unavailable');
      let locationName = 'Live Location';
      try {
        const titleRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
        const titleData = await titleRes.json();
        locationName = titleData.city || titleData.locality || locationName;
        if (titleData.principalSubdivision) setLiveState(titleData.principalSubdivision);
      } catch (e) {}
      setWeather({ temp: weatherData.current_weather.temperature, windspeed: weatherData.current_weather.windspeed, code: weatherData.current_weather.weathercode, location: `${locationName} 📍` });
    };

    const fetchWeatherByCity = async (city) => {
      try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1&language=en&format=json`);
        const geoData = await geoRes.json();
        if (geoData.results?.length > 0) {
          const { latitude, longitude, name } = geoData.results[0];
          await fetchWeatherByCoords(latitude, longitude);
          setWeather(prev => ({ ...prev, location: `${name} (Profile City)` }));
        }
      } catch (err) { console.error('Weather error:', err); }
    };

    const requestLocationWeather = () => {
      if (!navigator.geolocation) { setLocationPermission('unsupported'); setWeatherPromptMessage('Aapke browser mein location support nahi hai.'); return; }
      setWeatherLoading(true);
      setWeatherPromptMessage('');
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            await fetchWeatherByCoords(position.coords.latitude, position.coords.longitude);
            setLocationPermission('granted');
            setWeatherPromptMessage('');
          } catch (err) {
            await fetchWeatherByCity(user.city || 'Lucknow');
            setWeatherPromptMessage('Live location nahi mila, profile city weather dikhaya.');
          } finally { setWeatherLoading(false); }
        },
        async (error) => {
          if (error.code === 1) { setLocationPermission('denied'); setWeather(null); setWeatherPromptMessage('Permission denied. Browser site settings mein location enable karein.'); }
          else { await fetchWeatherByCity(user.city || 'Lucknow'); setWeatherPromptMessage('Profile city weather dikhaya gaya hai.'); }
          setWeatherLoading(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    };

    const loadWeather = async () => {
      if (!navigator.geolocation) { setLocationPermission('unsupported'); await fetchWeatherByCity(user.city || 'Lucknow'); return; }
      if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        setLocationPermission('unsupported'); await fetchWeatherByCity(user.city || 'Lucknow'); return;
      }
      if (navigator.permissions?.query) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
          setLocationPermission(permissionStatus.state);
          if (permissionStatus.state === 'denied') { setWeatherPromptMessage('Blocked 🚫: Site settings se location allow karein.'); return; }
          if (permissionStatus.state === 'granted') requestLocationWeather();
          permissionStatus.onchange = () => {
            const newState = permissionStatus.state;
            setLocationPermission(newState);
            if (newState === 'granted') requestLocationWeather();
            else if (newState === 'denied') setWeatherPromptMessage('Permission blocked.');
          };
          return;
        } catch (err) {}
      }
      requestLocationWeather();
    };

    if (user.role === 'FARMER') loadWeather();
  }, [user.city, user.role]);

  const handleEnableLocationWeather = () => {
    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setWeatherPromptMessage('HTTPS zaroori hai location ke liye.'); return;
    }
    setLocationPermission('prompt'); setWeather(null); setWeatherLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
          const weatherData = await weatherRes.json();
          if (!weatherData?.current_weather) throw new Error('Weather data missing');
          let locationName = 'Live Location';
          try {
            const titleRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
            const titleData = await titleRes.json();
            locationName = titleData.city || titleData.locality || locationName;
            if (titleData.principalSubdivision) setLiveState(titleData.principalSubdivision);
          } catch (e) {}
          setWeather({ temp: weatherData.current_weather.temperature, windspeed: weatherData.current_weather.windspeed, code: weatherData.current_weather.weathercode, location: `${locationName} 📍` });
          setLocationPermission('granted'); setWeatherPromptMessage('');
        } catch (err) { setWeatherPromptMessage('Weather load nahi hua. Dobara try karein.'); }
        finally { setWeatherLoading(false); }
      },
      (error) => {
        if (error.code === 1) { setLocationPermission('denied'); setWeatherPromptMessage('Location blocked. Browser site settings me jaake Location ko Allow karein.'); }
        else setWeatherPromptMessage('Location fetch fail hua. GPS on karein aur dobara try karein.');
        setWeatherLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // ── MANDI ──
  useEffect(() => {
    const loadMandi = async () => {
      const targetState = liveState || user.state;
      const cacheKey = `${targetState || ''}:${cropFilter}`;
      if (mandiCacheRef.current[cacheKey]) { setMandiRates(mandiCacheRef.current[cacheKey]); return; }
      setMandiLoading(true);
      try {
        const mandiRes = await api.get('/market/mandi', { params: { state: targetState || undefined, commodity: cropFilter || undefined, limit: 5 } });
        const records = mandiRes.data?.records || [];
        mandiCacheRef.current[cacheKey] = records;
        setMandiRates(records);
      } catch (err) { console.error('Mandi API Error:', err); }
      setMandiLoading(false);
    };
    if (user.role === 'FARMER') loadMandi();
  }, [user.state, user.role, cropFilter, liveState]);

  // ── UTILS ──
  const logout = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/login'); };

  const fallbackCopyText = (text) => {
    const area = document.createElement('textarea');
    area.value = text; area.setAttribute('readonly', ''); area.style.cssText = 'position:fixed;top:-9999px;left:-9999px';
    document.body.appendChild(area); area.focus(); area.select();
    let copied = false; try { copied = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(area); return copied;
  };

  const copyId = async (id) => {
    const text = String(id || '').trim();
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) await navigator.clipboard.writeText(text);
      else { const ok = fallbackCopyText(text); if (!ok) throw new Error('fallback failed'); }
      showNotification('ID copy ho gayi! ✅', { type: 'sms', duration: 2500 });
    } catch (err) { showNotification(`Manual copy karein: ${text}`, { title: 'Copy Failed', type: 'sms', duration: 7000 }); }
  };

  const showQR = async (produceId) => {
    try {
      setLoading(true);
      const res = await api.get(`/produce/${produceId}`);
      setQrModal({ url: `${window.location.origin}/verify/${produceId}`, details: res.data });
    } catch (err) { showNotification('QR load nahi hua. Network check karein.', { type: 'sms', tone: 'error' }); }
    finally { setLoading(false); }
  };

  // ── COMPUTED ──
  const roleLabel = user.role || 'USER';
  const baseList = user.role === 'FARMER' ? myProduces : receivedProduces;
  const totalSales = baseList.reduce((sum, item) => {
    const price = user.role === 'FARMER' ? Number(item.farmPrice) || 0 : Number(item.receivedPrice ?? item.farmPrice) || 0;
    return sum + (Number(item.quantity) || 0) * price;
  }, 0);

  const quickStats = [
    { label: user.role === 'FARMER' ? 'Meri Fasal' : 'Prapt Utpaad', value: baseList.length, icon: '🌾', tone: 'produce' },
    { label: 'Pending Pay', value: pendingCount, icon: '💰', tone: 'payments' },
    { label: 'Notifications', value: unreadNotifs, icon: '🔔', tone: 'notifs' },
    { label: 'Total Value', value: `₹${Math.round(totalSales).toLocaleString('en-IN')}`, icon: '📈', tone: 'sales' },
  ];

  const recentProduces = baseList.slice(0, 3);

  // ── SIDEBAR ITEMS ──
  const sidebarSections = [
    {
      title: 'Main',
      items: [
        { label: 'Dashboard', icon: <Home size={18} />, path: '/dashboard', show: true },
        { label: 'Profile', icon: <User size={18} />, path: '/profile', show: true },
        { label: t('dash_action_history') || 'Transactions', icon: <History size={18} />, path: '/transactions', show: true, badge: unreadNotifs },
      ]
    },
    {
      title: 'Kisan Operations',
      items: [
        { label: t('dash_action_register') || 'Register Produce', icon: <Sprout size={18} />, path: '/register-produce', show: user.role === 'FARMER' },
        { label: 'Transfer', icon: <Truck size={18} />, path: '/transfer', show: user.role !== 'CONSUMER' },
        { label: 'Pending Payments', icon: <Coins size={18} />, path: '/payment', show: user.role !== 'FARMER', badge: pendingCount },
        { label: 'AgriMarket', icon: <ShoppingCart size={18} />, path: '/marketplace', show: user.role !== 'FARMER' },
        { label: 'Lot Management', icon: <Layers size={18} />, path: '/lot-ops', show: true },
        { label: 'Dispatch', icon: <PackageCheck size={18} />, path: '/dispatch-logistics', show: user.role !== 'CONSUMER' },
        { label: 'Milestone Pay', icon: <ShieldCheck size={18} />, path: '/escrow', show: true },
        { label: 'Bimari Scanner', icon: <Microscope size={18} />, path: '/crop-disease', show: user.role === 'FARMER' },
        { label: 'AI Kisan Mitra', icon: <Bot size={18} />, path: '/ai', show: user.role === 'FARMER' },
      ]
    },
    {
      title: 'eNAM Features',
      items: [
        { label: 'Mandi Prices', icon: <TrendingUp size={18} />, path: '/mandi-prices', show: true },
        { label: 'Live Auction', icon: <Gavel size={18} />, path: '/auction', show: true },
        { label: 'Quality Grade', icon: <FlaskConical size={18} />, path: '/quality-grading', show: true },
        { label: 'Warehouse', icon: <Building2 size={18} />, path: '/warehouse', show: true },
        { label: 'Agri Credit', icon: <CreditCard size={18} />, path: '/finance', show: true },
        { label: 'Dispute', icon: <Scale size={18} />, path: '/dispute', show: true },
        { label: 'Market Advisory', icon: <BarChart3 size={18} />, path: '/market-advisory', show: true },
        { label: 'Buyer Ratings', icon: <Star size={18} />, path: '/buyer-ratings', show: true },
        { label: 'Govt Schemes', icon: <Home size={18} />, path: '/govt-schemes', show: true },
        { label: 'GST Invoice', icon: <FileText size={18} />, path: '/gst-invoice', show: true },
      ]
    },
    {
      title: 'Account',
      items: [
        { label: 'KYC Verify', icon: <ShieldCheck size={18} />, path: '/kyc', show: kycStatus !== 'VERIFIED' },
      ]
    }
  ];

  // ── 5 MINI NAV ITEMS (features NOT on dashboard page) ──
  const miniNavItems = user.role === 'FARMER' ? [
    { label: 'Register Produce', icon: <Sprout size={22} />, path: '/register-produce' },
    { label: 'Transfer', icon: <Truck size={22} />, path: '/transfer' },
    { label: 'Live Auction', icon: <Gavel size={22} />, path: '/auction' },
    { label: 'Bimari Scanner', icon: <Microscope size={22} />, path: '/crop-disease' },
    { label: 'Transactions', icon: <History size={22} />, path: '/transactions', badge: unreadNotifs },
  ] : [
    { label: 'Pending Payments', icon: <Coins size={22} />, path: '/payment', badge: pendingCount },
    { label: 'Transfer', icon: <Truck size={22} />, path: '/transfer' },
    { label: 'AgriMarket', icon: <ShoppingCart size={22} />, path: '/marketplace' },
    { label: 'Warehouse', icon: <Building2 size={22} />, path: '/warehouse' },
    { label: 'Transactions', icon: <History size={22} />, path: '/transactions', badge: unreadNotifs },
  ];

  // Margin driven by state — reliable since sidebar is position:fixed
  const isDesktop = window.innerWidth >= 1024;
  const mainMargin = isDesktop ? (sidebarOpen ? '240px' : '56px') : '0';

  return (
    <div className="fd-layout">

      {/* ── SIDEBAR OVERLAY (mobile only, when fully open) ── */}
      {sidebarOpen && (
        <div className="fd-sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ══ FULL SIDEBAR (open state) ══ */}
      <aside className={`fd-sidebar ${sidebarOpen ? 'fd-sidebar-open' : 'fd-sidebar-closed'}`}>
        <div className="fd-sidebar-header">
          <div className="fd-sidebar-brand">
            <div className="fd-sidebar-brand-icon">🌱</div>
            <span className="fd-sidebar-brand-name">FarmTrace</span>
          </div>
          <button className="fd-sidebar-close-btn" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="fd-sidebar-user-card">
          <div className="fd-sidebar-avatar">{user.name?.charAt(0)?.toUpperCase() || 'U'}</div>
          <div className="fd-sidebar-user-info">
            <div className="fd-sidebar-user-name">{user.name}</div>
            <div className="fd-sidebar-user-role">{roleLabel}</div>
          </div>
        </div>

        <nav className="fd-sidebar-nav">
          {sidebarSections.map((section) => {
            const visibleItems = section.items.filter(item => item.show);
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.title} className="fd-nav-section">
                <p className="fd-nav-section-title">{section.title}</p>
                {visibleItems.map((item) => (
                  <button
                    key={item.path}
                    title={item.label}
                    className={`fd-nav-item ${location.pathname === item.path ? 'fd-nav-active' : ''}`}
                    onClick={() => { navigate(item.path); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                  >
                    <span className="fd-nav-icon">{item.icon}</span>
                    <span className="fd-nav-label">{item.label}</span>
                    {item.badge > 0 && (
                      <span className="fd-nav-badge">{item.badge > 99 ? '99+' : item.badge}</span>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        <button onClick={logout} className="fd-sidebar-logout">
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </aside>

      {/* ══ MINI SIDEBAR (desktop only, collapsed state) ══ */}
      {!sidebarOpen && (
        <aside className="fd-mini-sidebar">
          {/* Hamburger to expand */}
          <button className="fd-mini-hamburger" onClick={() => setSidebarOpen(true)} title="Menu Kholein">
            <Menu size={20} />
          </button>

          {/* 5 key nav icons */}
          <nav className="fd-mini-nav">
            {miniNavItems.map((item) => (
              <button
                key={item.path}
                title={item.label}
                className={`fd-mini-nav-btn ${location.pathname === item.path ? 'fd-mini-active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                {item.icon}
                {item.badge > 0 && (
                  <span className="fd-mini-badge">{item.badge > 99 ? '99+' : item.badge}</span>
                )}
              </button>
            ))}
          </nav>

          {/* Logout */}
          <button className="fd-mini-logout" onClick={logout} title="Logout">
            <LogOut size={20} />
          </button>
        </aside>
      )}

      {/* ── MAIN WRAPPER ── */}
      <div className="fd-main-wrap" style={{ marginLeft: mainMargin }}>

        {/* ── KYC BANNER ── */}
        {kycStatus !== 'VERIFIED' && (
          <div onClick={() => navigate('/kyc')} className="fd-kyc-banner">
            <AlertTriangle size={16} />
            <span>
              {kycStatus === 'SUBMITTED'
                ? 'KYC review mein hai — 24 ghante mein verify ho jaayega'
                : 'Account verify karo — Aadhaar / PAN / eShram — Transfer & Payment ke liye zaroori hai'}
            </span>
            <span className="fd-kyc-banner-cta">
              {kycStatus === 'SUBMITTED' ? 'Status Dekho →' : 'Verify Karo →'}
            </span>
          </div>
        )}

        {/* ── HEADER ── */}
        <header className="fd-header">
          <button className="fd-hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu size={22} />
          </button>

          <div className="fd-header-search">
            <Search size={15} />
            <input
              type="text"
              placeholder="Koi bhi Lot ID search karein..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) navigate(`/verify/${e.target.value.trim()}`);
              }}
            />
            <kbd>↵</kbd>
          </div>

          <div className="fd-header-right">
            <LanguageToggle />
            {user.role === 'FARMER' && (
              <button
                className="fd-create-btn"
                onClick={() => navigate('/register-produce')}
                title="Nayi Fasal Register Karein"
              >
                <Sprout size={15} />
                <span>+</span>
              </button>
            )}
            <button className="fd-notif-btn" onClick={() => navigate('/transactions')} title="Notifications">
              <Bell size={20} />
              {unreadNotifs > 0 && (
                <span className="fd-notif-dot">{unreadNotifs > 99 ? '99+' : unreadNotifs}</span>
              )}
            </button>
            <button className="fd-profile-btn" onClick={() => navigate('/profile')}>
              <div className="fd-header-avatar">{user.name?.charAt(0)?.toUpperCase() || 'U'}</div>
              <div className="fd-profile-info">
                <span className="fd-profile-name">{user.name}</span>
                <span className="fd-profile-role">{roleLabel}</span>
              </div>
            </button>
          </div>
        </header>

        {/* ── QR / TRACEABILITY MODAL ── */}
        {qrModal && (
          <div className="ft-modal-overlay" onClick={() => setQrModal(null)}>
            <div className="ft-modal dashboard-qr-trace-modal" onClick={e => e.stopPropagation()} style={{ width: 'min(850px, 95%)', maxHeight: '90vh' }}>
              <button type="button" className="dashboard-modal-close" onClick={() => setQrModal(null)}
                style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', border: 'none', background: 'var(--ft-bg)', padding: '10px', borderRadius: '50%', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={20} strokeWidth={2.5} />
              </button>
              <div className="modal-inner-grid" style={{ display: 'flex', minHeight: '520px' }}>
                <div className="modal-qr-section" style={{ width: '320px', flexShrink: 0, padding: '3.5rem 2.5rem', borderRight: '1.5px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div className="modal-header-mini">
                    <div className="dashboard-brand-icon" style={{ width: 32, height: 32, fontSize: '1rem' }}>🌱</div>
                    <h3 className="ft-modal-title">Product Passport</h3>
                  </div>
                  <div style={{ background: '#fff', padding: '2rem', borderRadius: '32px', boxShadow: '0 15px 40px rgba(0,0,0,0.05)', marginBottom: '2rem', border: '1px solid rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <QRCodeSVG value={qrModal.url} size={200} style={{ borderRadius: '12px' }} />
                    <p style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--ft-text-muted)', marginTop: '1.25rem', textAlign: 'center' }}>Scan to trace on blockchain</p>
                  </div>
                  <div className="produce-info-mini">
                    <h4 className="mini-crop-name">{getCropEmoji(qrModal.details.cropType)} {qrModal.details.cropType}</h4>
                    <div className="mini-details-row">
                      <span><Info size={16} /> {qrModal.details.origin}</span>
                      <span><Layers size={16} /> {qrModal.details.quantity}kg</span>
                    </div>
                    <div className="mini-id-badge">LOT ID: {qrModal.details._id.slice(-8).toUpperCase()}</div>
                  </div>
                </div>
                <div className="modal-trace-section" style={{ flex: 1, padding: '4rem', display: 'flex', flexDirection: 'column' }}>
                  <h4 className="trace-section-title">Timeline — Journey to You</h4>
                  <div className="trace-timeline">
                    <div className="trace-step">
                      <div className="trace-marker green"></div>
                      <div className="trace-content">
                        <p className="trace-step-title">Farm Origin — {qrModal.details.farmerName}</p>
                        <p className="trace-step-sub">{qrModal.details.origin}</p>
                        <p className="trace-step-price">₹{qrModal.details.farmPrice}/kg</p>
                      </div>
                    </div>
                    {(qrModal.details.dbTransfers || []).map((tr, i) => (
                      <div key={i} className="trace-step">
                        <div className="trace-marker blue"></div>
                        <div className="trace-content">
                          <p className="trace-step-title">{tr.transferType.replace(/_/g, ' ')}</p>
                          <p className="trace-step-sub">{tr.location}</p>
                          <p className="trace-step-price">₹{tr.price}/kg</p>
                          {tr.txHash && <a href={`https://sepolia.etherscan.io/tx/${tr.txHash}`} target="_blank" rel="noreferrer" className="trace-proof-link">Verify Proof <ExternalLink size={12} /></a>}
                        </div>
                      </div>
                    ))}
                    {(!qrModal.details.dbTransfers || qrModal.details.dbTransfers.length === 0) && (
                      <p className="trace-empty-note">Awaiting shipment transfers...</p>
                    )}
                  </div>
                  {qrModal.details.isBlockchainVerified && (
                    <div className="modal-blockchain-verified"><ShieldCheck size={16} /> Immutable Blockchain Verified</div>
                  )}
                </div>
              </div>
              <div className="modal-footer" style={{ padding: '2.5rem 4rem 3.5rem', display: 'flex', gap: '1.5rem', background: '#fff' }}>
                <button onClick={() => setQrModal(null)} className="ft-btn ft-btn-ghost ft-btn-full">Close</button>
                <button onClick={() => window.open(qrModal.url, '_blank')} className="ft-btn ft-btn-primary ft-btn-full">Go to History Page</button>
              </div>
            </div>
          </div>
        )}

        {/* ── MAIN CONTENT ── */}
        <main className="fd-content">

          {/* ROW 1: GREETING + WEATHER */}
          <div className="fd-top-row">
            {/* Greeting Card */}
            <div className="fd-greeting-card ft-anim-slide-up">
              <p className="fd-greeting-hello">NAMASTE 🙏</p>
              <h1 className="fd-greeting-name">{user.name}</h1>
              <p className="fd-greeting-sub">
                {user.role === 'FARMER'
                  ? 'Aapki fasal, blockchain par verified. Neeche apni harvest details dekhein.'
                  : 'Track agricultural produce across the supply chain with immutable proof.'}
              </p>
              <div className="fd-chips-row">
                <span className="fd-chip">🏷 {roleLabel}</span>
                {user.city && <span className="fd-chip">📍 {user.city}</span>}
                {user.state && <span className="fd-chip">🗺️ {user.state}</span>}
                <span className="fd-chip">📅 {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
              </div>

              {/* Quick Stats inside greeting */}
              {!loading && (
                <div className="fd-mini-stats-row">
                  {quickStats.map((stat) => (
                    <div key={stat.label} className={`fd-mini-stat fd-stat-${stat.tone}`}>
                      <span className="fd-mini-stat-icon">{stat.icon}</span>
                      <span className="fd-mini-stat-val">{stat.value}</span>
                      <span className="fd-mini-stat-label">{stat.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Weather Panel (Farmer only) */}
            {user.role === 'FARMER' && (
              <div className="fd-weather-panel ft-anim-slide-up">
                <h3 className="fd-weather-title"><Thermometer size={18} /> Aaj Ka Mausam</h3>
                {weather ? (
                  <>
                    <div className="fd-weather-main">
                      {weather.code > 50 ? <CloudRain size={48} /> : (weather.code > 1 ? <Cloud size={48} /> : <Sun size={48} />)}
                      <span className="fd-weather-temp">{weather.temp}°C</span>
                    </div>
                    <div className="fd-weather-details">
                      <p>📍 <strong>{weather.location}</strong></p>
                      <p>💨 Hawa: {weather.windspeed} km/h</p>
                    </div>
                    {weatherPromptMessage && <p className="fd-weather-note">{weatherPromptMessage}</p>}
                  </>
                ) : weatherLoading ? (
                  <p className="ft-loading-pulse">Mausam aa raha hai...</p>
                ) : (
                  <div className="fd-weather-permission">
                    <p>Location enable karo tab live weather dikhega.</p>
                    <button type="button" className="fd-weather-enable-btn" onClick={handleEnableLocationWeather}>Enable Location</button>
                    {weatherPromptMessage && <p className="fd-weather-note">{weatherPromptMessage}</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── IMPORTANT FEATURE BANNER ── */}
          <div className="fd-feature-banner ft-anim-slide-up">
            {user.role === 'FARMER' ? (
              baseList.length === 0 ? (
                <div className="fd-banner-inner fd-banner-register" onClick={() => navigate('/register-produce')}>
                  <div className="fd-banner-icon">🌱</div>
                  <div className="fd-banner-text">
                    <h3>Apni Pehli Fasal Register Karein</h3>
                    <p>Blockchain par apni fasal ko secure karein — traceability aur better prices ke liye</p>
                  </div>
                  <button className="fd-banner-cta">
                    Register Karein <ArrowRight size={18} />
                  </button>
                </div>
              ) : (
                <div className="fd-banner-inner fd-banner-ai" onClick={() => navigate('/ai')}>
                  <div className="fd-banner-icon">🤖</div>
                  <div className="fd-banner-text">
                    <h3>AI Kisan Mitra — Kheti Mein Sahayta</h3>
                    <p>Bimari diagnosis, mausam salah, mandi tips — sabkuch ek jagah</p>
                  </div>
                  <button className="fd-banner-cta">
                    Chat Karein <ArrowRight size={18} />
                  </button>
                </div>
              )
            ) : (
              <div className="fd-banner-inner fd-banner-market" onClick={() => navigate('/marketplace')}>
                <div className="fd-banner-icon">🛒</div>
                <div className="fd-banner-text">
                  <h3>AgriMarket — Fresh Produce Khareeden</h3>
                  <p>Seedhe kisan se, blockchain-verified quality ke saath</p>
                </div>
                <button className="fd-banner-cta">
                  Dekhein <ArrowRight size={18} />
                </button>
              </div>
            )}
          </div>

          {/* ── GOVERNMENT SCHEMES ── */}
          <div className="fd-section">
            <div className="fd-section-header">
              <h2 className="fd-section-title">🏛️ Sarkar Ki Yojnayein</h2>
              <button className="fd-see-all-btn" onClick={() => navigate('/govt-schemes')}>
                Sabhi Dekhein <ChevronRight size={16} />
              </button>
            </div>
            <div className="fd-schemes-grid">
              {GOVT_SCHEMES.map((scheme) => (
                <div key={scheme.name} className="fd-scheme-card" onClick={() => navigate('/govt-schemes')}>
                  <span className="fd-scheme-icon">{scheme.icon}</span>
                  <div>
                    <div className="fd-scheme-name">{scheme.name}</div>
                    <div className="fd-scheme-desc">{scheme.desc}</div>
                  </div>
                  <ChevronRight size={16} className="fd-scheme-arrow" />
                </div>
              ))}
            </div>
          </div>

          {/* ── MANDI RATES (Farmer only) ── */}
          {user.role === 'FARMER' && (
            <div className="fd-section">
              <div className="fd-section-header">
                <h2 className="fd-section-title">📊 Aaj Ki Mandi Daren</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <select
                    value={cropFilter}
                    onChange={(e) => setCropFilter(e.target.value)}
                    className="fd-mandi-filter"
                  >
                    <option value="">Sabhi Fasalein</option>
                    <option value="Wheat">🌾 Gehu</option>
                    <option value="Paddy(Dhaan)(Common)">🌾 Dhaan</option>
                    <option value="Tomato">🍅 Tamatar</option>
                    <option value="Potato">🥔 Aloo</option>
                    <option value="Onion">🧅 Pyaaz</option>
                    <option value="Apple">🍎 Seb</option>
                    <option value="Cotton">🪴 Kapas</option>
                    <option value="Mustard">🌻 Sarson</option>
                  </select>
                  <button className="fd-see-all-btn" onClick={() => navigate('/mandi-prices')}>
                    Sabhi Dekhein <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              {mandiLoading ? (
                <p className="ft-loading-pulse">Rate aa rahe hain...</p>
              ) : mandiRates.length > 0 ? (
                <div className="fd-mandi-grid">
                  {mandiRates.map((record, i) => (
                    <div key={i} className="fd-mandi-card">
                      <div className="fd-mandi-crop">{getCropEmoji(record.commodity)} {record.commodity}</div>
                      <div className="fd-mandi-price">₹{(record.modal_price / 100).toFixed(2)}<span>/kg</span></div>
                      <div className="fd-mandi-location">{record.market}, {record.state}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--ft-text-muted)', fontWeight: 600, padding: '1rem 0' }}>Is fasal ka rate abhi nahi mila</p>
              )}
            </div>
          )}

          {/* ── RECENT PRODUCE ── */}
          <div className="fd-section">
            <div className="fd-section-header">
              <h2 className="fd-section-title">
                {user.role === 'FARMER' ? '🌾 Meri Fasal — Haaliyon Ki' : '📦 Prapt Utpaad — Haaliyon Ka'}
              </h2>
              <button className="fd-see-all-btn" onClick={() => navigate('/produce-list')}>
                Sabhi Dekhein <ChevronRight size={16} />
              </button>
            </div>

            {loading ? (
              <p className="ft-loading-pulse">🌱 Load ho raha hai...</p>
            ) : recentProduces.length === 0 ? (
              <div className="fd-empty-state">
                <div className="fd-empty-icon">{user.role === 'FARMER' ? '🌱' : '📦'}</div>
                <p className="fd-empty-title">
                  {user.role === 'FARMER' ? 'Koi fasal register nahi ki abhi tak' : 'Koi produce prapt nahi hua abhi tak'}
                </p>
                {user.role === 'FARMER' && (
                  <button className="ft-btn ft-btn-primary" onClick={() => navigate('/register-produce')}>
                    <Sprout size={18} /> Pehli Fasal Register Karein
                  </button>
                )}
              </div>
            ) : (
              <div className="fd-recent-produce-grid">
                {recentProduces.map((p, idx) => (
                  <div key={p._id} className="fd-produce-card" style={{ animationDelay: `${idx * 0.1}s` }}>
                    <div className="fd-produce-card-header">
                      <div className="fd-produce-meta-row">
                        <span className="mini-id-badge">LOT: {p._id.slice(-6).toUpperCase()}</span>
                        <span className={`ft-badge ${p.blockchainStatus === 'CONFIRMED' ? 'ft-badge-success' : 'ft-badge-pending'}`}>
                          {p.blockchainStatus === 'CONFIRMED' ? '✓ Verified' : '⏳ Pending'}
                        </span>
                      </div>
                      <div className="fd-produce-title-row">
                        <span className="fd-produce-emoji">{getCropEmoji(p.cropType)}</span>
                        <h3 className="fd-produce-name">{p.cropType}</h3>
                      </div>
                    </div>
                    <div className="fd-produce-card-details">
                      <div className="fd-produce-detail">
                        <span className="detail-label">Origin</span>
                        <span className="detail-val">{p.origin}</span>
                      </div>
                      <div className="fd-produce-detail">
                        <span className="detail-label">Quantity</span>
                        <span className="detail-val">{p.quantity} KG</span>
                      </div>
                      <div className="fd-produce-detail">
                        <span className="detail-label">Grade</span>
                        <span className="detail-val">{p.qualityGrade}</span>
                      </div>
                      <div className="fd-produce-detail">
                        <span className="detail-label">Price/KG</span>
                        <span className="detail-val">₹{user.role === 'FARMER' ? p.farmPrice : (p.receivedPrice || p.farmPrice)}</span>
                      </div>
                    </div>
                    <div className="fd-produce-card-footer">
                      <button onClick={() => showQR(p._id)} className="ft-btn ft-btn-primary ft-btn-sm">
                        <QrCode size={16} /> QR
                      </button>
                      <button onClick={() => copyId(p._id)} className="ft-btn ft-btn-ghost ft-btn-sm">
                        <Copy size={14} /> Copy
                      </button>
                      <button onClick={() => navigate(`/verify/${p._id}`)} className="ft-btn ft-btn-ghost ft-btn-sm">
                        <Eye size={14} /> History
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* View All Button */}
            <button className="fd-view-all-btn" onClick={() => navigate('/produce-list')}>
              Sabhi Produce aur Transfers Dekhein
              <ArrowRight size={18} />
            </button>
          </div>

        </main>
      </div>
    </div>
  );
}
