import React, { useMemo, useState } from 'react';
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
type RunStatus = 'Ready' | 'Review' | 'Running';
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

const runs: AuditRun[] = [
  {
    id: 'RUN-1042',
    repo: 'atlasstack/platform',
    goal: 'Security and auth callback review',
    status: 'Review',
    score: 86,
    severity: 'Medium',
    updated: '12 min ago',
    owner: 'Core AI',
    outputs: ['runbook.md', 'patch.diff', 'risk brief'],
  },
  {
    id: 'RUN-1041',
    repo: 'client/web',
    goal: 'Dashboard route simplification',
    status: 'Ready',
    score: 94,
    severity: 'Low',
    updated: '48 min ago',
    owner: 'Frontend',
    outputs: ['ux brief', 'component map'],
  },
  {
    id: 'RUN-1040',
    repo: 'services/api',
    goal: 'Dependency upgrade planning',
    status: 'Running',
    score: 71,
    severity: 'High',
    updated: '1 hr ago',
    owner: 'Platform',
    outputs: ['upgrade plan'],
  },
];

const metrics = [
  { label: 'Active runs', value: '18', trend: '+6 this week', icon: <CircleDot size={19} /> },
  { label: 'Avg. health', value: '84%', trend: '+12 points', icon: <TrendingUp size={19} /> },
  { label: 'PR drafts', value: '32', trend: '9 ready', icon: <GitPullRequest size={19} /> },
  { label: 'Risks closed', value: '127', trend: 'last 30 days', icon: <CheckCircle2 size={19} /> },
];

const statusClass = (status: RunStatus) => status.toLowerCase();
const severityClass = (severity: Severity) => severity.toLowerCase();

export const DashboardPage: React.FC<{ onCreateRun: () => void }> = ({ onCreateRun }) => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'All' | RunStatus>('All');

  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      const matchesQuery = `${run.repo} ${run.goal} ${run.owner}`.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = status === 'All' || run.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [query, status]);

  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <div>
          <span className="eyebrow"><LayoutDashboard size={16} /> Workspace dashboard</span>
          <h1>Track every audit from first scan to shippable remediation.</h1>
          <p>The dashboard now focuses on three useful jobs: monitor runs, review generated outputs, and start the next scan.</p>
        </div>
        <button className="primary-button large" onClick={onCreateRun}>
          <Plus size={17} /> New run
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
              <h2>Run queue</h2>
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
          <span className="eyebrow"><Filter size={16} /> Next best action</span>
          <h2>Review the auth callback patch first.</h2>
          <p>AtlasStack found one medium-risk token lifecycle issue and prepared a minimal patch. Review it before generating broader refactors.</p>
          <div className="priority-stack">
            <div><strong>1</strong><span>Approve patch.diff for atlasstack/platform</span></div>
            <div><strong>2</strong><span>Export security brief for stakeholders</span></div>
            <div><strong>3</strong><span>Schedule weekly architecture drift scan</span></div>
          </div>
          <button className="ghost-button wide">Open review queue</button>
        </aside>
      </section>
    </main>
  );
};
