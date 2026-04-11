import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import api from '../lib/api';
import LanguageToggle from '../components/LanguageToggle';
import { useLanguage } from '../lib/language';
import { useNotification } from '../context/NotificationContext';
import {
  Sprout, Truck, Coins, History, User, Layers,
  PackageCheck, ShieldCheck, Bot, LogOut,
  Sun, Cloud, CloudRain, Thermometer, Info,
  QrCode, Copy, Eye, X,
  Search, ChevronDown, ChevronUp, SlidersHorizontal, 
  Filter, Calendar, ArrowUpDown, IndianRupee
} from 'lucide-react';
import './Dashboard.css';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'priceHigh', label: 'Highest Price' },
  { value: 'priceLow', label: 'Lowest Price' }
];

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

export default function Dashboard() {
  const { t } = useLanguage();
  const { showNotification } = useNotification();
  const [myProduces, setMyProduces] = useState([]);
  const [receivedProduces, setReceivedProduces] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [qrModal, setQrModal] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const navigate = useNavigate();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (user.role === 'FARMER') {
          const res = await api.get('/api/produce/farmer/my');
          setMyProduces(res.data);
        } else {
          const res = await api.get('/api/produce/received/my');
          setReceivedProduces(res.data);
          const pending = await api.get('/api/payment/pending');
          setPendingCount(pending.data.length);
        }
        const notifRes = await api.get('/api/payment/notifications');
        const unreads = notifRes.data.filter(n => !n.isRead);
        setUnreadNotifs(unreads.length);

        if (unreads.length > 0) {
          setTimeout(() => {
            showNotification(`Namaste ${user.name}, aapke paas ${unreads.length} naye updates hain!`, {
              title: 'FarmTrace',
              type: 'sms',
              duration: 7000
            });
          }, 1500);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user.role, user.name, showNotification]);

  const [weather, setWeather] = useState(null);
  const [mandiRates, setMandiRates] = useState([]);
  const [mandiLoading, setMandiLoading] = useState(false);
  const [cropFilter, setCropFilter] = useState('');
  const [liveState, setLiveState] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [locationPermission, setLocationPermission] = useState('checking');
  const [weatherPromptMessage, setWeatherPromptMessage] = useState('');

  useEffect(() => {
    const fetchWeatherByCoords = async (latitude, longitude) => {
      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
      const weatherData = await weatherRes.json();

      if (!weatherData?.current_weather) {
        throw new Error('Weather data unavailable for current location');
      }

      let locationName = 'Live Location';
      try {
        const titleRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
        const titleData = await titleRes.json();
        locationName = titleData.city || titleData.locality || locationName;
        if (titleData.principalSubdivision) {
          setLiveState(titleData.principalSubdivision);
        }
      } catch (e) {
        // Reverse geocode best-effort hai; weather render ko block nahi karte.
      }

      setWeather({
        temp: weatherData.current_weather.temperature,
        windspeed: weatherData.current_weather.windspeed,
        code: weatherData.current_weather.weathercode,
        location: `${locationName} 📍`
      });
    };

    const fetchWeatherByCity = async (city) => {
      try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1&language=en&format=json`);
        const geoData = await geoRes.json();
        if (geoData.results && geoData.results.length > 0) {
          const { latitude, longitude, name } = geoData.results[0];
          await fetchWeatherByCoords(latitude, longitude);
          setWeather((prev) => ({ ...prev, location: `${name} (Profile City)` }));
        }
      } catch (err) { console.error('Weather error:', err); }
    };

    const requestLocationWeather = () => {
      if (!navigator.geolocation) {
        setLocationPermission('unsupported');
        setWeatherPromptMessage('Aapke browser mein location support nahi hai.');
        return;
      }

      setWeatherLoading(true);
      setWeatherPromptMessage('');

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            await fetchWeatherByCoords(latitude, longitude);
            setLocationPermission('granted');
            setWeatherPromptMessage('');
          } catch (err) {
            console.error('Weather by location error:', err);
            await fetchWeatherByCity(user.city || 'Lucknow');
            setWeatherPromptMessage('Live location weather load nahi hua, profile city weather dikhaya gaya hai.');
          } finally {
            setWeatherLoading(false);
          }
        },
        async (error) => {
          console.log('Geo error:', error.code, error.message);
          let errorInfo = '';
          if (error.code === 1) {
            setLocationPermission('denied');
            setWeather(null);
            errorInfo = 'Permission denied. Browser site settings mein location enable karein.';
          } else if (error.code === 2) {
            await fetchWeatherByCity(user.city || 'Lucknow');
            errorInfo = 'Signal weak hai, profile city weather dikhaya gaya hai.';
          } else if (error.code === 3) {
            await fetchWeatherByCity(user.city || 'Lucknow');
            errorInfo = 'Location timeout. Profile city show kiya gaya.';
          } else {
            await fetchWeatherByCity(user.city || 'Lucknow');
            errorInfo = 'Signal weak hai, profile city weather dikhaya gaya hai.';
          }
          setWeatherPromptMessage(errorInfo);
          setWeatherLoading(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    };

    const loadWeather = async () => {
      if (!navigator.geolocation) {
        setLocationPermission('unsupported');
        await fetchWeatherByCity(user.city || 'Lucknow');
        return;
      }

      if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        setLocationPermission('unsupported');
        setWeatherPromptMessage('Location permission ke liye HTTPS zaroori hai. Production domain par secure HTTPS check karein.');
        await fetchWeatherByCity(user.city || 'Lucknow');
        return;
      }

      if (navigator.permissions?.query) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
          setLocationPermission(permissionStatus.state);

          if (permissionStatus.state === 'denied') {
            setWeatherPromptMessage('Blocked 🚫: Site settings se location allow karein.');
            return;
          }

          if (permissionStatus.state === 'granted') {
            requestLocationWeather();
          }

          permissionStatus.onchange = () => {
            const newState = permissionStatus.state;
            setLocationPermission(newState);
            if (newState === 'granted') {
              requestLocationWeather();
            } else if (newState === 'denied') {
              setWeatherPromptMessage('Permission blocked.');
            }
          };
          return;
        } catch (err) {
          console.error('Permission query failed:', err);
        }
      }

      requestLocationWeather();
    };

    if (user.role === 'FARMER') loadWeather();
  }, [user.city, user.role]);

  const handleEnableLocationWeather = () => {
    if (user.role !== 'FARMER') return;

    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setWeatherPromptMessage('HTTPS ke bina browser location prompt nahi dikhata. AWS deployment par SSL certificate ensure karein.');
      return;
    }

    setLocationPermission('prompt');
    setWeather(null);
    setWeatherLoading(true);

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

          setWeather({
            temp: weatherData.current_weather.temperature,
            windspeed: weatherData.current_weather.windspeed,
            code: weatherData.current_weather.weathercode,
            location: `${locationName} 📍`
          });
          setLocationPermission('granted');
          setWeatherPromptMessage('');
        } catch (err) {
          console.error('Enable location weather error:', err);
          setWeatherPromptMessage('Weather load nahi hua. Dobara try karein.');
        } finally {
          setWeatherLoading(false);
        }
      },
      (error) => {
        if (error.code === 1) {
          setLocationPermission('denied');
          setWeatherPromptMessage('Location abhi blocked hai. Browser site settings me jaake Location ko Allow karein, phir dobara Enable Location dabayein.');
        } else if (error.code === 3) {
          setWeatherPromptMessage('Location timeout ho gaya. Signal slow ho sakta hai, dobara try karein.');
        } else {
          setWeatherPromptMessage('Location fetch fail hua (Unavailable). GPS on karein aur dobara try karein.');
        }
        setWeatherLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    const loadMandi = async () => {
      setMandiLoading(true);
      try {
        const targetState = liveState || user.state;
        const mandiRes = await api.get('/api/market/mandi', {
          params: {
            state: targetState || undefined,
            commodity: cropFilter || undefined,
            limit: 5
          }
        });
        setMandiRates(mandiRes.data?.records || []);
      } catch (err) { console.error('Mandi API Error:', err); }
      setMandiLoading(false);
    };
    if (user.role === 'FARMER') loadMandi();
  }, [user.state, user.role, cropFilter, liveState]);

  const logout = () => { localStorage.clear(); navigate('/login'); };

  const fallbackCopyText = (text) => {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-9999px';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.focus();
    area.select();

    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (err) {
      copied = false;
    }

    document.body.removeChild(area);
    return copied;
  };

  const copyId = async (id) => {
    const text = String(id || '').trim();
    if (!text) return;

    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const copied = fallbackCopyText(text);
        if (!copied) {
          throw new Error('Clipboard fallback failed');
        }
      }

      showNotification('ID copy ho gayi! ✅', { type: 'sms', duration: 2500 });
    } catch (err) {
      showNotification(`Auto-copy fail hua. Manual copy ke liye ID: ${text}`, {
        title: 'Copy Failed',
        type: 'sms',
        duration: 7000
      });
    }
  };

  const showQR = async (produceId) => {
    try {
      setLoading(true);
      const res = await api.get(`/api/produce/${produceId}`);
      const produceData = res.data;
      
      const verifyUrl = `${window.location.origin}/verify/${produceId}`;
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 300, margin: 2 });
      
      setQrModal({ 
        qr: qrDataUrl, 
        url: verifyUrl, 
        details: produceData 
      });
    } catch (err) { 
      console.error(err);
      showNotification('QR journey load nahi hua. Network check karein.', { type: 'sms', tone: 'error' });
    } finally {
      setLoading(false);
    }
  };


  const roleLabel = user.role || 'USER';

  const normalizeDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const getPrice = (item) => {
    if (user.role === 'FARMER') return Number(item.farmPrice) || 0;
    return Number(item.receivedPrice ?? item.farmPrice) || 0;
  };

  const baseList = user.role === 'FARMER' ? myProduces : receivedProduces;
  const totalProduce = baseList.length;
  const totalSales = baseList.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * getPrice(item)), 0);

  const quickStats = [
    { label: t('dash_stat_total_produce'), value: totalProduce, tone: 'produce', icon: '🌾' },
    { label: t('dash_stat_pending_payments'), value: pendingCount, tone: 'payments', icon: '💰' },
    { label: t('dash_stat_unread'), value: unreadNotifs, tone: 'notifications', icon: '🔔' },
    { label: t('dash_stat_total_sales'), value: `₹${Math.round(totalSales).toLocaleString('en-IN')}`, tone: 'sales', icon: '📈' }
  ];

  const filteredList = baseList
    .filter((item) => {
      const searchValue = searchText.trim().toLowerCase();
      const searchableText = [item.cropType, item.origin, item.farmerName, item.qualityGrade, item.lotCode, item._id].filter(Boolean).join(' ').toLowerCase();
      if (searchValue && !searchableText.includes(searchValue)) return false;
      if (statusFilter !== 'ALL') {
        const statusValue = item.blockchainStatus === 'CONFIRMED' ? 'VERIFIED' : 'PENDING';
        if (statusValue !== statusFilter) return false;
      }
      const createdAtDate = normalizeDate(item.createdAt);
      const from = normalizeDate(dateFrom);
      const to = normalizeDate(dateTo);
      if (from && (!createdAtDate || createdAtDate < from)) return false;
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        if (!createdAtDate || createdAtDate > end) return false;
      }
      const price = getPrice(item);
      const min = minPrice === '' ? null : Number(minPrice);
      const max = maxPrice === '' ? null : Number(maxPrice);
      if (min !== null && !Number.isNaN(min) && price < min) return false;
      if (max !== null && !Number.isNaN(max) && price > max) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === 'priceHigh') return getPrice(b) - getPrice(a);
      if (sortBy === 'priceLow') return getPrice(a) - getPrice(b);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  const resetFilters = () => {
    setSearchText(''); setStatusFilter('ALL'); setDateFrom(''); setDateTo(''); setMinPrice(''); setMaxPrice(''); setSortBy('newest');
  };

  return (
    <div className="dashboard-page">
      {/* ── UNIFIED QR & TRACEABILITY MODAL ── */}
      {qrModal && (
        <div className="ft-modal-overlay" onClick={() => setQrModal(null)}>
          <div className="ft-modal dashboard-qr-trace-modal" onClick={e => e.stopPropagation()} style={{ width: 'min(700px, 95%)', maxHeight: '90vh', overflowY: 'auto' }}>
            <button
              type="button"
              className="dashboard-modal-close"
              onClick={() => setQrModal(null)}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', border: 'none', background: 'var(--ft-bg)', padding: '8px', borderRadius: '50%', cursor: 'pointer', zIndex: 5 }}
            >
              <X size={20} strokeWidth={2.5} />
            </button>

            <div className="modal-inner-grid">
              <div className="modal-qr-section">
                <div className="modal-header-mini">
                  <div className="dashboard-brand-icon" style={{ width: 32, height: 32, fontSize: '1rem' }}>🌱</div>
                  <h3 className="ft-modal-title">Product Passport</h3>
                </div>
                
                <div className="qr-container-premium">
                  <img src={qrModal.qr} alt="QR Code" className="modal-qr-img" />
                  <p className="modal-qr-sub">Scan to trace on blockchain</p>
                </div>

                <div className="produce-info-mini">
                  <h4 className="mini-crop-name">{getCropEmoji(qrModal.details.cropType)} {qrModal.details.cropType}</h4>
                  <div className="mini-details-row">
                    <span>📍 {qrModal.details.origin}</span>
                    <span>⚖️ {qrModal.details.quantity}kg</span>
                  </div>
                  <div className="mini-id-badge">ID: {qrModal.details._id.slice(-8).toUpperCase()}</div>
                </div>
              </div>

              <div className="modal-trace-section">
                <h4 className="trace-section-title">Timeline — Journey to You</h4>
                <div className="trace-timeline">
                  {/* Start Point */}
                  <div className="trace-step">
                    <div className="trace-marker green"></div>
                    <div className="trace-content">
                      <p className="trace-step-title">Farm Origin — {qrModal.details.farmerName}</p>
                      <p className="trace-step-sub">{qrModal.details.origin}</p>
                      <p className="trace-step-price">₹{qrModal.details.farmPrice}/kg</p>
                    </div>
                  </div>

                  {/* Transfer Points */}
                  {(qrModal.details.dbTransfers || []).map((t, i) => (
                    <div key={i} className="trace-step">
                      <div className="trace-marker blue"></div>
                      <div className="trace-content">
                        <p className="trace-step-title">{t.transferType.replace(/_/g, ' ')}</p>
                        <p className="trace-step-sub">{t.location}</p>
                        <p className="trace-step-price">₹{t.price}/kg</p>
                        {t.txHash && <a href={`https://sepolia.etherscan.io/tx/${t.txHash}`} target="_blank" rel="noreferrer" className="trace-proof-link">View Proof →</a>}
                      </div>
                    </div>
                  ))}
                  
                  {(!qrModal.details.dbTransfers || qrModal.details.dbTransfers.length === 0) && (
                    <p className="trace-empty-note">Awaiting shipment transfers...</p>
                  )}
                </div>
                
                {qrModal.details.isBlockchainVerified && (
                  <div className="modal-blockchain-verified">
                    <ShieldCheck size={16} /> Immutable Blockchain Verified 
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
              <button onClick={() => setQrModal(null)} className="ft-btn ft-btn-ghost ft-btn-full">
                Close
              </button>
              <button 
                onClick={() => {
                  window.open(qrModal.url, '_blank');
                }} 
                className="ft-btn ft-btn-primary ft-btn-full"
              >
                Full History Page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STICKY HEADER ── */}
      <header className="dashboard-header glass">
        <div className="dashboard-brand" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
          <div className="dashboard-brand-icon">🌱</div>
          <h1 className="dashboard-title">FarmTrace</h1>
          <span className="dashboard-role-badge">{roleLabel}</span>
        </div>

        <div className="header-search-global">
          <div className="global-search-box">
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Any Lot ID #001..." 
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = e.target.value.trim();
                  if (val) navigate(`/verify/${val}`);
                }
              }}
            />
            <kbd>Enter</kbd>
          </div>
        </div>

        <div className="dashboard-header-actions">
          <LanguageToggle />
          <button onClick={logout} className="btn-logout">
            <LogOut size={18} />
            <span className="logout-text">Logout</span>
          </button>
        </div>
      </header>

      <div className="dash-inner">
        {/* ── GREETING HERO ── */}
        <section className="dash-greeting ft-anim-slide-up">
          <div className="dash-greeting-emoji">🌿</div>
          <div className="dash-greeting-hello">NAMASTE 🙏</div>
          <h2 className="dash-greeting-name">{user.name}</h2>
          <p className="dash-greeting-sub">
            {user.role === 'FARMER' ? 'Your farm, verified on the blockchain. See your harvest details below.' : 'Track agricultural produce across the supply chain with immutable proof.'}
          </p>
          <div className="dash-greeting-chips">
            <span className="dash-chip">Role: {roleLabel}</span>
            {user.city && <span className="dash-chip">📍 {user.city}</span>}
            {user.state && <span className="dash-chip">🗺️ {user.state}</span>}
            <span className="dash-chip">📅 {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </div>
        </section>

        {/* ── QUICK ACTIONS ── */}
        <p className="dash-section-title">⚡ मुख्य कार्य</p>
        <div className="dashboard-actions-row">
          {user.role === 'FARMER' && (
            <button onClick={() => navigate('/register-produce')} className="action-card primary">
              <div className="action-card-icon-wrap">
                <Sprout className="action-card-icon" />
              </div>
              <span className="action-card-label">{t('dash_action_register')}</span>
            </button>
          )}
          {user.role !== 'CONSUMER' && (
            <button onClick={() => navigate('/transfer')} className="action-card">
              <div className="action-card-icon-wrap" style={{ background: '#f0f9ff' }}>
                <Truck className="action-card-icon" color="#0369a1" />
              </div>
              <span className="action-card-label">{t('dash_action_transfer')}</span>
            </button>
          )}
          {user.role !== 'FARMER' && (
            <button onClick={() => navigate('/payment')} className={`action-card ${pendingCount > 0 ? 'action-card-alert-pending' : ''}`}>
              <div className="action-card-icon-wrap" style={{ background: '#fffbeb' }}>
                <Coins className="action-card-icon" color="#d97706" />
              </div>
              <span className="action-card-label">
                {t('dash_action_pending')}
                {pendingCount > 0 && <span className="notif-badge notif-badge-pending">{pendingCount > 99 ? '99+' : pendingCount}</span>}
              </span>
            </button>
          )}
          <button onClick={() => navigate('/transactions')} className={`action-card ${unreadNotifs > 0 ? 'action-card-alert-history' : ''}`}>
            <div className="action-card-icon-wrap" style={{ background: '#f5f3ff' }}>
              <History className="action-card-icon" color="#4f46e5" />
            </div>
            <span className="action-card-label">
              {t('dash_action_history')}
              {unreadNotifs > 0 && <span className="notif-badge notif-badge-history">{unreadNotifs > 99 ? '99+' : unreadNotifs}</span>}
            </span>
          </button>
          <button onClick={() => navigate('/profile')} className="action-card">
            <div className="action-card-icon-wrap" style={{ background: '#f0fdfa' }}>
              <User className="action-card-icon" color="#0f766e" />
            </div>
            <span className="action-card-label">{t('dash_action_profile')}</span>
          </button>
          <button onClick={() => navigate('/lot-ops')} className="action-card">
            <div className="action-card-icon-wrap" style={{ background: '#f5f3ff' }}>
              <Layers className="action-card-icon" color="#7c3aed" />
            </div>
            <span className="action-card-label">Lot Management</span>
          </button>
          {user.role !== 'CONSUMER' && (
            <button onClick={() => navigate('/dispatch-logistics')} className="action-card">
              <div className="action-card-icon-wrap" style={{ background: '#eff6ff' }}>
                <PackageCheck className="action-card-icon" color="#1d4ed8" />
              </div>
              <span className="action-card-label">Dispatch</span>
            </button>
          )}
          <button onClick={() => navigate('/escrow')} className="action-card">
            <div className="action-card-icon-wrap" style={{ background: '#fff7ed' }}>
              <ShieldCheck className="action-card-icon" color="#ea580c" />
            </div>
            <span className="action-card-label">Milestone Pay</span>
          </button>
          {user.role === 'FARMER' && (
            <button onClick={() => navigate('/ai')} className="action-card ai-card">
              <div className="action-card-icon-wrap" style={{ background: '#f0fdf4' }}>
                <Bot className="action-card-icon" color="#16a34a" />
              </div>
              <span className="action-card-label">{t('dash_action_ai')}</span>
            </button>
          )}
        </div>

        {/* ── STATS ── */}
        {!loading && (
          <>
            <p className="dash-section-title">📊 आपका विवरण</p>
            <div className="dashboard-stats-grid">
              {quickStats.map((stat, idx) => (
                <div key={stat.label} className={`dashboard-stat-card stat-${stat.tone}`} style={{ animationDelay: `${idx * 0.1}s` }}>
                  <span className="stat-icon-wrap">{stat.icon}</span>
                  <p className="dashboard-stat-label">{stat.label}</p>
                  <p className="dashboard-stat-value">{stat.value}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── FARMER WIDGETS (Weather + Mandi) ── */}
        {!loading && user.role === 'FARMER' && (
          <>
            <p className="dash-section-title">🌤️ लाइव जानकारी</p>
            <div className="dashboard-widgets-grid ft-anim-slide-up">
              {/* Weather */}
              <div className="widget-card weather-widget">
                <h3 className="widget-header"><Thermometer size={18} /> आज का तापमान</h3>
                {weather ? (
                  <>
                    <div className="weather-main">
                      {weather.code > 50 ? <CloudRain size={44} /> : (weather.code > 1 ? <Cloud size={44} /> : <Sun size={44} />)}
                      <span className="weather-temp">{weather.temp}°C</span>
                    </div>
                    <div className="weather-details">
                      <p>📍 <strong>{weather.location}</strong></p>
                      <p>💨 Hawa: {weather.windspeed} km/h</p>
                    </div>
                    {weatherPromptMessage && <p className="weather-inline-note">{weatherPromptMessage}</p>}
                  </>
                ) : weatherLoading ? (
                  <p style={{ opacity: 0.7, fontWeight: 600 }} className="ft-loading-pulse">Mausam aa raha hai...</p>
                ) : locationPermission === 'denied' || locationPermission === 'prompt' || locationPermission === 'checking' ? (
                  <div className="weather-permission-box">
                    <p className="weather-permission-title">Location enable karo tab live weather dikh sakta hai.</p>
                    <p className="weather-permission-sub">Tap karke permission allow karein. Agar pehle deny kiya hai to browser site settings me Location ko Allow karna hoga.</p>
                    <button type="button" className="weather-enable-btn" onClick={handleEnableLocationWeather}>
                      Enable Location
                    </button>
                    {weatherPromptMessage && <p className="weather-inline-note">{weatherPromptMessage}</p>}
                  </div>
                ) : (
                  <div className="weather-permission-box">
                    <p className="weather-permission-title">Live location weather available nahi hai.</p>
                    <button type="button" className="weather-enable-btn" onClick={handleEnableLocationWeather}>
                      Retry Location Weather
                    </button>
                    {weatherPromptMessage && <p className="weather-inline-note">{weatherPromptMessage}</p>}
                  </div>
                )}
              </div>

              {/* Mandi */}
              <div className="widget-card msp-widget" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                  <h3 className="widget-header" style={{ margin: 0 }}><Info size={18} /> मंडी दर</h3>
                  <select
                    value={cropFilter}
                    onChange={(e) => setCropFilter(e.target.value)}
                    style={{ padding: '0.35rem 0.5rem', borderRadius: '8px', border: '1.5px solid #fcd34d', background: 'rgba(255,255,255,0.85)', color: '#78350f', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', outline: 'none' }}
                  >
                    <option value="">Sabhi Fasalein</option>
                    <option value="Wheat">🌾 Gehu (Wheat)</option>
                    <option value="Paddy(Dhaan)(Common)">🌾 Dhaan (Paddy)</option>
                    <option value="Tomato">🍅 Tamatar</option>
                    <option value="Potato">🥔 Aloo</option>
                    <option value="Onion">🧅 Pyaaz</option>
                    <option value="Apple">🍎 Seb</option>
                    <option value="Cotton">🪴 Kapas</option>
                    <option value="Soyabean">🫛 Soyabean</option>
                    <option value="Mustard">🌻 Sarson</option>
                    <option value="Bhindi(Ladies Finger)">🥬 Bhindi</option>
                  </select>
                </div>
                {mandiLoading ? (
                  <p style={{ opacity: 0.7, fontWeight: 600, textAlign: 'center' }} className="ft-loading-pulse">Rate aa rahe hain...</p>
                ) : mandiRates.length > 0 ? (
                  <div className="msp-list">
                    {mandiRates.map((record, i) => (
                      <div key={i} className="msp-item">
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                          <span className="msp-crop">{record.commodity}</span>
                          <span className="msp-price">₹{(record.modal_price / 100).toFixed(2)}/kg</span>
                        </div>
                        <span style={{ fontSize: '0.76rem', color: '#92400e', marginTop: '0.2rem', display: 'block' }}>
                          {record.market}, {record.state}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ opacity: 0.7, fontWeight: 600, textAlign: 'center' }}>Is fasal ka rate abhi nahi mila</p>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── SEARCH & FILTER SECTION ── */}
        {!loading && (
          <div className="dashboard-filter-card ft-anim-slide-up">
            <div className="dashboard-filter-top">
              <div className="search-container">
                <Search className="search-icon" size={20} />
                <input 
                  className="dashboard-filter-input main-search" 
                  placeholder={t('dash_filter_search_placeholder') || "Search crop, location, grade..."} 
                  value={searchText} 
                  onChange={(e) => setSearchText(e.target.value)} 
                />
              </div>
              
              <button 
                className="filter-toggle-btn"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
              >
                <SlidersHorizontal size={18} />
                {isFilterOpen ? 'Hide Filters' : 'Advanced Filters'}
                {isFilterOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {(searchText || statusFilter !== 'ALL' || dateFrom || dateTo || minPrice || maxPrice) && (
                <button type="button" className="dashboard-clear-btn" onClick={resetFilters}>
                  ✕ Reset
                </button>
              )}
            </div>

            {isFilterOpen && (
              <div className="advanced-filters-section ft-anim-slide-up">
                {/* Status Filter */}
                <div className="input-group">
                  <label className="input-label">Produce Status</label>
                  <div className="input-with-icon">
                    <Filter className="input-field-icon" size={16} />
                    <select className="dashboard-filter-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                      <option value="ALL">Sabhi Status (All)</option>
                      <option value="VERIFIED">Verified Only</option>
                      <option value="PENDING">Pending Only</option>
                    </select>
                  </div>
                </div>

                {/* Sort By */}
                <div className="input-group">
                  <label className="input-label">Sort Order</label>
                  <div className="input-with-icon">
                    <ArrowUpDown className="input-field-icon" size={16} />
                    <select className="dashboard-filter-input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                      {SORT_OPTIONS.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                    </select>
                  </div>
                </div>

                {/* Date From */}
                <div className="input-group">
                  <label className="input-label">Date From</label>
                  <div className="input-with-icon">
                    <Calendar className="input-field-icon" size={16} />
                    <input type="date" className="dashboard-filter-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  </div>
                </div>

                {/* Date To */}
                <div className="input-group">
                  <label className="input-label">Date To</label>
                  <div className="input-with-icon">
                    <Calendar className="input-field-icon" size={16} />
                    <input type="date" className="dashboard-filter-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                  </div>
                </div>

                {/* Price Min */}
                <div className="input-group">
                  <label className="input-label">Min Price</label>
                  <div className="input-with-icon">
                    <IndianRupee className="input-field-icon" size={16} />
                    <input type="number" className="dashboard-filter-input" placeholder="0" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
                  </div>
                </div>

                {/* Price Max */}
                <div className="input-group">
                  <label className="input-label">Max Price</label>
                  <div className="input-with-icon">
                    <IndianRupee className="input-field-icon" size={16} />
                    <input type="number" className="dashboard-filter-input" placeholder="No limit" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PRODUCE LIST ── */}
        {loading ? (
          <p className="dashboard-loading ft-loading-pulse">🌱 लोड हो रहा है...</p>
        ) : (
          <>
            <p className="dash-section-title">
              {user.role === 'FARMER' ? '🌾 मेरी फसल' : '📦 प्राप्त उत्पाद'}
            </p>
            <div className="dashboard-grid">
              {/* FARMER — empty */}
              {user.role === 'FARMER' && myProduces.length === 0 && (
                <div className="dashboard-empty ft-anim-slide-up">
                  <div className="dashboard-empty-icon">🌱</div>
                  <h3>No Produce Registered</h3>
                  <p className="dashboard-empty-sub">Your harvest is the heart of the supply chain. Start by registering your first batch.</p>
                  <button onClick={() => navigate('/register-produce')} className="dashboard-empty-cta dashboard-empty-cta-farmer">
                    <Sprout size={20} /> Register Your Harvest
                  </button>
                </div>
              )}
              {user.role === 'FARMER' && myProduces.length > 0 && filteredList.length === 0 && (
                <div className="dashboard-empty">
                  <h3>🔍 No matches found</h3>
                  <p>Try adjusting your search or filters.</p>
                </div>
              )}

              {/* FARMER — cards */}
              {user.role === 'FARMER' && filteredList.map((p, idx) => (
                <div key={p._id} className="produce-card" style={{ animationDelay: `${idx * 0.08}s` }}>
                  <div className="produce-header-area">
                    <div className="produce-meta-row">
                      <div className="mini-id-badge">LOTID: {p._id.slice(-6).toUpperCase()}</div>
                      <span className={`ft-badge ${p.blockchainStatus === 'CONFIRMED' ? 'ft-badge-success' : 'ft-badge-pending'}`}>
                        {p.blockchainStatus === 'CONFIRMED' ? '✓ VERIFIED' : '⏳ PENDING'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.25rem' }}>
                      <div style={{ fontSize: '2.5rem' }}>{getCropEmoji(p.cropType)}</div>
                      <h3 className="produce-name">{p.cropType}</h3>
                    </div>
                  </div>
                  
                  <div className="produce-details">
                    <div className="produce-detail">
                      <span className="detail-label">Origin</span>
                      <span className="detail-val">{p.origin}</span>
                    </div>
                    <div className="produce-detail">
                      <span className="detail-label">Quantity</span>
                      <span className="detail-val">{p.quantity} KG</span>
                    </div>
                    <div className="produce-detail">
                      <span className="detail-label">Quality</span>
                      <span className="detail-val">Grade {p.qualityGrade}</span>
                    </div>
                    <div className="produce-detail">
                      <span className="detail-label">Price/KG</span>
                      <span className="detail-val">₹{p.farmPrice}</span>
                    </div>
                  </div>

                  <div className="produce-footer-area">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <button onClick={() => showQR(p._id)} className="ft-btn ft-btn-primary ft-btn-sm" style={{ padding: '0.6rem' }}>
                        <QrCode size={18} /> QR Trace
                      </button>
                      <button onClick={() => copyId(p._id)} className="ft-btn ft-btn-ghost ft-btn-sm" style={{ padding: '0.6rem' }}>
                        <Copy size={16} /> Copy ID
                      </button>
                    </div>
                    <button onClick={() => navigate(`/verify/${p._id}`)} className="ft-btn ft-btn-ghost ft-btn-full" style={{ padding: '0.6rem' }}>
                      <Eye size={18} /> Full History
                    </button>
                  </div>
                </div>
              ))}

              {/* DISTRIBUTOR/RETAILER — empty */}
              {user.role !== 'FARMER' && receivedProduces.length === 0 && (
                <div className="dashboard-empty">
                  <div className="dashboard-empty-icon">📦</div>
                  <p>{t('dash_empty_received')}</p>
                  <p className="dashboard-empty-sub">{t('dash_empty_received_sub')}</p>
                  {user.role !== 'CONSUMER' && (
                    <button onClick={() => navigate('/transfer')} className="ft-btn ft-btn-primary">
                      <Truck size={18} /> {t('dash_empty_transfer_cta')}
                    </button>
                  )}
                </div>
              )}
              {user.role !== 'FARMER' && receivedProduces.length > 0 && filteredList.length === 0 && (
                <div className="dashboard-empty"><p>🔍 {t('dash_empty_filter')}</p></div>
              )}

              {/* DISTRIBUTOR/RETAILER — cards */}
              {user.role !== 'FARMER' && filteredList.map((p, idx) => (
                <div key={p._id} className="produce-card" style={{ animationDelay: `${idx * 0.08}s` }}>
                  <div className="produce-header-area">
                    <div className="produce-meta-row">
                      <div className="mini-id-badge">LOTID: {p._id.slice(-6).toUpperCase()}</div>
                      <span className="ft-badge ft-badge-success">📦 RECEIVED</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.25rem' }}>
                      <div style={{ fontSize: '2.5rem' }}>{getCropEmoji(p.cropType)}</div>
                      <h3 className="produce-name">{p.cropType}</h3>
                    </div>
                  </div>

                  <div className="produce-details">
                    <div className="produce-detail">
                      <span className="detail-label">Farmer</span>
                      <span className="detail-val">{p.farmerName}</span>
                    </div>
                    <div className="produce-detail">
                      <span className="detail-label">Quantity</span>
                      <span className="detail-val">{p.quantity} KG</span>
                    </div>
                    <div className="produce-detail">
                      <span className="detail-label">Origin</span>
                      <span className="detail-val">{p.origin}</span>
                    </div>
                    <div className="produce-detail">
                      <span className="detail-label">Price/KG</span>
                      <span className="detail-val">₹{p.receivedPrice || p.farmPrice}</span>
                    </div>
                  </div>

                  <div className="produce-footer-area">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <button onClick={() => showQR(p._id)} className="ft-btn ft-btn-primary ft-btn-sm" style={{ padding: '0.6rem' }}>
                        <QrCode size={18} /> QR Trace
                      </button>
                      <button onClick={() => copyId(p._id)} className="ft-btn ft-btn-ghost ft-btn-sm" style={{ padding: '0.6rem' }}>
                        <Copy size={16} /> Copy ID
                      </button>
                    </div>
                    <button onClick={() => navigate(`/verify/${p._id}`)} className="ft-btn ft-btn-ghost ft-btn-full" style={{ padding: '0.6rem' }}>
                      <Eye size={18} /> Full History
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
