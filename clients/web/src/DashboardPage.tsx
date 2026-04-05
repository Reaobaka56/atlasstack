import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Home, GitBranch, Clock, BarChart3, Settings, ChevronRight,
  Github, Plus, Zap, Shield, TrendingUp, AlertTriangle,
  CheckCircle2, Calendar, Activity, Star, ArrowLeft,
  Search, RefreshCw, ExternalLink, Cpu, FileCode2
} from 'lucide-react';

// ── helpers ────────────────────────────────────────────────────────────────
const scoreColor = (s: number) =>
  s > 70 ? '#10b981' : s > 40 ? '#f59e0b' : '#ef4444';

const scoreLabel = (s: number) =>
  s > 70 ? 'Good' : s > 40 ? 'Needs Work' : 'Critical';

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

// ── types ───────────────────────────────────────────────────────────────────
interface Analysis {
  id: string;
  repo_url: string;
  status: string;
  health_score: number;
  created_at: string;
}

// ── sub-components ──────────────────────────────────────────────────────────
const NavItem = ({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group ${
      active
        ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
        : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
    }`}
  >
    <span className={`transition-colors ${active ? 'text-indigo-400' : 'text-slate-600 group-hover:text-slate-300'}`}>
      {icon}
    </span>
    {label}
  </button>
);

const StatCard = ({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  accent: string;
}) => (
  <div className="bg-[#13131f] border border-white/5 rounded-2xl p-5 flex items-start justify-between hover:border-white/10 transition-colors">
    <div>
      <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-black text-white tabular-nums">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
    </div>
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${accent}`}>{icon}</div>
  </div>
);

