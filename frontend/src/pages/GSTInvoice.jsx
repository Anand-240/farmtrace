import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Plus, X, Printer, CheckCircle2 } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const GST_RATES = [0, 5, 12, 18, 28];
const UNITS = ['Kg', 'Quintal', 'Metric Ton', 'Piece', 'Dozen'];
const STATUS_COLORS = { DRAFT: '#6b7280', ISSUED: '#3b82f6', PAID: '#16a34a', CANCELLED: '#dc2626' };

function InvoicePreview({ invoice, onClose }) {
  const printInvoice = () => window.print();

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ margin: 0, fontWeight: 900 }}>Invoice Preview</h2>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={printInvoice} style={{ padding: '0.5rem 1rem', border: '1.5px solid var(--ft-border)', borderRadius: '8px', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}><Printer size={16} /> Print</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={22} /></button>
          </div>
        </div>

        <div id="invoice-print" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '2px solid var(--ft-forest)', paddingBottom: '1rem' }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: '1.5rem', color: 'var(--ft-forest)' }}>🌾 FarmTrace</div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: '0.25rem' }}>TAX INVOICE</div>
              <div style={{ fontSize: '0.85rem', color: '#555' }}>No: {invoice.invoiceNo}</div>
              <div style={{ fontSize: '0.85rem', color: '#555' }}>Date: {new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ padding: '0.3rem 0.75rem', borderRadius: '8px', background: `${STATUS_COLORS[invoice.status]}15`, color: STATUS_COLORS[invoice.status], fontWeight: 800, fontSize: '0.85rem' }}>{invoice.status}</span>
              {invoice.isInterState && <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#d97706', fontWeight: 600 }}>Inter-State Supply (IGST)</div>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '1.5rem' }}>
            {[{ title: 'Seller (From)', name: invoice.sellerName, gstin: invoice.sellerGstin, address: invoice.sellerAddress, state: invoice.sellerState }, { title: 'Buyer (To)', name: invoice.buyerName, gstin: invoice.buyerGstin, address: invoice.buyerAddress, state: invoice.buyerState }].map((p, i) => (
              <div key={i} style={{ background: '#f8fdf8', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--ft-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{p.title}</div>
                <div style={{ fontWeight: 800, fontSize: '1rem' }}>{p.name}</div>
                {p.gstin && <div style={{ fontSize: '0.85rem', color: '#555' }}>GSTIN: {p.gstin}</div>}
                {p.address && <div style={{ fontSize: '0.85rem', color: '#555' }}>{p.address}</div>}
                {p.state && <div style={{ fontSize: '0.85rem', color: '#555' }}>State: {p.state}</div>}
              </div>
            ))}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--ft-forest)', color: '#fff' }}>
                {['Description', 'HSN', 'Qty', 'Unit', 'Rate', 'Amount', 'GST%', invoice.isInterState ? 'IGST' : 'CGST+SGST', 'Total'].map(h => (
                  <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems?.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  {[item.description, item.hsnCode || '—', item.quantity, item.unit, `₹${item.rate?.toFixed(2)}`, `₹${item.amount?.toFixed(2)}`, `${item.gstRate}%`, invoice.isInterState ? `₹${item.igst?.toFixed(2)}` : `₹${item.cgst?.toFixed(2)} + ₹${item.sgst?.toFixed(2)}`, `₹${item.totalAmount?.toFixed(2)}`].map((v, j) => (
                    <td key={j} style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ minWidth: '280px' }}>
              {[{ label: 'Subtotal', value: invoice.subtotal }, invoice.isInterState ? { label: 'IGST', value: invoice.totalIgst } : null, !invoice.isInterState ? { label: 'CGST', value: invoice.totalCgst } : null, !invoice.isInterState ? { label: 'SGST', value: invoice.totalSgst } : null].filter(Boolean).map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', fontSize: '0.9rem', borderBottom: '1px solid #f0f0f0' }}>
                  <span style={{ color: '#555' }}>{r.label}</span>
                  <span style={{ fontWeight: 600 }}>₹{r.value?.toFixed(2)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderTop: '2px solid var(--ft-forest)', marginTop: '0.25rem' }}>
                <span style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--ft-forest)' }}>Grand Total</span>
                <span style={{ fontWeight: 900, fontSize: '1.25rem', color: 'var(--ft-forest)' }}>₹{invoice.grandTotal?.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {invoice.notes && <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f8f8f8', borderRadius: '8px', fontSize: '0.85rem', color: '#555' }}>Notes: {invoice.notes}</div>}
        </div>
      </div>
    </div>
  );
}

function CreateInvoiceModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    buyerName: '', buyerGstin: '', buyerAddress: '', buyerState: '',
    sellerGstin: '', sellerAddress: '', sellerState: '',
    notes: '', dueDate: ''
  });
  const [lineItems, setLineItems] = useState([{ description: '', hsnCode: '0801', quantity: 1, unit: 'Kg', rate: 0, gstRate: 5 }]);
  const [saving, setSaving] = useState(false);

  const addLine = () => setLineItems(prev => [...prev, { description: '', hsnCode: '', quantity: 1, unit: 'Kg', rate: 0, gstRate: 5 }]);
  const removeLine = (i) => setLineItems(prev => prev.filter((_, idx) => idx !== i));
  const updateLine = (i, field, value) => setLineItems(prev => { const n = [...prev]; n[i] = { ...n[i], [field]: value }; return n; });

  const isInterState = form.sellerState && form.buyerState && form.sellerState.toLowerCase() !== form.buyerState.toLowerCase();

  const computedItems = lineItems.map(item => {
    const amount = item.quantity * item.rate;
    const taxAmt = (amount * item.gstRate) / 100;
    return { ...item, amount, totalAmount: amount + taxAmt, cgst: isInterState ? 0 : taxAmt / 2, sgst: isInterState ? 0 : taxAmt / 2, igst: isInterState ? taxAmt : 0 };
  });

  const subtotal = computedItems.reduce((s, i) => s + i.amount, 0);
  const totalTax = computedItems.reduce((s, i) => s + (i.cgst + i.sgst + i.igst), 0);
  const grandTotal = subtotal + totalTax;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.buyerName) return toast.error('Buyer name required');
    if (lineItems.some(l => !l.description || !l.rate)) return toast.error('All line items fill karein');
    setSaving(true);
    try {
      await api.post('/invoice', { ...form, lineItems });
      toast.success('Invoice generate ho gaya!');
      onCreated(); onClose();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: '20px', padding: '2rem', width: '100%', maxWidth: '700px', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontWeight: 900, color: 'var(--ft-forest)' }}>Create GST Invoice</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={22} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ background: '#f8fdf8', borderRadius: '12px', padding: '1rem' }}>
              <div style={{ fontWeight: 800, color: 'var(--ft-forest)', marginBottom: '0.75rem', fontSize: '0.9rem', textTransform: 'uppercase' }}>Seller (You)</div>
              {[{ label: 'GSTIN', key: 'sellerGstin', placeholder: '22AAAAA0000A1Z5' }, { label: 'Address', key: 'sellerAddress', placeholder: 'Your full address' }, { label: 'State', key: 'sellerState', placeholder: 'e.g. Punjab' }].map(f => (
                <div key={f.key} style={{ marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ft-text-muted)' }}>{f.label}</label>
                  <input type="text" placeholder={f.placeholder} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1.5px solid var(--ft-border)', marginTop: '0.2rem', fontSize: '0.88rem', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ background: '#fff5f5', borderRadius: '12px', padding: '1rem' }}>
              <div style={{ fontWeight: 800, color: '#dc2626', marginBottom: '0.75rem', fontSize: '0.9rem', textTransform: 'uppercase' }}>Buyer *</div>
              {[{ label: 'Buyer Name *', key: 'buyerName', placeholder: 'Full name / Company' }, { label: 'GSTIN', key: 'buyerGstin', placeholder: 'Buyer GSTIN (optional)' }, { label: 'Address', key: 'buyerAddress', placeholder: 'Buyer address' }, { label: 'State', key: 'buyerState', placeholder: 'e.g. Maharashtra' }].map(f => (
                <div key={f.key} style={{ marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ft-text-muted)' }}>{f.label}</label>
                  <input type="text" placeholder={f.placeholder} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1.5px solid var(--ft-border)', marginTop: '0.2rem', fontSize: '0.88rem', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>
          </div>

          {isInterState && <div style={{ background: '#fef3c7', borderRadius: '10px', padding: '0.75rem 1rem', color: '#d97706', fontWeight: 600, fontSize: '0.88rem' }}>⚠️ Inter-State supply detected — IGST will be applied instead of CGST+SGST</div>}

          {/* Line Items */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 800, color: 'var(--ft-forest)' }}>Line Items</div>
              <button type="button" onClick={addLine} style={{ padding: '0.35rem 0.85rem', borderRadius: '8px', border: '1.5px solid var(--ft-forest)', background: '#fff', color: 'var(--ft-forest)', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Plus size={14} /> Add Line</button>
            </div>
            {lineItems.map((item, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.8fr 0.8fr 1fr 0.8fr auto', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                <input placeholder="Description *" value={item.description} onChange={e => updateLine(i, 'description', e.target.value)} style={{ padding: '0.55rem', borderRadius: '8px', border: '1.5px solid var(--ft-border)', fontSize: '0.85rem' }} required />
                <input type="number" placeholder="Qty" value={item.quantity} onChange={e => updateLine(i, 'quantity', Number(e.target.value))} style={{ padding: '0.55rem', borderRadius: '8px', border: '1.5px solid var(--ft-border)', fontSize: '0.85rem' }} />
                <select value={item.unit} onChange={e => updateLine(i, 'unit', e.target.value)} style={{ padding: '0.55rem', borderRadius: '8px', border: '1.5px solid var(--ft-border)', fontSize: '0.82rem' }}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
                <input type="number" placeholder="Rate ₹" value={item.rate} onChange={e => updateLine(i, 'rate', Number(e.target.value))} style={{ padding: '0.55rem', borderRadius: '8px', border: '1.5px solid var(--ft-border)', fontSize: '0.85rem' }} />
                <select value={item.gstRate} onChange={e => updateLine(i, 'gstRate', Number(e.target.value))} style={{ padding: '0.55rem', borderRadius: '8px', border: '1.5px solid var(--ft-border)', fontSize: '0.82rem' }}>
                  {GST_RATES.map(r => <option key={r} value={r}>GST {r}%</option>)}
                </select>
                <div style={{ padding: '0.55rem', fontWeight: 800, color: 'var(--ft-forest)', fontSize: '0.85rem', textAlign: 'right' }}>₹{(item.quantity * item.rate * (1 + item.gstRate / 100)).toFixed(0)}</div>
                {lineItems.length > 1 && <button type="button" onClick={() => removeLine(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}><X size={18} /></button>}
              </div>
            ))}
          </div>

          {/* Totals */}
          <div style={{ background: '#f8fdf8', borderRadius: '12px', padding: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ minWidth: '240px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', fontSize: '0.9rem' }}><span style={{ color: '#555' }}>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', fontSize: '0.9rem' }}><span style={{ color: '#555' }}>Tax</span><span>₹{totalTax.toFixed(2)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderTop: '2px solid var(--ft-forest)', marginTop: '0.25rem', fontWeight: 900, fontSize: '1.1rem', color: 'var(--ft-forest)' }}><span>Grand Total</span><span>₹{grandTotal.toFixed(2)}</span></div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ft-text-muted)' }}>Due Date</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1.5px solid var(--ft-border)', marginTop: '0.35rem', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ft-text-muted)' }}>Notes</label>
              <input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Payment terms etc." style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1.5px solid var(--ft-border)', marginTop: '0.35rem', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>
          </div>

          <button type="submit" disabled={saving} style={{ padding: '0.9rem', background: 'var(--ft-forest)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '1rem', cursor: 'pointer' }}>
            {saving ? 'Generating...' : 'Generate Invoice'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function GSTInvoice() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [preview, setPreview] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/invoice/my'); setInvoices(r.data.invoices || []); } catch { toast.error('Load failed'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const markPaid = async (id) => {
    try { await api.patch(`/invoice/${id}/status`, { status: 'PAID' }); toast.success('Invoice marked as paid!'); load(); } catch { toast.error('Error'); }
  };

  return (
    <div className="ft-page planetono-flow">
      {showCreate && <CreateInvoiceModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {preview && <InvoicePreview invoice={preview} onClose={() => setPreview(null)} />}

      <nav className="ft-top-nav glass" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="ft-container nav-flex">
          <button onClick={() => navigate('/dashboard')} className="ft-btn ft-btn-ghost ft-btn-sm"><ArrowLeft size={18} /> Dashboard</button>
          <span className="nav-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FileText size={20} /> GST Invoice</span>
          <button onClick={() => setShowCreate(true)} className="ft-btn ft-btn-sm" style={{ background: 'var(--ft-forest)', color: '#fff', border: 'none' }}><Plus size={16} /> New</button>
        </div>
      </nav>

      <div className="ft-container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--ft-forest)' }}>GST / e-Invoice</h1>
          <p style={{ color: 'var(--ft-text-muted)' }}>Auto GST calculation · CGST/SGST/IGST · Print-ready invoices</p>
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: '3rem' }}><div className="ft-spinner" style={{ margin: '0 auto' }} /></div> : invoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', background: '#fff', borderRadius: '16px', border: '1px solid var(--ft-border)' }}>
            <p style={{ fontSize: '3rem' }}>🧾</p>
            <p style={{ fontWeight: 700, color: 'var(--ft-text-muted)', marginBottom: '1rem' }}>Koi invoice nahi hai abhi</p>
            <button onClick={() => setShowCreate(true)} style={{ padding: '0.75rem 2rem', background: 'var(--ft-forest)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>Create First Invoice</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {invoices.map(inv => (
              <div key={inv._id} style={{ background: '#fff', borderRadius: '14px', padding: '1.5rem', border: '1px solid var(--ft-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--ft-forest)', fontSize: '0.95rem' }}>{inv.invoiceNo}</span>
                    <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', background: `${STATUS_COLORS[inv.status]}15`, color: STATUS_COLORS[inv.status], fontWeight: 700, fontSize: '0.75rem' }}>{inv.status}</span>
                    {inv.isInterState && <span style={{ padding: '0.2rem 0.6rem', borderRadius: '6px', background: '#fef3c7', color: '#d97706', fontWeight: 700, fontSize: '0.72rem' }}>IGST</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.88rem' }}>
                    <span>To: <strong>{inv.buyerName}</strong></span>
                    {inv.buyerGstin && <span>GSTIN: <strong>{inv.buyerGstin}</strong></span>}
                    <span>Date: <strong>{new Date(inv.invoiceDate).toLocaleDateString('hi-IN')}</strong></span>
                    {inv.dueDate && <span>Due: <strong style={{ color: new Date(inv.dueDate) < new Date() && inv.status !== 'PAID' ? '#dc2626' : 'inherit' }}>{new Date(inv.dueDate).toLocaleDateString('hi-IN')}</strong></span>}
                  </div>
                  {inv.notes && <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#555' }}>{inv.notes}</p>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 900, fontSize: '1.4rem', color: 'var(--ft-forest)' }}>₹{inv.grandTotal?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--ft-text-muted)' }}>incl. ₹{inv.totalTax?.toFixed(2)} tax</div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
                    <button onClick={() => setPreview(inv)} style={{ padding: '0.5rem 1rem', border: '1.5px solid var(--ft-forest)', color: 'var(--ft-forest)', background: '#fff', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Printer size={14} /> View</button>
                    {inv.status === 'ISSUED' && <button onClick={() => markPaid(inv._id)} style={{ padding: '0.5rem 1rem', border: 'none', color: '#fff', background: '#16a34a', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><CheckCircle2 size={14} /> Paid</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
