import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const NAV_LINKS = [
  { label: 'Supply Chain', href: '#supply-chain' },
  { label: 'Traceability', href: '#traceability' },
  { label: 'Market', href: '#market' },
  { label: 'Schemes', href: '#schemes' },
  { label: 'Contact', href: '#contact' },
];

const FEATURES = [
  { icon: '🔗', title: 'Blockchain Traceability', desc: 'Every produce lot tracked on immutable blockchain — from farm to final consumer with QR-based verification.', color: '#0d3319' },
  { icon: '📊', title: 'Live Mandi Prices', desc: 'Real-time AGMARKNET rates across all major mandis. Historical trends, state-wise coverage.', color: '#065f46' },
  { icon: '🏷', title: 'eNAM-Style Auctions', desc: 'Multi-buyer competitive bidding with auto-accept rules, countdown timers, and live bid history.', color: '#1e40af' },
  { icon: '🔬', title: 'Quality Grading', desc: 'Lab-backed quality reports: moisture, purity, grade (FAQ/A/B/Premium) — eNAM compliant.', color: '#7c3aed' },
  { icon: '🏭', title: 'Warehouse & WMS', desc: 'Stock-in/out, WDRA warehouse receipts, cold-chain tracking, capacity management.', color: '#b45309' },
  { icon: '💳', title: 'Agri Credit', desc: 'Kisan Credit Card, crop loans, invoice discounting, warehouse receipt loans — all in one place.', color: '#0369a1' },
  { icon: '🤖', title: 'AI Market Advisory', desc: 'Demand forecasts, seasonal crop guidance, and AI chatbot for market questions in Hinglish.', color: '#059669' },
  { icon: '🏛️', title: 'Govt Scheme Eligibility', desc: 'PM-KISAN, PMFBY, KCC — instant eligibility check based on your role and land holding.', color: '#dc2626' },
];

const SUPPLY_STEPS = [
  { role: 'Farmer', icon: '👨‍🌾', desc: 'Registers produce, adds quality report', status: 'COMPLETED', color: '#16a34a' },
  { role: 'Distributor', icon: '🚚', desc: 'Receives, inspects & dispatches lots', status: 'IN TRANSIT', color: '#d97706' },
  { role: 'Retailer', icon: '🏪', desc: 'Stores & sells to end market', status: 'QUEUED', color: '#3b82f6' },
  { role: 'Consumer', icon: '🛒', desc: 'Scans QR, views full journey', status: 'PENDING', color: '#6b7280' },
];

const STATS = [
  { value: '12,000+', label: 'Farmers Registered', icon: '👨‍🌾' },
  { value: '₹48 Cr', label: 'Trade Volume', icon: '💰' },
  { value: '8 States', label: 'Coverage', icon: '🗺️' },
  { value: '99.8%', label: 'Blockchain Uptime', icon: '🔗' },
];

const GOVT_SCHEMES_TEASER = [
  { icon: '🌾', title: 'PM-KISAN', benefit: '₹6,000/year income support', tag: 'Income Support' },
  { icon: '🛡️', title: 'PMFBY', benefit: 'Crop insurance at minimal premium', tag: 'Insurance' },
  { icon: '💳', title: 'Kisan Credit Card', benefit: 'Credit upto ₹3L at 4% p.a.', tag: 'Credit' },
  { icon: '🏗️', title: 'Agri Infra Fund', benefit: '3% interest subvention on infra loans', tag: 'Infrastructure' },
];

function useInView(ref, threshold = 0.15) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref, threshold]);
  return inView;
}

