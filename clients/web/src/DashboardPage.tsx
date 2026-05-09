import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Home, GitBranch, Clock, BarChart3, Settings, ChevronRight,
  Github, Plus, Zap, Shield, TrendingUp, AlertTriangle,
  CheckCircle2, Calendar, Activity, Star, ArrowLeft,
  Search, RefreshCw, ExternalLink, Cpu, FileCode2,
  Menu, X as CloseIcon, LogOut, Wifi,
  MessageSquare, Send, X, MessagesSquare, Network, Lock, Sparkles, Filter, MoreHorizontal
} from 'lucide-react';
import ArchitectureMap from './ArchitectureMap';
import { useAuth, useClerk } from '@clerk/react';

// ── Helpers ────────────────────────────────────────────────────────
const scoreColor = (s: number) =>
  s > 70 ? '#10b981' : s > 40 ? '#f59e0b' : '#ef4444';

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

// ── Types ───────────────────────────────────────────────────────────
interface Analysis {
  id: string;
  repo_url: string;
  status: string;
  health_score: number;
  created_at: string;
}

// ── Local Show Helper ──────────────────────────────────────────────
const Show = ({ when, children }: { when: 'signed-in' | 'signed-out'; children: React.ReactNode }) => {
  const { isSignedIn } = useAuth();
  if (when === 'signed-in' && isSignedIn) return <>{children}</>;
  if (when === 'signed-out' && !isSignedIn) return <>{children}</>;
  return null;
};

// ── Professional Components ────────────────────────────────────────

const NavItem = ({ icon, label, active = false, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all group ${
      active 
        ? 'bg-white/10 text-white border border-white/10 shadow-[0_0_20px_rgba(255,255,255,0.05)]' 
        : 'text-silver-600 hover:text-white hover:bg-white/5 border border-transparent'
    }`}
  >
    <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
      {icon}
    </div>
    <span className="text-xs font-bold tracking-tight">{label}</span>
    {active && <div className="ml-auto w-1 h-4 rounded-full bg-white shadow-[0_0_10px_#fff]" />}
  </div>
);

const StatCard = ({ label, value, sub, icon, color }: { label: string; value: string | number; sub: string; icon: React.ReactElement<{ className?: string }>; color: string }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="liquid-glass p-6 rounded-[1.25rem] border-white/5 relative overflow-hidden group hover:border-white/10 transition-all"
  >
    <div className={`absolute top-0 right-0 w-32 h-32 bg-${color}-500/5 blur-[60px] -z-10 transition-all group-hover:scale-150`} />
    <div className="flex justify-between items-start mb-6">
      <div className={`w-12 h-12 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center shadow-inner`}>
        {React.cloneElement(icon, { className: `w-5 h-5 text-${color}-400` })}
      </div>
      <div className="flex flex-col items-end">
        <p className="text-[10px] font-black text-silver-600 uppercase tracking-widest mb-1">{label}</p>
        <h3 className="text-3xl font-black text-white tabular-nums metallic-text tracking-tighter">{value}</h3>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full bg-${color}-500 animate-pulse`} />
      <p className="text-[11px] text-silver-500 font-medium">{sub}</p>
    </div>
  </motion.div>
);

const HistoryCard = ({ analysis, onClick }: { analysis: Analysis; onClick: () => void }) => (
  <motion.div 
    layout
    initial={{ opacity: 0, scale: 0.98 }}
    animate={{ opacity: 1, scale: 1 }}
    whileHover={{ y: -4 }}
    onClick={onClick}
    className="liquid-glass p-5 rounded-[1rem] border-white/5 cursor-pointer group hover:border-white/20 transition-all relative overflow-hidden"
  >
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center shadow-inner group-hover:bg-indigo-500/10 transition-colors">
        <Github className="w-6 h-6 text-silver-400 group-hover:text-indigo-400 transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-bold text-white truncate group-hover:text-indigo-300 transition-colors">{analysis.repo_url.split('/').slice(-2).join('/')}</h4>
        <div className="flex items-center gap-3 mt-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-silver-600 uppercase tracking-widest">
            <Clock className="w-3 h-3" /> {relativeTime(analysis.created_at)}
          </div>
          <div className="w-1 h-1 rounded-full bg-white/10" />
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: scoreColor(analysis.health_score) }}>
            <Activity className="w-3 h-3" /> {scoreLabel(analysis.health_score)}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-xl font-black text-white tabular-nums tracking-tighter" style={{ color: scoreColor(analysis.health_score) }}>
          {analysis.health_score}<span className="text-[10px] opacity-30">/100</span>
        </div>
        <div className="text-[9px] font-black text-silver-600 uppercase tracking-widest mt-1">Health</div>
      </div>
    </div>
  </motion.div>
);

