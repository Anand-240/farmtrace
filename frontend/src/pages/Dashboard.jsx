import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import api from '../lib/api';
import LanguageToggle from '../components/LanguageToggle';
import { useLanguage } from '../lib/language';
import { useNotification } from '../context/NotificationContext';
import { Sprout, Truck, Coins, History, User, Layers, PackageCheck, ShieldCheck, Bot, LogOut, Sun, Cloud, CloudRain, Thermometer, Info } from 'lucide-react';
import './Dashboard.css';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'priceHigh', label: 'Highest Price' },
  { value: 'priceLow', label: 'Lowest Price' }
];

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
            showNotification(`Hello ${user.name}, aapke paas ${unreads.length} naye updates hain! Kripya apne History page pe check karein.`, {
              title: 'FarmTrace SMS',
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
  }, [user.role]);

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
          setWeather({
            temp: weatherData.current_weather.temperature,
            windspeed: weatherData.current_weather.windspeed,
            code: weatherData.current_weather.weathercode,
            location: name
          });
        }
      } catch (err) {
        console.error('Weather error fallback:', err);
      }
    };

    const loadWeather = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const { latitude, longitude } = position.coords;
              const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
              const weatherData = await weatherRes.json();
              
              let locationName = "GPS Location";
              try {
                const titleRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
                const titleData = await titleRes.json();
                locationName = titleData.city || titleData.locality || "Live GPS Location";
                if (titleData.principalSubdivision) {
                  setLiveState(titleData.principalSubdivision);
                }
              } catch (e) {
                console.error("Reverse geo error", e);
              }

              setWeather({
                temp: weatherData.current_weather.temperature,
                windspeed: weatherData.current_weather.windspeed,
                code: weatherData.current_weather.weathercode,
                location: `${locationName} 🎯`
              });
            } catch (err) {
              console.error('Live Weather error:', err);
              fetchWeatherByCity(user.city || 'Lucknow');
            }
          },
          (error) => {
            console.warn('GPS denied or failed, using profile city');
            fetchWeatherByCity(user.city || 'Lucknow');
          }
        );
      } else {
        fetchWeatherByCity(user.city || 'Lucknow');
      }
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
          // Fallback globally without state filter
          mandiRes = await fetch(`https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=${apiKey}&format=json&limit=5${cropQuery}`);
          mandiData = await mandiRes.json();
        }
        
        if (mandiData.records) {
          setMandiRates(mandiData.records);
        } else {
          setMandiRates([]);
        }
      } catch (err) {
        console.error("Mandi API Error:", err);
      }
      setMandiLoading(false);
    };
    if (user.role === 'FARMER') loadMandi();
  }, [user.state, user.role, cropFilter, liveState]);

  const logout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const copyId = (id) => {
    navigator.clipboard.writeText(id);
    alert('ID copy ho gayi!');
  };

  const showQR = async (produceId) => {
    try {
      const verifyUrl = `${window.location.origin}/verify/${produceId}`;
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 300 });
      setQrModal({ qr: qrDataUrl, url: verifyUrl });
    } catch (err) {
      alert('QR load nahi hua');
    }
  };

  const roleColor = { FARMER: '#27500A', DISTRIBUTOR: '#085041', RETAILER: '#854F0B' };

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
  const totalSales = baseList.reduce((sum, item) => {
    const quantity = Number(item.quantity) || 0;
    const price = getPrice(item);
    return sum + (quantity * price);
  }, 0);

  const quickStats = [
    {
      label: t('dash_stat_total_produce'),
      value: totalProduce,
      tone: 'produce'
    },
    {
      label: t('dash_stat_pending_payments'),
      value: pendingCount,
      tone: 'payments'
    },
    {
      label: t('dash_stat_unread'),
      value: unreadNotifs,
      tone: 'notifications'
    },
    {
      label: t('dash_stat_total_sales'),
      value: `Rs ${Math.round(totalSales).toLocaleString('en-IN')}`,
      tone: 'sales'
    }
  ];

  const filteredList = baseList
    .filter((item) => {
      const searchValue = searchText.trim().toLowerCase();
      const searchableText = [item.cropType, item.origin, item.farmerName, item.qualityGrade]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (searchValue && !searchableText.includes(searchValue)) {
        return false;
      }

      if (statusFilter !== 'ALL') {
        const statusValue = item.blockchainStatus === 'CONFIRMED' ? 'VERIFIED' : 'PENDING';
        if (statusValue !== statusFilter) return false;
      }

      const createdAtDate = normalizeDate(item.createdAt);
      const from = normalizeDate(dateFrom);
      const to = normalizeDate(dateTo);

      if (from && (!createdAtDate || createdAtDate < from)) {
        return false;
      }

      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        if (!createdAtDate || createdAtDate > end) {
          return false;
        }
      }

      const price = getPrice(item);
      const min = minPrice === '' ? null : Number(minPrice);
      const max = maxPrice === '' ? null : Number(maxPrice);

      if (min !== null && !Number.isNaN(min) && price < min) {
        return false;
      }

      if (max !== null && !Number.isNaN(max) && price > max) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'oldest') {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }

      if (sortBy === 'priceHigh') {
        return getPrice(b) - getPrice(a);
      }

      if (sortBy === 'priceLow') {
        return getPrice(a) - getPrice(b);
      }

      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  const resetFilters = () => {
    setSearchText('');
    setStatusFilter('ALL');
    setDateFrom('');
    setDateTo('');
    setMinPrice('');
    setMaxPrice('');
    setSortBy('newest');
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-bg-orb dashboard-bg-orb-a" />
      <div className="dashboard-bg-orb dashboard-bg-orb-b" />

      {qrModal && (
        <div className="dashboard-modal-overlay" onClick={() => setQrModal(null)}>
          <div className="dashboard-modal-card" onClick={e => e.stopPropagation()}>
            <h3 className="dashboard-modal-title">{t('dash_qr_title')}</h3>
            <p className="dashboard-modal-sub">{t('dash_qr_sub')}</p>
            <img src={qrModal.qr} alt="QR Code"
              className="dashboard-modal-qr" />
            <p className="dashboard-modal-url">{qrModal.url}</p>
            <button onClick={() => setQrModal(null)} className="btn btn-solid btn-full">
              {t('dash_close')}
            </button>
          </div>
        </div>
      )}

      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">{t('dash_title')}</h1>
          <p className="dashboard-welcome">
            {t('dash_welcome')}, {user.name}
            <span className="dashboard-role-badge" style={{ background: roleColor[user.role] || '#27500A' }}>
              {roleLabel}
            </span>
          </p>
        </div>
        <div className="dashboard-header-actions">
          <LanguageToggle />
          <button onClick={logout} className="btn-logout" title={t('dash_logout')}>
            <LogOut size={20} />
            <span className="logout-text">{t('dash_logout')}</span>
          </button>
        </div>
      </div>

      <div className="dashboard-actions-row">
        {user.role === 'FARMER' && (
          <button onClick={() => navigate('/register-produce')} className="action-card primary">
            <Sprout className="action-card-icon" />
            <span className="action-card-label">{t('dash_action_register')}</span>
          </button>
        )}
        {user.role !== 'CONSUMER' && (
          <button onClick={() => navigate('/transfer')} className="action-card">
            <Truck className="action-card-icon" color="#0a5a79" />
            <span className="action-card-label">{t('dash_action_transfer')}</span>
          </button>
        )}
        {user.role !== 'FARMER' && (
          <button onClick={() => navigate('/payment')} className="action-card">
            <Coins className="action-card-icon" color="#914f18" />
            <span className="action-card-label">
              {t('dash_action_pending')} {pendingCount > 0 && `(${pendingCount})`}
            </span>
          </button>
        )}
        <button onClick={() => navigate('/transactions')} className="action-card">
          <History className="action-card-icon" color="#203f8f" />
          <span className="action-card-label">
            {t('dash_action_history')}
            {unreadNotifs > 0 && <span className="notif-badge">{unreadNotifs}</span>}
          </span>
        </button>
        <button onClick={() => navigate('/profile')} className="action-card">
          <User className="action-card-icon" color="#425c4a" />
          <span className="action-card-label">{t('dash_action_profile')}</span>
        </button>
        <button onClick={() => navigate('/lot-ops')} className="action-card">
          <Layers className="action-card-icon" color="#5a3f86" />
          <span className="action-card-label">Lot Split / Merge</span>
        </button>
        {user.role !== 'CONSUMER' && (
          <button onClick={() => navigate('/dispatch-logistics')} className="action-card">
            <PackageCheck className="action-card-icon" color="#2d3f9e" />
            <span className="action-card-label">Dispatch & Delivery</span>
          </button>
        )}
        <button onClick={() => navigate('/escrow')} className="action-card">
          <ShieldCheck className="action-card-icon" color="#f57c00" />
          <span className="action-card-label">Milestone Payments</span>
        </button>
        {user.role === 'FARMER' && (
          <button onClick={() => navigate('/ai')} className="action-card ai-card">
            <Bot className="action-card-icon" color="#1d9e75" />
            <span className="action-card-label">{t('dash_action_ai')}</span>
          </button>
        )}
      </div>

      {!loading && (
        <div className="dashboard-stats-grid">
          {quickStats.map((stat) => (
            <div key={stat.label} className={`dashboard-stat-card stat-${stat.tone}`}>
              <p className="dashboard-stat-label">{stat.label}</p>
              <p className="dashboard-stat-value">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {!loading && user.role === 'FARMER' && (
        <div className="dashboard-widgets-grid animate-slide-up">
          <div className="widget-card weather-widget">
            <h3 className="widget-header"><Thermometer size={20} /> Aaj Ka Mausam</h3>
            {weather ? (
              <>
                <div className="weather-main">
                  {weather.code > 50 ? <CloudRain size={42} /> : (weather.code > 1 ? <Cloud size={42} /> : <Sun size={42} />)}
                  <span className="weather-temp">{weather.temp}°C</span>
                </div>
                <div className="weather-details">
                  <p>Location: <strong>{weather.location}</strong></p>
                  <p>Hawa: {weather.windspeed} km/h</p>
                </div>
              </>
            ) : (
              <p style={{ opacity: 0.8 }}>Mausam ki jaankari aa rahi hai...</p>
            )}
          </div>
          
          <div className="widget-card msp-widget" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
              <h3 className="widget-header" style={{ margin:0 }}><Info size={20} /> Live Mandi Rates</h3>
              <select 
                value={cropFilter} 
                onChange={(e) => setCropFilter(e.target.value)}
                style={{
                  padding: '0.38rem 0.5rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(161, 100, 13, 0.4)',
                  background: 'rgba(255, 255, 255, 0.85)',
                  color: '#a1640d',
                  fontSize: '0.85rem',
                  outline: 'none',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                <option value="">Sabhi Fasalein</option>
                <option value="Wheat">Gehu (Wheat)</option>
                <option value="Paddy(Dhaan)(Common)">Dhaan (Paddy)</option>
                <option value="Tomato">Tamatar (Tomato)</option>
                <option value="Potato">Aloo (Potato)</option>
                <option value="Onion">Pyaaz (Onion)</option>
                <option value="Apple">Seb (Apple)</option>
                <option value="Cotton">Kapas (Cotton)</option>
                <option value="Soyabean">Soyabean</option>
                <option value="Mustard">Sarson</option>
                <option value="Bhindi(Ladies Finger)">Bhindi</option>
              </select>
            </div>

            {mandiLoading ? (
              <div style={{ display:'flex', flex:1, alignItems:'center', justifyContent:'center', opacity: 0.7, fontWeight:'600' }}>
                Fasal ke aaj ke fresh rate aa rahe hain...
              </div>
            ) : mandiRates.length > 0 ? (
              <div className="msp-list">
                 {mandiRates.map((record, i) => (
                   <div key={i} className="msp-item" style={{display:'flex', flexDirection:'column', alignItems:'flex-start', gap:'0.2rem'}}>
                     <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}>
                       <span className="msp-crop">{record.commodity}</span>
                       <span className="msp-price">Rs {(record.modal_price / 100).toFixed(2)}/kg</span>
                     </div>
                     <span style={{fontSize:'0.8rem', color:'#8b6a36'}}>
                       {record.market}, {record.state} (Rs {record.modal_price}/qtl)
                     </span>
                   </div>
                 ))}
              </div>
            ) : (
              <div style={{ display:'flex', flex:1, alignItems:'center', justifyContent:'center', opacity: 0.7, fontWeight:'600' }}>
                Khed hai, abhi is fasal ka aaj ka rate update nahi hua hai.
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && (
        <div className="dashboard-filter-card">
          <div className="dashboard-filter-top">
            <h3 className="dashboard-filter-title">{t('dash_filter_title')}</h3>
            <button type="button" className="dashboard-clear-btn" onClick={resetFilters}>
              {t('dash_filter_clear')}
            </button>
          </div>

          <div className="dashboard-filter-grid">
            <input
              className="dashboard-filter-input"
              placeholder={t('dash_filter_search_placeholder')}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />

            <select
              className="dashboard-filter-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">{t('dash_filter_all_status')}</option>
              <option value="VERIFIED">{t('dash_filter_verified')}</option>
              <option value="PENDING">{t('dash_filter_pending')}</option>
            </select>

            <select
              className="dashboard-filter-input"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <input
              type="date"
              className="dashboard-filter-input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />

            <input
              type="date"
              className="dashboard-filter-input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />

            <input
              type="number"
              className="dashboard-filter-input"
              placeholder={t('dash_filter_min_price')}
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />

            <input
              type="number"
              className="dashboard-filter-input"
              placeholder={t('dash_filter_max_price')}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>
        </div>
      )}

      {loading ? (
        <p className="dashboard-loading">{t('dash_loading')}</p>
      ) : (
        <div className="dashboard-grid">

          {user.role === 'FARMER' && myProduces.length === 0 && (
            <div className="dashboard-empty">
              <p>{t('dash_empty_farmer')}</p>
              <p className="dashboard-empty-sub">
                {t('dash_empty_farmer_sub')}
              </p>
              <button
                onClick={() => navigate('/register-produce')}
                className="btn btn-solid dashboard-empty-cta dashboard-empty-cta-farmer"
              >
                {t('dash_empty_register_cta')}
              </button>
            </div>
          )}

          {user.role === 'FARMER' && myProduces.length > 0 && filteredList.length === 0 && (
            <div className="dashboard-empty"><p>{t('dash_empty_filter')}</p></div>
          )}

          {user.role === 'FARMER' && filteredList.map(p => (
            <div key={p._id} className="produce-card">
              <div className="produce-card-header">
                <h3 className="produce-name">{p.cropType}</h3>
                <span className={`status-badge ${p.blockchainStatus === 'CONFIRMED' ? 'status-ok' : 'status-pending'}`}>
                  {p.blockchainStatus === 'CONFIRMED' ? 'Verified' : 'Pending'}
                </span>
              </div>
              <p className="produce-detail">Mool: {p.origin}</p>
              <p className="produce-detail">Maatra: {p.quantity} kg</p>
              <p className="produce-detail">Grade: {p.qualityGrade}</p>
              <p className="produce-price">Rs {p.farmPrice}/kg</p>
              <button onClick={() => showQR(p._id)} className="btn btn-action-primary">
                QR Code Dekho / Print Karo
              </button>
              <button onClick={() => copyId(p._id)} className="btn btn-action-secondary">
                ID Copy Karo
              </button>
              {p.txHash && (
                <a href={`https://sepolia.etherscan.io/tx/${p.txHash}`}
                  target="_blank" rel="noreferrer" className="chain-link">
                  Blockchain pe dekho →
                </a>
              )}
              <button onClick={() => navigate(`/verify/${p._id}`)} className="btn btn-verify">
                Poori Journey Dekho
              </button>
            </div>
          ))}

          {user.role !== 'FARMER' && receivedProduces.length === 0 && (
            <div className="dashboard-empty">
              <p>{t('dash_empty_received')}</p>
              <p className="dashboard-empty-sub">
                {t('dash_empty_received_sub')}
              </p>
              {user.role !== 'CONSUMER' && (
                <button
                  onClick={() => navigate('/transfer')}
                  className="btn btn-solid dashboard-empty-cta dashboard-empty-cta-transfer"
                >
                  {t('dash_empty_transfer_cta')}
                </button>
              )}
            </div>
          )}

          {user.role !== 'FARMER' && receivedProduces.length > 0 && filteredList.length === 0 && (
            <div className="dashboard-empty"><p>{t('dash_empty_filter')}</p></div>
          )}

          {user.role !== 'FARMER' && filteredList.map(p => (
            <div key={p._id} className="produce-card">
              <div className="produce-card-header">
                <h3 className="produce-name">{p.cropType}</h3>
                <span className="status-badge status-received">
                  Received
                </span>
              </div>
              <p className="produce-detail">Kisan: {p.farmerName}</p>
              <p className="produce-detail">Mool: {p.origin}</p>
              <p className="produce-detail">Maatra: {p.quantity} kg</p>
              <p className="produce-detail">Grade: {p.qualityGrade}</p>
              <div className="price-row">
                <div>
                  <p className="price-label">Farm price</p>
                  <p className="farm-price">Rs {p.farmPrice}/kg</p>
                </div>
                <div className="price-right">
                  <p className="price-label">Tumne diya</p>
                  <p className="received-price">Rs {p.receivedPrice}/kg</p>
                </div>
              </div>
              <button onClick={() => showQR(p._id)} className="btn btn-action-primary">
                QR Code Dekho / Print Karo
              </button>
              <button onClick={() => copyId(p._id)} className="btn btn-action-secondary">
                ID Copy Karo
              </button>
              <button onClick={() => navigate(`/verify/${p._id}`)} className="btn btn-verify">
                Poori Journey Dekho
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
