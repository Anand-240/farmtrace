import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Lightbulb, Send, Bot } from 'lucide-react';
import api from '../lib/api';

const SEASONAL_ADVICE = {
  Kharif: { months: [6, 7, 8, 9, 10], crops: ['Rice', 'Cotton', 'Soybean', 'Maize', 'Groundnut', 'Jowar', 'Bajra'], tip: 'Kharif season (Jun-Oct): Rainfall-based crops. Check PMFBY insurance before sowing.' },
  Rabi: { months: [11, 12, 1, 2, 3], crops: ['Wheat', 'Mustard', 'Gram', 'Lentil', 'Barley', 'Peas'], tip: 'Rabi season (Nov-Mar): Winter crops. MSP support available. Early sowing recommended.' },
  Zaid: { months: [4, 5], crops: ['Vegetables', 'Watermelon', 'Muskmelon', 'Cucumber', 'Bitter Gourd'], tip: 'Zaid season (Apr-May): Short-duration summer crops. High demand, quick returns.' }
};

const DEMAND_FORECASTS = [
  { crop: 'Wheat', trend: 'up', reason: 'Global supply constraints & higher MSP announced for next season', confidence: 85, priceRange: '₹2,200–2,400/qtl' },
  { crop: 'Onion', trend: 'volatile', reason: 'Seasonal harvest incoming — prices expected to dip before rising again', confidence: 72, priceRange: '₹800–1,600/qtl' },
  { crop: 'Tomato', trend: 'up', reason: 'Off-season demand spike + export opportunities', confidence: 78, priceRange: '₹1,200–2,800/qtl' },
  { crop: 'Cotton', trend: 'stable', reason: 'Textile sector demand stable; MSP ensures floor support', confidence: 80, priceRange: '₹6,500–7,000/qtl' },
  { crop: 'Soybean', trend: 'up', reason: 'Biofuel demand & edible oil import costs driving prices higher', confidence: 75, priceRange: '₹3,800–4,200/qtl' },
  { crop: 'Potato', trend: 'down', reason: 'Large arrivals from UP & Bihar expected to push prices down', confidence: 70, priceRange: '₹600–900/qtl' }
];

const currentMonth = new Date().getMonth() + 1;
const currentSeason = Object.entries(SEASONAL_ADVICE).find(([, s]) => s.months.includes(currentMonth))?.[0] || 'Rabi';

function AdvisoryChat() {
  const [messages, setMessages] = useState([{ role: 'ai', text: `Namaste! Main aapka Market Advisor hoon. Crop prices, demand forecast, best selling time, ya koi bhi agri market sawaal poochhein!` }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages(m => [...m, { role: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);
    try {
      const context = `You are an Indian agricultural market advisor for FarmTrace. Speak in simple Hinglish (Hindi + English mix). Give practical advice about crop prices, when to sell, which crops have demand, mandi rates, government schemes, and market trends. Today is ${new Date().toLocaleDateString('hi-IN')} and current season is ${currentSeason}. Keep responses concise (under 120 words).`;
      const res = await api.post('/ai/chat', { message: userMsg, context });
      setMessages(m => [...m, { role: 'ai', text: res.data.reply || res.data.message || 'Market advice de raha hoon...' }]);
    } catch {
      setMessages(m => [...m, { role: 'ai', text: 'Server se baat nahi ho paa rahi. Thodi der baad try karein.' }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--ft-border)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '480px' }}>
      <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--ft-border)', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)' }}>
        <Bot size={20} style={{ color: 'var(--ft-forest)' }} />
        <div>
          <div style={{ fontWeight: 800, color: 'var(--ft-forest)' }}>AI Market Advisor</div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>● Online — Ask about prices, demand, seasons</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '80%', background: m.role === 'user' ? 'var(--ft-forest)' : '#f0fdf4', color: m.role === 'user' ? '#fff' : '#333', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', padding: '0.75rem 1rem', fontSize: '0.9rem', lineHeight: 1.5 }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ background: '#f0fdf4', borderRadius: '14px 14px 14px 4px', padding: '0.75rem 1.25rem' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[0, 1, 2].map(i => <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--ft-forest)', animation: `bounce 1s ease ${i * 0.2}s infinite` }} />)}
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '1rem', borderTop: '1px solid var(--ft-border)', display: 'flex', gap: '0.75rem' }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !loading && send()} placeholder="Sawaal poochhein..." style={{ flex: 1, padding: '0.65rem 1rem', borderRadius: '999px', border: '1.5px solid var(--ft-border)', fontSize: '0.9rem' }} />
        <button onClick={send} disabled={loading || !input.trim()} style={{ padding: '0.65rem 1.25rem', background: 'var(--ft-forest)', color: '#fff', border: 'none', borderRadius: '999px', cursor: 'pointer' }}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

