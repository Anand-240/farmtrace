import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import InfiniteScroll from 'react-infinite-scroll-component';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { Search, ShoppingCart, ArrowLeft, Filter, MapPin, Scale, Eye, Send } from 'lucide-react';
import api from '../lib/api';
import { track } from '../lib/posthog';

const CROP_EMOJIS = {
  wheat: '🌾', rice: '🌾', paddy: '🌾', tomato: '🍅', potato: '🥔',
  onion: '🧅', apple: '🍎', cotton: '🪴', mustard: '🌻', sugarcane: '🎋', corn: '🌽', mango: '🥭'
};

function getCropEmoji(cropType = '') {
  const key = cropType.toLowerCase().split(' ')[0];
  return CROP_EMOJIS[key] || '🌱';
}

export default function Marketplace() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [apiError, setApiError] = useState(false);
  const fetchingMoreRef = useRef(false);
  const navigate = useNavigate();

  const fetchItems = async (pageNum, searchQuery) => {
    try {
      const res = await api.get('/market/search', {
        params: { query: searchQuery, page: pageNum, limit: 10 }
      });
      setApiError(false);
      return res.data;
    } catch (err) {
      setApiError(true);
      return { results: [], total: 0 };
    }
  };

  const loadInitial = async () => {
    setLoading(true);
    setPage(1);
    const data = await fetchItems(1, query);
    setItems(data.results);
    setTotal(data.total);
    setHasMore(data.results.length < data.total);
    setLoading(false);
  };

  useEffect(() => {
    track('marketplace_viewed');
  }, []);

  useEffect(() => {
    setSearching(true);
    const delayDebounceFn = setTimeout(() => {
      setSearching(false);
      loadInitial();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMoreData = async () => {
    if (fetchingMoreRef.current) return;
    fetchingMoreRef.current = true;
    try {
      const nextPage = page + 1;
      const data = await fetchItems(nextPage, query);
      setItems((prev) => {
        const newItems = [...prev, ...data.results];
        if (newItems.length >= data.total) setHasMore(false);
        return newItems;
      });
      setTotal(data.total);
      setPage(nextPage);
    } finally {
      fetchingMoreRef.current = false;
    }
  };

  const renderSkeletons = () => (
    <div className="marketplace-grid">
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <div key={n} className="market-card">
          <Skeleton height={150} style={{ borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }} />
          <div style={{ padding: '1.25rem' }}>
            <Skeleton width="60%" height={24} style={{ marginBottom: '0.5rem' }} />
            <Skeleton width="40%" height={16} style={{ marginBottom: '1rem' }} />
            <Skeleton count={3} style={{ marginBottom: '0.5rem' }} />
            <Skeleton width="100%" height={40} style={{ marginTop: '1rem', borderRadius: '12px' }} />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="ft-page planetono-flow">
      <nav className="ft-top-nav glass" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="ft-container nav-flex">
          <button onClick={() => navigate('/dashboard')} className="ft-btn ft-btn-ghost ft-btn-sm">
            <ArrowLeft size={18} /> Dashboard
          </button>
          <span className="nav-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingCart size={20} /> AgriMarket
          </span>
          <div style={{ width: 80 }} />
        </div>
      </nav>

      <div className="ft-container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        <div className="market-header ft-anim-slide-up">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--ft-forest)', letterSpacing: '-0.03em' }}>Global Marketplace</h1>
            <p style={{ color: 'var(--ft-text-muted)', fontSize: '1.1rem', marginTop: '0.5rem' }}>Discover and buy verified produce directly from farmers.</p>
          </div>

          <div className="market-search-bar" style={{ maxWidth: 600, margin: '0 auto 3rem', display: 'flex', gap: '1rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={20} style={{ position: 'absolute', left: '1.2rem', top: '1rem', color: 'var(--ft-text-muted)' }} />
              <input
                type="text"
                placeholder="Search crops, regions, grades..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ width: '100%', padding: '1rem 3.5rem 1rem 3.5rem', borderRadius: '999px', border: `1.5px solid ${searching ? 'var(--ft-forest)' : 'var(--ft-border)'}`, fontSize: '1.05rem', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', outline: 'none', transition: 'all 0.2s' }}
              />
              {searching && (
                <div className="ft-spinner-sm" style={{ position: 'absolute', right: '1.2rem', top: '50%', transform: 'translateY(-50%)' }} />
              )}
            </div>
            <button className="ft-btn ft-btn-ghost" title="Advanced filters — coming soon" disabled style={{ borderRadius: '999px', padding: '0 1.5rem', border: '1.5px solid var(--ft-border)', background: '#fff', opacity: 0.5, cursor: 'not-allowed' }}>
              <Filter size={18} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Filters</span>
            </button>
          </div>
        </div>

        {loading ? (
          renderSkeletons()
        ) : apiError ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#fff1f1', borderRadius: '16px', border: '1px solid #f8b4b4' }}>
            <p style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>⚠️</p>
            <p style={{ fontWeight: 800, color: '#c0392b', marginBottom: '0.5rem' }}>Server se data nahi aaya</p>
            <p style={{ color: '#888', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Network check karein ya thodi der baad dobara try karein.</p>
            <button onClick={() => { setApiError(false); setLoading(true); setPage(1); fetchItems(1, query).then(data => { setItems(data.results); setTotal(data.total); setHasMore(data.results.length < data.total); setLoading(false); }); }} style={{ padding: '0.75rem 2rem', background: '#27500A', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>
              🔄 Retry
            </button>
          </div>
        ) : (
          <InfiniteScroll
            dataLength={items.length}
            next={fetchMoreData}
            hasMore={hasMore}
            loader={<div style={{ textAlign: 'center', padding: '2rem' }}><div className="ft-spinner" style={{ margin: '0 auto' }}></div></div>}
            endMessage={
              <p style={{ textAlign: 'center', color: 'var(--ft-text-muted)', padding: '2rem', fontWeight: 600 }}>
                {total > 0 ? 'You have seen it all! 🌾' : 'Is search ke liye koi produce nahi mila. 🌱'}
              </p>
            }
            style={{ overflow: 'visible' }}
          >
            <div className="marketplace-grid">
              {items.map((item, index) => (
                <div key={item.id} className="market-card ft-anim-reveal" style={{ animationDelay: `${(index % 10) * 0.05}s` }}>
                  <div className="market-card-image" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '4rem' }}>
                    {getCropEmoji(item.cropType)}
                  </div>
                  <div className="market-card-content" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--ft-forest)', margin: 0 }}>{item.cropType}</h3>
                      <span style={{ background: '#fef3c7', color: '#b45309', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>Grade {item.qualityGrade}</span>
                    </div>
                    
                    <p style={{ fontSize: '0.9rem', color: 'var(--ft-text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                      <MapPin size={14} /> {item.origin}
                    </p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--ft-text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1.25rem' }}>
                      <Scale size={14} /> {item.quantity} KG Available
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--ft-border)', paddingTop: '1rem' }}>
                      <div>
                        <p style={{ fontSize: '0.7rem', color: 'var(--ft-text-muted)', textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>Farmer</p>
                        <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#000', margin: 0 }}>{item.farmerName}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '0.7rem', color: 'var(--ft-text-muted)', textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>Price</p>
                        <p style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--ft-forest)', margin: 0 }}>₹{item.farmPrice}/kg</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                      <button
                        onClick={() => navigate(`/verify/${item.id}`)}
                        style={{ flex: 1, padding: '0.75rem', background: '#fff', color: 'var(--ft-forest)', border: '1.5px solid var(--ft-border)', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
                      >
                        <Eye size={15} /> View
                      </button>
                      <button
                        onClick={() => navigate(`/transfer?lot=${item.id}`)}
                        style={{ flex: 2, padding: '0.75rem', background: 'var(--ft-forest)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.9rem' }}
                        onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                      >
                        <Send size={15} /> Request to Buy
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </InfiniteScroll>
        )}
      </div>

      <style>{`
        .marketplace-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 2rem;
        }
        .market-card {
          background: #fff;
          border-radius: 16px;
          border: 1px solid var(--ft-border);
          box-shadow: 0 4px 20px rgba(0,0,0,0.04);
          overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .market-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 30px rgba(0,0,0,0.08);
        }
      `}</style>
    </div>
  );
}
