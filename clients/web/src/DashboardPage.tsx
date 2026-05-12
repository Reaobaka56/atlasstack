import React, { useMemo, useState, useEffect } from 'react';
import { useAuth, UserButton, useUser } from '@clerk/react';
import { motion } from 'motion/react';
import {
  ArrowUpRight,
  CheckCircle2,
  CircleDot,
  Clock3,
  Filter,
  GitPullRequest,
  LayoutDashboard,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

// ── Error Boundary ──────────────────────────────────────────────
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
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
        <div style={{padding: 32, color: '#ef4444', background: '#000', minHeight: '100vh', fontFamily: 'sans-serif'}}>
          <h1>Something went wrong.</h1>
          <pre style={{background: '#111', padding: 16, borderRadius: 8}}>{this.state.error?.toString()}</pre>
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
  const diff = Date.now() - new Date(dateStr).getTime();
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
          <h4 className="m-0 text-sm font-semibold">{githubAccount?.username || user.username || 'GitHub Connected'}</h4>
          <span className="text-xs text-indigo-500 font-medium">Verified Identity</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 border-t border-indigo-100/30 pt-4">
        <div className="stat-item">
          <span className="label">Repos</span>
          <span className="value">--</span>
        </div>
        <div className="stat-item">
          <span className="label">Stars</span>
          <span className="value">--</span>
        </div>
        <div className="stat-item">
          <span className="label">Private</span>
          <span className="value">Yes</span>
        </div>
      </div>
    </article>
  );
};

export const DashboardPage: React.FC<{ apiUrl: string; onCreateRun: () => void }> = ({ apiUrl, onCreateRun }) => {
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

  useEffect(() => {
    const fetchAnalyses = async () => {
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
            repo: a.repo_url.split('/').pop() || a.repo_url,
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
    };

    fetchAnalyses();
  }, [apiUrl, getToken]);

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
          <img src="/logo_modern.png" alt="" className="brand-logo-img" />
          <span className="eyebrow"><LayoutDashboard size={16} /> {user?.firstName ? `${user.firstName}'s` : 'Workspace'} dashboard</span>
        </div>
        <div>
          <h1>Welcome back, {user?.firstName || 'Engineer'}.</h1>
          <p>You have {backendRuns.length} active analyses. Connect more repositories to generate deeper architectural insights.</p>
        </div>
        <button className="primary-button large" onClick={onCreateRun}>
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
                  <button aria-label={`Open ${run.repo}`}><ArrowUpRight size={17} /></button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="insight-panel">
          <GitHubStats user={user} />
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