// ── main component ──────────────────────────────────────────────────────────
export const DashboardPage = ({
  token,
  apiUrl,
  onBack,
  onViewAnalysis,
}: {
  token: string;
  apiUrl: string;
  onBack: () => void;
  onViewAnalysis: (id: string, repoUrl: string) => void;
  key?: React.Key;
}) => {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState<'home' | 'analyses' | 'repos' | 'reports'>('home');
  const [search, setSearch] = useState('');
  const [tipIdx] = useState(() => Math.floor(Math.random() * TIPS.length));

  useEffect(() => {
    fetchAnalyses();
  }, [token]);

  const fetchAnalyses = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiUrl}/api/v1/analyses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(res.status === 401 ? 'Session expired.' : 'Failed to load history.');
      const data = await res.json();
      setAnalyses(Array.isArray(data) ? data : data.analyses || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = analyses.filter((a) =>
    a.repo_url.toLowerCase().includes(search.toLowerCase())
  );

  const avgHealth =
    analyses.length > 0
      ? Math.round(analyses.reduce((s, a) => s + (a.health_score || 0), 0) / analyses.length)
      : 0;

  const good = analyses.filter((a) => a.health_score > 70).length;
  const critical = analyses.filter((a) => a.health_score <= 40).length;

  const now = new Date();
  const greeting =
    now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';

  const dayLabel = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex h-screen bg-[#07070f] overflow-hidden text-slate-300">

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="w-60 shrink-0 flex flex-col border-r border-white/5 bg-[#0c0c18] py-6 px-3 gap-1 overflow-y-auto">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-3 mb-6">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <Zap className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="text-white font-black tracking-tight text-lg">AtlasStack</span>
        </div>

        {/* Primary nav */}
        <p className="text-[9px] uppercase tracking-widest font-black text-slate-600 px-3 mb-1">Menu</p>
        <NavItem icon={<Home className="w-4 h-4" />} label="Dashboard" active={activeNav === 'home'} onClick={() => setActiveNav('home')} />
        <NavItem icon={<Activity className="w-4 h-4" />} label="Analyses" active={activeNav === 'analyses'} onClick={() => setActiveNav('analyses')} />
        <NavItem icon={<GitBranch className="w-4 h-4" />} label="Repositories" active={activeNav === 'repos'} onClick={() => setActiveNav('repos')} />
        <NavItem icon={<BarChart3 className="w-4 h-4" />} label="Reports" active={activeNav === 'reports'} onClick={() => setActiveNav('reports')} />

        <div className="h-px bg-white/5 my-3" />

        {/* Recent repos */}
        <p className="text-[9px] uppercase tracking-widest font-black text-slate-600 px-3 mb-1">Recent Repos</p>
        {analyses.slice(0, 5).map((a) => (
          <button
            key={a.id}
            onClick={() => onViewAnalysis(a.id, a.repo_url)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-all group text-left w-full"
          >
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: scoreColor(a.health_score) }}
            />
            <span className="truncate">{a.repo_url.replace('https://github.com/', '')}</span>
          </button>
        ))}
        {analyses.length === 0 && !loading && (
          <p className="text-xs text-slate-600 px-3 py-2 italic">No repos yet</p>
        )}

        <div className="flex-1" />

        {/* AI Tip card */}
        <div className="mx-1 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/15">
          <div className="flex items-center gap-2 mb-2">
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">AI Tip</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">{TIPS[tipIdx]}</p>
        </div>

        {/* Back */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 mt-2 rounded-xl text-xs text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
        </button>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-8 space-y-8">

          {/* Greeting header */}
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">{dayLabel}</p>
            <h1 className="text-3xl font-black text-white mb-1">{greeting} 👋</h1>
            <p className="text-slate-400 text-sm">
              {analyses.length > 0
                ? `You have ${analyses.length} scanned repostitories. Average health: ${avgHealth}/100.`
                : "Let's scan your first repository and get some insights."}
            </p>
          </motion.div>

          {/* Quick action pills */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="flex flex-wrap gap-3"
          >
            {[
              { label: '+ Analyze Repo', icon: <Plus className="w-3.5 h-3.5" />, action: onBack, style: 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500/30' },
              { label: 'Refresh History', icon: <RefreshCw className="w-3.5 h-3.5" />, action: fetchAnalyses, style: 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/8' },
              { label: 'Connect GitHub', icon: <Github className="w-3.5 h-3.5" />, action: () => {}, style: 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/8' },
              { label: 'View Reports', icon: <BarChart3 className="w-3.5 h-3.5" />, action: () => setActiveNav('reports'), style: 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/8' },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border transition-all hover:scale-105 active:scale-95 ${item.style}`}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4"
          >
            <StatCard
              label="Total Scans"
              value={analyses.length}
              sub="All time"
              icon={<Activity className="w-5 h-5 text-indigo-400" />}
              accent="bg-indigo-500/10 border-indigo-500/20"
            />
            <StatCard
              label="Avg Health"
              value={`${avgHealth}/100`}
              sub={avgHealth > 70 ? 'Great shape' : avgHealth > 40 ? 'Needs work' : 'Attention needed'}
              icon={<Shield className="w-5 h-5 text-emerald-400" />}
              accent="bg-emerald-500/10 border-emerald-500/20"
            />
            <StatCard
              label="Healthy Repos"
              value={good}
              sub="Score > 70"
              icon={<CheckCircle2 className="w-5 h-5 text-green-400" />}
              accent="bg-green-500/10 border-green-500/20"
            />
            <StatCard
              label="Need Fixes"
              value={critical}
              sub="Score ≤ 40"
              icon={<AlertTriangle className="w-5 h-5 text-red-400" />}
              accent="bg-red-500/10 border-red-500/20"
            />
          </motion.div>

          {/* Main grid: recent analyses + activity */}
          <div className="grid lg:grid-cols-5 gap-6">

            {/* Recent Analyses (3/5) */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="lg:col-span-3 bg-[#0f0f1c] border border-white/5 rounded-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <h2 className="text-sm font-black text-white">Recent Analyses</h2>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-600 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search repos..."
                    className="bg-white/5 border border-white/8 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40 w-44"
                  />
                </div>
              </div>

              {/* Body */}
              <div className="divide-y divide-white/5">
                {loading ? (
                  <div className="py-16 flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                    <p className="text-xs text-slate-500">Loading your analyses...</p>
                  </div>
                ) : error ? (
                  <div className="py-12 text-center px-6">
                    <AlertTriangle className="w-8 h-8 text-red-400/50 mx-auto mb-2" />
                    <p className="text-red-400 text-sm">{error}</p>
                    <button onClick={fetchAnalyses} className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mx-auto">
                      <RefreshCw className="w-3 h-3" /> Retry
                    </button>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-16 text-center px-6">
                    <FileCode2 className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm font-semibold mb-1">
                      {search ? 'No matching repos' : 'No analyses yet'}
                    </p>
                    <p className="text-slate-600 text-xs mb-5">
                      {search ? 'Try a different search term.' : 'Scan your first repo to see insights here.'}
                    </p>
                    {!search && (
                      <button
                        onClick={onBack}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all hover:scale-105 active:scale-95"
                      >
                        + Analyze a Repository
                      </button>
                    )}
                  </div>
                ) : (
                  filtered.map((analysis, i) => (
                    <motion.button
                      key={analysis.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => onViewAnalysis(analysis.id, analysis.repo_url)}
                      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/3 transition-colors text-left group"
                    >
                      {/* repo icon */}
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center shrink-0">
                        <Github className="w-4 h-4 text-indigo-400" />
                      </div>

                      {/* name + url */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">
                          {analysis.repo_url.replace('https://github.com/', '')}
                        </p>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {relativeTime(analysis.created_at)}
                          <span className="mx-1">·</span>
                          <span className={`font-bold ${
                            analysis.status === 'done' ? 'text-emerald-500' : 'text-amber-500'
                          }`}>
                            {analysis.status}
                          </span>
                        </p>
                      </div>

                      {/* Health bar */}
                      <div className="w-24 shrink-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Health</span>
                          <span className="text-xs font-black" style={{ color: scoreColor(analysis.health_score) }}>
                            {analysis.health_score}
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${analysis.health_score}%`,
                              background: scoreColor(analysis.health_score),
                              boxShadow: `0 0 6px ${scoreColor(analysis.health_score)}60`,
                            }}
                          />
                        </div>
                        <p className="text-[9px] font-bold mt-0.5" style={{ color: scoreColor(analysis.health_score) }}>
                          {scoreLabel(analysis.health_score)}
                        </p>
                      </div>

                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 transition-colors shrink-0" />
                    </motion.button>
                  ))
                )}
              </div>
            </motion.div>

            {/* Right column (2/5) */}
            <div className="lg:col-span-2 flex flex-col gap-4">

              {/* Health Breakdown */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-[#0f0f1c] border border-white/5 rounded-2xl p-5"
              >
                <h2 className="text-xs font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-400" /> Health Breakdown
                </h2>
                {[
                  { label: 'Healthy repos', count: good, total: analyses.length, color: '#10b981' },
                  { label: 'Needs work', count: analyses.filter(a => a.health_score > 40 && a.health_score <= 70).length, total: analyses.length, color: '#f59e0b' },
                  { label: 'Critical', count: critical, total: analyses.length, color: '#ef4444' },
                ].map((item) => (
                  <div key={item.label} className="mb-3 last:mb-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">{item.label}</span>
                      <span className="text-xs font-bold text-white">{item.count}/{item.total}</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: item.total > 0 ? `${(item.count / item.total) * 100}%` : '0%' }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className="h-full rounded-full"
                        style={{ background: item.color, boxShadow: `0 0 8px ${item.color}50` }}
                      />
                    </div>
                  </div>
                ))}
              </motion.div>

              {/* Quick Goals */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-[#0f0f1c] border border-white/5 rounded-2xl p-5"
              >
                <h2 className="text-xs font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-400" /> Your Goals
                </h2>
                {[
                  { label: 'Scan 5 repos', done: Math.min(analyses.length, 5), total: 5 },
                  { label: 'Get avg score > 70', done: avgHealth > 70 ? 1 : 0, total: 1 },
                  { label: 'Connect GitHub', done: 0, total: 1 },
                ].map((g) => {
                  const pct = g.total > 0 ? (g.done / g.total) * 100 : 0;
                  return (
                    <div key={g.label} className="mb-3 last:mb-0">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-slate-400">{g.label}</span>
                        <span className="text-xs font-bold text-indigo-400">{Math.round(pct)}%</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.9, delay: 0.35 }}
                          className="h-full rounded-full bg-indigo-500"
                          style={{ boxShadow: '0 0 6px #6366f180' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </motion.div>

              {/* Recent Activity */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-[#0f0f1c] border border-white/5 rounded-2xl p-5 flex-1"
              >
                <h2 className="text-xs font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-400" /> Recent Activity
                </h2>
                {analyses.length === 0 ? (
                  <p className="text-xs text-slate-600 text-center py-6 italic">No activity yet</p>
                ) : (
                  <div className="space-y-3">
                    {analyses.slice(0, 4).map((a, i) => (
                      <div key={a.id} className="flex items-start gap-3">
                        <div
                          className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                          style={{ background: scoreColor(a.health_score) }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-300 font-medium truncate">
                            Scanned {a.repo_url.replace('https://github.com/', '')}
                          </p>
                          <p className="text-[10px] text-slate-600">{relativeTime(a.created_at)}</p>
                        </div>
                        <span
                          className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded border shrink-0"
                          style={{ color: scoreColor(a.health_score), borderColor: `${scoreColor(a.health_score)}30`, background: `${scoreColor(a.health_score)}10` }}
                        >
                          {a.health_score}/100
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
