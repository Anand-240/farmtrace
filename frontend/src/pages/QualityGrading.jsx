import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FlaskConical, CheckCircle, Plus, X } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const GRADE_COLORS = { Premium: '#7c3aed', FAQ: '#059669', A: '#16a34a', B: '#d97706', C: '#dc2626', Rejected: '#6b7280' };
const GRADE_LABELS = { Premium: 'Premium Quality', FAQ: 'Fair Average Quality', A: 'Grade A', B: 'Grade B', C: 'Grade C', Rejected: 'Rejected' };

const STANDARD_PARAMS = [
  { name: 'Moisture Content', unit: '%', maxOk: 14 },
  { name: 'Foreign Matter', unit: '%', maxOk: 2 },
  { name: 'Damaged/Shriveled Grains', unit: '%', maxOk: 5 },
  { name: 'Purity', unit: '%', minOk: 95 },
  { name: 'Protein Content', unit: '%', minOk: 10 }
];

export default function QualityGrading() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [produces, setProduces] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    produceId: '', cropType: '', grade: 'FAQ',
    moistureContent: '', purityPercent: '', foreignMatter: '', damagedGrains: '', weight: '',
    labName: '', graderName: '', graderLicenseNo: '', remarks: '',
    parameters: STANDARD_PARAMS.map(p => ({ name: p.name, value: '', unit: p.unit, status: 'OK' }))
  });

  useEffect(() => {
    Promise.all([
      api.get('/quality/my').then(r => setReports(r.data.reports || [])).catch(() => {}),
      api.get('/produce/farmer/my').then(r => setProduces(r.data || [])).catch(() => {})
    ]).finally(() => setLoading(false));
  }, []);

  const handleProduceChange = (produceId) => {
    const p = produces.find(p => p._id === produceId);
    setForm(f => ({ ...f, produceId, cropType: p?.cropType || '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.produceId || !form.grade) return toast.error('Produce aur grade required hai');
    setSaving(true);
    try {
      const payload = {
        ...form,
        moistureContent: form.moistureContent ? Number(form.moistureContent) : undefined,
        purityPercent: form.purityPercent ? Number(form.purityPercent) : undefined,
        foreignMatter: form.foreignMatter ? Number(form.foreignMatter) : undefined,
        damagedGrains: form.damagedGrains ? Number(form.damagedGrains) : undefined,
        weight: form.weight ? Number(form.weight) : undefined,
        parameters: form.parameters.filter(p => p.value)
      };
      const res = await api.post('/quality', payload);
      setReports(prev => [res.data.report, ...prev]);
      toast.success('Quality report save ho gaya!');
      setShowForm(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    setSaving(false);
  };

  const updateParam = (i, field, value) => {
    setForm(f => {
      const params = [...f.parameters];
      params[i] = { ...params[i], [field]: value };
      return { ...f, parameters: params };
    });
  };

  if (loading) return <div className="ft-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><div className="ft-spinner" /></div>;

  return (
    <div className="ft-page planetono-flow">
      <nav className="ft-top-nav glass" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="ft-container nav-flex">
          <button onClick={() => navigate('/dashboard')} className="ft-btn ft-btn-ghost ft-btn-sm"><ArrowLeft size={18} /> Dashboard</button>
          <span className="nav-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FlaskConical size={20} /> Quality Grading</span>
          <button onClick={() => setShowForm(true)} className="ft-btn ft-btn-sm" style={{ background: 'var(--ft-forest)', color: '#fff', border: 'none' }}><Plus size={16} /> New Report</button>
        </div>
      </nav>

      <div className="ft-container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--ft-forest)' }}>Quality Assaying & Grading</h1>
          <p style={{ color: 'var(--ft-text-muted)' }}>Standardized lab reports · eNAM-compliant grading</p>
        </div>

        {/* Grade Reference */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '2.5rem' }}>
          {Object.entries(GRADE_LABELS).map(([g, label]) => (
            <div key={g} style={{ background: '#fff', border: `2px solid ${GRADE_COLORS[g]}20`, borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: GRADE_COLORS[g], display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.5rem', color: '#fff', fontWeight: 900, fontSize: '0.9rem' }}>{g[0]}</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: GRADE_COLORS[g] }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Reports */}
        {reports.length === 0 && !showForm ? (
          <div style={{ textAlign: 'center', padding: '4rem', background: '#fff', borderRadius: '16px', border: '1px solid var(--ft-border)' }}>
            <p style={{ fontSize: '3rem' }}>🔬</p>
            <p style={{ fontWeight: 700, color: 'var(--ft-text-muted)', marginBottom: '1rem' }}>Abhi tak koi quality report nahi hai</p>
            <button onClick={() => setShowForm(true)} style={{ padding: '0.75rem 2rem', background: 'var(--ft-forest)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>Create First Report</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {reports.map(r => (
              <div key={r._id} style={{ background: '#fff', borderRadius: '14px', border: `2px solid ${GRADE_COLORS[r.grade] || '#e5e7eb'}30`, padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <span style={{ background: GRADE_COLORS[r.grade], color: '#fff', padding: '0.2rem 0.75rem', borderRadius: '999px', fontWeight: 800, fontSize: '0.85rem' }}>{r.grade}</span>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>{r.cropType}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--ft-text-muted)' }}>
                    {r.moistureContent != null && <span>Moisture: <strong>{r.moistureContent}%</strong></span>}
                    {r.purityPercent != null && <span>Purity: <strong>{r.purityPercent}%</strong></span>}
                    {r.foreignMatter != null && <span>Foreign Matter: <strong>{r.foreignMatter}%</strong></span>}
                    {r.weight != null && <span>Weight: <strong>{r.weight}kg</strong></span>}
                    {r.labName && <span>Lab: <strong>{r.labName}</strong></span>}
                    {r.graderName && <span>Grader: <strong>{r.graderName}</strong></span>}
                  </div>
                  {r.remarks && <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: '#555' }}>{r.remarks}</p>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--ft-text-muted)' }}>{new Date(r.createdAt).toLocaleDateString('hi-IN')}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem', color: '#16a34a', fontWeight: 600, fontSize: '0.85rem' }}>
                    <CheckCircle size={14} /> {r.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Form Modal */}
        {showForm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ background: '#fff', borderRadius: '20px', padding: '2rem', width: '100%', maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, fontWeight: 900, color: 'var(--ft-forest)' }}>New Quality Report</h2>
                <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={22} /></button>
              </div>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ft-text-muted)' }}>Produce *</label>
                  <select value={form.produceId} onChange={e => handleProduceChange(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1.5px solid var(--ft-border)', marginTop: '0.35rem', fontSize: '0.95rem' }} required>
                    <option value="">-- Select Produce --</option>
                    {produces.map(p => <option key={p._id} value={p._id}>{p.cropType} — {p.quantity}kg</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ft-text-muted)' }}>Grade *</label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                    {Object.keys(GRADE_LABELS).map(g => (
                      <button type="button" key={g} onClick={() => setForm(f => ({ ...f, grade: g }))} style={{ padding: '0.4rem 1rem', borderRadius: '999px', border: `2px solid ${form.grade === g ? GRADE_COLORS[g] : 'var(--ft-border)'}`, background: form.grade === g ? GRADE_COLORS[g] : '#fff', color: form.grade === g ? '#fff' : 'inherit', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>{g}</button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {[{ label: 'Moisture (%)', key: 'moistureContent' }, { label: 'Purity (%)', key: 'purityPercent' }, { label: 'Foreign Matter (%)', key: 'foreignMatter' }, { label: 'Damaged Grains (%)', key: 'damagedGrains' }, { label: 'Weight (kg)', key: 'weight' }].map(f => (
                    <div key={f.key}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ft-text-muted)' }}>{f.label}</label>
                      <input type="number" step="0.1" value={form[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1.5px solid var(--ft-border)', marginTop: '0.35rem', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {[{ label: 'Lab Name', key: 'labName' }, { label: 'Grader Name', key: 'graderName' }, { label: 'License No.', key: 'graderLicenseNo' }].map(f => (
                    <div key={f.key}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ft-text-muted)' }}>{f.label}</label>
                      <input type="text" value={form[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1.5px solid var(--ft-border)', marginTop: '0.35rem', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                    </div>
                  ))}
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ft-text-muted)', display: 'block', marginBottom: '0.5rem' }}>Additional Parameters</label>
                  {form.parameters.map((p, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, width: '160px', flexShrink: 0 }}>{p.name}</span>
                      <input type="text" placeholder={`Value ${p.unit}`} value={p.value} onChange={e => updateParam(i, 'value', e.target.value)} style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1.5px solid var(--ft-border)', fontSize: '0.85rem' }} />
                      <select value={p.status} onChange={e => updateParam(i, 'status', e.target.value)} style={{ padding: '0.5rem', borderRadius: '8px', border: '1.5px solid var(--ft-border)', fontSize: '0.8rem' }}>
                        <option>OK</option><option>FAIL</option><option>MARGINAL</option>
                      </select>
                    </div>
                  ))}
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ft-text-muted)' }}>Remarks</label>
                  <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} rows={2} style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1.5px solid var(--ft-border)', marginTop: '0.35rem', fontSize: '0.95rem', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>

                <button type="submit" disabled={saving} style={{ padding: '0.9rem', background: 'var(--ft-forest)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '1rem', cursor: 'pointer' }}>
                  {saving ? 'Saving...' : 'Save Quality Report'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