// ── Main Dashboard Component ───────────────────────────────────────

export const DashboardPage = ({ apiUrl, onBack, onViewAnalysis, onNewScan }: { apiUrl: string; onBack: () => void; onViewAnalysis: (id: string, repoUrl: string) => void; onNewScan: () => void }) => {
  const { getToken, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState<'home' | 'analyses' | 'repos' | 'reports' | 'settings'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [atlasAccessToken, setAtlasAccessToken] = useState<string | null>(localStorage.getItem('atlas_access_token'));
  const [githubRepos, setGithubRepos] = useState<Array<any>>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user'|'ai', text: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const webSocket = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAnalyses();
  }, []);

  const fetchAndSetRepos = async () => {
    try {
      setLoadingRepos(true);
      const token = atlasAccessToken || localStorage.getItem('atlas_access_token');
      if (!token) {
        setGithubRepos([]);
        return;
      }
      const res = await fetch(`${apiUrl}/api/v1/auth/github/repos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch repos');
      const data = await res.json();
      setGithubRepos(data || []);
    } catch (e) {
      console.error('Fetch repos error', e);
      setGithubRepos([]);
    } finally {
      setLoadingRepos(false);
    }
  };

  useEffect(() => {
    if (atlasAccessToken) fetchAndSetRepos();
  }, [atlasAccessToken]);

  // Handle GitHub OAuth callback (frontend receives ?code= and exchanges it)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const processed = params.get('atlas_github_processed');
    if (code && !processed) {
      (async () => {
        try {
          // Exchange code for AtlasStack access token via backend
          const res = await fetch(`${apiUrl}/api/v1/auth/github/callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
          });
          if (!res.ok) throw new Error('GitHub sign-in failed');
          const data = await res.json();
          if (data.access_token) {
            setAtlasAccessToken(data.access_token);
            localStorage.setItem('atlas_access_token', data.access_token);
            showToast('GitHub account linked');
          }
        } catch (err: any) {
          console.error('GitHub callback error', err);
          showToast('Failed to link GitHub account');
        } finally {
          // Mark as processed so we don't re-run on reload
          params.set('atlas_github_processed', '1');
          const newUrl = window.location.origin + window.location.pathname + '?' + params.toString();
          window.history.replaceState({}, document.title, newUrl);
        }
      })();
    }
  }, []);

  const fetchAnalyses = async () => {
    try {
      setLoading(true);
      const clerkToken = await getToken();
      if (!clerkToken) { setAnalyses([]); setLoading(false); return; }
      const res = await fetch(`${apiUrl}/api/v1/analyses`, {
        headers: { Authorization: `Bearer ${clerkToken}` },
      });
      if (!res.ok) throw new Error('Failed to load history.');
      const data = await res.json();
      setAnalyses(data.analyses || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const filteredAnalyses = analyses.filter(a => 
    a.repo_url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = [
    { label: 'Active Repos', value: analyses.length, sub: 'Total mapped nodes', icon: <GitBranch />, color: 'indigo' },
    { label: 'Total Risks', value: analyses.reduce((acc, a) => acc + (a.health_score < 70 ? 1 : 0), 0), sub: 'Critical vulnerabilities', icon: <Shield />, color: 'rose' },
    { label: 'Avg Health', value: analyses.length ? Math.round(analyses.reduce((acc, a) => acc + a.health_score, 0) / analyses.length) : '--', sub: 'System integrity score', icon: <Activity />, color: 'emerald' },
    { label: 'AI Patches', value: '12', sub: 'Autofixes generated', icon: <Sparkles />, color: 'amber' },
  ];

  // Chat Logic (Shared with IDEPage)
  useEffect(() => {
    if (!isChatOpen) return;
    let socket: WebSocket;
    (async () => {
      const clerkToken = await getToken();
      if (!clerkToken) return;
      const wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws?token=' + encodeURIComponent(clerkToken);
      socket = new WebSocket(wsUrl);
      webSocket.current = socket;
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'chat_response') {
            setIsAiTyping(false);
            setChatMessages(prev => [...prev, { role: 'ai', text: data.text }]);
          }
        } catch (e) { console.error('WS Error:', e); }
      };
    })();
    return () => socket?.close();
  }, [isChatOpen]);

  const handleSendChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || !webSocket.current) return;
    const text = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', text }]);
    setChatInput('');
    setIsAiTyping(true);
    webSocket.current.send(JSON.stringify({ type: 'chat', text }));
  };

  const SidebarContent = () => (
    <>
      <div className="px-6 mb-10">
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => onBack()}>
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tighter">ATLAS<span className="text-silver-500">STACK</span></h1>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-emerald-500/80 uppercase tracking-widest">Node Active</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-2 px-3">
        <NavItem icon={<Home size={18} />} label="Overview" active={activeNav === 'home'} onClick={() => setActiveNav('home')} />
        <NavItem icon={<Clock size={18} />} label="Scan History" active={activeNav === 'analyses'} onClick={() => setActiveNav('analyses')} />
        <NavItem icon={<GitBranch size={18} />} label="Connected Repos" active={activeNav === 'repos'} onClick={() => setActiveNav('repos')} />
        <NavItem icon={<BarChart3 size={18} />} label="Risk Intelligence" active={activeNav === 'reports'} onClick={() => setActiveNav('reports')} />
        <div className="pt-4 pb-2 px-4">
          <div className="h-px bg-white/5 w-full" />
        </div>
        <NavItem icon={<Settings size={18} />} label="Settings" active={activeNav === 'settings'} onClick={() => setActiveNav('settings')} />
      </div>

      <div className="mx-4 p-5 rounded-3xl bg-white/5 border border-white/10 mb-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg bg-yellow-400/10 flex items-center justify-center">
            <Cpu className="w-3.5 h-3.5 text-yellow-500" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-silver-400">System Intel</span>
        </div>
        <p className="text-[11px] text-silver-500 leading-relaxed font-medium">Auto-patching is active for {analyses.length} nodes. Monitor drift levels in reports.</p>
      </div>

      <button onClick={() => signOut()} className="mx-4 mb-8 flex items-center gap-3 px-6 py-4 rounded-2xl text-xs font-bold text-silver-600 hover:text-white hover:bg-red-500/10 transition-all group border border-transparent hover:border-red-500/20">
        <LogOut className="w-4 h-4 group-hover:rotate-12 transition-transform" /> Sign Out
      </button>
    </>
  );

  return (
    <div className="dashboard-shell flex h-screen bg-[#030303] text-white overflow-hidden font-sans">
      <div className="noise-overlay" />
      <div className="island-bg">
        <div className="aurora-blob blob-1" />
        <div className="aurora-blob blob-2" />
        <div className="aurora-blob blob-3" />
      </div>
      
      {/* Sidebar */}
      <aside className={`fixed lg:relative z-40 h-full w-[280px] bg-[#0a0a0a]/80 backdrop-blur-3xl border-r border-white/5 transition-transform duration-300 lg:translate-x-0 flex flex-col pt-10 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-full overflow-y-auto custom-scrollbar relative pt-10 pb-20 px-4 sm:px-10">
        <div className="max-w-6xl mx-auto">
          
          {/* Top Bar */}
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12">
            <div>
              <h2 className="text-4xl font-black text-white metallic-text tracking-tighter">Command Center</h2>
              <p className="text-silver-500 text-sm font-medium mt-1">Orchestrating architectural intelligence for your nodes.</p>
            </div>
            <div className="flex items-center gap-4 w-full sm:w-auto">
               <div className="relative flex-1 sm:w-64">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-silver-600" />
                 <input 
                   type="text" 
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   placeholder="Search nodes..." 
                   className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-xs font-medium text-white focus:outline-none focus:border-white/20 transition-all"
                 />
               </div>
               <button onClick={() => onNewScan()} className="btn-primary px-6 py-3 rounded-2xl flex items-center gap-2 group whitespace-nowrap">
                 <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" /> 
                 <span className="hidden sm:inline">New Scan</span>
               </button>
               <button className="lg:hidden w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                 <Menu className="w-5 h-5" />
               </button>
            </div>
          </header>

          {/* View: Overview */}
          {activeNav === 'home' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Stats Hub */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {stats.map((s, i) => (
                  <StatCard key={i} {...s} />
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Recent Analyses List */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-black text-white flex items-center gap-3">
                       <Clock className="w-5 h-5 text-indigo-400" /> Recent Activity
                    </h3>
                    <button onClick={() => setActiveNav('analyses')} className="text-[10px] font-black uppercase tracking-widest text-silver-600 hover:text-white transition-colors flex items-center gap-1">
                      View All History <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  {loading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-24 bg-white/5 rounded-[1rem] animate-pulse" />
                      ))}
                    </div>
                  ) : filteredAnalyses.length === 0 ? (
                    <div className="liquid-glass p-20 rounded-[1.5rem] border-white/5 text-center">
                      <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
                        <Search className="w-10 h-10 text-silver-700" />
                      </div>
                      <h4 className="text-xl font-bold text-white mb-2">No nodes found</h4>
                      <p className="text-silver-500 text-sm max-w-xs mx-auto leading-relaxed">We couldn't find any analyses matching your query. Try a different term or start a new scan.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {filteredAnalyses.slice(0, 5).map(a => (
                        <HistoryCard key={a.id} analysis={a} onClick={() => onViewAnalysis(a.id, a.repo_url)} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Side Intelligence Panel */}
                <div className="space-y-8">
                  {/* Pro Upgrade Card */}
                  <div className="liquid-glass p-8 rounded-[1.5rem] border-indigo-500/20 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 to-violet-600/10 opacity-50" />
                    <div className="relative z-10">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center mb-6 border border-indigo-500/20">
                        <Star className="w-6 h-6 text-indigo-400 fill-indigo-400" />
                      </div>
                      <h4 className="text-xl font-black text-white mb-2">AtlasStack Pro</h4>
                      <p className="text-silver-500 text-xs leading-relaxed mb-6 font-medium">Unlock unlimited scans, custom AI policies, and automated Pull Request fix generation.</p>
                      <button className="w-full btn-primary py-3 rounded-2xl font-bold text-xs shadow-lg shadow-indigo-500/20 group-hover:scale-[1.02] transition-transform">
                        Upgrade Workspace
                      </button>
                    </div>
                  </div>

                  {/* AI System Status */}
                  <div className="liquid-glass p-8 rounded-[1.5rem] border-white/5">
                    <h4 className="text-xs font-black text-silver-400 uppercase tracking-widest mb-6">System Health</h4>
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-silver-500 uppercase tracking-widest">Analysis Engine</span>
                        <span className="text-[10px] font-black text-emerald-400">99.9% Online</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-silver-500 uppercase tracking-widest">Network Latency</span>
                        <span className="text-[10px] font-black text-emerald-400">12ms</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-silver-500 uppercase tracking-widest">LLM Context</span>
                        <span className="text-[10px] font-black text-indigo-400">Active</span>
                      </div>
                    </div>
                    <div className="mt-8 pt-6 border-t border-white/5">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
                           <Wifi className="w-4 h-4 text-emerald-500" />
                         </div>
                         <div>
                           <div className="text-[10px] font-black text-white uppercase tracking-widest">Regional Hub</div>
                           <div className="text-[9px] text-silver-600 font-bold uppercase tracking-widest">US-EAST-1</div>
                         </div>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* View: All History */}
          {activeNav === 'analyses' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <h3 className="text-2xl font-black text-white metallic-text tracking-tighter">Full Scan History</h3>
              <div className="grid grid-cols-1 gap-4">
                {filteredAnalyses.map(a => (
                  <HistoryCard key={a.id} analysis={a} onClick={() => onViewAnalysis(a.id, a.repo_url)} />
                ))}
              </div>
            </motion.div>
          )}

          {/* View: Connected Repos */}
          {activeNav === 'repos' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="liquid-glass p-8 rounded-[1.5rem] border-white/5">
              <div className="flex items-center gap-4 mb-6">
                <GitBranch className="w-12 h-12 text-indigo-400" />
                <div>
                  <h3 className="text-xl font-bold text-white">Connected Repositories</h3>
                  <p className="text-silver-500 text-sm">Link your GitHub account to show repositories (including private ones you authorize).</p>
                </div>
              </div>

              {githubRepos.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-silver-500 mb-6">No GitHub repos connected yet.</p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={async () => {
                        try {
                          const r = await fetch(`${apiUrl}/api/v1/auth/github/login`);
                          const j = await r.json();
                          if (j.url) {
                            // Redirect user to GitHub authorize page
                            window.location.href = j.url;
                          } else throw new Error('Invalid redirect URL');
                        } catch (e) { console.error(e); showToast('Unable to start GitHub OAuth'); }
                      }}
                      className="btn-primary px-6 py-3 rounded-2xl font-bold text-xs"
                    >
                      Connect GitHub
                    </button>

                    <button
                      onClick={async () => {
                        // Try to fetch repos if we already have an AtlasStack token
                        await fetchAndSetRepos();
                      }}
                      className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-bold"
                    >
                      Refresh Repos
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {githubRepos.map((r, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center"> <Github className="w-4 h-4 text-white" /> </div>
                        <div>
                          <div className="text-sm font-bold text-white">{r.name}</div>
                          <div className="text-[11px] text-silver-500">{r.url}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-silver-400">{r.private ? 'Private' : 'Public'}</div>
                        <a href={r.url} target="_blank" rel="noreferrer" className="text-[11px] text-indigo-400">Open</a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* View: Risk Intelligence */}
          {activeNav === 'reports' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <h3 className="text-2xl font-black text-white metallic-text tracking-tighter">Risk Intelligence Hub</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="liquid-glass p-8 rounded-[1.25rem] border-rose-500/20">
                   <Shield className="w-8 h-8 text-rose-500 mb-4" />
                   <h4 className="text-white font-bold mb-2">Security Surface</h4>
                   <p className="text-silver-600 text-xs leading-relaxed">Global analysis of security debt across all scanned nodes.</p>
                 </div>
                 <div className="liquid-glass p-8 rounded-[1.25rem] border-amber-500/20">
                   <Activity className="w-8 h-8 text-amber-500 mb-4" />
                   <h4 className="text-white font-bold mb-2">Architectural Drift</h4>
                   <p className="text-silver-600 text-xs leading-relaxed">Real-time monitoring of schema changes and module decoupling.</p>
                 </div>
              </div>
            </motion.div>
          )}
          {/* View: Settings */}
          {activeNav === 'settings' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <h3 className="text-2xl font-black text-white metallic-text tracking-tighter">Workspace Settings</h3>
              <div className="liquid-glass p-10 rounded-[1.5rem] border-white/5 space-y-8">
                <div>
                  <h4 className="text-sm font-bold text-white mb-4">API Configuration</h4>
                  <div className="bg-black/40 border border-white/10 rounded-2xl p-4 font-mono text-[11px] text-silver-500">
                    Endpoint: {apiUrl}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-4">Identity</h4>
                  <p className="text-silver-600 text-xs">Connected via Clerk Auth</p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* Floating AI Chat Trigger */}
      <Show when="signed-in">
        <div className="fixed bottom-8 right-8 z-50">
          <AnimatePresence>
            {isChatOpen && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="mb-6 w-[400px] h-[550px] liquid-glass rounded-[1rem] border-white/10 shadow-2xl flex flex-col overflow-hidden"
              >
                <div className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
                      <MessagesSquare className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-widest">AI Architect</h3>
                      <div className="flex items-center gap-1.5 text-[8px] text-emerald-400 font-bold uppercase tracking-widest">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active Node Connection
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
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-silver-700">Node Sync Complete.<br/>Ready for architectural queries.</p>
                    </div>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-4 rounded-2xl text-xs font-medium leading-relaxed ${msg.role === 'user' ? 'bg-white text-black rounded-tr-none' : 'bg-white/5 text-silver-300 border border-white/10 rounded-tl-none'}`}>
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

          <button onClick={() => setIsChatOpen(!isChatOpen)} className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95 border border-white/10 group ${isChatOpen ? 'bg-white text-black' : 'liquid-glass text-white'}`}>
            {isChatOpen ? <X className="w-7 h-7" /> : <MessageSquare className="w-7 h-7 group-hover:scale-110 transition-transform" />}
          </button>
        </div>
      </Show>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-white text-black px-6 py-3 rounded-2xl font-bold text-xs shadow-2xl flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Internal NavItem helper (moved back to local scope to avoid export issues)
// This is already defined at the top as NavItem.
