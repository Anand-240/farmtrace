import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useNotification } from '../context/NotificationContext';
import {
  ArrowLeft, Sprout, Truck, QrCode, Copy, Eye, Search,
  Filter, Calendar, IndianRupee, ArrowUpDown, ChevronDown,
  ChevronUp, SlidersHorizontal, X, Layers, ShieldCheck, ExternalLink
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import './ProduceList.css';

const PRODUCE_PAGE_SIZE = 20;

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'priceHigh', label: 'Highest Price' },
  { value: 'priceLow', label: 'Lowest Price' },
];

const CROP_EMOJIS = {
  wheat: '🌾', gehu: '🌾', rice: '🌾', dhaan: '🌾', paddy: '🌾',
  tomato: '🍅', tamatar: '🍅', potato: '🥔', aloo: '🥔',
  onion: '🧅', pyaaz: '🧅', apple: '🍎', seb: '🍎',
  cotton: '🪴', kapas: '🪴', mustard: '🌻', sarson: '🌻',
  sugarcane: '🎋', ganna: '🎋', corn: '🌽', maize: '🌽',
  mango: '🥭', aam: '🥭',
};

function getCropEmoji(cropType = '') {
  return CROP_EMOJIS[cropType.toLowerCase().split(' ')[0]] || '🌱';
}

