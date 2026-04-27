import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Home, GitBranch, Clock, BarChart3, Settings, ChevronRight,
  Github, Plus, Zap, Shield, TrendingUp, AlertTriangle,
  CheckCircle2, Calendar, Activity, Star, ArrowLeft,
  Search, RefreshCw, ExternalLink, Cpu, FileCode2,
  Menu, X as CloseIcon, LogOut,
  MessageSquare, Send, X, MessagesSquare, Network
} from 'lucide-react';
import ArchitectureMap from './ArchitectureMap';
import { useAuth } from '@clerk/react';

// ── helpers ────────────────────────────────────────────────────────────────
const scoreColor = (s: number) =>
  s > 70 ? 'var(--color-silver-100)' : s > 40 ? 'var(--color-silver-300)' : '#ef4444';

const scoreLabel = (s: number) =>
  s > 70 ? 'Optimal' : s > 40 ? 'Fair' : 'Critical';

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
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all group border ${
      active
        ? 'bg-white/10 text-white border-white/20 shadow-lg'
        : 'text-silver-500 hover:text-white hover:bg-white/5 border-transparent'
    }`}
  >
    <span className={`transition-colors ${active ? 'text-white' : 'text-silver-500 group-hover:text-silver-300'}`}>
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
  <div className="liquid-glass border-white/5 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 flex flex-col justify-between hover:border-white/20 transition-all hover:scale-[1.02] group shadow-2xl">
    <div className="flex items-start justify-between mb-4">
      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center border shadow-inner ${accent}`}>
        {icon}
      </div>
      <div className="text-right">
        <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] font-black text-silver-500 mb-1">{label}</p>
        <p className="text-2xl sm:text-3xl font-black text-white tabular-nums metallic-text">{value}</p>
      </div>
    </div>
    <p className="text-[10px] sm:text-xs text-silver-600 font-medium group-hover:text-silver-400 transition-colors">{sub}</p>
  </div>
);

