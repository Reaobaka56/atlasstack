export type RunStatus = 'Ready' | 'Review' | 'Running';
export type Severity = 'Low' | 'Medium' | 'High';
export type RunGoal = 'architecture' | 'security' | 'upgrade';
export type RunOutput = 'runbook' | 'pull-request' | 'brief';

export interface AuditRun {
  id: string;
  repo: string;
  goal: string;
  status: RunStatus;
  score: number;
  severity: Severity;
  updatedAt: string;
  owner: string;
  outputs: string[];
}

export interface NewRunPayload {
  repoUrl: string;
  goal: RunGoal;
  output: RunOutput;
}

const STORAGE_KEY = 'atlasstack_audit_runs';

const goalLabels: Record<RunGoal, string> = {
  architecture: 'Architecture review',
  security: 'Security scan',
  upgrade: 'Dependency upgrade plan',
};

const goalDefaults: Record<RunGoal, Pick<AuditRun, 'score' | 'severity' | 'outputs'>> = {
  architecture: { score: 82, severity: 'Medium', outputs: ['architecture map', 'runbook.md'] },
  security: { score: 76, severity: 'High', outputs: ['risk brief', 'patch queue'] },
  upgrade: { score: 88, severity: 'Low', outputs: ['upgrade plan', 'dependency brief'] },
};

const outputLabels: Record<RunOutput, string> = {
  runbook: 'prioritized runbook',
  'pull-request': 'pull request draft',
  brief: 'executive brief',
};

export const seedRuns: AuditRun[] = [
  {
    id: 'RUN-1042',
    repo: 'atlasstack/platform',
    goal: 'Security and auth callback review',
    status: 'Review',
    score: 86,
    severity: 'Medium',
    updatedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
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
    updatedAt: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
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
    updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    owner: 'Platform',
    outputs: ['upgrade plan'],
  },
];

export const repoDisplayName = (repoUrl: string) => {
  const normalized = repoUrl.trim().replace(/\.git$/, '').replace(/\/$/, '');
  try {
    const url = new URL(normalized);
    const parts = url.pathname.split('/').filter(Boolean);
    return parts.length >= 2 ? parts.slice(-2).join('/') : url.hostname;
  } catch {
    const parts = normalized.split('/').filter(Boolean);
    return parts.length >= 2 ? parts.slice(-2).join('/') : normalized || 'new/repository';
  }
};

const isAuditRun = (value: unknown): value is AuditRun => {
  if (!value || typeof value !== 'object') return false;
  const run = value as Partial<AuditRun>;
  return Boolean(run.id && run.repo && run.goal && run.status && typeof run.score === 'number' && run.updatedAt);
};

export const loadStoredRuns = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedRuns;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(isAuditRun) ? parsed : seedRuns;
  } catch {
    return seedRuns;
  }
};

export const saveStoredRuns = (runs: AuditRun[]) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
  } catch {
    // Storage can fail in restricted browser contexts; the in-memory state still works.
  }
};

export const createAuditRun = ({ repoUrl, goal, output }: NewRunPayload): AuditRun => {
  const defaults = goalDefaults[goal];
  const selectedOutput = outputLabels[output];

  return {
    id: `RUN-${Date.now().toString().slice(-6)}`,
    repo: repoDisplayName(repoUrl),
    goal: `${goalLabels[goal]} for ${repoDisplayName(repoUrl)}`,
    status: 'Running',
    score: defaults.score,
    severity: defaults.severity,
    updatedAt: new Date().toISOString(),
    owner: 'You',
    outputs: Array.from(new Set([...defaults.outputs, selectedOutput])),
  };
};

export const mapApiAnalyses = (payload: unknown): AuditRun[] => {
  const records = Array.isArray((payload as { analyses?: unknown[] })?.analyses)
    ? (payload as { analyses: unknown[] }).analyses
    : [];

  return records.map((record, index) => {
    const row = record as {
      id?: string;
      repo_url?: string;
      status?: string;
      health_score?: number;
      created_at?: string;
    };
    const score = typeof row.health_score === 'number' ? row.health_score : 0;
    return {
      id: row.id || `API-${index}`,
      repo: repoDisplayName(row.repo_url || 'unknown/repository'),
      goal: 'Saved repository analysis',
      status: row.status === 'completed' ? 'Ready' : row.status === 'failed' ? 'Review' : 'Running',
      score,
      severity: score > 80 ? 'Low' : score > 55 ? 'Medium' : 'High',
      updatedAt: row.created_at || new Date().toISOString(),
      owner: 'AtlasStack API',
      outputs: ['saved analysis'],
    };
  });
};