export default function ProduceList() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const user = storedUser;

  const [activeTab, setActiveTab] = useState('produce');
  const [produces, setProduces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qrModal, setQrModal] = useState(null);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(PRODUCE_PAGE_SIZE);

  const fetchProduces = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = user.role === 'FARMER' ? '/produce/farmer/my' : '/produce/received/my';
      const res = await api.get(endpoint);
      setProduces(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user.role]);

  useEffect(() => { fetchProduces(); }, [fetchProduces]);

  const getPrice = (item) =>
    user.role === 'FARMER' ? Number(item.farmPrice) || 0 : Number(item.receivedPrice ?? item.farmPrice) || 0;

  const normalizeDate = (val) => {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  const filteredList = produces
    .filter((item) => {
      const sv = searchText.trim().toLowerCase();
      const text = [item.cropType, item.origin, item.farmerName, item.qualityGrade, item.lotCode, item._id].filter(Boolean).join(' ').toLowerCase();
      if (sv && !text.includes(sv)) return false;
      if (statusFilter !== 'ALL') {
        const s = item.blockchainStatus === 'CONFIRMED' ? 'VERIFIED' : 'PENDING';
        if (s !== statusFilter) return false;
      }
      const createdAt = normalizeDate(item.createdAt);
      const from = normalizeDate(dateFrom);
      const to = normalizeDate(dateTo);
      if (from && (!createdAt || createdAt < from)) return false;
      if (to) { const end = new Date(to); end.setHours(23,59,59,999); if (!createdAt || createdAt > end) return false; }
      const price = getPrice(item);
      const min = minPrice === '' ? null : Number(minPrice);
      const max = maxPrice === '' ? null : Number(maxPrice);
      if (min !== null && !isNaN(min) && price < min) return false;
      if (max !== null && !isNaN(max) && price > max) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === 'priceHigh') return getPrice(b) - getPrice(a);
      if (sortBy === 'priceLow') return getPrice(a) - getPrice(b);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  const paginatedList = filteredList.slice(0, displayLimit);

  const resetFilters = () => {
    setSearchText(''); setStatusFilter('ALL'); setDateFrom(''); setDateTo('');
    setMinPrice(''); setMaxPrice(''); setSortBy('newest'); setDisplayLimit(PRODUCE_PAGE_SIZE);
  };

  const hasActiveFilters = searchText || statusFilter !== 'ALL' || dateFrom || dateTo || minPrice || maxPrice;

  const fallbackCopy = (text) => {
    const el = document.createElement('textarea');
    el.value = text; el.style.cssText = 'position:fixed;top:-9999px'; document.body.appendChild(el);
    el.focus(); el.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(el);
  };

  const copyId = async (id) => {
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) await navigator.clipboard.writeText(id);
      else fallbackCopy(id);
      showNotification('ID copy ho gayi! ✅', { type: 'sms', duration: 2500 });
    } catch (err) { showNotification(`Manual copy: ${id}`, { type: 'sms', duration: 6000 }); }
  };

  const showQR = async (produceId) => {
    try {
      const res = await api.get(`/produce/${produceId}`);
      setQrModal({ url: `${window.location.origin}/verify/${produceId}`, details: res.data });
    } catch (err) { showNotification('QR load nahi hua.', { type: 'sms', tone: 'error' }); }
  };

  return (
    <div className="pl-page">

      {/* QR Modal */}
      {qrModal && (
        <div className="ft-modal-overlay" onClick={() => setQrModal(null)}>
          <div className="ft-modal pl-qr-modal" onClick={e => e.stopPropagation()}>
            <button className="pl-modal-close" onClick={() => setQrModal(null)}><X size={20} /></button>
            <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <QRCodeSVG value={qrModal.url} size={200} />
              <p style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--ft-text-muted)' }}>Scan to trace on blockchain</p>
              <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
                <button onClick={() => setQrModal(null)} className="ft-btn ft-btn-ghost ft-btn-full">Close</button>
                <button onClick={() => window.open(qrModal.url, '_blank')} className="ft-btn ft-btn-primary ft-btn-full">Open History</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="pl-header">
        <button className="pl-back-btn" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={20} />
          <span>Dashboard</span>
        </button>
        <div className="pl-header-center">
          <h1 className="pl-header-title">
            {user.role === 'FARMER' ? '🌾 Meri Fasal aur Transfers' : '📦 Prapt Utpaad aur Transfers'}
          </h1>
        </div>
        <div style={{ width: 120 }} />
      </header>

      {/* Tabs */}
      <div className="pl-tabs">
        <button
          className={`pl-tab ${activeTab === 'produce' ? 'pl-tab-active' : ''}`}
          onClick={() => setActiveTab('produce')}
        >
          {user.role === 'FARMER' ? <Sprout size={18} /> : <Layers size={18} />}
          {user.role === 'FARMER' ? 'Meri Fasal' : 'Prapt Utpaad'}
          <span className="pl-tab-count">
            {hasActiveFilters ? `${filteredList.length} / ${produces.length}` : produces.length}
          </span>
        </button>
        <button
          className={`pl-tab ${activeTab === 'transfers' ? 'pl-tab-active' : ''}`}
          onClick={() => setActiveTab('transfers')}
        >
          <Truck size={18} />
          Transfers
        </button>
      </div>

      <div className="pl-content">

        {/* ── PRODUCE TAB ── */}
        {activeTab === 'produce' && (
          <>
            {/* Search & Filters */}
            <div className="pl-filter-card">
              <div className="pl-filter-top">
                <div className="pl-search-wrap">
                  <Search size={18} className="pl-search-icon" />
                  <input
                    className="pl-search-input"
                    placeholder="Crop type, location, grade, LOT ID..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                  />
                </div>
                <button
                  className="pl-filter-toggle"
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                >
                  <SlidersHorizontal size={16} />
                  {isFilterOpen ? 'Hide Filters' : 'Advanced Filters'}
                  {isFilterOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {hasActiveFilters && (
                  <button className="pl-reset-btn" onClick={resetFilters}>
                    <X size={14} /> Reset
                  </button>
                )}
              </div>

              {isFilterOpen && (
                <div className="pl-advanced-filters">
                  <div className="pl-filters-grid">
                    <div className="pl-filter-group">
                      <h5 className="pl-filter-group-title">Management</h5>
                      <div className="pl-filter-field">
                        <label>Status</label>
                        <div className="pl-input-icon-wrap">
                          <Filter size={15} className="pl-field-icon" />
                          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="ALL">Sabhi</option>
                            <option value="VERIFIED">Verified Only</option>
                            <option value="PENDING">Pending Only</option>
                          </select>
                        </div>
                      </div>
                      <div className="pl-filter-field">
                        <label>Sort</label>
                        <div className="pl-input-icon-wrap">
                          <ArrowUpDown size={15} className="pl-field-icon" />
                          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="pl-filter-group">
                      <h5 className="pl-filter-group-title">Timeline</h5>
                      <div className="pl-filter-field">
                        <label>Date From</label>
                        <div className="pl-input-icon-wrap">
                          <Calendar size={15} className="pl-field-icon" />
                          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                        </div>
                      </div>
                      <div className="pl-filter-field">
                        <label>Date To</label>
                        <div className="pl-input-icon-wrap">
                          <Calendar size={15} className="pl-field-icon" />
                          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                        </div>
                      </div>
                    </div>
                    <div className="pl-filter-group">
                      <h5 className="pl-filter-group-title">Price Range</h5>
                      <div className="pl-filter-field">
                        <label>Min Price</label>
                        <div className="pl-input-icon-wrap">
                          <IndianRupee size={15} className="pl-field-icon" />
                          <input type="number" placeholder="0" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
                        </div>
                      </div>
                      <div className="pl-filter-field">
                        <label>Max Price</label>
                        <div className="pl-input-icon-wrap">
                          <IndianRupee size={15} className="pl-field-icon" />
                          <input type="number" placeholder="No limit" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Results count */}
            {!loading && (
              <p className="pl-results-count">
                {filteredList.length} result{filteredList.length !== 1 ? 's' : ''}
                {hasActiveFilters ? ` (filtered from ${produces.length})` : ''}
              </p>
            )}

            {/* Produce Grid */}
            {loading ? (
              <p className="ft-loading-pulse">🌱 Load ho raha hai...</p>
            ) : filteredList.length === 0 ? (
              <div className="pl-empty">
                <div className="pl-empty-icon">{user.role === 'FARMER' ? '🌱' : '📦'}</div>
                <h3>{hasActiveFilters ? 'Koi match nahi mila' : user.role === 'FARMER' ? 'Koi fasal register nahi ki' : 'Koi produce nahi mila'}</h3>
                {hasActiveFilters
                  ? <button className="ft-btn ft-btn-ghost" onClick={resetFilters}>Filters Reset Karein</button>
                  : user.role === 'FARMER' && <button className="ft-btn ft-btn-primary" onClick={() => navigate('/register-produce')}><Sprout size={18} /> Register Karein</button>
                }
              </div>
            ) : (
              <>
                <div className="pl-produce-grid">
                  {paginatedList.map((p, idx) => (
                    <div key={p._id} className="pl-produce-card" style={{ animationDelay: `${idx * 0.05}s` }}>
                      <div className="pl-card-header">
                        <div className="pl-card-meta">
                          <span className="mini-id-badge">LOT: {p._id.slice(-6).toUpperCase()}</span>
                          <span className={`ft-badge ${p.blockchainStatus === 'CONFIRMED' ? 'ft-badge-success' : 'ft-badge-pending'}`}>
                            {p.blockchainStatus === 'CONFIRMED' ? '✓ Verified' : '⏳ Pending'}
                          </span>
                        </div>
                        <div className="pl-card-title-row">
                          <span className="pl-crop-emoji">{getCropEmoji(p.cropType)}</span>
                          <h3 className="pl-crop-name">{p.cropType}</h3>
                        </div>
                      </div>

                      <div className="pl-card-details">
                        {user.role === 'FARMER' ? (
                          <>
                            <div className="pl-detail"><span className="detail-label">Origin</span><span className="detail-val">{p.origin}</span></div>
                            <div className="pl-detail"><span className="detail-label">Qty</span><span className="detail-val">{p.quantity} KG</span></div>
                            <div className="pl-detail"><span className="detail-label">Grade</span><span className="detail-val">Grade {p.qualityGrade}</span></div>
                            <div className="pl-detail"><span className="detail-label">Price/KG</span><span className="detail-val">₹{p.farmPrice}</span></div>
                          </>
                        ) : (
                          <>
                            <div className="pl-detail"><span className="detail-label">Farmer</span><span className="detail-val">{p.farmerName}</span></div>
                            <div className="pl-detail"><span className="detail-label">Qty</span><span className="detail-val">{p.quantity} KG</span></div>
                            <div className="pl-detail"><span className="detail-label">Origin</span><span className="detail-val">{p.origin}</span></div>
                            <div className="pl-detail"><span className="detail-label">Price/KG</span><span className="detail-val">₹{p.receivedPrice || p.farmPrice}</span></div>
                          </>
                        )}
                      </div>

                      <div className="pl-card-footer">
                        <button onClick={() => showQR(p._id)} className="ft-btn ft-btn-primary ft-btn-sm">
                          <QrCode size={15} /> QR
                        </button>
                        <button onClick={() => copyId(p._id)} className="ft-btn ft-btn-ghost ft-btn-sm">
                          <Copy size={14} /> Copy ID
                        </button>
                        <button onClick={() => navigate(`/verify/${p._id}`)} className="ft-btn ft-btn-ghost ft-btn-sm">
                          <Eye size={14} /> History
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {filteredList.length > displayLimit && (
                  <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <button
                      className="ft-btn ft-btn-ghost"
                      onClick={() => setDisplayLimit(prev => prev + PRODUCE_PAGE_SIZE)}
                      style={{ padding: '0.75rem 2.5rem', fontWeight: 800 }}
                    >
                      Load More ({filteredList.length - displayLimit} remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── TRANSFERS TAB ── */}
        {activeTab === 'transfers' && (
          <div className="pl-transfers-section">
            <div className="pl-transfers-info">
              <div className="pl-transfers-icon">🚚</div>
              <h2>Aapke Transfers</h2>
              <p>Produce transfers — bhejne ke liye, ya naya transfer shuru karne ke liye neeche click karein.</p>
              <div className="pl-transfers-actions">
                <button className="ft-btn ft-btn-primary" onClick={() => navigate('/transfer')}>
                  <Truck size={18} /> Naya Transfer Karein
                </button>
                <button className="ft-btn ft-btn-ghost" onClick={() => navigate('/transactions')}>
                  <ShieldCheck size={18} /> Transfer History
                </button>
              </div>
            </div>

            {/* Show produce list with their transfer status */}
            <div className="pl-transfer-produce-list">
              <h3 className="pl-transfer-subtitle">Produce aur unki Transfer Chain</h3>
              {loading ? (
                <p className="ft-loading-pulse">Load ho raha hai...</p>
              ) : produces.length === 0 ? (
                <div className="pl-empty">
                  <div className="pl-empty-icon">📦</div>
                  <h3>Koi produce nahi mila</h3>
                </div>
              ) : produces.map((p) => (
                <div key={p._id} className="pl-transfer-row">
                  <div className="pl-transfer-row-left">
                    <span className="pl-transfer-emoji">{getCropEmoji(p.cropType)}</span>
                    <div>
                      <div className="pl-transfer-crop">{p.cropType}</div>
                      <div className="pl-transfer-meta">
                        LOT: {p._id.slice(-6).toUpperCase()} &nbsp;·&nbsp; {p.quantity} KG &nbsp;·&nbsp; ₹{user.role === 'FARMER' ? p.farmPrice : (p.receivedPrice || p.farmPrice)}/kg
                      </div>
                    </div>
                  </div>
                  <div className="pl-transfer-row-right">
                    <span className={`ft-badge ${p.blockchainStatus === 'CONFIRMED' ? 'ft-badge-success' : 'ft-badge-pending'}`}>
                      {p.blockchainStatus === 'CONFIRMED' ? '✓ Verified' : '⏳ Pending'}
                    </span>
                    <button
                      className="ft-btn ft-btn-ghost ft-btn-sm"
                      onClick={() => navigate(`/verify/${p._id}`)}
                      style={{ fontSize: '0.8rem' }}
                    >
                      <Eye size={14} /> Journey <ExternalLink size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
