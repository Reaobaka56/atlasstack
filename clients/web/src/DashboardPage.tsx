import React, { useMemo, useState, useEffect } from 'react';
import { useAuth, UserButton, useUser } from '@clerk/react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  CircleDot,
  Clock3,
  Filter,
  GitPullRequest,
  LayoutDashboard,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Activity,
  Github,
  X,
  Cpu,
  Loader2,
  Edit3,
  Save,
} from 'lucide-react';

// ── Scan Overlay Component ───────────────────────────────────────
const ScanOverlay = ({ isVisible, repoUrl, onCancel }: { isVisible: boolean, repoUrl: string, onCancel: () => void }) => {
  if (!isVisible) return null;

  return (
    <motion.div 
      className="scan-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="scan-overlay-content">
        <motion.div 
          className="scan-icon-container"
          animate={{ 
            scale: [1, 1.1, 1],
            rotate: [0, 90, 180, 270, 360]
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        >
          <Cpu size={48} color="#4f46e5" />
        </motion.div>
        
        <h2>Analyzing Architecture</h2>
        <p className="repo-target">{repoUrl}</p>
        
        <div className="scan-steps">
          <div className="scan-step active">
            <Loader2 className="animate-spin" size={16} />
            <span>Cloning Repository...</span>
          </div>
          <div className="scan-step">
            <div className="dot" />
            <span>Parsing AST & Dependencies...</span>
          </div>
          <div className="scan-step">
            <div className="dot" />
            <span>Running Security Audit...</span>
          </div>
          <div className="scan-step">
            <div className="dot" />
            <span>Synthesizing Architectural Map...</span>
          </div>
        </div>

        <div className="progress-bar-container">
          <motion.div 
            className="progress-bar-fill"
            initial={{ width: "0%" }}
            animate={{ width: "65%" }}
            transition={{ duration: 10, ease: "easeOut" }}
          />
        </div>

        <button className="cancel-button" onClick={onCancel}>
          <X size={16} /> Cancel Analysis
        </button>
      </div>
    </motion.div>
  );
};

// ── Error Boundary ──────────────────────────────────────────────
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, info: any) {
    console.error('ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, color: '#ef4444', background: '#000', minHeight: '100vh', fontFamily: 'sans-serif' }}>
          <h1>Something went wrong.</h1>
          <pre style={{ background: '#111', padding: 16, borderRadius: 8 }}>{this.state.error?.toString()}</pre>
          <p>Check the browser console for more details.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Helpers ────────────────────────────────────────────────────────
const scoreColor = (s: number | undefined | null) => {
  if (typeof s !== 'number' || isNaN(s)) return '#ef4444';
  return s > 70 ? '#10b981' : s > 40 ? '#f59e0b' : '#ef4444';
};

const scoreLabel = (s: number | undefined | null) => {
  if (typeof s !== 'number' || isNaN(s)) return 'Critical';
  return s > 70 ? 'Optimal' : s > 40 ? 'Fair' : 'Critical';
};

const relativeTime = (dateStr: string) => {
  if (!dateStr) return 'Unknown';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Recently';
  const diff = Date.now() - d.getTime();
  const h = Math.floor(diff / 36e5);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const TIPS = [
  'Run weekly scans to catch regressions early.',
  'Connect GitHub to enable one-click PR fixes.',
  'Use ELI5 mode to share findings with non-engineers.',
  'Higher health scores unlock Pro AI fix generation.',
];

// ── Result Modal Component ───────────────────────────────────────
const ResultModal = ({ run, apiUrl, onClose }: { run: AuditRun | null, apiUrl: string, onClose: () => void }) => {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [prStatus, setPrStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedCode, setEditedCode] = useState<string>('');
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const { getToken } = useAuth();

  useEffect(() => {
    if (!run) {
      setDetail(null);
      setPrStatus('idle');
      setEditingIndex(null);
      setOverrides({});
      return;
    }
    const fetchDetail = async () => {
      setLoading(true);
      try {
        const token = await getToken();
        const res = await fetch(`${apiUrl}/api/v1/analyses/${run.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setDetail(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [run, apiUrl, getToken]);

  const handleCreatePR = async () => {
    if (!run) return;
    setPrStatus('loading');
    try {
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/v1/analyses/${run.id}/fixes/apply_all`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ overrides })
      });
      if (res.ok) {
        const data = await res.json();
        setPrStatus('success');
        setPrUrl(data.html_url || data.pr_url);
      } else {
        setPrStatus('error');
      }
    } catch (err) {
      setPrStatus('error');
    }
  };

  const startEditing = (index: number, code: string) => {
    setEditingIndex(index);
    setEditedCode(overrides[index] || code);
  };

  const saveEdit = () => {
    if (editingIndex !== null) {
      setOverrides({ ...overrides, [editingIndex]: editedCode });
      setEditingIndex(null);
    }
  };

  if (!run) return null;

  return (
    <motion.div 
      className="result-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClose}
    >
      <motion.div 
        className="result-modal-content"
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="flex items-center gap-4">
            <div className="repo-icon">{run.repo.slice(0, 1).toUpperCase()}</div>
            <div>
              <h2>{run.repo} Analysis</h2>
              <span className="text-sm opacity-60">Completed {run.updated}</span>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="animate-spin text-indigo-500" size={40} />
              <p className="text-sm font-bold opacity-50">Syncing detailed architecture report...</p>
            </div>
          ) : (
            <>
              <div className="risk-summary">
                <div className="score-ring" style={{ borderColor: scoreColor(run.score) }}>
                  <strong>{run.score}%</strong>
                  <span>Health</span>
                </div>
                <div className="risk-details">
                  <h3>Analysis Summary</h3>
                  <p className="text-sm mt-2 opacity-70">
                    {detail?.explanation?.summary || run.goal}
                  </p>
                  
                  {detail?.fixes?.length > 0 && (
                    <div className="risk-item high">
                      <ShieldAlert size={16} />
                      <span>{detail.fixes.length} fixable issues identified</span>
                    </div>
                  )}
                </div>
              </div>

              {detail?.fixes?.length > 0 && (
                <div className="analysis-outputs mt-8">
                  <h4 className="eyebrow mb-4">Recommended Patches</h4>
                  <div className="grid gap-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {detail.fixes.map((fix: any, i: number) => (
                      <div key={i} className={`fix-card-v2 ${editingIndex === i ? 'editing' : ''}`}>
                        <div className="fix-header">
                          <div className="flex items-center gap-3">
                            <CheckCircle2 size={16} className="text-mint" />
                            <span className="text-sm font-bold">{fix.problem}</span>
                          </div>
                          <button 
                            className="text-xs font-bold text-indigo-500 hover:underline flex items-center gap-1"
                            onClick={() => editingIndex === i ? saveEdit() : startEditing(i, fix.code_add)}
                          >
                            {editingIndex === i ? <Save size={14} /> : <Edit3 size={14} />}
                            {editingIndex === i ? 'Save' : 'Edit'}
                          </button>
                        </div>
                        
                        <div className="fix-body mt-2">
                          <span className="text-[10px] opacity-40 font-mono block mb-2">{fix.file_path}</span>
                          {editingIndex === i ? (
                            <textarea 
                              className="edit-area"
                              value={editedCode}
                              onChange={(e) => setEditedCode(e.target.value)}
                              spellCheck={false}
                            />
                          ) : (
                            <pre className="code-preview">
                              {overrides[i] || fix.code_add}
                            </pre>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer flex justify-between items-center py-6 px-8 bg-indigo-50/30">
          <div className="pr-status-area">
            {prStatus === 'success' && prUrl && (
              <a href={prUrl} target="_blank" rel="noreferrer" className="text-sm text-mint font-bold flex items-center gap-2">
                <GitPullRequest size={16} /> Pull Request Opened! View on GitHub →
              </a>
            )}
            {prStatus === 'error' && <span className="text-sm text-rose font-bold">Failed to create PR. Check backend logs.</span>}
          </div>
          <div className="flex gap-4">
            <button className="ghost-button" onClick={onClose}>Close</button>
            {detail?.fixes?.length > 0 && prStatus !== 'success' && (
              <button 
                className="btn-primary" 
                style={{ padding: '0 32px', minHeight: '52px', fontSize: '16px' }}
                onClick={handleCreatePR}
                disabled={prStatus === 'loading'}
              >
                {prStatus === 'loading' ? <Loader2 className="animate-spin" size={20} /> : <GitPullRequest size={20} />}
                {prStatus === 'loading' ? 'Creating PR...' : 'Create Pull Request'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Types ───────────────────────────────────────────────────────────
type RunStatus = 'Ready' | 'Review' | 'Running' | 'pending' | 'completed' | 'failed';
type Severity = 'Low' | 'Medium' | 'High';

interface AuditRun {
  id: string;
  repo: string;
  goal: string;
  status: RunStatus;
  score: number;
  severity: Severity;
  updated: string;
  owner: string;
  outputs: string[];
}

interface BackendAnalysis {
  id: string;
  repo_url: string;
  status: string;
  health_score: number;
  created_at: string;
  summary?: string;
}

const runs: AuditRun[] = [];

const metrics = [
  { label: 'Active runs', value: '18', trend: '+6 this week', icon: <CircleDot size={19} /> },
  { label: 'Avg. health', value: '84%', trend: '+12 points', icon: <TrendingUp size={19} /> },
  { label: 'PR drafts', value: '32', trend: '9 ready', icon: <GitPullRequest size={19} /> },
  { label: 'Risks closed', value: '127', trend: 'last 30 days', icon: <CheckCircle2 size={19} /> },
];

const statusClass = (status: RunStatus) => status.toLowerCase();
const severityClass = (severity: Severity) => severity.toLowerCase();

const GitHubStats = ({ user }: { user: any }) => {
  if (!user) return null;
  const githubAccount = user.externalAccounts?.find((a: any) => a.provider === 'github');

  return (
    <article className="github-stats-card">
      <div className="flex items-center gap-3 mb-4">
        <div className="github-avatar">
          {githubAccount?.imageUrl ? <img src={githubAccount.imageUrl} alt="" /> : <Github size={20} />}
        </div>
        <div>
          <h4 className="m-0 text-sm font-semibold truncate max-w-[120px]">{githubAccount?.username || user.username || 'Connected'}</h4>
          <span className="text-xs text-indigo-500 font-medium">GitHub Profile</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 border-t border-indigo-100/30 pt-4">
        <div className="stat-item">
          <span className="label">Identity</span>
          <span className="value">Verified</span>
        </div>
        <div className="stat-item">
          <span className="label">Auth</span>
          <span className="value">Active</span>
        </div>
        <div className="stat-item">
          <span className="label">Private</span>
          <span className="value">Yes</span>
        </div>
      </div>
    </article>
  );
};

const GitHubRepos = ({ apiUrl, onAnalyze }: { apiUrl: string; onAnalyze: (url: string) => void }) => {
  const { getToken } = useAuth();
  const [repos, setRepos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRepos = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/v1/auth/github/repos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRepos(data);
      } else {
        const data = await res.json();
        setError(data.detail || 'Failed to fetch repos');
      }
    } catch (err) {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRepos(); }, []);

  if (error) return (
    <div className="repos-error-state">
      <Github size={24} />
      <p>Unable to fetch repositories.</p>
      <span className="text-xs opacity-50">Ensure your GitHub account is connected in settings.</span>
    </div>
  );

  return (
    <div className="github-repos-grid">
      <div className="flex justify-between items-center mb-4">
        <h3>GitHub Repositories</h3>
        <button className="ghost-button mini" onClick={fetchRepos}><RefreshCw size={14} /></button>
      </div>
      {loading ? <p>Syncing repositories...</p> : (
        <div className="repo-mini-list">
          {Array.isArray(repos) && repos.slice(0, 5).map(repo => (
            <div key={repo.name || repo.url} className="repo-mini-item">
              <span>{repo.name || 'Untitled Repo'}</span>
              <button onClick={() => onAnalyze(repo.url || '')}>Scan <ArrowRight size={14} /></button>
            </div>
          ))}
          {Array.isArray(repos) && repos.length === 0 && <p className="text-xs opacity-50">No repositories found.</p>}
        </div>
      )}
    </div>
  );
};

export const DashboardPage: React.FC<{ apiUrl: string; onCreateRun: () => void; onAnalyze?: (url: string) => void }> = (props) => {
  return (
    <ErrorBoundary>
      <DashboardContent {...props} />
    </ErrorBoundary>
  );
};

const DashboardContent: React.FC<{ apiUrl: string; onCreateRun: () => void; onAnalyze?: (url: string) => void }> = ({ apiUrl, onCreateRun, onAnalyze }) => {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'All' | RunStatus>('All');
  const [backendRuns, setBackendRuns] = useState<AuditRun[]>([]);

  const metrics = useMemo(() => [
    { label: 'Active runs', value: String(backendRuns.length), trend: 'Real-time', icon: <CircleDot size={19} /> },
    { label: 'Health avg', value: backendRuns.length > 0 ? `${Math.round(backendRuns.reduce((acc, r) => acc + r.score, 0) / backendRuns.length)}%` : '100%', trend: 'Global index', icon: <Activity size={19} /> },
    { label: 'PR drafts', value: String(backendRuns.filter(r => r.status === 'Review').length), trend: 'Verified fixes', icon: <GitPullRequest size={19} /> },
  ], [backendRuns]);
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [targetRepo, setTargetRepo] = useState('');
  const [selectedRun, setSelectedRun] = useState<AuditRun | null>(null);

  const handleAnalyze = async (url: string) => {
    setTargetRepo(url);
    setIsAnalyzing(true);
    
    try {
      const token = await getToken();
      // Trigger backend scan
      const res = await fetch(`${apiUrl}/api/v1/analysis/mvp`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ repo_url: url })
      });
      
      if (res.ok) {
        const newRunData = await res.json();
        // Wait a bit to simulate "thinking" for the premium feel
        setTimeout(async () => {
          setIsAnalyzing(false);
          await fetchAnalyses();
          
          // Auto-popup results for the new run
          const mappedRun: AuditRun = {
            id: newRunData.id,
            repo: newRunData.repo_url.split('/').pop() || 'Untitled',
            goal: newRunData.summary || 'Architecture Analysis',
            status: 'Ready',
            severity: 'Medium',
            updated: 'Just now',
            score: newRunData.health_score || 0,
            owner: 'You',
            outputs: ['Map', 'Audit']
          };
          setSelectedRun(mappedRun);
        }, 2000);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Analysis failed: ${errData.detail || 'Check server logs'}`);
        setIsAnalyzing(false);
      }
    } catch (err) {
      console.error(err);
      alert('Network error: Could not reach the analysis engine.');
      setIsAnalyzing(false);
    }
  };

  const fetchAnalyses = React.useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${apiUrl}/api/v1/analyses`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const analyses: BackendAnalysis[] = data.analyses || [];

        const mappedRuns: AuditRun[] = analyses.map(a => ({
          id: a.id,
          repo: a.repo_url?.split('/').pop() || a.repo_url || 'Unknown',
          goal: a.summary || 'General repo analysis',
          status: (a.status === 'completed' ? 'Ready' : a.status === 'pending' ? 'Running' : 'Review') as RunStatus,
          score: a.health_score || 0,
          severity: (a.health_score < 40 ? 'High' : a.health_score < 70 ? 'Medium' : 'Low') as Severity,
          updated: relativeTime(a.created_at),
          owner: 'System',
          outputs: ['runbook.md', 'summary.json'],
        }));

        setBackendRuns(mappedRuns);
      }
    } catch (error) {
      console.error('Failed to fetch analyses:', error);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, getToken]);

  useEffect(() => {
    fetchAnalyses();
    
    // Check for scan trigger from Studio
    const hashParts = window.location.hash.split('?');
    if (hashParts.length > 1) {
      const params = new URLSearchParams(hashParts[1]);
      const scanUrl = params.get('scan');
      if (scanUrl && !isAnalyzing) {
        handleAnalyze(decodeURIComponent(scanUrl));
        // Clear param to prevent re-triggering on refresh
        window.location.hash = '#/dashboard';
      }
    }

    // Add polling to keep queue fresh
    const interval = setInterval(fetchAnalyses, 5000);
    return () => clearInterval(interval);
  }, [fetchAnalyses, handleAnalyze, isAnalyzing, window.location.hash]);

  const allRuns = useMemo(() => [...backendRuns, ...runs], [backendRuns]);

  const filteredRuns = useMemo(() => {
    return allRuns.filter((run) => {
      const matchesQuery = `${run.repo} ${run.goal} ${run.owner}`.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = status === 'All' || run.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [query, status]);

  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <div className="flex items-center gap-3 mb-2">
          <img src="/logo.png" alt="" className="brand-logo-img" />
          <span className="eyebrow"><LayoutDashboard size={16} /> {user?.firstName ? `${user.firstName}'s` : 'Workspace'} dashboard</span>
        </div>
        <div>
          <h1>Welcome back, {user?.firstName || 'Engineer'}.</h1>
          <p>You have {backendRuns.length} active analyses. Connect more repositories to generate deeper architectural insights.</p>
        </div>
        <button className="btn-primary large" onClick={onCreateRun}>
          <Plus size={17} /> New scan
        </button>
      </section>

      <section className="metric-grid">
        {metrics.map((metric, index) => (
          <motion.article
            className="metric-card"
            key={metric.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <div className="metric-icon">{metric.icon}</div>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.trend}</small>
          </motion.article>
        ))}
      </section>

      <ScanOverlay 
        isVisible={isAnalyzing} 
        repoUrl={targetRepo} 
        onCancel={() => setIsAnalyzing(false)} 
      />

      <ResultModal 
        run={selectedRun} 
        apiUrl={apiUrl}
        onClose={() => setSelectedRun(null)} 
      />

      <section className="dashboard-grid">
        <div className="runs-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow"><Sparkles size={16} /> Recent workflows</span>
              <div className="flex justify-between items-center w-full">
                <h2>Queue</h2>
                <div className="user-nav-mini">
                  <UserButton afterSignOutUrl="/" />
                </div>
              </div>
            </div>
            <div className="toolbar">
              <div className="search-box">
                <Search size={16} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search runs" />
              </div>
              <select value={status} onChange={(event) => setStatus(event.target.value as 'All' | RunStatus)}>
                <option>All</option>
                <option>Ready</option>
                <option>Review</option>
                <option>Running</option>
              </select>
            </div>
          </div>

          <div className="run-list">
            {filteredRuns.map((run) => (
              <article className="run-row" key={run.id}>
                <div className="run-main">
                  <div className="repo-icon">{run.repo.slice(0, 1).toUpperCase()}</div>
                  <div>
                    <div className="row-title">
                      <h3>{run.repo}</h3>
                      <span className={`status-pill ${statusClass(run.status)}`}>{run.status}</span>
                    </div>
                    <p>{run.goal}</p>
                    <div className="output-list">
                      {run.outputs.map((output) => <span key={output}>{output}</span>)}
                    </div>
                  </div>
                </div>
                <div className="run-meta">
                  <span className={`severity-pill ${severityClass(run.severity)}`}><ShieldAlert size={14} /> {run.severity}</span>
                  <strong>{run.score}%</strong>
                  <small><Clock3 size={13} /> {run.updated}</small>
                  <div className="flex items-center gap-2">
                    {run.status === 'Ready' && (
                      <button 
                        className="btn-primary" 
                        style={{ height: '36px', padding: '0 12px', fontSize: '12px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRun(run);
                        }}
                      >
                        <GitPullRequest size={14} /> Ship PR
                      </button>
                    )}
                    <button
                      aria-label={`Open ${run.repo}`}
                      onClick={() => setSelectedRun(run)}
                    >
                      <ArrowUpRight size={17} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="insight-panel">
          <GitHubStats user={user} />
          <div className="mt-6">
            <GitHubRepos apiUrl={apiUrl} onAnalyze={handleAnalyze} />
          </div>
          <div className="mt-6">
            <span className="eyebrow"><Filter size={16} /> Recommendation</span>
            <h2>Review architecture drift first.</h2>
            <p>AtlasStack identified potential misalignment in your core data flow. Review the generated map to align with best practices.</p>
            <div className="priority-stack">
              <div><strong>1</strong><span>Audit private repository security posture</span></div>
              <div><strong>2</strong><span>Generate architecture-aware remediation patches</span></div>
              <div><strong>3</strong><span>Schedule automated weekly drift scans</span></div>
            </div>
            <button className="ghost-button wide">Open review queue</button>
          </div>
        </aside>
      </section>
    </main>
  );
};
