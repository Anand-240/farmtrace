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
  QrCode, Copy, Link, Eye
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

  useEffect(() => {
    const fetchWeatherByCity = async (city) => {
      try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1&language=en&format=json`);
        const geoData = await geoRes.json();
        if (geoData.results && geoData.results.length > 0) {
          const { latitude, longitude, name } = geoData.results[0];
          const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
          const weatherData = await weatherRes.json();
          setWeather({ temp: weatherData.current_weather.temperature, windspeed: weatherData.current_weather.windspeed, code: weatherData.current_weather.weathercode, location: name });
        }
      } catch (err) { console.error('Weather error:', err); }
    };

    const loadWeather = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const { latitude, longitude } = position.coords;
              const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
              const weatherData = await weatherRes.json();
              let locationName = 'GPS Location';
              try {
                const titleRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
                const titleData = await titleRes.json();
                locationName = titleData.city || titleData.locality || 'Live Location';
                if (titleData.principalSubdivision) setLiveState(titleData.principalSubdivision);
              } catch (e) {}
              setWeather({ temp: weatherData.current_weather.temperature, windspeed: weatherData.current_weather.windspeed, code: weatherData.current_weather.weathercode, location: `${locationName} 📍` });
            } catch (err) { fetchWeatherByCity(user.city || 'Lucknow'); }
          },
          () => fetchWeatherByCity(user.city || 'Lucknow')
        );
      } else { fetchWeatherByCity(user.city || 'Lucknow'); }
    };

    if (user.role === 'FARMER') loadWeather();
  }, [user.city, user.role]);

  useEffect(() => {
    const loadMandi = async () => {
      setMandiLoading(true);
      try {
        const apiKey = process.env.REACT_APP_DATA_GOV_API_KEY;
        const targetState = liveState || user.state;
        const stateQuery = targetState ? `&filters[state]=${encodeURIComponent(targetState)}` : '';
        const cropQuery = cropFilter ? `&filters[commodity]=${encodeURIComponent(cropFilter)}` : '';
        let mandiRes = await fetch(`https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=${apiKey}&format=json&limit=5${stateQuery}${cropQuery}`);
        let mandiData = await mandiRes.json();
        if (!mandiData.records || mandiData.records.length === 0) {
          mandiRes = await fetch(`https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=${apiKey}&format=json&limit=5${cropQuery}`);
          mandiData = await mandiRes.json();
        }
        setMandiRates(mandiData.records || []);
      } catch (err) { console.error('Mandi API Error:', err); }
      setMandiLoading(false);
    };
    if (user.role === 'FARMER') loadMandi();
  }, [user.state, user.role, cropFilter, liveState]);

  const logout = () => { localStorage.clear(); navigate('/login'); };

  const copyId = (id) => {
    navigator.clipboard.writeText(id);
    showNotification('ID copy ho gayi! ✅', { type: 'sms', duration: 2500 });
  };

  const showQR = async (produceId) => {
    try {
      const verifyUrl = `${window.location.origin}/verify/${produceId}`;
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 300, margin: 2 });
      setQrModal({ qr: qrDataUrl, url: verifyUrl });
    } catch (err) { alert('QR load nahi hua'); }
  };

  const roleColor = { FARMER: '#1a4a0f', DISTRIBUTOR: '#0c4a6e', RETAILER: '#78350f' };
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
      const searchableText = [item.cropType, item.origin, item.farmerName, item.qualityGrade].filter(Boolean).join(' ').toLowerCase();
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
      {/* ── QR MODAL ── */}
      {qrModal && (
        <div className="dashboard-modal-overlay" onClick={() => setQrModal(null)}>
          <div className="dashboard-modal-card" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📱</div>
            <h3 className="dashboard-modal-title">{t('dash_qr_title')}</h3>
            <p className="dashboard-modal-sub">{t('dash_qr_sub')}</p>
            <img src={qrModal.qr} alt="QR Code" className="dashboard-modal-qr" />
            <p className="dashboard-modal-url">{qrModal.url}</p>
            <button onClick={() => setQrModal(null)} className="btn btn-full btn-action-primary" style={{ borderRadius: '12px', padding: '0.75rem' }}>
              ✕ Band Karo
            </button>
          </div>
        </div>
      )}

      {/* ── STICKY HEADER ── */}
      <div className="dashboard-header">
        <div className="dashboard-brand">
          <div className="dashboard-brand-icon">🌾</div>
          <div>
            <h1 className="dashboard-title">FarmTrace</h1>
            <p className="dashboard-welcome">
              {user.name}
              <span className="dashboard-role-badge" style={{ background: roleColor[user.role] || '#1a4a0f' }}>
                {roleLabel}
              </span>
            </p>
          </div>
        </div>
        <div className="dashboard-header-actions">
          <LanguageToggle />
          <button onClick={logout} className="btn-logout" title={t('dash_logout')}>
            <LogOut size={16} />
            <span className="logout-text">{t('dash_logout')}</span>
          </button>
        </div>
      </div>

      <div className="dash-inner">
        {/* ── GREETING BANNER ── */}
        <div className="dash-greeting ft-anim-slide-up">
          <div className="dash-greeting-emoji">🌾</div>
          <div className="dash-greeting-hello">स्वागत है 🙏</div>
          <div className="dash-greeting-name">{user.name}</div>
          <div className="dash-greeting-sub">
            {user.role === 'FARMER' ? 'आपकी फसल की पूरी जानकारी यहाँ देखें' : 'प्राप्त उत्पाद की जानकारी'}
          </div>
          <div className="dash-greeting-chips">
            <span className="dash-chip">🌿 {roleLabel}</span>
            {user.city && <span className="dash-chip">📍 {user.city}</span>}
            {user.state && <span className="dash-chip">🗺️ {user.state}</span>}
            <span className="dash-chip">📅 {new Date().toLocaleDateString('hi-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </div>
        </div>

        {/* ── QUICK ACTIONS ── */}
        <p className="dash-section-title">⚡ मुख्य कार्य</p>
        <div className="dashboard-actions-row">
          {user.role === 'FARMER' && (
            <button onClick={() => navigate('/register-produce')} className="action-card primary">
              <Sprout className="action-card-icon" />
              <span className="action-card-label">{t('dash_action_register')}</span>
            </button>
          )}
          {user.role !== 'CONSUMER' && (
            <button onClick={() => navigate('/transfer')} className="action-card">
              <Truck className="action-card-icon" color="#0369a1" />
              <span className="action-card-label">{t('dash_action_transfer')}</span>
            </button>
          )}
          {user.role !== 'FARMER' && (
            <button onClick={() => navigate('/payment')} className="action-card">
              <Coins className="action-card-icon" color="#d97706" />
              <span className="action-card-label">
                {t('dash_action_pending')}
                {pendingCount > 0 && <span className="notif-badge">{pendingCount}</span>}
              </span>
            </button>
          )}
          <button onClick={() => navigate('/transactions')} className="action-card">
            <History className="action-card-icon" color="#4f46e5" />
            <span className="action-card-label">
              {t('dash_action_history')}
              {unreadNotifs > 0 && <span className="notif-badge">{unreadNotifs}</span>}
            </span>
          </button>
          <button onClick={() => navigate('/profile')} className="action-card">
            <User className="action-card-icon" color="#0f766e" />
            <span className="action-card-label">{t('dash_action_profile')}</span>
          </button>
          <button onClick={() => navigate('/lot-ops')} className="action-card">
            <Layers className="action-card-icon" color="#7c3aed" />
            <span className="action-card-label">Lot Split / Merge</span>
          </button>
          {user.role !== 'CONSUMER' && (
            <button onClick={() => navigate('/dispatch-logistics')} className="action-card">
              <PackageCheck className="action-card-icon" color="#1d4ed8" />
              <span className="action-card-label">Dispatch</span>
            </button>
          )}
          <button onClick={() => navigate('/escrow')} className="action-card">
            <ShieldCheck className="action-card-icon" color="#ea580c" />
            <span className="action-card-label">Milestone Pay</span>
          </button>
          {user.role === 'FARMER' && (
            <button onClick={() => navigate('/ai')} className="action-card ai-card">
              <Bot className="action-card-icon" color="#16a34a" />
              <span className="action-card-label">{t('dash_action_ai')}</span>
            </button>
          )}
        </div>

        {/* ── STATS ── */}
        {!loading && (
          <>
            <p className="dash-section-title">📊 आपका विवरण</p>
            <div className="dashboard-stats-grid">
              {quickStats.map((stat) => (
                <div key={stat.label} className={`dashboard-stat-card stat-${stat.tone}`}>
                  <div className="stat-icon-wrap">{stat.icon}</div>
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
                  </>
                ) : (
                  <p style={{ opacity: 0.7, fontWeight: 600 }} className="ft-loading-pulse">Mausam aa raha hai...</p>
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

        {/* ── FILTER SECTION ── */}
        {!loading && (
          <div className="dashboard-filter-card">
            <div className="dashboard-filter-top">
              <p className="dashboard-filter-title">🔍 फ़िल्टर करें</p>
              <button type="button" className="dashboard-clear-btn" onClick={resetFilters}>
                ✕ Clear
              </button>
            </div>
            <div className="dashboard-filter-grid">
              <input className="dashboard-filter-input" placeholder={t('dash_filter_search_placeholder')} value={searchText} onChange={(e) => setSearchText(e.target.value)} />
              <select className="dashboard-filter-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="ALL">{t('dash_filter_all_status')}</option>
                <option value="VERIFIED">{t('dash_filter_verified')}</option>
                <option value="PENDING">{t('dash_filter_pending')}</option>
              </select>
              <select className="dashboard-filter-input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                {SORT_OPTIONS.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
              </select>
              <input type="date" className="dashboard-filter-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <input type="date" className="dashboard-filter-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              <input type="number" className="dashboard-filter-input" placeholder={t('dash_filter_min_price')} value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
              <input type="number" className="dashboard-filter-input" placeholder={t('dash_filter_max_price')} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
            </div>
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
                <div className="dashboard-empty">
                  <div className="dashboard-empty-icon">🌱</div>
                  <p>{t('dash_empty_farmer')}</p>
                  <p className="dashboard-empty-sub">{t('dash_empty_farmer_sub')}</p>
                  <button onClick={() => navigate('/register-produce')} className="dashboard-empty-cta dashboard-empty-cta-farmer">
                    <Sprout size={18} /> {t('dash_empty_register_cta')}
                  </button>
                </div>
              )}
              {user.role === 'FARMER' && myProduces.length > 0 && filteredList.length === 0 && (
                <div className="dashboard-empty"><p>🔍 {t('dash_empty_filter')}</p></div>
              )}

              {/* FARMER — cards */}
              {user.role === 'FARMER' && filteredList.map((p, idx) => (
                <div key={p._id} className="produce-card" style={{ animationDelay: `${idx * 0.05}s` }}>
                  <div className="produce-card-header">
                    <h3 className="produce-name">
                      <span className="produce-emoji">{getCropEmoji(p.cropType)}</span>
                      {p.cropType}
                    </h3>
                    <span className={`status-badge ${p.blockchainStatus === 'CONFIRMED' ? 'status-ok' : 'status-pending'}`}>
                      {p.blockchainStatus === 'CONFIRMED' ? '✓ Verified' : '⏳ Pending'}
                    </span>
                  </div>
                  <div className="produce-details">
                    <div className="produce-detail">
                      <span className="detail-label">Mool (Origin)</span>
                      <span className="detail-val">📍 {p.origin}</span>
                    </div>
                    <div className="produce-detail">
                      <span className="detail-label">Maatra (Qty)</span>
                      <span className="detail-val">⚖️ {p.quantity} kg</span>
                    </div>
                    <div className="produce-detail">
                      <span className="detail-label">Grade</span>
                      <span className="detail-val">🏅 {p.qualityGrade}</span>
                    </div>
                    <div className="produce-detail">
                      <span className="detail-label">Tarikh</span>
                      <span className="detail-val">📅 {new Date(p.createdAt).toLocaleDateString('hi-IN')}</span>
                    </div>
                  </div>
                  <p className="produce-price">₹{p.farmPrice}/kg</p>
                  <div className="produce-actions">
                    <button onClick={() => showQR(p._id)} className="btn btn-full btn-action-primary">
                      <QrCode size={15} /> QR Code Dekho / Print Karo
                    </button>
                    <button onClick={() => copyId(p._id)} className="btn btn-full btn-action-secondary">
                      <Copy size={15} /> ID Copy Karo
                    </button>
                    {p.txHash && (
                      <a href={`https://sepolia.etherscan.io/tx/${p.txHash}`} target="_blank" rel="noreferrer" className="chain-link btn-full">
                        <Link size={13} /> Blockchain pe Dekho →
                      </a>
                    )}
                    <button onClick={() => navigate(`/verify/${p._id}`)} className="btn btn-full btn-verify">
                      <Eye size={15} /> Poori Journey Dekho
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
                    <button onClick={() => navigate('/transfer')} className="dashboard-empty-cta dashboard-empty-cta-transfer">
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
                <div key={p._id} className="produce-card" style={{ animationDelay: `${idx * 0.05}s` }}>
                  <div className="produce-card-header">
                    <h3 className="produce-name">
                      <span className="produce-emoji">{getCropEmoji(p.cropType)}</span>
                      {p.cropType}
                    </h3>
                    <span className="status-badge status-received">📦 Received</span>
                  </div>
                  <div className="produce-details">
                    <div className="produce-detail">
                      <span className="detail-label">Kisan</span>
                      <span className="detail-val">👨‍🌾 {p.farmerName}</span>
                    </div>
                    <div className="produce-detail">
                      <span className="detail-label">Mool</span>
                      <span className="detail-val">📍 {p.origin}</span>
                    </div>
                    <div className="produce-detail">
                      <span className="detail-label">Maatra</span>
                      <span className="detail-val">⚖️ {p.quantity} kg</span>
                    </div>
                    <div className="produce-detail">
                      <span className="detail-label">Grade</span>
                      <span className="detail-val">🏅 {p.qualityGrade}</span>
                    </div>
                  </div>
                  <div className="price-row">
                    <div>
                      <p className="price-label">Farm Price</p>
                      <p className="farm-price">₹{p.farmPrice}/kg</p>
                    </div>
                    <div className="price-right">
                      <p className="price-label">Tumne diya</p>
                      <p className="received-price">₹{p.receivedPrice}/kg</p>
                    </div>
                  </div>
                  <div className="produce-actions">
                    <button onClick={() => showQR(p._id)} className="btn btn-full btn-action-primary">
                      <QrCode size={15} /> QR Code Dekho / Print Karo
                    </button>
                    <button onClick={() => copyId(p._id)} className="btn btn-full btn-action-secondary">
                      <Copy size={15} /> ID Copy Karo
                    </button>
                    <button onClick={() => navigate(`/verify/${p._id}`)} className="btn btn-full btn-verify">
                      <Eye size={15} /> Poori Journey Dekho
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
