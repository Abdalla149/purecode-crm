import { useState, useRef, useCallback } from 'react';
import { Upload, CheckSquare, Square, RefreshCw } from 'lucide-react';
import api from '../utils/api';

const AGENTS = [
  { id: 'mwhEdKvuwIUFFujKry9y', name: 'Khalid' },
  { id: '3zHvVi4Kee0XV8Y8A4aI', name: 'Omar' },
  { id: '9OcAH0DjAFvzWChwnxKq', name: 'Sara' },
];

const BUSINESS_TYPES = ['Roofing', 'HVAC', 'Plumbing', 'Towing', 'Auto Repair'];

const MIN_RATINGS = [
  { value: 'any', label: 'Any rating' },
  { value: '4.0', label: '4.0+ rating' },
  { value: '4.5', label: '4.5+ rating' },
  { value: '4.8', label: '4.8+ rating' },
];

const MIN_REVIEWS = [
  { value: 'any',  label: 'Any # reviews' },
  { value: '50',   label: '50+ reviews' },
  { value: '100',  label: '100+ reviews' },
];

// ── CSV parser (client-side, no library needed) ──
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  if (lines.length < 2) return [];

  function parseLine(line) {
    const fields = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        fields.push(cur.trim()); cur = '';
      } else {
        cur += ch;
      }
    }
    fields.push(cur.trim());
    return fields;
  }

  const rawHeaders = parseLine(lines[0]);
  const headers = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  const find = (...aliases) =>
    aliases.map(a => headers.indexOf(a)).find(i => i >= 0) ?? -1;

  const col = {
    name:    find('name', 'businessname', 'business', 'company', 'companyname'),
    phone:   find('phone', 'phonenumber', 'tel', 'telephone', 'mobile'),
    city:    find('city'),
    state:   find('state'),
    rating:  find('rating', 'googlerating', 'score', 'googlereview', 'stars'),
    reviews: find('nor', 'reviews', 'reviewcount', 'numberofreviews', 'numreviews'),
    website: find('website', 'url', 'web', 'siteurl'),
  };

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const f = parseLine(lines[i]);
    const g = k => col[k] >= 0 ? (f[col[k]] || '').trim() : '';
    const row = {
      name: g('name'), phone: g('phone'), city: g('city'),
      state: g('state'), rating: g('rating'), reviews: g('reviews'), website: g('website'),
    };
    if (row.name || row.phone) rows.push(row);
  }
  return rows;
}

// ── Shared input styles (dark theme) ──
const inputBase = {
  background: 'var(--bg3)',
  border: '1px solid var(--border2)',
  borderRadius: 6,
  color: 'var(--text)',
  padding: '7px 10px',
  fontSize: 12,
  width: '100%',
  boxSizing: 'border-box',
};