// ── main component ──────────────────────────────────────────────────────────
export const DashboardPage = ({
  apiUrl,
  onBack,
  onViewAnalysis,
}: {
  token?: string;
  apiUrl: string;
  onBack: () => void;
  onViewAnalysis: (id: string, repoUrl: string) => void;
  key?: React.Key;
}) => {
  const { getToken } = useAuth();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState<'home' | 'analyses' | 'repos' | 'reports'>('home');
  const [search, setSearch] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [tipIdx] = useState(() => Math.floor(Math.random() * TIPS.length));

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user'|'ai', text: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const webSocket = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Architecture Map State
  const [selectedArchGraph, setSelectedArchGraph] = useState<any>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, isAiTyping]);

  // WebSocket for Chat
  useEffect(() => {
    let socket: WebSocket;
    (async () => {
      const clerkToken = await getToken();
      if (!clerkToken) return;
      const wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws?token=' + encodeURIComponent(clerkToken);
      socket = new WebSocket(wsUrl);
      webSocket.current = socket;
      socket.onopen = () => console.log('Dashboard Chat Socket Connected');
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'chat_response') {
            setIsAiTyping(false);
            setChatMessages(prev => [...prev, { role: 'ai', text: data.text }]);
          }
        } catch (e) {
          console.error('WS Error:', e);
        }
      };
      socket.onclose = () => console.log('Dashboard Chat Socket Disconnected');
    })();
    return () => socket?.close();
  }, [apiUrl, getToken]);

  const handleSendChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || !webSocket.current) return;

    const text = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', text }]);
    setChatInput('');
    setIsAiTyping(true);

    webSocket.current.send(JSON.stringify({
      type: 'chat',
      text: text
    }));
  };

  useEffect(() => {
    fetchAnalyses();
  }, [token]);

  const fetchAnalyses = async () => {
    try {
      setLoading(true);
      const clerkToken = await getToken();
      if (!clerkToken) {
        setAnalyses([]);
        setLoading(false);
        return;
      }
      const res = await fetch(`${apiUrl}/api/v1/analyses`, {
        headers: { Authorization: `Bearer ${clerkToken}` },
      });
      if (!res.ok) {
        if (res.status === 401) { setAnalyses([]); return; }
        throw new Error('Failed to load history.');
      }
      const data = await res.json();
      setAnalyses(Array.isArray(data) ? data : data.analyses || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch graph for the most recent analysis automatically
  useEffect(() => {
    if (analyses.length > 0 && !selectedArchGraph) {
        const fetchRecentGraph = async () => {
            try {
                const clerkToken = await getToken();
                const recent = analyses[0];
                const res = await fetch(`${apiUrl}/api/v1/analyses/${recent.id}/graph`, {
                    headers: clerkToken ? { Authorization: `Bearer ${clerkToken}` } : {}
                });
                if (res.ok) {
                    const data = await res.json();
                    setSelectedArchGraph(data);
                }
            } catch (e) {
                console.warn("Could not fetch recent graph for dashboard preview", e);
            }
        };
        fetchRecentGraph();
    }
  }, [analyses, getToken]);

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

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 mb-10 cursor-pointer" onClick={onBack}>
        <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl overflow-hidden p-1.5">
          <img src="/logo.png" alt="AtlasStack Logo" className="w-full h-full object-contain" />
        </div>
        <span className="text-white font-black tracking-tighter text-xl">AtlasStack</span>
      </div>

      {/* Primary nav */}
      <div className="space-y-1 mb-10">
        <p className="text-[10px] uppercase tracking-[0.3em] font-black text-silver-700 px-4 mb-4">Navigation</p>
        <NavItem icon={<Home className="w-4 h-4" />} label="Overview" active={activeNav === 'home'} onClick={() => { setActiveNav('home'); setIsSidebarOpen(false); }} />
        <NavItem icon={<Activity className="w-4 h-4" />} label="Scans" active={activeNav === 'analyses'} onClick={() => { setActiveNav('analyses'); setIsSidebarOpen(false); }} />
        <NavItem icon={<GitBranch className="w-4 h-4" />} label="Repos" active={activeNav === 'repos'} onClick={() => { setActiveNav('repos'); setIsSidebarOpen(false); }} />
        <NavItem icon={<BarChart3 className="w-4 h-4" />} label="Insights" active={activeNav === 'reports'} onClick={() => { setActiveNav('reports'); setIsSidebarOpen(false); }} />
      </div>

      {/* Recent repos */}
      <div className="mb-10">
        <p className="text-[10px] uppercase tracking-[0.3em] font-black text-silver-700 px-4 mb-4">Pinned Repos</p>
        <div className="space-y-1 px-2">
          {analyses.slice(0, 4).map((a) => (
            <button
              key={a.id}
              onClick={() => onViewAnalysis(a.id, a.repo_url)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-silver-500 hover:text-white hover:bg-white/5 transition-all group text-left w-full"
            >
              <div
                className="w-2 h-2 rounded-full shrink-0 shadow-[0_0_8px_rgba(255,255,255,0.2)]"
                style={{ background: scoreColor(a.health_score) }}
              />
              <span className="truncate flex-1">{a.repo_url.split('/').pop()}</span>
              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
          {analyses.length === 0 && !loading && (
            <p className="text-[10px] text-silver-800 px-4 italic">No recent activity</p>
          )}
        </div>
      </div>

      <div className="flex-1" />

      {/* AI Tip card */}
      <div className="mx-2 p-5 rounded-3xl bg-white/5 border border-white/10 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg bg-yellow-400/10 flex items-center justify-center">
            <Cpu className="w-3.5 h-3.5 text-yellow-500" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-silver-400">Engineering Intel</span>
        </div>
        <p className="text-[11px] text-silver-500 leading-relaxed font-medium">{TIPS[tipIdx]}</p>
      </div>

      {/* Logout */}
      <button
        onClick={onBack}
        className="flex items-center gap-3 px-4 py-4 rounded-2xl text-xs font-bold text-silver-600 hover:text-white hover:bg-red-500/10 transition-all group border border-transparent hover:border-red-500/20"
      >
        <LogOut className="w-4 h-4 group-hover:rotate-12 transition-transform" /> Sign Out
      </button>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      
      {/* ── Mobile Header ─────────────────────────────────────────────────── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 px-6 py-4 flex items-center justify-between liquid-glass border-t-0 border-x-0 rounded-none shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center p-1">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-white font-black tracking-tighter text-lg underline decoration-white/10 decoration-2 underline-offset-4">AtlasStack</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10"
        >
          <Menu className="w-5 h-5 text-white" />
        </button>
      </header>

      {/* ── Sidebar (Desktop) ─────────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-72 shrink-0 flex-col border-r border-white/5 liquid-glass rounded-none py-10 px-4 gap-1 overflow-y-auto">
        <SidebarContent />
      </aside>

      {/* ── Sidebar (Mobile Drawer) ───────────────────────────────────────── */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="lg:hidden fixed inset-y-0 left-0 w-80 z-50 flex flex-col liquid-glass rounded-none py-10 px-6 shadow-2xl border-y-0 border-l-0"
            >
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="absolute top-8 right-6 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10"
              >
                <CloseIcon className="w-5 h-5 text-white" />
              </button>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto pt-24 lg:pt-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-10 lg:px-16 py-8 sm:py-12 space-y-8 sm:space-y-12">

          {/* Greeting header */}
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="relative">
            <div className="absolute -top-4 -left-4 w-32 h-32 bg-white/5 blur-[80px] -z-10 rounded-full" />
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
              <div className="text-center sm:text-left">
                <p className="text-[10px] text-silver-600 uppercase tracking-[0.4em] font-black mb-3 ml-1">{dayLabel}</p>
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white mb-3 tracking-tight">
                  {greeting}, <span className="metallic-text">User</span>
                </h1>
                <p className="text-silver-400 text-sm font-medium opacity-80 pl-1 max-w-md leading-relaxed mx-auto sm:mx-0">
                  {analyses.length > 0
                    ? `You've deployed ${analyses.length} systems. Global infrastructure stability is currently at ${avgHealth}%.`
                    : "No systems detected. Initialize your first node to begin scanning."}
                </p>
              </div>
              <button
                onClick={onBack}
                className="btn-pill btn-pill-active py-3 sm:py-4 px-6 sm:px-8 text-xs sm:text-sm shadow-[0_0_30px_rgba(255,255,255,0.1)] flex items-center justify-center gap-3 group w-full sm:w-auto"
              >
                <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" /> New Analysis
              </button>
            </div>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            <StatCard
              label="Global Scans"
              value={analyses.length}
              sub="Accumulated Node Intelligence"
              icon={<Activity className="w-5 h-5 text-white" />}
              accent="bg-white/5 border-white/10"
            />
            <StatCard
              label="Fleet Health"
              value={`${avgHealth}%`}
              sub={avgHealth > 70 ? 'Operational Optimal' : 'Needs Optimization'}
              icon={<Shield className="w-5 h-5 text-emerald-400" />}
              accent="bg-emerald-400/5 border-emerald-400/10"
            />
            <StatCard
              label="Stable Nodes"
              value={good}
              sub="Zero Vulnerability Detected"
              icon={<CheckCircle2 className="w-5 h-5 text-silver-300" />}
              accent="bg-white/5 border-white/10"
            />
            <StatCard
              label="Threat Alerts"
              value={critical}
              sub="Immediate Action Required"
              icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
              accent="bg-red-500/5 border-red-500/10"
            />
          </motion.div>

          {/* Main grid: recent analyses + activity */}
          <div className="grid lg:grid-cols-12 gap-8">

            {/* Recent Analyses (8/12) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="lg:col-span-8 liquid-glass border-white/5 rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl relative"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 blur-[100px] -z-10" />
              
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between px-8 py-8 gap-4 border-b border-white/5">
                <h2 className="text-xl font-black text-white metallic-text">Recent Infrastructure Scans</h2>
                <div className="relative">
                  <Search className="w-4 h-4 text-silver-600 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter nodes..."
                    className="bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm text-white placeholder:text-silver-700 focus:outline-none focus:border-white/20 w-full sm:w-64 transition-all"
                  />
                </div>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-6 space-y-3">
                {loading ? (
                  <div className="py-24 flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-white/10 border-t-white rounded-full animate-spin" />
                    <p className="text-[10px] uppercase tracking-[0.3em] font-black text-silver-600">Syncing Node History...</p>
                  </div>
                ) : error ? (
                  <div className="py-16 text-center px-6">
                    <AlertTriangle className="w-12 h-12 text-red-500/20 mx-auto mb-4" />
                    <p className="text-red-400 text-sm font-bold mb-4">{error}</p>
                    <button onClick={fetchAnalyses} className="btn-pill py-2.5 px-6 text-xs flex items-center gap-2 mx-auto">
                      <RefreshCw className="w-3.5 h-3.5" /> Reconnect
                    </button>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-24 text-center px-6">
                    <FileCode2 className="w-16 h-16 text-silver-900 mx-auto mb-6" />
                    <p className="text-white text-lg font-black mb-2">
                      {search ? 'Zero Matches' : 'No Infrastructure Active'}
                    </p>
                    <p className="text-silver-600 text-sm mb-8">
                      {search ? 'Adjust your filtering parameters.' : 'Deploy your first node to initialize monitoring.'}
                    </p>
                    {!search && (
                      <button
                        onClick={onBack}
                        className="btn-pill btn-pill-active py-4 px-10 font-black text-sm"
                      >
                        Initialize First Node
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filtered.map((analysis, i) => (
                      <motion.button
                        key={analysis.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => onViewAnalysis(analysis.id, analysis.repo_url)}
                        className="w-full flex items-center gap-5 px-6 py-5 rounded-[1.5rem] bg-white/0 hover:bg-white/5 transition-all text-left group border border-transparent hover:border-white/10 relative overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        
                        {/* repo icon */}
                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 transition-transform">
                          <Github className="w-5 h-5 text-white" />
                        </div>

                        {/* name + url */}
                        <div className="flex-1 min-w-0 z-10">
                          <p className="text-base font-black text-white truncate mb-1">
                            {analysis.repo_url.split('/').pop()}
                          </p>
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="text-[10px] text-silver-600 flex items-center gap-1.5 uppercase font-black tracking-widest leading-none">
                              <Clock className="w-3 h-3" />
                              {relativeTime(analysis.created_at)}
                            </p>
                            <span className="w-1 h-1 bg-silver-800 rounded-full" />
                            <span className={`text-[10px] font-black uppercase tracking-widest leading-none ${
                              analysis.status === 'done' ? 'text-emerald-500' : 'text-yellow-500'
                            }`}>
                              {analysis.status}
                            </span>
                          </div>
                        </div>

                        {/* Health Progress */}
                        <div className="hidden sm:block w-32 shrink-0 z-10 ml-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-silver-700">Stability</span>
                            <span className="text-xs font-black text-white">
                              {analysis.health_score}%
                            </span>
                          </div>
                          <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5 p-[2px]">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${analysis.health_score}%` }}
                              className="h-full rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                              style={{ 
                                background: analysis.health_score > 70 ? 'var(--color-silver-100)' : analysis.health_score > 40 ? 'var(--color-silver-400)' : '#ef4444'
                              }}
                            />
                          </div>
                        </div>

                        <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-all group-hover:border-transparent shrink-0">
                          <ChevronRight className="w-5 h-5" />
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>

            {/* Right column (4/12) */}
            <div className="lg:col-span-4 flex flex-col gap-8">

              {/* Health Breakdown */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="liquid-glass border-white/5 rounded-[2.5rem] p-8 shadow-xl"
              >
                <h2 className="text-xs font-black text-white uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-silver-400" /> Infrastructure Stability
                </h2>
                <div className="space-y-6">
                  {[
                    { label: 'High Stability Fleet', count: good, total: analyses.length, color: 'var(--color-silver-100)' },
                    { label: 'Awaiting Optimization', count: analyses.filter(a => a.health_score > 40 && a.health_score <= 70).length, total: analyses.length, color: 'var(--color-silver-400)' },
                    { label: 'Critical Failure Risk', count: critical, total: analyses.length, color: '#ef4444' },
                  ].map((item) => (
                    <div key={item.label} className="group">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black uppercase tracking-wider text-silver-500 group-hover:text-silver-300 transition-colors">{item.label}</span>
                        <div className="text-right">
                          <span className="text-xs font-black text-white block">{item.count}</span>
                          <span className="text-[8px] font-black text-silver-700 uppercase">Nodes</span>
                        </div>
                      </div>
                      <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 p-[2px]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: item.total > 0 ? `${(item.count / item.total) * 100}%` : '0%' }}
                          transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
                          className="h-full rounded-full shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                          style={{ background: item.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Quick Goals */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="liquid-glass border-white/5 rounded-[2.5rem] p-8 shadow-xl bg-gradient-to-br from-white/[0.02] to-transparent"
              >
                <h2 className="text-xs font-black text-white uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                  <Star className="w-5 h-5 text-yellow-400" /> Progression
                </h2>
                <div className="space-y-6">
                  {[
                    { label: 'Node expansion (5 Nodes)', done: Math.min(analyses.length, 5), total: 5 },
                    { label: 'Fleet Optimization (70% Avg)', done: avgHealth > 70 ? 1 : 0, total: 1 },
                    { label: 'Cloud Uplink (Auth)', done: 1, total: 1 },
                  ].map((g) => {
                    const pct = g.total > 0 ? (g.done / g.total) * 100 : 0;
                    return (
                      <div key={g.label}>
                        <div className="flex justify-between mb-3 items-end">
                          <span className="text-[10px] font-black uppercase text-silver-500 max-w-[140px] leading-tight">{g.label}</span>
                          <span className="text-sm font-black text-white italic">{Math.round(pct)}%</span>
                        </div>
                        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 1.5, delay: 0.4 }}
                            className="h-full rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.5)]"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>

              {/* Activity Log */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="liquid-glass border-white/5 rounded-[2.5rem] p-8 flex-1 shadow-xl"
              >
                <h2 className="text-xs font-black text-white uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-silver-600" /> Activity Log
                </h2>
                {analyses.length === 0 ? (
                  <p className="text-xs text-silver-800 text-center py-12 italic font-medium">No signals detected.</p>
                ) : (
                  <div className="space-y-6 relative ml-2">
                    <div className="absolute left-0 top-1 bottom-1 w-px bg-white/5" />
                    {analyses.slice(0, 4).map((a, i) => (
                      <div key={a.id} className="flex items-start gap-5 relative group">
                        <div
                          className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 z-10 shadow-lg border border-black transition-transform group-hover:scale-150"
                          style={{ 
                            background: a.health_score > 70 ? 'var(--color-silver-100)' : a.health_score > 40 ? 'var(--color-silver-400)' : '#ef4444',
                            boxShadow: `0 0 10px ${a.health_score > 70 ? 'rgba(255,255,255,0.3)' : 'transparent'}`
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-black truncate group-hover:metallic-text transition-all">
                            Node {a.repo_url.split('/').pop()} Scan
                          </p>
                          <p className="text-[10px] text-silver-700 font-bold uppercase tracking-widest mt-1">{relativeTime(a.created_at)}</p>
                        </div>
                        <span
                          className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded border shrink-0"
                          style={{ color: a.health_score > 70 ? 'var(--color-silver-100)' : a.health_score > 40 ? 'var(--color-silver-400)' : '#ef4444', borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)' }}
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

          {/* Architecture Preview Section */}
          {selectedArchGraph && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="liquid-glass border-white/5 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-10 w-64 h-64 bg-white/5 blur-[120px] -z-10 rounded-full" />
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl">
                    <Network className="w-7 h-7 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white metallic-text tracking-tighter">Fleet Command: Node Topology</h3>
                    <p className="text-silver-600 font-bold text-xs mt-1 uppercase tracking-widest">Active visualization for {selectedArchGraph.repo?.split('/').pop() || 'Recent Node'}</p>
                  </div>
                </div>
                <button
                   onClick={() => onViewAnalysis(analyses[0].id, analyses[0].repo_url)}
                   className="btn-pill py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] border-white/10 hover:border-white/20 hover:bg-white/5 text-silver-400 flex items-center gap-2"
                >
                  Enter IDE <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
              
              <div className="rounded-[2.5rem] overflow-hidden bg-black/40 border border-white/5 p-8 backdrop-blur-xl shadow-2xl">
                <ArchitectureMap graph={selectedArchGraph} />
              </div>
            </motion.div>
          )}

        </div>
      </main>

      {/* Floating AI Chat Widget */}
      <div className="fixed bottom-8 right-8 z-50">
        <AnimatePresence>
          {isChatOpen && (
              <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="mb-6 w-[calc(100vw-32px)] sm:w-[400px] h-[500px] sm:h-[550px] liquid-glass rounded-[2rem] border-white/10 shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
                    <MessagesSquare className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">AI Architect</h3>
                    <div className="flex items-center gap-1.5 text-[8px] text-emerald-400 font-bold uppercase tracking-widest">
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Fleet Wide Intelligence
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="text-silver-700 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {chatMessages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                    <div className="w-16 h-16 mb-4 flex items-center justify-center p-2 bg-white/5 rounded-2xl border border-white/10">
                      <img src="/logo.png" alt="Logo" className="w-full h-full object-contain grayscale opacity-60" />
                    </div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-silver-700">Fleet Link Active.<br/>Monitoring node cluster health.</p>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-2xl text-xs font-medium leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-white text-black rounded-tr-none' 
                        : 'bg-white/5 text-silver-300 border border-white/10 rounded-tl-none'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isAiTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white/5 text-silver-300 border border-white/10 p-4 rounded-2xl rounded-tl-none flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-silver-700 animate-bounce" />
                      <div className="w-1.5 h-1.5 rounded-full bg-silver-700 animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-silver-700 animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSendChat} className="p-6 bg-black/40 border-t border-white/5">
                <div className="relative">
                  <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask AtlasStack AI..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-5 pr-14 text-xs font-medium text-white focus:outline-none focus:border-white/20 transition-all"
                  />
                  <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white text-black rounded-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95 border border-white/10 group ${
            isChatOpen ? 'bg-white text-black' : 'liquid-glass text-white'
          }`}
        >
          {isChatOpen ? <X className="w-7 h-7" /> : <MessageSquare className="w-7 h-7 group-hover:scale-110 transition-transform" />}
          {!isChatOpen && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 border-2 border-black rounded-full flex items-center justify-center">
               <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            </div>
          )}
        </button>
      </div>

    </div>
  );
};

