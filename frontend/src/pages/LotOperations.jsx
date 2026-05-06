import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { 
  ArrowLeft, 
  Layers, 
  Split, 
  Merge, 
  Search, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Info,
  Package,
  ArrowRight,
  X,
  RefreshCcw,
  Zap,
  Scale
} from 'lucide-react';

export default function LotOperations() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('split'); // 'split' or 'merge'
  const [myLots, setMyLots] = useState([]);
  const [loadingLots, setLoadingLots] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [operationStep, setOperationStep] = useState(1); // 1: Select, 2: Configure

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // ===== SPLIT STATE =====
  const [selectedSplitLot, setSelectedSplitLot] = useState(null);
  const [splitRows, setSplitRows] = useState([{ quantity: '', id: Date.now() }]);

  // ===== MERGE STATE =====
  const [selectedMergeLots, setSelectedMergeLots] = useState([]);

  useEffect(() => {
    fetchLots();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLots = async () => {
    setLoadingLots(true);
    try {
      const endpoint = user.role === 'FARMER' ? '/produce/farmer/my' : '/produce/received/my';
      const res = await api.get(endpoint);
      setMyLots(res.data.filter(l => l.lotStatus === 'ACTIVE'));
    } catch (err) {
      setError('Lots load karne mein dikkat aayi');
    } finally {
      setLoadingLots(false);
    }
  };

  const filteredLots = useMemo(() => {
    return myLots.filter(l => 
      l.lotCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.cropType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l._id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [myLots, searchTerm]);

  // ===== SPLIT LOGIC =====
  const handleSplitLotSelection = (lot) => {
    setSelectedSplitLot(lot);
    setOperationStep(2);
    setSplitRows([{ quantity: '', id: Date.now() }]);
  };

  const addSplitRow = () => {
    setSplitRows([...splitRows, { quantity: '', id: Date.now() }]);
  };

  const removeSplitRow = (id) => {
    if (splitRows.length > 1) {
      setSplitRows(splitRows.filter(r => r.id !== id));
    }
  };

  const updateSplitRow = (id, value) => {
    setSplitRows(splitRows.map(r => r.id === id ? { ...r, quantity: value } : r));
  };

  const totalSplitQty = useMemo(() => {
    return splitRows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  }, [splitRows]);

  const remainingQty = selectedSplitLot ? (selectedSplitLot.quantity - totalSplitQty).toFixed(2) : 0;

  const handleSplit = async () => {
    if (!selectedSplitLot) return;
    const quantities = splitRows.map(r => Number(r.quantity)).filter(q => q > 0);

    if (quantities.length < 1) {
      setError('Kam se kam ek valid quantity bharo');
      return;
    }

    if (quantities.some(q => q <= 0)) {
      setError('Saari quantities zero se zyada honi chahiye');
      return;
    }

    if (totalSplitQty >= selectedSplitLot.quantity) {
      setError(`Kul split quantity (${totalSplitQty} kg) original lot (${selectedSplitLot.quantity} kg) se kam honi chahiye — kuch remainder parent lot mein rehna chahiye`);
      return;
    }

    if (totalSplitQty > selectedSplitLot.quantity) {
      setError('Kul quantity original se zyada nahi ho sakti');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.post(`/produce/${selectedSplitLot._id}/split`, {
        splits: quantities.map(q => ({ quantity: q }))
      });
      setSuccess('Lot split ho gaya! 🎉');
      resetState();
      fetchLots();
    } catch (err) {
      setError(err.response?.data?.message || 'Split fail ho gaya');
    } finally {
      setLoading(false);
    }
  };

  // ===== MERGE LOGIC =====
  const toggleMergeSelection = (lot) => {
    const isSelected = selectedMergeLots.find(l => l._id === lot._id);
    if (isSelected) {
      setSelectedMergeLots(selectedMergeLots.filter(l => l._id !== lot._id));
    } else {
      if (selectedMergeLots.length > 0) {
        const first = selectedMergeLots[0];
        if (lot.cropType !== first.cropType || lot.qualityGrade !== first.qualityGrade) {
          setError('Sirf same Crop aur Grade wale lots merge honge');
          setTimeout(() => setError(''), 3000);
          return;
        }
      }
      setSelectedMergeLots([...selectedMergeLots, lot]);
    }
  };

  const totalMergeQty = useMemo(() => {
    return selectedMergeLots.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0).toFixed(2);
  }, [selectedMergeLots]);

  const handleMerge = async () => {
    if (selectedMergeLots.length < 2) {
      setError('Kam se kam 2 lots select karein');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.post('/produce/merge', {
        lotIds: selectedMergeLots.map(l => l._id)
      });
      setSuccess('Lots merge ho gaye! 🔗');
      resetState();
      fetchLots();
    } catch (err) {
      setError(err.response?.data?.message || 'Merge fail ho gaya');
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setSelectedSplitLot(null);
    setSelectedMergeLots([]);
    setOperationStep(1);
    setSplitRows([{ quantity: '', id: Date.now() }]);
    setSuccess('');
    setError('');
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    resetState();
  };

  return (
    <div className="ft-page lot-ops-page">
      <nav className="ft-top-nav glass">
        <div className="ft-container nav-content">
          <button onClick={() => navigate('/dashboard')} className="back-btn">
            <ArrowLeft size={20} />
            <span>Dashboard</span>
          </button>
          
          <div className="nav-title">
            <div className="icon-badge">
              <Layers size={22} className="ft-icon-gradient" />
            </div>
            <h1>Lot Management</h1>
          </div>

          <div className="header-search-global lot-mgmt-search-shift">
            <div className="global-search-box">
              <Search size={16} />
              <input 
                type="text" 
                placeholder="Trace any ID..." 
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = e.target.value.trim();
                    if (val) navigate(`/verify/${val}`);
                  }
                }}
              />
            </div>
          </div>

          <div className="nav-actions">
            <button className="refresh-btn" onClick={fetchLots} disabled={loadingLots}>
              <RefreshCcw size={18} className={loadingLots ? 'spinning' : ''} />
            </button>
          </div>
        </div>
      </nav>

      <div className="ft-container main-layout">
        <header className="ops-header animate-slide-up">
          <div className="ops-toggle-container">
            <button 
              className={`ops-toggle-btn ${activeTab === 'split' ? 'active' : ''}`}
              onClick={() => handleTabChange('split')}
            >
              <Split size={20} />
              <span>Split Produce</span>
              <div className="btn-indicator" />
            </button>
            <button 
              className={`ops-toggle-btn ${activeTab === 'merge' ? 'active' : ''}`}
              onClick={() => handleTabChange('merge')}
            >
              <Merge size={20} />
              <span>Merge Produce</span>
              <div className="btn-indicator" />
            </button>
          </div>
          
          <div className="ops-workflow-steps">
            <div className={`step-item ${operationStep === 1 ? 'active' : 'completed'}`}>
              <div className="step-num">1</div>
              <span className="step-label">Select Lots</span>
            </div>
            <div className="step-line" />
            <div className={`step-item ${operationStep === 2 ? 'active' : ''}`}>
              <div className="step-num">2</div>
              <span className="step-label">Configure & Link</span>
            </div>
          </div>
        </header>

        {error && <div className="ft-alert ft-alert-error animate-shake"><AlertCircle size={20} /> {error}</div>}
        {success && <div className="ft-alert ft-alert-success animate-bounce-in"><CheckCircle2 size={20} /> {success}</div>}

        <div className="ops-content-grid">
          {/* SECTION 1: INVENTORY SELECTOR */}
          <aside className={`inventory-panel glass ${operationStep === 2 && activeTab === 'split' ? 'hidden-mobile' : ''}`}>
            <div className="panel-header">
              <div className="search-wrapper">
                <Search size={18} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Search lots by ID or Crop..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="lot-inventory-list">
              <div className="inventory-stats">
                <span>{filteredLots.length} Active Lots Found</span>
              </div>

              {loadingLots ? (
                <div className="loading-state">
                  <div className="ft-spinner" />
                  <p>Inventory loading...</p>
                </div>
              ) : filteredLots.length === 0 ? (
                <div className="empty-state">
                  <Package size={40} />
                  <p>No active lots match your search</p>
                </div>
              ) : (
                <div className="inventory-grid">
                  {filteredLots.map(lot => {
                    const isSelected = activeTab === 'split' 
                      ? selectedSplitLot?._id === lot._id 
                      : selectedMergeLots.find(l => l._id === lot._id);
                    
                    return (
                      <div 
                        key={lot._id} 
                        className={`lot-card-mini ${isSelected ? 'selected' : ''}`}
                        onClick={() => activeTab === 'split' ? handleSplitLotSelection(lot) : toggleMergeSelection(lot)}
                      >
                        <div className="card-top">
                          <span className="lot-id">{lot.lotCode}</span>
                          <div className={`status-dot ${lot.lotStatus === 'ACTIVE' ? 'active' : ''}`} />
                        </div>
                        <div className="card-middle">
                          <h3 className="crop-name">{lot.cropType}</h3>
                          <span className="quantity">{lot.quantity} <small>kg</small></span>
                        </div>
                        <div className="card-bottom">
                          <span className="grade-badge">{lot.qualityGrade} Grade</span>
                          {activeTab === 'merge' && isSelected && <CheckCircle2 size={16} className="check-icon" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          {/* SECTION 2: WORKSPACE */}
          <main className="workspace-panel glass">
            {activeTab === 'split' ? (
              <div className="workspace-flow content-split">
                {operationStep === 1 ? (
                  <div className="empty-workspace animate-fade-in">
                    <div className="illo-wrap">
                      <div className="illo-circle"><Split size={48} /></div>
                    </div>
                    <h2>Lot Split Karein</h2>
                    <p>Apne inventory se ek lot select karein jise aap naye (chote) lots mein split karna chahte hain.</p>
                  </div>
                ) : (
                  <div className="config-workspace animate-slide-up">
                    <div className="source-lot-banner">
                      <div className="banner-info">
                        <div className="info-icon"><Package size={24} /></div>
                        <div className="info-details">
                          <label>SELECTED SOURCE</label>
                          <h3>{selectedSplitLot.lotCode} - {selectedSplitLot.cropType}</h3>
                        </div>
                      </div>
                      <div className="banner-stats">
                        <div className="stat-pill">
                          <Scale size={16} />
                          <span>{selectedSplitLot.quantity} kg</span>
                        </div>
                        <button className="change-btn" onClick={() => setOperationStep(1)}>Change</button>
                      </div>
                    </div>

                    <div className="operation-table">
                      <div className="table-header">
                        <h3>New Child Lots</h3>
                        <button className="add-btn" onClick={addSplitRow}>
                          <Plus size={18} /> Add Row
                        </button>
                      </div>

                      <div className="rows-container">
                        {splitRows.map((row, idx) => (
                          <div key={row.id} className="split-row-item animate-slide-in" style={{ animationDelay: `${idx * 0.05}s` }}>
                            <div className="row-index">{idx + 1}</div>
                            <div className="row-input">
                              <input 
                                type="number" 
                                placeholder="Quantity (kg)" 
                                value={row.quantity}
                                onChange={(e) => updateSplitRow(row.id, e.target.value)}
                              />
                              <span className="input-suffix">kg</span>
                            </div>
                            <button className="delete-row" onClick={() => removeSplitRow(row.id)} disabled={splitRows.length === 1}>
                              <Trash2 size={18} />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="split-summary-box">
                        <div className="progress-label">
                          <span>Split Distribution</span>
                          <span className={totalSplitQty >= selectedSplitLot.quantity ? 'text-error' : ''}>
                            {totalSplitQty} / {selectedSplitLot.quantity} kg
                          </span>
                        </div>
                        <div className="progress-track">
                          <div
                            className={`progress-fill ${totalSplitQty >= selectedSplitLot.quantity ? 'error' : ''}`}
                            style={{ width: `${Math.min((totalSplitQty / selectedSplitLot.quantity) * 100, 100)}%` }}
                          />
                        </div>
                        <div className="remaining-label">
                          Parent lot mein bachegi: <strong style={{ color: Number(remainingQty) < 0 ? '#ff6b6b' : 'var(--ft-forest)' }}>{remainingQty} kg</strong>
                        </div>
                        {Number(remainingQty) > 0 && (
                          <div style={{ marginTop: '0.75rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '0.6rem 0.9rem', fontSize: '0.8rem', color: '#1e40af', fontWeight: 600 }}>
                            ℹ️ <strong>{remainingQty} kg</strong> original lot mein rahegi — sirf naye child lots transfer honge.
                          </div>
                        )}
                        {Number(remainingQty) <= 0 && totalSplitQty > 0 && (
                          <div style={{ marginTop: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '0.6rem 0.9rem', fontSize: '0.8rem', color: '#b91c1c', fontWeight: 600 }}>
                            ⚠️ Parent lot mein kuch quantity bachni chahiye. Ek ya zyada split quantities kam karo.
                          </div>
                        )}
                      </div>

                      <div className="action-footer">
                        <button 
                          className="ft-btn ft-btn-primary ft-btn-full"
                          onClick={handleSplit}
                          disabled={loading || totalSplitQty <= 0 || totalSplitQty >= selectedSplitLot.quantity}
                        >
                          {loading ? <div className="ft-spinner" /> : (
                            <>
                              <Zap size={20} />
                              Confirm Split & Create Child Lots
                            </>
                          )}
                        </button>
                        <p className="hint-text">Blockchain ledger automatically update ho jayega.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="workspace-flow content-merge">
                {selectedMergeLots.length === 0 ? (
                  <div className="empty-workspace animate-fade-in">
                    <div className="illo-wrap">
                      <div className="illo-circle"><Merge size={48} /></div>
                    </div>
                    <h2>Lots Merge Karein</h2>
                    <p>Selection list se 2 ya usse zyada compatible lots select karein jinhe aap combine karna chahte hain.</p>
                  </div>
                ) : (
                  <div className="config-workspace animate-slide-up">
                    <div className="merge-selection-header">
                      <h3>Selected for Merging ({selectedMergeLots.length})</h3>
                      <button className="clear-link" onClick={() => setSelectedMergeLots([])}>Clear All</button>
                    </div>

                    <div className="merge-chips-grid">
                      {selectedMergeLots.map(lot => (
                        <div key={lot._id} className="merge-chip-item">
                          <div className="chip-content">
                            <span className="chip-code">{lot.lotCode}</span>
                            <span className="chip-qty">{lot.quantity}kg</span>
                          </div>
                          <button onClick={() => toggleMergeSelection(lot)}><X size={16} /></button>
                        </div>
                      ))}
                    </div>

                    <div className="merge-projection-card">
                      <div className="projection-glow" />
                      <div className="projection-main">
                        <div className="proj-node">
                          <Package size={28} />
                          <span>Multiple Lots</span>
                        </div>
                        <div className="proj-arrow">
                          <ArrowRight />
                          <div className="arrow-glow" />
                        </div>
                        <div className="proj-node result">
                          <Package size={40} />
                          <span>Merged Final Lot</span>
                        </div>
                      </div>

                      <div className="projection-stats">
                        <div className="p-stat">
                          <label>New Combined Weight</label>
                          <div className="val">{totalMergeQty} <small>kg</small></div>
                        </div>
                        <div className="p-stat">
                          <label>Resulting Grade</label>
                          <div className="val">{selectedMergeLots[0]?.qualityGrade}</div>
                        </div>
                        <div className="p-stat">
                          <label>Target Price Avg</label>
                          <div className="val">₹{(selectedMergeLots.reduce((sum, l) => sum + (l.farmPrice * l.quantity), 0) / totalMergeQty || 0).toFixed(1)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="blockchain-info-box">
                      <div className="info-icon"><Info size={20} /></div>
                      <p>Merging process irreversible hai. Purane lots blockchain par <strong>"MERGED"</strong> mark ho jayenge aur naya master lot banega.</p>
                    </div>

                    <div className="action-footer">
                      <button 
                        className="ft-btn ft-btn-primary ft-btn-full"
                        onClick={handleMerge}
                        disabled={loading || selectedMergeLots.length < 2}
                      >
                        {loading ? <div className="ft-spinner" /> : (
                          <>
                            <RefreshCcw size={20} />
                            Combine & Confirm Merge
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      <style>{`
        .lot-ops-page {
          background: var(--ft-bg);
          min-height: 100vh;
          padding-top: 5rem;
        }

        .nav-content {
          height: 4.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .back-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: none;
          border: none;
          color: var(--ft-text-muted);
          font-weight: 700;
          cursor: pointer;
          transition: var(--ft-transition);
        }
        .back-btn:hover { color: var(--ft-forest); transform: translateX(-4px); }

        .nav-title {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .icon-badge {
          width: 40px;
          height: 40px;
          background: white;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: var(--ft-shadow-sm);
        }
        .nav-title h1 { font-size: 1.25rem; font-weight: 800; }

        .lot-mgmt-search-shift {
          margin: 0 auto 0 4rem;
          max-width: 320px;
        }

        .refresh-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 1px solid var(--ft-border);
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: var(--ft-transition);
        }
        .refresh-btn:hover { border-color: var(--ft-forest); color: var(--ft-forest); }
        .spinning { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .main-layout {
          margin-top: 2rem;
          padding-bottom: 4rem;
        }

        .ops-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2rem;
          margin-bottom: 2.5rem;
        }

        .ops-toggle-container {
          background: white;
          padding: 0.5rem;
          border-radius: 100px;
          display: flex;
          gap: 0.5rem;
          border: 1px solid var(--ft-border);
          box-shadow: var(--ft-shadow-sm);
        }

        .ops-toggle-btn {
          padding: 0.75rem 1.5rem;
          border-radius: 100px;
          border: none;
          background: none;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-weight: 800;
          color: var(--ft-text-muted);
          cursor: pointer;
          position: relative;
          transition: var(--ft-transition);
        }

        .ops-toggle-btn.active {
          color: var(--ft-forest);
        }

        .btn-indicator {
          position: absolute;
          inset: 0;
          background: var(--ft-sage-light);
          border-radius: 100px;
          z-index: -1;
          opacity: 0;
          transform: scale(0.9);
          transition: var(--ft-transition);
        }

        .ops-toggle-btn.active .btn-indicator {
          opacity: 1;
          transform: scale(1);
        }

        .ops-workflow-steps {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .step-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          opacity: 0.4;
          transition: var(--ft-transition);
        }
        .step-item.active { opacity: 1; }
        .step-item.completed { opacity: 0.8; color: var(--ft-success); }
        
        .step-num {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--ft-text-muted);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 0.85rem;
        }
        .step-item.active .step-num { background: var(--ft-forest); }
        .step-item.completed .step-num { background: var(--ft-success); }

        .step-label { font-weight: 700; font-size: 0.9rem; }
        .step-line { width: 40px; height: 1px; background: var(--ft-border); }

        .ops-content-grid {
          display: grid;
          grid-template-columns: 380px 1fr;
          gap: 2rem;
          min-height: 600px;
        }

        .inventory-panel {
          border-radius: var(--ft-radius-lg);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .panel-header {
          padding: 1.5rem;
          border-bottom: 1px solid var(--ft-border);
        }

        .search-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          background: var(--ft-bg);
          border-radius: 12px;
          padding: 0 1rem;
          border: 1px solid var(--ft-border);
        }
        .search-icon { color: var(--ft-text-muted); }
        .search-wrapper input {
          width: 100%;
          padding: 0.85rem 0.5rem;
          background: none;
          border: none;
          outline: none;
          font-weight: 600;
          font-size: 0.9rem;
        }

        .lot-inventory-list {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
        }

        .inventory-stats {
          font-size: 0.75rem;
          font-weight: 800;
          text-transform: uppercase;
          color: var(--ft-text-muted);
          margin-bottom: 1rem;
          padding-left: 0.5rem;
        }

        .inventory-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.75rem;
        }

        .lot-card-mini {
          background: white;
          border: 1px solid var(--ft-border);
          border-radius: 16px;
          padding: 1.25rem;
          cursor: pointer;
          transition: var(--ft-transition);
        }

        .lot-card-mini:hover {
          transform: translateY(-2px);
          border-color: var(--ft-forest);
          box-shadow: var(--ft-shadow-sm);
        }

        .lot-card-mini.selected {
          border-color: var(--ft-forest);
          background: var(--ft-sage-light);
          box-shadow: inset 0 0 0 1px var(--ft-forest);
        }

        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }
        .lot-id {
          font-size: 0.75rem;
          font-weight: 800;
          color: var(--ft-forest);
          letter-spacing: 0.05em;
        }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #ccc; }
        .status-dot.active { background: var(--ft-success); box-shadow: 0 0 10px var(--ft-success); }

        .crop-name { font-size: 1.1rem; margin: 0; }
        .quantity { font-weight: 800; font-size: 1.25rem; color: var(--ft-text); }
        .quantity small { font-size: 0.85rem; opacity: 0.6; }

        .card-bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 1rem;
        }
        .grade-badge {
          font-size: 0.7rem;
          font-weight: 800;
          text-transform: uppercase;
          background: white;
          padding: 0.25rem 0.6rem;
          border-radius: 6px;
          border: 1px solid var(--ft-border);
        }
        .check-icon { color: var(--ft-forest); }

        .workspace-panel {
          border-radius: var(--ft-radius-lg);
          padding: 2rem;
          display: flex;
          flex-direction: column;
        }

        .empty-workspace {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 4rem;
        }

        .illo-wrap {
          margin-bottom: 2rem;
          position: relative;
        }
        .illo-circle {
          width: 120px;
          height: 120px;
          background: var(--ft-sage-light);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--ft-forest);
          position: relative;
        }
        .illo-circle::after {
          content: '';
          position: absolute;
          inset: -15px;
          border: 1px dashed var(--ft-forest);
          border-radius: 50%;
          opacity: 0.2;
          animation: spin 10s linear infinite;
        }

        .empty-workspace h2 { font-size: 1.75rem; margin-bottom: 1rem; color: var(--ft-forest); }
        .empty-workspace p { max-width: 360px; color: var(--ft-text-muted); line-height: 1.6; }

        .source-lot-banner {
          background: var(--ft-forest);
          color: white;
          padding: 1.5rem;
          border-radius: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2.5rem;
          box-shadow: var(--ft-shadow);
        }

        .banner-info { display: flex; align-items: center; gap: 1.25rem; }
        .info-icon { width: 48px; height: 48px; background: rgba(255,255,255,0.1); border-radius: 14px; display: flex; align-items: center; justify-content: center; }
        .info-details label { font-size: 0.7rem; font-weight: 800; opacity: 0.7; letter-spacing: 0.1em; }
        .info-details h3 { font-size: 1.25rem; margin: 0; }

        .banner-stats { display: flex; align-items: center; gap: 1.5rem; }
        .stat-pill { background: rgba(255,255,255,0.15); padding: 0.5rem 1rem; border-radius: 100px; display: flex; align-items: center; gap: 0.5rem; font-weight: 800; }
        .change-btn { background: none; border: 1px solid rgba(255,255,255,0.3); color: white; padding: 0.4rem 1rem; border-radius: 100px; font-weight: 700; cursor: pointer; }

        .operation-table .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }
        .operation-table .table-header h3 { font-size: 1.1rem; color: var(--ft-forest); }
        .add-btn { background: var(--ft-sage-light); color: var(--ft-forest); border: none; padding: 0.6rem 1.25rem; border-radius: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: var(--ft-transition); }
        .add-btn:hover { background: var(--ft-sage); }

        .rows-container { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2.5rem; }
        .split-row-item {
          display: grid;
          grid-template-columns: 40px 1fr 40px;
          align-items: center;
          gap: 1.5rem;
          background: white;
          padding: 0.75rem 1.25rem;
          border-radius: 16px;
          border: 1px solid var(--ft-border);
        }
        .row-index { font-weight: 800; color: var(--ft-text-muted); font-size: 0.9rem; }
        .row-input { position: relative; }
        .row-input input {
          width: 100%;
          padding: 0.85rem 3rem 0.85rem 1.25rem;
          border: 1.5px solid var(--ft-border);
          border-radius: 12px;
          font-weight: 800;
          font-size: 1.1rem;
        }
        .input-suffix { position: absolute; right: 1.25rem; top: 50%; transform: translateY(-50%); font-weight: 800; color: var(--ft-text-muted); }
        .delete-row { background: none; border: none; color: #ff6b6b; cursor: pointer; opacity: 0.7; }
        .delete-row:hover { opacity: 1; transform: scale(1.1); }

        .split-summary-box { background: var(--ft-bg); padding: 1.75rem; border-radius: 20px; border: 1.5px solid var(--ft-border); margin-bottom: 3rem; }
        .progress-label { display: flex; justify-content: space-between; font-weight: 800; font-size: 0.9rem; margin-bottom: 0.75rem; }
        .progress-track { height: 12px; background: white; border-radius: 100px; border: 1px solid var(--ft-border); overflow: hidden; margin-bottom: 1rem; }
        .progress-fill { height: 100%; background: var(--ft-forest); transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
        .progress-fill.error { background: #ff6b6b; }
        .remaining-label { text-align: right; font-size: 0.85rem; color: var(--ft-text-muted); font-weight: 600; }
        .remaining-label strong { color: var(--ft-forest); font-size: 1rem; }

        .action-footer { display: flex; flex-direction: column; align-items: center; gap: 1rem; }
        .hint-text { font-size: 0.8rem; color: var(--ft-text-muted); font-weight: 500; }

        .merge-selection-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .clear-link { background: none; border: none; color: #ff6b6b; font-weight: 700; cursor: pointer; }
        
        .merge-chips-grid { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 2.5rem; }
        .merge-chip-item {
          background: white;
          border: 1px solid var(--ft-border);
          border-radius: 100px;
          padding: 0.5rem 0.5rem 0.5rem 1.25rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          box-shadow: var(--ft-shadow-sm);
        }
        .chip-code { font-weight: 800; color: var(--ft-forest); font-size: 0.85rem; }
        .chip-qty { font-weight: 700; font-size: 0.8rem; opacity: 0.6; }
        .merge-chip-item button { width: 24px; height: 24px; border-radius: 50%; border: none; background: var(--ft-bg); display: flex; align-items: center; justify-content: center; color: #ff6b6b; cursor: pointer; }

        .merge-projection-card {
          background: linear-gradient(135deg, var(--ft-forest), #1a4a15);
          color: white;
          border-radius: 32px;
          padding: 3rem 2rem;
          margin-bottom: 2.5rem;
          position: relative;
          overflow: hidden;
          box-shadow: var(--ft-shadow-lg);
        }
        .projection-glow { position: absolute; inset: 0; background: radial-gradient(circle at top right, rgba(255,255,255,0.1), transparent); }
        .projection-main { display: flex; align-items: center; justify-content: center; gap: 2.5rem; margin-bottom: 3.5rem; position: relative; z-index: 1; }
        .proj-node { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; font-weight: 700; font-size: 0.9rem; opacity: 0.8; }
        .proj-node.result { opacity: 1; background: rgba(255,255,255,0.1); padding: 1.5rem; border-radius: 24px; border: 1px solid rgba(255,255,255,0.2); }
        .proj-node.result span { font-size: 1.1rem; border-top: 1px solid rgba(255,255,255,0.2); width: 100%; text-align: center; padding-top: 0.5rem; margin-top: 0.5rem; }
        .proj-arrow { position: relative; color: var(--ft-wheat); }
        .arrow-glow { position: absolute; inset: -10px; background: var(--ft-wheat); opacity: 0.4; filter: blur(20px); border-radius: 50%; }

        .projection-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
          position: relative;
          z-index: 1;
          border-top: 1px solid rgba(255,255,255,0.1);
          padding-top: 2rem;
        }
        .p-stat label { display: block; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; opacity: 0.6; margin-bottom: 0.5rem; letter-spacing: 0.1em; }
        .p-stat .val { font-size: 1.5rem; font-weight: 900; }
        .p-stat .val small { font-size: 0.9rem; font-weight: 500; opacity: 0.7; }

        .blockchain-info-box {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1e40af;
          padding: 1.25rem;
          border-radius: 16px;
          margin-bottom: 2.5rem;
          font-weight: 600;
          font-size: 0.9rem;
          line-height: 1.5;
        }

        @keyframes slide-up { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-in { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
        .animate-slide-up { animation: slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-fade-in { animation: fade-in 0.6s ease forwards; }
        .animate-slide-in { animation: slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        @media (max-width: 1024px) {
          .ops-content-grid { grid-template-columns: 1fr; }
          .inventory-panel { max-height: 400px; }
          .hidden-mobile { display: none !important; }
        }
        @media (max-width: 600px) {
          .ops-workflow-steps { display: none; }
          .projection-main { gap: 1rem; scale: 0.8; }
          .projection-stats { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