export default function Import() {
  const fileInputRef = useRef(null);

  const [fileName,     setFileName]     = useState('');
  const [allRows,      setAllRows]      = useState([]);
  const [selected,     setSelected]     = useState(new Set());
  const [dragOver,     setDragOver]     = useState(false);
  const [minRating,    setMinRating]    = useState('any');
  const [minReviews,   setMinReviews]   = useState('any');
  const [agentId,      setAgentId]      = useState('');
  const [businessType, setBusinessType] = useState('');
  const [tier,         setTier]         = useState('2');
  const [campaign,     setCampaign]     = useState('');
  const [importing,    setImporting]    = useState(false);
  const [progress,     setProgress]     = useState(0);
  const [result,       setResult]       = useState(null);
  const [error,        setError]        = useState(null);

  // ── Derived: filtered rows (with original index attached) ──
  const filteredRows = allRows
    .map((row, i) => ({ ...row, origIdx: i }))
    .filter(row => {
      if (minRating !== 'any' && (parseFloat(row.rating) || 0) < parseFloat(minRating)) return false;
      if (minReviews !== 'any' && (parseInt(row.reviews) || 0) < parseInt(minReviews)) return false;
      return true;
    });

  const selectedCount  = filteredRows.filter(r => selected.has(r.origIdx)).length;
  const leadsToImport  = filteredRows.filter(r => selected.has(r.origIdx));
  const canImport      = selectedCount > 0 && agentId && businessType;

  // ── File loading ──
  function loadFile(file) {
    if (!file || !file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a .csv file');
      return;
    }
    setError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const rows = parseCSV(e.target.result);
      if (rows.length === 0) {
        setError('No data rows found — check the CSV format and column headers');
        return;
      }
      setAllRows(rows);
      setSelected(new Set(rows.map((_, i) => i))); // select all by default
      setResult(null);
    };
    reader.readAsText(file);
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    loadFile(e.dataTransfer.files[0]);
  }, []); // eslint-disable-line

  const handleFileInput = (e) => loadFile(e.target.files[0]);

  // ── Selection helpers ──
  function toggleRow(origIdx) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(origIdx) ? next.delete(origIdx) : next.add(origIdx);
      return next;
    });
  }

  function selectAll() {
    setSelected(prev => {
      const next = new Set(prev);
      filteredRows.forEach(r => next.add(r.origIdx));
      return next;
    });
  }

  function deselectAll() {
    setSelected(prev => {
      const next = new Set(prev);
      filteredRows.forEach(r => next.delete(r.origIdx));
      return next;
    });
  }

  // ── Import ──
  async function handleImport() {
    if (!canImport) return;

    setImporting(true);
    setProgress(0);
    setError(null);

    // Animate progress bar to ~88% over estimated duration
    const msPerStep = Math.max(60, Math.round((leadsToImport.length * 300) / 88));
    const timer = setInterval(() => setProgress(p => p < 88 ? p + 1 : p), msPerStep);

    try {
      const { data } = await api.post('/leads/import', {
        leads: leadsToImport.map(({ origIdx, ...row }) => row),
        assignment: { agentId, businessType, tier, campaign: campaign.trim() },
      });
      clearInterval(timer);
      setProgress(100);
      setTimeout(() => {
        setResult(data);
        setImporting(false);
      }, 400);
    } catch {
      clearInterval(timer);
      setImporting(false);
      setProgress(0);
      setError('Something went wrong — contact David');
    }
  }

  function reset() {
    setAllRows([]);
    setSelected(new Set());
    setFileName('');
    setResult(null);
    setError(null);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <>
      {/* ── Page head ── */}
      <div className="page-head">
        <div>
          <h1 className="page-h1">Import Leads</h1>
          <p className="page-subtitle">Upload CSV → filter → assign → push to pipeline</p>
        </div>
        {allRows.length > 0 && !importing && (
          <button className="btn btn-secondary" onClick={reset}>
            <RefreshCw size={12} /> New File
          </button>
        )}
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div style={{
          background: 'var(--red-dim)', border: '1px solid rgba(255,77,106,0.25)',
          borderRadius: 8, padding: '12px 16px', color: 'var(--red)',
          marginBottom: 16, fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* ── Success summary ── */}
      {result && (
        <div style={{
          background: 'rgba(0,229,160,0.07)', border: '1px solid rgba(0,229,160,0.2)',
          borderRadius: 10, padding: '24px 28px', marginBottom: 20,
        }}>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontWeight: 800,
            fontSize: 18, color: 'var(--primary)', marginBottom: 16,
          }}>
            ✓ Import complete
          </div>
          <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 36, fontFamily: "'Syne', sans-serif", fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>
                {result.imported}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>leads imported</div>
            </div>
            <div>
              <div style={{ fontSize: 36, fontFamily: "'Syne', sans-serif", fontWeight: 800, color: 'var(--text3)', lineHeight: 1 }}>
                {result.skipped}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>skipped (duplicates / errors)</div>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={reset}>Import Another File</button>
        </div>
      )}

      {/* ── Step 1: Upload zone (only when no rows loaded) ── */}
      {allRows.length === 0 && !result && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragEnter={() => setDragOver(true)}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border2)'}`,
              borderRadius: 12,
              padding: '52px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragOver ? 'rgba(0,229,160,0.05)' : 'var(--bg2)',
              transition: 'border-color 0.15s, background 0.15s',
              marginBottom: 20,
            }}
          >
            <div style={{ marginBottom: 14 }}>
              <Upload size={36} color={dragOver ? 'var(--primary)' : 'var(--text3)'} />
            </div>
            <div style={{
              fontSize: 15, fontWeight: 600,
              color: dragOver ? 'var(--primary)' : 'var(--text)',
              marginBottom: 8,
            }}>
              {dragOver ? 'Drop it' : 'Drag & drop your CSV here'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
              or click to browse
              <br />
              Expected columns: <span style={{ color: 'var(--text2)', fontFamily: "'DM Mono', monospace" }}>Name, Phone, City, State, Rating, NOR, Website</span>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />

          {/* Format hint card */}
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '14px 18px',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>CSV format</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'DM Mono', monospace", lineHeight: 1.8 }}>
              Name, Phone, City, State, Rating, NOR, Website<br />
              "Apex Roofing", "555-123-4567", "Austin", "TX", "4.9", "212", "apexroofing.com"
            </div>
          </div>
        </>
      )}

      {/* ── Steps 2–4: Filter + Table + Assign + Import ── */}
      {allRows.length > 0 && !result && (
        <>
          {/* ── Step 2: Filter bar ── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            flexWrap: 'wrap', marginBottom: 12,
          }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0 }}>
              <span style={{ color: 'var(--text2)', fontWeight: 600 }}>📄 {fileName}</span>
              {' · '}{allRows.length} rows
            </div>
            <div style={{ flex: 1 }} />
            <select value={minRating} onChange={e => setMinRating(e.target.value)} style={{ ...inputBase, width: 'auto' }}>
              {MIN_RATINGS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={minReviews} onChange={e => setMinReviews(e.target.value)} style={{ ...inputBase, width: 'auto' }}>
              {MIN_REVIEWS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Select all / deselect all + count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={selectAll}>
              Select All ({filteredRows.length})
            </button>
            <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={deselectAll}>
              Deselect All
            </button>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              <span style={{ color: 'var(--primary)', fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{selectedCount}</span>
              {' of '}
              <span style={{ fontWeight: 600 }}>{filteredRows.length}</span>
              {' selected'}
              {filteredRows.length < allRows.length && (
                <span style={{ color: 'var(--text3)' }}> · {allRows.length - filteredRows.length} filtered out</span>
              )}
            </div>
          </div>

          {/* ── Preview table ── */}
          <div className="panel" style={{ padding: 0, marginBottom: 20 }}>
            <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0, background: 'transparent', maxHeight: 380, overflowY: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}></th>
                    <th>#</th>
                    <th>Business</th>
                    <th>Phone</th>
                    <th>City</th>
                    <th>St</th>
                    <th>Rating</th>
                    <th>Reviews</th>
                    <th>Website</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text3)', padding: '20px 0' }}>
                        No rows match current filters
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => {
                      const isSel = selected.has(row.origIdx);
                      return (
                        <tr
                          key={row.origIdx}
                          style={{ cursor: 'pointer', opacity: isSel ? 1 : 0.35 }}
                          onClick={() => toggleRow(row.origIdx)}
                        >
                          <td style={{ textAlign: 'center', paddingRight: 0 }}>
                            {isSel
                              ? <CheckSquare size={13} color="var(--primary)" />
                              : <Square size={13} color="var(--text3)" />}
                          </td>
                          <td className="td-mono" style={{ color: 'var(--text3)' }}>
                            {String(row.origIdx + 1).padStart(2, '0')}
                          </td>
                          <td className="td-name">{row.name || '—'}</td>
                          <td className="td-phone">{row.phone || '—'}</td>
                          <td style={{ fontSize: 12, color: 'var(--text2)' }}>{row.city || '—'}</td>
                          <td style={{ fontSize: 12, color: 'var(--text2)' }}>{row.state || '—'}</td>
                          <td style={{ fontSize: 12, color: row.rating ? 'var(--gold)' : 'var(--text3)', fontWeight: row.rating ? 600 : 400 }}>
                            {row.rating ? `⭐ ${row.rating}` : '—'}
                          </td>
                          <td style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: 'var(--text2)' }}>
                            {row.reviews || '—'}
                          </td>
                          <td style={{ fontSize: 11, color: 'var(--text3)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.website || '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Step 3: Assignment panel ── */}
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-head">
              <div className="panel-title">Assign & Tag</div>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>applied to all selected leads</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600, marginBottom: 5 }}>Agent *</div>
                <select value={agentId} onChange={e => setAgentId(e.target.value)} style={inputBase}>
                  <option value="">Select agent…</option>
                  {AGENTS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600, marginBottom: 5 }}>Business Type *</div>
                <select value={businessType} onChange={e => setBusinessType(e.target.value)} style={inputBase}>
                  <option value="">Select type…</option>
                  {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600, marginBottom: 5 }}>Tier</div>
                <select value={tier} onChange={e => setTier(e.target.value)} style={inputBase}>
                  <option value="1">Tier 1</option>
                  <option value="2">Tier 2</option>
                  <option value="3">Tier 3</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600, marginBottom: 5 }}>Campaign Tag</div>
                <input
                  type="text"
                  value={campaign}
                  onChange={e => setCampaign(e.target.value)}
                  placeholder="e.g. CA-Roofing-May2026"
                  style={{ ...inputBase, fontFamily: "'DM Mono', monospace" }}
                />
              </div>
            </div>
            {(!agentId || !businessType) && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 12 }}>
                * Agent and Business Type are required
              </div>
            )}
          </div>

          {/* ── Step 4: Import button / progress ── */}
          {importing ? (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>
                <span>Importing {leadsToImport.length} lead{leadsToImport.length !== 1 ? 's' : ''}…</span>
                <span>{progress}%</span>
              </div>
              <div style={{ height: 8, background: 'var(--bg4)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'linear-gradient(to right, var(--primary), rgba(0,229,160,0.55))',
                  borderRadius: 4,
                  transition: 'width 0.15s ease',
                }} />
              </div>
            </div>
          ) : (
            <button
              disabled={!canImport}
              onClick={handleImport}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: canImport ? 'var(--primary)' : 'var(--bg4)',
                color: canImport ? '#0a0a0a' : 'var(--text3)',
                border: 'none', borderRadius: 8,
                fontFamily: "'Syne', sans-serif", fontWeight: 700,
                fontSize: 14, padding: '12px 32px',
                cursor: canImport ? 'pointer' : 'not-allowed',
                transition: 'opacity 0.2s',
              }}
            >
              <Upload size={14} />
              Import {selectedCount} Lead{selectedCount !== 1 ? 's' : ''}
            </button>
          )}
        </>
      )}
    </>
  );
}
