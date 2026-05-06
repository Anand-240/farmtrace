import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Camera, Microscope, AlertTriangle, CheckCircle, Loader, RefreshCw } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const SEVERITY_CONFIG = {
  high:    { color: '#C62828', bg: '#FFEBEE', badge: '🔴 Gambhir', border: '#EF9A9A' },
  medium:  { color: '#E65100', bg: '#FFF3E0', badge: '🟡 Madhyam', border: '#FFCC80' },
  low:     { color: '#2E7D32', bg: '#E8F5E9', badge: '🟢 Halki',   border: '#A5D6A7' },
  none:    { color: '#1565C0', bg: '#E3F2FD', badge: '✅ Swasth',  border: '#90CAF9' },
  unknown: { color: '#555',    bg: '#F5F5F5', badge: '⚪ Anjaan',  border: '#E0E0E0' },
};

export default function CropDisease() {
  const navigate = useNavigate();
  const fileRef = useRef();
  const cameraRef = useRef();

  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [retryIn, setRetryIn] = useState(0);

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResults(null);
  };

  const handleDetect = async () => {
    if (!file) { toast.error('Pehle photo upload karo'); return; }
    setLoading(true);
    setResults(null);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await api.post('/crop-disease/detect', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000
      });
      setResults(res.data);
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 503) {
        const wait = data?.estimatedTime || 20;
        toast.error(`Model load ho raha hai — ${wait}s mein dobara try karo`);
        let t = wait;
        setRetryIn(t);
        const interval = setInterval(() => {
          t -= 1;
          setRetryIn(t);
          if (t <= 0) clearInterval(interval);
        }, 1000);
      } else {
        toast.error(data?.message || 'Detection fail hua');
      }
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setPreview(null); setFile(null); setResults(null); setRetryIn(0); };

  return (
    <div className="ft-page" style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#E8F5E9,#F9FBE7)', paddingBottom: '3rem' }}>

      {/* Nav */}
      <nav className="ft-top-nav glass">
        <div className="ft-container nav-flex">
          <button className="ft-btn ft-btn-ghost ft-btn-sm" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={18} /> Dashboard
          </button>
          <span className="nav-title" style={{ fontWeight: 900 }}>🌿 Fasal Bimari Scanner</span>
          <div style={{ width: 80 }} />
        </div>
      </nav>

      <div className="ft-container" style={{ paddingTop: '5rem', maxWidth: 640, margin: '0 auto' }}>

        {/* Header */}
        <div className="ft-card" style={{ background: 'linear-gradient(135deg,#1B5E20,#2E7D32)', color: '#fff', border: 'none', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Microscope size={40} />
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>AI Bimari Detection</h2>
              <p style={{ margin: '0.25rem 0 0', opacity: 0.85, fontSize: '0.9rem' }}>
                Fasal ki photo lo — YOLOv8 AI bimari pakad lega
              </p>
            </div>
          </div>
        </div>

        {/* Upload Area */}
        {!preview ? (
          <div className="ft-card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1.25rem', fontWeight: 900 }}>📸 Fasal ki Photo Lo</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

              {/* Camera */}
              <input type="file" accept="image/*" capture="environment" ref={cameraRef}
                onChange={e => handleFile(e.target.files[0])} style={{ display: 'none' }} />
              <button
                onClick={() => cameraRef.current.click()}
                style={{
                  padding: '1.75rem 1rem', borderRadius: 16, border: '2px dashed #A5D6A7',
                  background: '#F1F8E9', cursor: 'pointer', display: 'flex',
                  flexDirection: 'column', alignItems: 'center', gap: '0.75rem'
                }}
              >
                <Camera size={32} color="#2E7D32" />
                <span style={{ fontWeight: 700, color: '#2E7D32', fontSize: '0.95rem' }}>Camera se lo</span>
                <span style={{ fontSize: '0.78rem', color: '#888' }}>Seedha photo khicho</span>
              </button>

              {/* Upload */}
              <input type="file" accept="image/*" ref={fileRef}
                onChange={e => handleFile(e.target.files[0])} style={{ display: 'none' }} />
              <button
                onClick={() => fileRef.current.click()}
                style={{
                  padding: '1.75rem 1rem', borderRadius: 16, border: '2px dashed #C8E6C9',
                  background: '#F9FBE7', cursor: 'pointer', display: 'flex',
                  flexDirection: 'column', alignItems: 'center', gap: '0.75rem'
                }}
              >
                <Upload size={32} color="#558B2F" />
                <span style={{ fontWeight: 700, color: '#558B2F', fontSize: '0.95rem' }}>Gallery se upload</span>
                <span style={{ fontSize: '0.78rem', color: '#888' }}>Photo choose karo</span>
              </button>
            </div>

            <div style={{ marginTop: '1.25rem', background: '#E3F2FD', borderRadius: 12, padding: '0.875rem 1rem', display: 'flex', gap: '0.6rem' }}>
              <span style={{ fontSize: '1rem' }}>💡</span>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#1565C0', lineHeight: 1.5 }}>
                Clear photo lo — patte ya tana clearly visible hona chahiye. Achhi roshni mein photo lete hain to best result aata hai.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Preview + Detect */}
            <div className="ft-card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontWeight: 900 }}>📷 Uploaded Photo</h3>
                <button onClick={reset} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>
                  <RefreshCw size={14} /> Nayi Photo
                </button>
              </div>
              <img src={preview} alt="crop" style={{ width: '100%', borderRadius: 12, maxHeight: 320, objectFit: 'cover' }} />

              {retryIn > 0 ? (
                <div style={{ marginTop: '1rem', background: '#FFF3E0', border: '1px solid #FFCC80', borderRadius: 10, padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700, color: '#E65100' }}>
                  ⏳ Model warm ho raha hai... {retryIn}s baad try karo
                </div>
              ) : (
                <button
                  onClick={handleDetect}
                  disabled={loading}
                  className="ft-btn ft-btn-primary ft-btn-full"
                  style={{ marginTop: '1rem', height: 52, fontSize: '1rem', fontWeight: 800 }}
                >
                  {loading
                    ? <><div className="ft-spinner" style={{ margin: '0 auto' }} /> Scanning...</>
                    : '🔬 Bimari Scan Karo'}
                </button>
              )}
            </div>

            {/* Results */}
            {loading && (
              <div className="ft-card" style={{ textAlign: 'center', padding: '3rem' }}>
                <Loader size={40} color="#2E7D32" style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                <p style={{ marginTop: '1rem', color: '#555', fontWeight: 600 }}>AI model analyze kar raha hai...</p>
                <p style={{ fontSize: '0.85rem', color: '#888' }}>10-30 seconds lag sakte hain</p>
              </div>
            )}

            {results && !loading && (
              <div>
                {/* Summary */}
                <div className="ft-card" style={{ marginBottom: '1rem', background: results.detections.length === 0 ? '#E8F5E9' : '#FFF8E1', border: `1.5px solid ${results.detections.length === 0 ? '#A5D6A7' : '#FFD54F'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {results.detections.length === 0
                      ? <CheckCircle size={24} color="#2E7D32" />
                      : <AlertTriangle size={24} color="#E65100" />}
                    <div>
                      <p style={{ margin: 0, fontWeight: 800, fontSize: '1rem', color: results.detections.length === 0 ? '#2E7D32' : '#E65100' }}>
                        {results.summary}
                      </p>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#666' }}>
                        {results.detections.length} bimari{results.detections.length !== 1 ? 'yan' : ''} mili
                      </p>
                    </div>
                  </div>
                </div>

                {/* Detection Cards */}
                {results.detections.map((d, i) => {
                  const cfg = SEVERITY_CONFIG[d.severity] || SEVERITY_CONFIG.unknown;
                  return (
                    <div key={i} className="ft-card" style={{ marginBottom: '1rem', border: `1.5px solid ${cfg.border}`, background: '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                        <div>
                          <span style={{ fontWeight: 900, fontSize: '1.1rem', color: cfg.color }}>{d.disease}</span>
                          <div style={{ fontSize: '0.78rem', color: '#888', marginTop: '0.2rem' }}>
                            Confidence: <strong>{d.confidence}%</strong>
                          </div>
                        </div>
                        <span style={{
                          padding: '0.25rem 0.75rem', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700,
                          background: cfg.bg, color: cfg.color
                        }}>{cfg.badge}</span>
                      </div>

                      {/* Confidence bar */}
                      <div style={{ height: 6, background: '#eee', borderRadius: 3, marginBottom: '1rem', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${d.confidence}%`, background: cfg.color, borderRadius: 3, transition: 'width 0.5s' }} />
                      </div>

                      <div style={{ background: cfg.bg, borderRadius: 10, padding: '0.75rem 1rem' }}>
                        <p style={{ margin: '0 0 0.3rem', fontWeight: 800, fontSize: '0.82rem', color: cfg.color }}>
                          🌿 Ilaj / Upay:
                        </p>
                        <p style={{ margin: 0, fontSize: '0.88rem', color: '#333', lineHeight: 1.6 }}>{d.remedy}</p>
                      </div>
                    </div>
                  );
                })}

                <button onClick={reset} className="ft-btn ft-btn-ghost ft-btn-full" style={{ marginTop: '0.5rem' }}>
                  <RefreshCw size={16} /> Dobara Scan Karo
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
