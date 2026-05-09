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
import { AuditRun, RunStatus, Severity } from './auditRuns';

const statusClass = (status: RunStatus) => status.toLowerCase();
const severityClass = (severity: Severity) => severity.toLowerCase();

const relativeTime = (date: string) => {
  const timestamp = new Date(date).getTime();
  if (Number.isNaN(timestamp)) return 'just now';

  const diff = Date.now() - timestamp;
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const getPrimaryAction = (runs: AuditRun[]) => {
  const reviewRun = runs.find((run) => run.status === 'Review');
  const highRiskRun = runs.find((run) => run.severity === 'High');
  const runningRun = runs.find((run) => run.status === 'Running');
  return reviewRun || highRiskRun || runningRun || runs[0];
};

export const DashboardPage: React.FC<{ runs: AuditRun[]; onCreateRun: () => void }> = ({ runs, onCreateRun }) => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'All' | RunStatus>('All');

  const metrics = useMemo(() => {
    const averageScore = runs.length
      ? Math.round(runs.reduce((total, run) => total + run.score, 0) / runs.length)
      : 0;
    const readyRuns = runs.filter((run) => run.status === 'Ready').length;
    const reviewRuns = runs.filter((run) => run.status === 'Review').length;
    const closedRisks = runs.reduce((total, run) => total + Math.max(1, run.outputs.length), 0);

    return [
      { label: 'Active runs', value: runs.length.toString(), trend: `${runs.filter((run) => run.status === 'Running').length} running`, icon: <CircleDot size={19} /> },
      { label: 'Avg. health', value: `${averageScore}%`, trend: runs.length ? 'from current queue' : 'no runs yet', icon: <TrendingUp size={19} /> },
      { label: 'PR drafts', value: readyRuns.toString(), trend: `${reviewRuns} in review`, icon: <GitPullRequest size={19} /> },
      { label: 'Artifacts', value: closedRisks.toString(), trend: 'generated outputs', icon: <CheckCircle2 size={19} /> },
    ];
  }, [runs]);

  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      const matchesQuery = `${run.repo} ${run.goal} ${run.owner}`.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = status === 'All' || run.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [query, runs, status]);

  const primaryAction = useMemo(() => getPrimaryAction(runs), [runs]);

  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <div>
          <span className="eyebrow"><LayoutDashboard size={16} /> Workspace dashboard</span>
          <h1>Track every audit from first scan to shippable remediation.</h1>
          <p>The dashboard is now driven by created, persisted, or API-loaded runs instead of a fixed static queue.</p>
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
            {filteredRuns.length ? filteredRuns.map((run) => (
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
                  <small><Clock3 size={13} /> {relativeTime(run.updatedAt)}</small>
                  <button aria-label={`Open ${run.repo}`}><ArrowUpRight size={17} /></button>
                </div>
              </article>
            )) : (
              <div className="empty-state">
                <h3>No matching runs</h3>
                <p>Try clearing your filters or create a new audit from the studio.</p>
                <button className="ghost-button" onClick={onCreateRun}>Create run</button>
              </div>
            )}
          </div>
        </div>

        <aside className="insight-panel">
          <span className="eyebrow"><Filter size={16} /> Next best action</span>
          {primaryAction ? (
            <>
              <h2>{primaryAction.status === 'Running' ? 'Let the current scan finish.' : `Review ${primaryAction.repo} first.`}</h2>
              <p>{primaryAction.goal} is the highest-priority item in the current queue based on status and severity.</p>
              <div className="priority-stack">
                <div><strong>1</strong><span>Open {primaryAction.repo} and inspect generated evidence</span></div>
                <div><strong>2</strong><span>Export {primaryAction.outputs[0] || 'the runbook'} for reviewers</span></div>
                <div><strong>3</strong><span>Start the next targeted scan from Studio</span></div>
              </div>
            </>
          ) : (
            <>
              <h2>Create your first audit run.</h2>
              <p>The panel will update once a repository has been submitted or loaded from the API.</p>
            </>
          )}
          <button className="ghost-button wide" onClick={onCreateRun}>Open studio</button>
        </aside>
      </section>
    </main>
  );
};
