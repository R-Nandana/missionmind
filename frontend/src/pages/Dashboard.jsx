import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import ObservationCard from '../components/ObservationCard';
import MarsGuideModal from '../components/MarsGuideModal';
import { API_BASE_URL } from '../api';
import { 
  Activity, Search, RotateCcw, AlertTriangle, Compass, Sparkles,
  BarChart2, ShieldAlert, ChevronLeft, ChevronRight, Layers, Eye,
  Satellite, SlidersHorizontal, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react';

const SIMULATED_EVENTS = [
  { sol: 12, title: 'Sol 12: Dust Devil', icon: '🌪️', type: 'dust_event', desc: 'Pressure drop -30 Pa, temp spike +15°C' },
  { sol: 15, title: 'Sol 15: Heat Spike', icon: '⚡', type: 'brief_hot_spike', desc: 'Transient midday thermal spike' },
  { sol: 25, title: 'Sol 25: Cold Front', icon: '❄️', type: 'cold_front', desc: 'Pre-dawn cold front -20°C' },
  { sol: 33, title: 'Sol 33: Pre-dawn Warm', icon: '🌅', type: 'pre_dawn_warming', desc: 'Early boundary layer heat mixing' },
  { sol: 37, title: 'Sol 37: Thermal Plume', icon: '🌡️', type: 'hot_anomaly', desc: 'Afternoon surface heat plume' },
  { sol: 45, title: 'Sol 45: Night Inversion', icon: '🌙', type: 'nighttime_warming', desc: 'Radiative cloud thermal blanket' },
  { sol: 52, title: 'Sol 52: Gravity Wave', icon: '〰️', type: 'pressure_wave', desc: 'Mesoscale pressure surge +50 Pa' },
  { sol: 55, title: 'Sol 55: Pressure Surge', icon: '📈', type: 'pressure_surge', desc: 'High-amplitude pressure wave' },
  { sol: 60, title: 'Sol 60: Dust Lifting', icon: '💨', type: 'dust_lifting', desc: 'Boundary layer aerosol suspension' },
  { sol: 68, title: 'Sol 68: Polar Spill', icon: '🧊', type: 'cold_air_intrusion', desc: 'Pre-dawn cold air intrusion' },
  { sol: 73, title: 'Sol 73: Late Spike', icon: '🔥', type: 'late_afternoon_spike', desc: 'Afternoon ground heat retention' },
  { sol: 78, title: 'Sol 78: Sunset Temp', icon: '🌆', type: 'sunset_temp_anomaly', desc: 'Rapid radiative cooling post-sunset' },
  { sol: 82, title: 'Sol 82: Dust Storm', icon: '🌫️', type: 'regional_dust_storm', desc: 'Regional storm, all-sol opacity' },
  { sol: 91, title: 'Sol 91: Pressure Drop', icon: '📉', type: 'morning_pressure_drop', desc: 'Morning localized suction' },
  { sol: 95, title: 'Sol 95: Evening Cold', icon: '❄️', type: 'evening_cooling_anomaly', desc: 'Rapid radiative cooling' }
];

export default function Dashboard() {
  const [observations, setObservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [observationsError, setObservationsError] = useState('');

  // Filters & State
  const [onlyAnomalies, setOnlyAnomalies] = useState(false);
  const [solFilter, setSolFilter] = useState('');
  const [selectedAnomalyType, setSelectedAnomalyType] = useState('all');
  const [viewMode, setViewMode] = useState('explorer'); // 'explorer' | 'scientist'
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [missionBriefing, setMissionBriefing] = useState(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingExpanded, setBriefingExpanded] = useState(false);

  // Fetch telemetry overview statistics
  const fetchStats = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = {};
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const res = await axios.get(`${API_BASE_URL}/observations/stats`, { headers });
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  // Fetch Gemini-powered Mission Intelligence Briefing
  const fetchMissionInsights = async () => {
    setBriefingLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = {};
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const res = await axios.get(`${API_BASE_URL}/observations/mission-insights`, { headers });
      setMissionBriefing(res.data);
      setBriefingExpanded(true);
    } catch (err) {
      console.error('Failed to fetch mission insights:', err);
    } finally {
      setBriefingLoading(false);
    }
  };

  // Fetch observations with applied filters
  const fetchObservations = useCallback(async (pageNum, overrides = {}) => {
    setLoading(true);
    setObservationsError('');
    try {
      const token = localStorage.getItem('token');
      const anomalyParam = overrides.onlyAnomalies !== undefined ? overrides.onlyAnomalies : onlyAnomalies;
      const solParam = overrides.solFilter !== undefined ? overrides.solFilter : solFilter;
      const typeParam = overrides.selectedAnomalyType !== undefined ? overrides.selectedAnomalyType : selectedAnomalyType;

      let url = `${API_BASE_URL}/observations?page=${pageNum}&limit=12`;
      if (anomalyParam) url += `&is_anomaly=true`;
      if (solParam) url += `&sol=${solParam}`;
      if (typeParam && typeParam !== 'all') url += `&anomaly_type=${typeParam}`;

      const headers = {};
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const res = await axios.get(url, { headers });
      setObservations(res.data.observations);
      setTotalPages(res.data.totalPages);
      setPage(res.data.page);
      setTotalCount(res.data.total);
    } catch (error) {
      console.error('Failed to fetch observations', error);
      if (error.response && error.response.status === 401) {
        localStorage.removeItem('token');
        window.location.reload();
      } else {
        setObservationsError('Telemetry could not be reached. Check that the backend is running, then retry.');
      }
    } finally {
      setLoading(false);
    }
  }, [onlyAnomalies, solFilter, selectedAnomalyType]);

  useEffect(() => {
    fetchStats();
    fetchObservations(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quick jump to a simulated anomaly event
  const handleQuickJump = (event) => {
    setSolFilter(String(event.sol));
    setOnlyAnomalies(false);
    setSelectedAnomalyType('all');
    fetchObservations(1, { solFilter: String(event.sol), onlyAnomalies: false, selectedAnomalyType: 'all' });
  };

  // Reset all filters
  const handleResetFilters = () => {
    setOnlyAnomalies(false);
    setSolFilter('');
    setSelectedAnomalyType('all');
    fetchObservations(1, { onlyAnomalies: false, solFilter: '', selectedAnomalyType: 'all' });
  };

  const handleToggleAnomaliesOnly = (enabled) => {
    setOnlyAnomalies(enabled);
    fetchObservations(1, { onlyAnomalies: enabled });
  };

  const handleSolSearchSubmit = (e) => {
    e.preventDefault();
    fetchObservations(1);
  };

  return (
    <div className="animate-fade-in dashboard-wrapper">
      {/* Mars Weather & Simulation Guide Modal */}
      <MarsGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

      <div className="dashboard-heading">
        <div>
          <div className="section-kicker">MISSION OPERATIONS / ATMOSPHERIC SCIENCE</div>
          <h1>Telemetry overview</h1>
          <p>Perseverance surface weather, anomaly monitoring, and evidence-backed analysis.</p>
        </div>
        <div className="connection-status">
          <span className="archive-mark" />
          <span>ARCHIVE SCOPE</span>
          <strong>SOL 1–100</strong>
        </div>
      </div>

      {/* Mission overview */}
      <div className="glass-panel mission-banner">
        <div className="mission-banner-left">
          <div className="rover-badge">
            <Satellite size={14} /> MARS 2020 / PERSEVERANCE
          </div>
          <h2 className="banner-title">Weather from another world.</h2>
          <p className="banner-desc">
            MEDA environmental observations from Jezero Crater, Sols 1–100.
          </p>
          <div className="mission-facts">
            <span><b>18.38° N</b> Jezero Crater</span>
            <span><b>MEDA</b> Weather station</span>
            <span><b>1–100</b> Sol range</span>
          </div>
        </div>

        <div className="mission-graphic" aria-hidden="true">
          <div className="planet-halo" />
          <div className="planet">
            <div className="planet-shade" />
            <div className="planet-crater crater-one" />
            <div className="planet-crater crater-two" />
          </div>
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <span className="orbit-point" />
          <span className="graphic-caption">JEZERO · 18.38°N</span>
        </div>

        <div className="mission-banner-actions">
          <button 
            className="btn btn-secondary guide-btn" 
            onClick={() => setIsGuideOpen(true)}
            title="Learn how Mars weather, seasons, and anomalies work"
          >
            <Compass size={18} color="#c084fc" />
            <span>Mars Science Guide</span>
          </button>

          <button
            className="btn btn-gemini-briefing"
            onClick={fetchMissionInsights}
            disabled={briefingLoading}
            title="Generate an executive Gemini AI meteorological briefing for Sols 1-100"
          >
            {briefingLoading
              ? <Activity className="spinner" size={16} />
              : <Sparkles size={16} color="#38bdf8" />}
            <span>{briefingLoading ? 'Generating Briefing...' : 'AI Mission Briefing'}</span>
          </button>

          {/* View Mode Toggle: Explorer vs Scientist */}
          <div className="view-mode-toggle" title="Switch between beginner Explorer view and rigorous Scientist view">
            <button 
              className={`mode-btn ${viewMode === 'explorer' ? 'active' : ''}`}
              onClick={() => setViewMode('explorer')}
            >
              <Sparkles size={14} /> Explorer View
            </button>
            <button 
              className={`mode-btn ${viewMode === 'scientist' ? 'active' : ''}`}
              onClick={() => setViewMode('scientist')}
            >
              <BarChart2 size={14} /> Scientist View
            </button>
          </div>
        </div>
      </div>

      {/* Telemetry summary */}
      <div className="stats-overview-grid">
        <div className="glass-panel stat-card stat-observations">
          <div className="stat-card-top"><span className="stat-icon"><Activity size={17} /></span><span className="stat-label">Observations</span></div>
          <div className="stat-val">{stats ? stats.totalObservations.toLocaleString() : '—'}</div>
          <div className="stat-sub">MEDA records in archive</div>
        </div>

        <div className="glass-panel stat-card stat-card-alert">
          <div className="stat-card-top"><span className="stat-icon stat-icon-alert"><AlertTriangle size={17} /></span><span className="stat-label">Flagged anomalies</span></div>
          <div className="stat-val">{stats ? stats.anomalyCount.toLocaleString() : '—'}<span className="stat-unit">{stats ? `${stats.anomalyPercentage}%` : 'pending'}</span></div>
          <div className="stat-sub">Observations outside baseline</div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-card-top"><span className="stat-icon stat-icon-normal"><Activity size={17} /></span><span className="stat-label">Within baseline</span></div>
          <div className="stat-val">{stats ? stats.normalCount.toLocaleString() : '—'}<span className="stat-unit">{stats ? `${(100 - Number(stats.anomalyPercentage)).toFixed(1)}%` : 'pending'}</span></div>
          <div className="stat-sub">Within expected climatology</div>
        </div>

        <div className="glass-panel stat-card stat-context-card">
          <div className="stat-card-top"><span className="stat-icon stat-icon-context"><Layers size={17} /></span><span className="stat-label">Viewing mode</span></div>
          <div className="stat-val stat-mode-value">{viewMode === 'explorer' ? 'Explorer' : 'Scientist'}</div>
          <div className="stat-sub">{viewMode === 'explorer' ? 'Plain-language summaries' : 'Z-scores and citations'}</div>
        </div>
      </div>

      {/* Gemini Mission Intelligence Briefing Panel */}
      {missionBriefing && (
        <div className="glass-panel mission-briefing-panel animate-fade-in">
          <div className="briefing-header" onClick={() => setBriefingExpanded(!briefingExpanded)} style={{ cursor: 'pointer' }}>
            <div className="briefing-header-left">
              <span className="gemini-pill" style={{ fontSize: '0.7rem' }}>
                <Sparkles size={13} /> Gemini AI
              </span>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#f1f5f9', margin: 0 }}>
                Mission Intelligence Briefing — Sols 1–100
              </h3>
              <span className="gemini-model-badge" style={{ fontSize: '0.65rem' }}>{missionBriefing.model}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-refresh-insights"
                onClick={(e) => { e.stopPropagation(); fetchMissionInsights(); }}
                disabled={briefingLoading}
                title="Regenerate mission briefing"
              >
                <RefreshCw size={12} className={briefingLoading ? 'spinner' : ''} />
                <span>Refresh</span>
              </button>
              {briefingExpanded ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
            </div>
          </div>
          {briefingExpanded && (
            <div className="briefing-body">
              <pre className="briefing-text">{missionBriefing.briefing}</pre>
            </div>
          )}
        </div>
      )}

      {/* Quick-Jump Carousel: Simulated Mars Events */}
      <div className="quick-jump-container glass-panel">
        <div className="quick-jump-header">
          <div className="section-title-group">
            <span className="section-icon"><ShieldAlert size={17} /></span>
            <div><h3>Notable events</h3><p>Jump to a sol in the event catalogue</p></div>
          </div>
          <span className="horizontal-hint">SCROLL TO EXPLORE <span aria-hidden="true">→</span></span>
        </div>

        <div className="quick-jump-pills">
          {SIMULATED_EVENTS.map((ev) => (
            <button
              key={ev.sol}
              className={`pill-btn ${solFilter === String(ev.sol) ? 'active' : ''}`}
              onClick={() => handleQuickJump(ev)}
              title={`${ev.desc} (Sol ${ev.sol})`}
            >
              <span className="pill-icon">{ev.icon}</span>
              <span className="pill-title">{ev.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Observation explorer */}
      <section className="observations-section">
        <div className="observations-heading">
          <div>
            <div className="section-kicker">OBSERVATION ARCHIVE</div>
            <h2>Telemetry stream</h2>
            <p>Inspect sensor readings or run evidence-backed analysis.</p>
          </div>
          <span className="records-count"><strong>{totalCount.toLocaleString()}</strong> records</span>
        </div>

      <div className="glass-panel filter-toolbar">
        <div className="filter-toolbar-label"><SlidersHorizontal size={15} /> FILTERS</div>
        {/* Toggle Anomalies vs All */}
        <div className="filter-group">
          <button 
            className={`btn-filter ${!onlyAnomalies ? 'active' : ''}`}
            onClick={() => handleToggleAnomaliesOnly(false)}
          >
            All observations
          </button>
          <button 
            className={`btn-filter ${onlyAnomalies ? 'active-alert' : ''}`}
            onClick={() => handleToggleAnomaliesOnly(true)}
          >
            <AlertTriangle size={14} /> Anomalies
          </button>
        </div>

        {/* Search by Sol */}
        <form onSubmit={handleSolSearchSubmit} className="sol-search-form">
          <Search size={16} color="#94a3b8" />
          <input 
            type="number" 
            placeholder="Search Sol (1-100)..." 
            value={solFilter}
            onChange={(e) => setSolFilter(e.target.value)}
            min="1"
            max="100"
            className="search-input"
          />
          <button type="submit" className="btn btn-secondary btn-sm">Find</button>
        </form>

        {/* Anomaly Type Dropdown */}
        <div className="dropdown-filter">
          <select 
            value={selectedAnomalyType} 
            onChange={(e) => {
              setSelectedAnomalyType(e.target.value);
              fetchObservations(1, { selectedAnomalyType: e.target.value });
            }}
            className="select-field"
          >
            <option value="all">All Anomaly Types</option>
            <option value="dust_event">🌪️ Dust Devil Vortex</option>
            <option value="cold_front">❄️ Cold Front</option>
            <option value="pressure_wave">〰️ Gravity Pressure Wave</option>
            <option value="pressure_surge">📈 Pressure Surge</option>
            <option value="regional_dust_storm">🌫️ Regional Dust Storm</option>
            <option value="nighttime_warming">🌙 Nighttime Inversion</option>
            <option value="hot_anomaly">🌡️ Thermal Heat Plume</option>
            <option value="cold_air_intrusion">🧊 Cold Air Intrusion</option>
            <option value="dust_lifting">💨 Dust Lifting</option>
          </select>
        </div>

        {/* Reset button if filters active */}
        {(onlyAnomalies || solFilter || selectedAnomalyType !== 'all') && (
          <button className="btn btn-secondary btn-sm" onClick={handleResetFilters} title="Reset all filters">
            <RotateCcw size={14} /> Reset
          </button>
        )}
      </div>

      {/* Main Observations Grid */}
      {loading ? (
        <div className="loading-state">
          <Activity className="spinner" size={48} color="var(--accent-color)" />
          <p style={{ marginTop: '1rem', color: '#94a3b8', fontSize: '0.95rem' }}>
            Fetching Mars MEDA sensor telemetry...
          </p>
        </div>
      ) : observationsError ? (
        <div className="glass-panel empty-state service-error">
          <AlertTriangle size={34} />
          <h3>Telemetry service unavailable</h3>
          <p>{observationsError}</p>
          <button className="btn btn-secondary" onClick={() => fetchObservations(page)}>
            <RotateCcw size={15} /> Retry connection
          </button>
        </div>
      ) : observations.length === 0 ? (
        <div className="glass-panel empty-state">
          <AlertTriangle size={48} color="#f59e0b" style={{ marginBottom: '1rem' }} />
          <h3>No Observations Found</h3>
          <p style={{ color: '#94a3b8', maxWidth: '400px', margin: '0.5rem auto 1.5rem' }}>
            No data matched your current filter criteria (Sol: {solFilter || 'Any'}, Type: {selectedAnomalyType}).
          </p>
          <button className="btn" onClick={handleResetFilters}>
            Clear Filters & Show All Sols
          </button>
        </div>
      ) : (
        <>
        <div className="results-toolbar">
          <span><Eye size={15} /> Showing {observations.length} of {totalCount.toLocaleString()} records</span>
          {onlyAnomalies && <span className="active-filter-chip"><AlertTriangle size={13} /> Anomalies only</span>}
        </div>
        <div className="dashboard-grid">
          {observations.map((obs) => (
            <ObservationCard 
              key={obs._id} 
              obs={obs} 
              viewMode={viewMode}
            />
          ))}
        </div>
        </>
      )}

      {/* Pagination Footer */}
      {!loading && totalPages > 1 && (
        <div className="pagination-bar glass-panel">
          <button 
            className="btn btn-secondary" 
            disabled={page === 1}
            onClick={() => fetchObservations(page - 1)}
          >
            <ChevronLeft size={16} /> Prev
          </button>
          
          <span className="pagination-info">
            Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} observations)
          </span>

          <button 
            className="btn btn-secondary" 
            disabled={page === totalPages}
            onClick={() => fetchObservations(page + 1)}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}
      </section>
    </div>
  );
}