function Section({ id, children, style }) {
  const ref = useRef(null);
  const inView = useInView(ref);
  return (
    <section id={id} ref={ref} style={{ opacity: inView ? 1 : 0, transform: inView ? 'translateY(0)' : 'translateY(32px)', transition: 'opacity 0.7s ease, transform 0.7s ease', ...style }}>
      {children}
    </section>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [videoError, setVideoError] = useState(true); // default true: use gradient instead of external video
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 60);
      if (window.scrollY > 60) setMobileMenuOpen(false);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/marketplace?q=${encodeURIComponent(searchQuery)}`);
  };

  const smoothScroll = (href) => {
    if (href.startsWith('#')) {
      const el = document.querySelector(href);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif", color: '#0f172a', background: '#fff', overflowX: 'hidden' }}>

      {/* ── NAVBAR ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled || mobileMenuOpen ? 'rgba(255,255,255,0.97)' : 'transparent',
        backdropFilter: scrolled || mobileMenuOpen ? 'blur(12px)' : 'none',
        borderBottom: scrolled || mobileMenuOpen ? '1px solid rgba(0,0,0,0.08)' : 'none',
        transition: 'all 0.3s ease',
        padding: '0 2rem',
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '68px', gap: '2rem' }}>
          {/* Logo */}
          <div onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
            <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #0d3319, #16a34a)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>🌾</div>
            <span style={{ fontWeight: 900, fontSize: '1.25rem', color: scrolled || mobileMenuOpen ? '#0d3319' : '#fff', letterSpacing: '-0.03em' }}>FARMTRACE</span>
          </div>

          {/* Nav Links — hidden on mobile */}
          <div className="lp-nav-links" style={{ display: 'flex', gap: '0.25rem', flex: 1, justifyContent: 'center' }}>
            {NAV_LINKS.map(link => (
              <button key={link.label} onClick={() => smoothScroll(link.href)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem 0.85rem', borderRadius: '8px', fontWeight: 600, fontSize: '0.92rem', color: scrolled ? '#374151' : 'rgba(255,255,255,0.88)', transition: 'all 0.2s', fontFamily: 'inherit' }}
                onMouseOver={e => { e.currentTarget.style.background = scrolled ? '#f3f4f6' : 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = scrolled ? '#0d3319' : '#fff'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = scrolled ? '#374151' : 'rgba(255,255,255,0.88)'; }}>
                {link.label}
              </button>
            ))}
          </div>

          {/* Search — hidden on mobile */}
          <form className="lp-search-form" onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center', background: scrolled ? '#f8f9fa' : 'rgba(255,255,255,0.15)', borderRadius: '999px', padding: '0.4rem 1rem', border: scrolled ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(8px)', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', color: scrolled ? '#9ca3af' : 'rgba(255,255,255,0.7)' }}>🔍</span>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search crops, mandis..." style={{ background: 'none', border: 'none', outline: 'none', fontSize: '0.88rem', color: scrolled ? '#374151' : '#fff', width: '160px', fontFamily: 'inherit' }} />
          </form>

          {/* Login — always visible */}
          <button onClick={() => navigate('/login')} style={{ padding: '0.55rem 1.4rem', background: scrolled || mobileMenuOpen ? '#0d3319' : '#fff', color: scrolled || mobileMenuOpen ? '#fff' : '#0d3319', border: 'none', borderRadius: '999px', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit', flexShrink: 0 }}
            onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.04)'; }}
            onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
            Login
          </button>

          {/* Hamburger — mobile only */}
          <button className="lp-hamburger" onClick={() => setMobileMenuOpen(v => !v)} style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem', borderRadius: '8px', color: scrolled || mobileMenuOpen ? '#0d3319' : '#fff', flexShrink: 0, fontFamily: 'inherit' }}>
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div style={{ background: 'rgba(255,255,255,0.98)', borderTop: '1px solid rgba(0,0,0,0.06)', padding: '1rem 2rem 1.5rem' }}>
            {NAV_LINKS.map(link => (
              <button key={link.label} onClick={() => { smoothScroll(link.href); setMobileMenuOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '0.75rem 0', fontWeight: 700, fontSize: '1rem', color: '#374151', borderBottom: '1px solid #f3f4f6', fontFamily: 'inherit' }}>
                {link.label}
              </button>
            ))}
            <form onSubmit={e => { handleSearch(e); setMobileMenuOpen(false); }} style={{ display: 'flex', alignItems: 'center', marginTop: '1rem', background: '#f8f9fa', borderRadius: '999px', padding: '0.5rem 1rem', border: '1px solid #e5e7eb', gap: '0.5rem' }}>
              <span>🔍</span>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search crops, mandis..." style={{ background: 'none', border: 'none', outline: 'none', fontSize: '0.9rem', color: '#374151', flex: 1, fontFamily: 'inherit' }} />
            </form>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <div style={{ position: 'relative', height: '100vh', minHeight: '600px', overflow: 'hidden' }}>
        {/* Video Background */}
        {!videoError ? (
          <video autoPlay muted loop playsInline onError={() => setVideoError(true)}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}>
            <source src="https://agristack.gov.in/assets/videos/home_bg.mp4" type="video/mp4" />
          </video>
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0d3319 0%, #1a5c2a 50%, #2d7a3a 100%)', zIndex: 0 }} />
        )}

        {/* Overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(5,20,10,0.65) 0%, rgba(5,20,10,0.5) 50%, rgba(5,20,10,0.75) 100%)', zIndex: 1 }} />

        {/* Live Badge */}
        <div style={{ position: 'absolute', top: '100px', left: '50%', transform: 'translateX(-50%)', zIndex: 2, display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '999px', padding: '0.35rem 1rem', fontSize: '0.78rem', fontWeight: 700, color: '#fff', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4ade80', animation: 'livePulse 1.5s ease-in-out infinite', display: 'inline-block' }} />
          LIVE FROM FARM TO CONSUMER — INDIA
        </div>

        {/* Hero Content */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '0 2rem' }}>
          <h1 style={{ fontSize: 'clamp(2.4rem, 6vw, 4.5rem)', fontWeight: 900, color: '#fff', lineHeight: 1.08, letterSpacing: '-0.03em', marginBottom: '1.25rem', maxWidth: '820px', textShadow: '0 2px 20px rgba(0,0,0,0.4)' }}>
            India's Blockchain-Powered<br />
            <span style={{ background: 'linear-gradient(90deg, #4ade80, #86efac)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Agri Supply Chain
            </span>
          </h1>
          <p style={{ fontSize: 'clamp(1rem, 2vw, 1.25rem)', color: 'rgba(255,255,255,0.85)', maxWidth: '600px', lineHeight: 1.6, marginBottom: '2.5rem', fontWeight: 400 }}>
            Real-time data visualization of every produce lot — from farm to table. Powered by blockchain, eNAM market intelligence, and AI advisory.
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => navigate('/login')} style={{ padding: '0.9rem 2.5rem', background: 'linear-gradient(135deg, #16a34a, #0d3319)', color: '#fff', border: 'none', borderRadius: '999px', fontWeight: 800, fontSize: '1.05rem', cursor: 'pointer', boxShadow: '0 8px 30px rgba(16,163,74,0.4)', transition: 'all 0.25s', fontFamily: 'inherit' }}
              onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 14px 35px rgba(16,163,74,0.5)'; }}
              onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(16,163,74,0.4)'; }}>
              Get Started Free
            </button>
            <button onClick={() => smoothScroll('#supply-chain')} style={{ padding: '0.9rem 2.5rem', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.4)', borderRadius: '999px', fontWeight: 700, fontSize: '1.05rem', cursor: 'pointer', backdropFilter: 'blur(8px)', transition: 'all 0.25s', fontFamily: 'inherit' }}
              onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }}
              onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}>
              Explore Platform ↓
            </button>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div style={{ position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em' }}>
          <span>SCROLL</span>
          <div style={{ width: '1.5px', height: '40px', background: 'linear-gradient(to bottom, rgba(255,255,255,0.5), transparent)', animation: 'scrollLine 2s ease-in-out infinite' }} />
        </div>
      </div>

      {/* ── STATS BAR ── */}
      <div style={{ background: '#0d3319', padding: '1.5rem 2rem' }}>
        <div className="lp-stats-grid" style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {STATS.map((s, i) => (
            <div key={s.label} style={{ textAlign: 'center', borderRight: i < STATS.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none', padding: '0.5rem' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#4ade80' }}>{s.value}</div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, marginTop: '0.2rem' }}>{s.icon} {s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SUPPLY CHAIN FLOW ── */}
      <Section id="supply-chain" style={{ padding: '5rem 2rem', background: '#f8fdf8' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <span style={{ background: '#dcfce7', color: '#16a34a', padding: '0.3rem 1rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Global Journey Tracker</span>
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, color: '#0d3319', marginTop: '0.75rem', letterSpacing: '-0.02em' }}>Interactive End-to-End Transparency</h2>
            <p style={{ color: '#64748b', fontSize: '1.05rem', marginTop: '0.5rem', maxWidth: '540px', margin: '0.75rem auto 0' }}>Track every lot in real-time — from harvest to final sale, with blockchain-verified timestamps</p>
          </div>

          {/* Steps */}
          <div className="lp-supply-steps" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0', position: 'relative' }}>
            {/* Connecting Line */}
            <div style={{ position: 'absolute', top: '40px', left: '12.5%', right: '12.5%', height: '2px', background: 'linear-gradient(90deg, #16a34a, #d97706, #3b82f6, #9ca3af)', zIndex: 0 }} />

            {SUPPLY_STEPS.map((step, i) => (
              <div key={step.role} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                {/* Status badge */}
                <div style={{ background: `${step.color}15`, border: `2px solid ${step.color}30`, borderRadius: '999px', padding: '0.2rem 0.65rem', fontSize: '0.68rem', fontWeight: 800, color: step.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem', whiteSpace: 'nowrap' }}>
                  {step.status}
                </div>
                {/* Icon Circle */}
                <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#fff', border: `3px solid ${step.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', boxShadow: `0 8px 24px ${step.color}25`, transition: 'transform 0.2s' }}
                  onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                  onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
                  {step.icon}
                </div>
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a', marginTop: '1rem', marginBottom: '0.4rem' }}>{step.role}</h3>
                <p style={{ fontSize: '0.83rem', color: '#64748b', textAlign: 'center', lineHeight: 1.4, maxWidth: '160px' }}>{step.desc}</p>

                {/* Step number */}
                <div style={{ position: 'absolute', top: '-8px', right: 'calc(50% - 52px)', width: '22px', height: '22px', borderRadius: '50%', background: step.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 900 }}>
                  {i + 1}
                </div>
              </div>
            ))}
          </div>

          {/* Journey Detail Card */}
          <div className="lp-journey-detail" style={{ marginTop: '3rem', background: '#fff', borderRadius: '20px', border: '1px solid #e5e7eb', padding: '2rem', boxShadow: '0 8px 30px rgba(0,0,0,0.06)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>Batch ID</div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', fontFamily: 'monospace', color: '#0d3319' }}>#FT-9842-AG</div>
              <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#16a34a', fontWeight: 600 }}>✓ Blockchain Verified</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>Produce</div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>🌾 Organic Winter Wheat</div>
              <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ background: '#dcfce7', color: '#16a34a', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>Grade: Premium</span>
                <span style={{ background: '#fef3c7', color: '#d97706', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>500 kg</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>Metrics</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {[{ label: 'Temp Stability', value: '98.2%', color: '#16a34a' }, { label: 'Moisture', value: '12.4%', color: '#0369a1' }, { label: 'Purity', value: '97.8%', color: '#7c3aed' }].map(m => (
                  <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem' }}>
                    <span style={{ color: '#64748b' }}>{m.label}</span>
                    <span style={{ fontWeight: 800, color: m.color }}>{m.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── FEATURES GRID ── */}
      <Section id="traceability" style={{ padding: '5rem 2rem', background: '#fff' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <span style={{ background: '#eff6ff', color: '#1e40af', padding: '0.3rem 1rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Platform Features</span>
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, color: '#0d3319', marginTop: '0.75rem', letterSpacing: '-0.02em' }}>Everything Indian Agriculture Needs</h2>
            <p style={{ color: '#64748b', fontSize: '1.05rem', marginTop: '0.5rem', maxWidth: '520px', margin: '0.75rem auto 0' }}>From mandi price discovery to blockchain traceability — built for Bharat</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.25rem' }}>
            {FEATURES.map((f, i) => (
              <div key={f.title} style={{ background: '#fff', borderRadius: '16px', padding: '1.75rem', border: '1.5px solid #f0f0f0', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', transition: 'all 0.25s', cursor: 'default' }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = `0 16px 40px ${f.color}20`; e.currentTarget.style.borderColor = `${f.color}40`; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#f0f0f0'; }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: `${f.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', marginBottom: '1rem' }}>
                  {f.icon}
                </div>
                <h3 style={{ fontWeight: 800, fontSize: '1.02rem', color: '#0f172a', marginBottom: '0.5rem' }}>{f.title}</h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.55 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── CARBON FOOTPRINT + TRUST CERTS ── */}
      <Section id="market" style={{ padding: '5rem 2rem', background: '#f8fdf8' }}>
        <div className="lp-carbon-row" style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: '2rem', alignItems: 'start' }}>
          {/* Carbon Footprint */}
          <div style={{ background: '#fff', borderRadius: '20px', padding: '2rem', border: '1px solid #e5e7eb', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ fontWeight: 900, fontSize: '1.2rem', color: '#0d3319' }}>Carbon Footprint Analysis</h3>
                <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.25rem' }}>Per batch · Compare vs industry average</p>
              </div>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', fontWeight: 700 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#0d3319', display: 'inline-block' }} /> This Batch</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#d1d5db', display: 'inline-block' }} /> Industry Avg</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.5rem', height: '140px', paddingBottom: '0.5rem' }}>
              {[
                { label: 'HARVEST', batch: 72, avg: 85 },
                { label: 'MILL', batch: 58, avg: 78 },
                { label: 'LOGISTICS', batch: 65, avg: 90 },
                { label: 'PACKAGING', batch: 48, avg: 70 },
              ].map(d => (
                <div key={d.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '110px' }}>
                    <div style={{ width: '22px', background: '#0d3319', borderRadius: '4px 4px 0 0', height: `${d.batch}%`, transition: 'height 1s ease' }} />
                    <div style={{ width: '22px', background: '#e5e7eb', borderRadius: '4px 4px 0 0', height: `${d.avg}%` }} />
                  </div>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.04em' }}>{d.label}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0fdf4', borderRadius: '10px', padding: '0.85rem 1rem' }}>
              <span style={{ fontWeight: 700, color: '#16a34a', fontSize: '0.9rem' }}>📉 42% lower emissions than regional benchmark</span>
              <button onClick={() => navigate('/login')} style={{ padding: '0.4rem 1rem', background: '#0d3319', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit' }}>Download Report ↗</button>
            </div>
          </div>

          {/* Trust Certifications */}
          <div style={{ background: '#fff', borderRadius: '20px', padding: '2rem', border: '1px solid #e5e7eb', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontWeight: 900, fontSize: '1.2rem', color: '#0d3319', marginBottom: '1.5rem' }}>Trust Certifications</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { icon: '🌿', title: 'Organic Certified', sub: 'Verified by India Organic', score: '98/100' },
                { icon: '⭐', title: 'Fair Trade Certified', sub: 'FT-9842-F', score: '95/100' },
                { icon: '🔗', title: 'Blockchain Verified', sub: 'Txn: 0x3a8b…f7c2', score: '100/100' },
              ].map(c => (
                <div key={c.title} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem', background: '#f8fdf8', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                  <span style={{ fontSize: '1.5rem' }}>{c.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{c.title}</div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{c.sub}</div>
                  </div>
                  <span style={{ fontWeight: 900, color: '#16a34a', fontSize: '0.85rem' }}>{c.score}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.5rem' }}>Powered by</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                {['AGMARKNET', 'NABARD', 'APEDA'].map(b => (
                  <span key={b} style={{ padding: '0.25rem 0.6rem', background: '#f3f4f6', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, color: '#6b7280' }}>{b}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── GOVT SCHEMES ── */}
      <Section id="schemes" style={{ padding: '5rem 2rem', background: '#fff' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <span style={{ background: '#fef9c3', color: '#854d0e', padding: '0.3rem 1rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Government Scheme Integration</span>
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, color: '#0d3319', marginTop: '0.75rem', letterSpacing: '-0.02em' }}>Unlock Every Government Benefit</h2>
            <p style={{ color: '#64748b', fontSize: '1.05rem', marginTop: '0.5rem', maxWidth: '520px', margin: '0.75rem auto 0' }}>
              FarmTrace automatically checks your eligibility for PM-KISAN, PMFBY, KCC and 8+ schemes.
            </p>
          </div>

          {/* Eligibility Banner */}
          <div style={{ background: 'linear-gradient(135deg, #0d3319, #16a34a)', borderRadius: '20px', padding: '2rem 2.5rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>For this batch — Batch #FT-9842-AG</div>
              <div style={{ color: '#fff', fontWeight: 900, fontSize: '1.2rem' }}>Eligible for 2026 Sustainable Agriculture Subsidy</div>
              <div style={{ color: '#86efac', fontSize: '0.9rem', marginTop: '0.3rem' }}>+ Clean Energy Logistics Rebate · 3 schemes applicable</div>
            </div>
            <button onClick={() => navigate('/login')} style={{ padding: '0.75rem 1.75rem', background: '#fff', color: '#0d3319', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              Check My Eligibility →
            </button>
          </div>

          {/* Scheme Cards */}
          <div className="lp-schemes-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem' }}>
            {GOVT_SCHEMES_TEASER.map(s => (
              <div key={s.title} style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', border: '1.5px solid #e5e7eb', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', transition: 'all 0.2s' }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.08)'; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.04)'; }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{s.icon}</div>
                <div style={{ display: 'inline-block', background: '#f0fdf4', color: '#16a34a', padding: '0.15rem 0.6rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, marginBottom: '0.75rem' }}>{s.tag}</div>
                <h3 style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0d3319', marginBottom: '0.4rem' }}>{s.title}</h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>{s.benefit}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── CTA BANNER ── */}
      <Section style={{ padding: '5rem 2rem', background: 'linear-gradient(135deg, #0d3319 0%, #065f46 100%)' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌾</div>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 900, color: '#fff', marginBottom: '1rem', letterSpacing: '-0.02em' }}>
            Join 12,000+ Farmers on FarmTrace
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '1.05rem', lineHeight: 1.6, marginBottom: '2rem' }}>
            Register your produce, access live mandi prices, apply for government schemes, and track your supply chain — all in one platform.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/login')} style={{ padding: '0.95rem 2.5rem', background: '#fff', color: '#0d3319', border: 'none', borderRadius: '999px', fontWeight: 900, fontSize: '1.05rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}
              onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.04)'; }}
              onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
              Start Free — No Credit Card
            </button>
            <button onClick={() => smoothScroll('#supply-chain')} style={{ padding: '0.95rem 2.5rem', background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,0.4)', borderRadius: '999px', fontWeight: 700, fontSize: '1.05rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              See How It Works ↓
            </button>
          </div>
        </div>
      </Section>

      {/* ── FOOTER ── */}
      <footer id="contact" style={{ background: '#0d3319', color: 'rgba(255,255,255,0.7)', padding: '3rem 2rem 2rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div className="lp-footer-grid" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: '3rem', marginBottom: '2.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #16a34a, #4ade80)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>🌾</div>
                <span style={{ fontWeight: 900, fontSize: '1.15rem', color: '#fff' }}>FARMTRACE</span>
              </div>
              <p style={{ fontSize: '0.85rem', lineHeight: 1.6, maxWidth: '240px' }}>Cultivating Transparency through Digital Craftsmanship. India's blockchain-powered agri supply chain platform.</p>
            </div>
            {[
              { title: 'Platform', links: ['Supply Chain', 'Live Auctions', 'Quality Grading', 'Warehouse WMS', 'Agri Credit'] },
              { title: 'Compliance', links: ['Government Schemes', 'GST / e-Invoice', 'KYC Verification', 'Privacy Policy', 'Data Governance'] },
              { title: 'Resources', links: ['Impact Report', 'Mandi Prices', 'Market Advisory', 'Dispute Portal', 'Contact Us'] },
            ].map(col => (
              <div key={col.title}>
                <div style={{ fontWeight: 800, color: '#fff', marginBottom: '1rem', fontSize: '0.9rem' }}>{col.title}</div>
                {col.links.map(link => (
                  <div key={link} style={{ marginBottom: '0.5rem' }}>
                    <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit', padding: 0, transition: 'color 0.2s' }}
                      onMouseOver={e => { e.currentTarget.style.color = '#86efac'; }}
                      onMouseOut={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}>
                      {link}
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="lp-footer-bottom" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <span style={{ fontSize: '0.82rem' }}>© {new Date().getFullYear()} FarmTrace. Cultivating Transparency through Digital Craftsmanship.</span>
            <div className="lp-footer-partners" style={{ display: 'flex', gap: '1.5rem', fontSize: '0.82rem' }}>
              {['Ministry of Agriculture', 'AGMARKNET', 'NABARD', 'eNAM'].map(p => (
                <span key={p} style={{ opacity: 0.5 }}>{p}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
        @keyframes scrollLine {
          0% { opacity: 0; transform: scaleY(0); transform-origin: top; }
          50% { opacity: 1; transform: scaleY(1); transform-origin: top; }
          100% { opacity: 0; transform: scaleY(1); transform-origin: bottom; }
        }

        /* ── Mobile Nav ── */
        @media (max-width: 768px) {
          .lp-nav-links { display: none !important; }
          .lp-search-form { display: none !important; }
          .lp-hamburger { display: flex !important; align-items: center; justify-content: center; font-size: 1.4rem; }
        }

        /* ── Stats Bar ── */
        @media (max-width: 640px) {
          .lp-stats-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 0 !important; }
          .lp-stats-grid > div { border-right: none !important; border-bottom: 1px solid rgba(255,255,255,0.1); padding: 0.85rem !important; }
        }

        /* ── Supply Chain steps ── */
        @media (max-width: 640px) {
          .lp-supply-steps { grid-template-columns: repeat(2, 1fr) !important; gap: 2rem !important; }
          .lp-journey-detail { grid-template-columns: 1fr !important; }
        }

        /* ── Carbon footprint row ── */
        @media (max-width: 768px) {
          .lp-carbon-row { grid-template-columns: 1fr !important; }
        }

        /* ── Footer ── */
        @media (max-width: 768px) {
          .lp-footer-grid { grid-template-columns: 1fr 1fr !important; gap: 2rem !important; }
        }
        @media (max-width: 480px) {
          .lp-footer-grid { grid-template-columns: 1fr !important; }
          .lp-footer-bottom { flex-direction: column !important; gap: 0.75rem !important; text-align: center; }
          .lp-footer-partners { flex-wrap: wrap !important; justify-content: center !important; }
        }

        /* ── Govt Schemes ── */
        @media (max-width: 640px) {
          .lp-schemes-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 400px) {
          .lp-schemes-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