export default function MarketAdvisory() {
  const navigate = useNavigate();
  const season = SEASONAL_ADVICE[currentSeason];

  return (
    <div className="ft-page planetono-flow">
      <nav className="ft-top-nav glass" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="ft-container nav-flex">
          <button onClick={() => navigate('/dashboard')} className="ft-btn ft-btn-ghost ft-btn-sm"><ArrowLeft size={18} /> Dashboard</button>
          <span className="nav-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><TrendingUp size={20} /> Market Advisory</span>
          <div style={{ width: 80 }} />
        </div>
      </nav>

      <div className="ft-container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--ft-forest)' }}>Market Advisory</h1>
          <p style={{ color: 'var(--ft-text-muted)' }}>AI-powered demand forecasts · seasonal guidance · best time to sell</p>
        </div>

        {/* Current Season Banner */}
        <div style={{ background: 'linear-gradient(135deg, var(--ft-forest), #16a34a)', color: '#fff', borderRadius: '16px', padding: '1.5rem 2rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.85rem', opacity: 0.8, fontWeight: 600, marginBottom: '0.25rem' }}>Current Season</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '0.5rem' }}>{currentSeason} 🌱</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9, maxWidth: '500px', lineHeight: 1.5 }}>{season.tip}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.5rem', fontWeight: 600 }}>Best Crops This Season</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {season.crops.map(c => <span key={c} style={{ background: 'rgba(255,255,255,0.2)', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.82rem', fontWeight: 600 }}>{c}</span>)}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Demand Forecasts */}
          <div>
            <h2 style={{ fontWeight: 900, color: 'var(--ft-forest)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lightbulb size={20} /> Demand Forecasts
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {DEMAND_FORECASTS.map(f => (
                <div key={f.crop} style={{ background: '#fff', borderRadius: '14px', padding: '1.25rem', border: '1px solid var(--ft-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{f.crop}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.2rem' }}>{f.trend === 'up' ? '📈' : f.trend === 'down' ? '📉' : '📊'}</span>
                      <span style={{ fontWeight: 900, color: f.trend === 'up' ? '#16a34a' : f.trend === 'down' ? '#dc2626' : '#d97706', fontSize: '0.85rem' }}>{f.trend.toUpperCase()}</span>
                    </div>
                  </div>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#555', lineHeight: 1.4 }}>{f.reason}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ft-forest)' }}>{f.priceRange}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <div style={{ width: '60px', height: '6px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ width: `${f.confidence}%`, height: '100%', background: 'var(--ft-forest)', borderRadius: '999px' }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--ft-text-muted)' }}>{f.confidence}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Chat */}
          <div>
            <h2 style={{ fontWeight: 900, color: 'var(--ft-forest)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bot size={20} /> Ask AI Advisor
            </h2>
            <AdvisoryChat />

            {/* Quick Questions */}
            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--ft-text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}>Quick Questions:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {['Wheat kab bechen?', 'Best crop this season?', 'Onion price forecast?', 'MSP kya hai 2025 mein?', 'Export ke liye kaunsi crop?'].map(q => (
                  <button key={q} style={{ padding: '0.35rem 0.85rem', borderRadius: '999px', border: '1.5px solid var(--ft-border)', background: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>{q}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
      `}</style>
    </div>
  );
}
