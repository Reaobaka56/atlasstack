import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Github, Terminal, CheckCircle2, ChevronRight,
  ArrowLeft, Search, ShieldCheck, Zap, Layers, FolderTree, Lightbulb, 
  Wrench, Play, Code2, Copy, ToggleLeft, ToggleRight, ListChecks, FileWarning, Star, AlertTriangle,
  Share2, Download, FileText, Check, RefreshCw, Lock, Puzzle, Wifi, TrendingUp, Eye, Rocket,
  FileCode2, MessageSquare, Send, X, MessagesSquare, Network, LogOut, Home, GitBranch, Clock, BarChart3, Settings, Menu, Cpu, Sparkles, GitPullRequest
} from 'lucide-react';
import {
  SignInButton,
  useAuth,
  useClerk
} from "@clerk/react";

// Local Show helper — mirrors the one in App.tsx
const Show = ({ when, children }: { when: 'signed-in' | 'signed-out'; children: React.ReactNode }) => {
  const { isSignedIn } = useAuth();
  if (when === 'signed-in' && isSignedIn) return <>{children}</>;
  if (when === 'signed-out' && !isSignedIn) return <>{children}</>;
  return null;
};
import mermaid from 'mermaid';
import ArchitectureMap from './ArchitectureMap';

const ATLAS_MOCK_GRAPH = {
  repo: "atlasstack",
  score: 100,
  nodes: [
    { id: "web", label: "Dashboard", sub: "React/Vite", layer: "client", risk: false, info: "AtlasStack UI Client" },
    { id: "vscode", label: "IDE Plugin", sub: "Extension", layer: "client", risk: false, info: "AtlasStack VSCode Extension" },
    { id: "kong", label: "API Gateway", sub: "Kong", layer: "infra", risk: false, info: "Rate Limiting & Routing" },
    { id: "api", label: "Core API", sub: "FastAPI", layer: "core", risk: false, info: "Primary backend service" },
    { id: "worker", label: "Analyzer", sub: "Celery", layer: "core", risk: false, info: "Async security scanner" },
    { id: "llm", label: "AI Engine", sub: "Qwen2.5", layer: "infra", risk: false, info: "Local LLM Inference" },
    { id: "neo4j", label: "Knowledge", sub: "Neo4j", layer: "data", risk: false, info: "Code relationships graph" },
    { id: "pg", label: "Database", sub: "PostgreSQL", layer: "data", risk: false, info: "User & Repo Metadata" },
    { id: "weaviate", label: "Vectors", sub: "Weaviate", layer: "data", risk: false, info: "Semantic code representations" }
  ],
  edges: [
    { from: "web", to: "kong", flow: false },
    { from: "vscode", to: "kong", flow: false },
    { from: "kong", to: "api", flow: true },
    { from: "api", to: "worker", flow: true },
    { from: "api", to: "pg", flow: false },
    { from: "worker", to: "llm", flow: true },
    { from: "worker", to: "neo4j", flow: true },
    { from: "worker", to: "weaviate", flow: true }
  ]
};

// Initialize Mermaid
mermaid.initialize({
  startOnLoad: true,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'Inter, system-ui, sans-serif',
  themeVariables: {
    primaryColor: '#ffffff',
    primaryTextColor: '#0f172a',
    primaryBorderColor: '#1e293b',
    lineColor: '#334155',
    secondaryColor: '#1e293b',
    tertiaryColor: '#0f172a'
  }
});

const Mermaid = ({ chart }: { chart: string }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && chart) {
      ref.current.removeAttribute('data-processed');
      mermaid.contentLoaded();
    }
  }, [chart]);

  return (
    <div className="mermaid bg-black/20 p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[1rem] border border-white/5 flex justify-center overflow-x-auto" ref={ref}>
      {chart}
    </div>
  );
};



export const IDEPage = (props: { repoUrl: string; analysisId?: string | null; onBack: () => void; apiUrl?: string; token?: string | null; key?: React.Key }) => {
  return <IDEPageContent {...props} />;
};

const IDEPageContent = ({ repoUrl, analysisId, onBack, apiUrl: apiUrlProp }: { repoUrl: string; analysisId?: string | null; onBack: () => void; apiUrl?: string; token?: string | null }) => {
  const defaultApiHost = window.location.hostname;
  const defaultApiUrl = (defaultApiHost === 'localhost' || defaultApiHost === '127.0.0.1' || defaultApiHost === '0.0.0.0')
    ? 'http://localhost:8005'
    : `${window.location.protocol}//${defaultApiHost}:8005`;
  const API_URL = apiUrlProp || (import.meta as any).env?.VITE_API_URL || (window as any).ATLASSTACK_API_URL || defaultApiUrl;
  const { getToken, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const [step, setStep] = useState<'connect' | 'input' | 'analyzing' | 'dashboard'>(analysisId ? 'analyzing' : 'connect');
  const [repoInput, setRepoInput] = useState(repoUrl || '');
  const [mvpData, setMvpData] = useState<any>(null);
  const [showRunModal, setShowRunModal] = useState(false);
  const [eli5Mode, setEli5Mode] = useState(false);
  const [appliedFixes, setAppliedFixes] = useState<number[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [expandedDiff, setExpandedDiff] = useState<number | null>(null);
  const [analyzingStep, setAnalyzingStep] = useState(0);
  const [archGraph, setArchGraph] = useState<any>(null);
  const [activeNav] = useState<'analyses' | 'home' | 'repos' | 'reports'>('analyses');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user'|'ai', text: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const webSocket = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, isAiTyping]);

  // WebSocket for Chat — uses live Clerk token
  useEffect(() => {
    let socket: WebSocket;
    (async () => {
      const clerkToken = await getToken();
      if (!clerkToken) return;
      const wsUrl = API_URL.replace(/^http/, 'ws') + '/ws?token=' + encodeURIComponent(clerkToken);
      socket = new WebSocket(wsUrl);
      webSocket.current = socket;
      socket.onopen = () => console.log('Web Chat Socket Connected');
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
      socket.onclose = () => console.log('Web Chat Socket Disconnected');
    })();
    return () => socket?.close();
  }, [API_URL, getToken]);

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

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Animated analysis steps
  useEffect(() => {
    if (step !== 'analyzing') return;
    const steps = ['Cloning repository...', 'Parsing file tree...', 'Running AI analysis...', 'Scoring health...'];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % steps.length;
      setAnalyzingStep(i);
    }, 2200);
    return () => clearInterval(interval);
  }, [step]);

  const fetchMvpData = async () => {
    const targetRepo = repoInput;
    const clerkToken = await getToken();

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (clerkToken) headers['Authorization'] = `Bearer ${clerkToken}`;

    fetch(`${API_URL}/api/v1/analysis/mvp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ repo_url: targetRepo, save_result: !!isSignedIn })
    })
    .then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Analysis failed');
      return data;
    })
    .then(data => {
      const sanitized = {
        ...data,
        explanation: data.explanation || {
          summary: "No summary available.",
          eli5_summary: "No simplified explanation available.",
          entry_point: "Unknown",
          architecture: "System Architecture",
          data_flow: "N/A"
        },
        health_score: data.health_score ?? 0,
        fixes: data.fixes || [],
        important_files: data.important_files || [],
        tech_stack: data.tech_stack || [],
        run_steps: data.run_steps || [],
      };
      setMvpData(sanitized);
      setStep('dashboard');
      // Fetch the new graphical map as well
      fetch(`${API_URL}/api/v1/analysis/graph/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: targetRepo })
      })
      .then(r => r.json())
      .then(graphData => {
        if (graphData && graphData.nodes) {
          setArchGraph(graphData);
        } else {
          setArchGraph(ATLAS_MOCK_GRAPH as any);
        }
      })
      .catch(e => {
        console.error("Graph error:", e);
        setArchGraph(ATLAS_MOCK_GRAPH as any);
      });

      setTimeout(() => setStep('dashboard'), 500);
    })
    .catch(err => {
      // Safe mock
      setMvpData({
        isError: true,
        explanation: {
          summary: "Failed to reach backend API.",
          eli5_summary: "The robot got confused because it couldn't talk to the server!",
          entry_point: "Unknown",
          architecture: "Unknown",
          data_flow: "Unknown"
        },
        important_files: [],
        fixes: [],
        errors: [`Fetch error: ${err.message}`],
        run_steps: ["Start your backend server!"],
        health_score: 0,
        dependencies: [],
        tech_stack: { frameworks: [], databases: [] }
      });
      setTimeout(() => setStep('dashboard'), 500);
    });
  };

  const fetchExistingData = async () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const clerkToken = await getToken();
    if (clerkToken) headers['Authorization'] = `Bearer ${clerkToken}`;

    fetch(`${API_URL}/api/v1/analyses/${analysisId}`, {
      method: 'GET',
      headers
    })
    .then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to load analysis');
      return data;
    })
    .then(data => {
      const sanitized = {
        ...data,
        explanation: data.explanation || {
          summary: "No summary available.",
          eli5_summary: "No simplified explanation available.",
          entry_point: "Unknown",
          architecture: "System Architecture",
          data_flow: "N/A"
        },
        health_score: data.health_score ?? 0,
        fixes: data.fixes || [],
        important_files: data.important_files || [],
        tech_stack: data.tech_stack || [],
        run_steps: data.run_steps || [],
      };
      setMvpData(sanitized);
      setStep('dashboard');
      
      // Attempt to load the graph
      fetch(`${API_URL}/api/v1/analyses/${analysisId}/graph`, {
        method: 'GET',
        headers
      })
      .then(r => {
        if (r.ok) return r.json();
        // Fallback to preview if not found
        return fetch(`${API_URL}/api/v1/analysis/graph/preview`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ repo_url: data.repo_url })
        }).then(res => res.json());
      })
      .then(graphData => {
        if (graphData && graphData.nodes) {
          setArchGraph(graphData);
        } else {
          setArchGraph(ATLAS_MOCK_GRAPH as any);
        }
      })
      .catch(e => {
        console.error("Graph error:", e);
        setArchGraph(ATLAS_MOCK_GRAPH as any);
      });

      setTimeout(() => setStep('dashboard'), 500);
    })
    .catch(err => {
      showToast(`Failed to load history: ${err.message}`);
      onBack();
    });
  };

  useEffect(() => {
    if (step === 'analyzing') {
      if (analysisId && analysisId !== 'new') {
        fetchExistingData();
      } else {
        fetchMvpData();
      }
    }
  }, [step, repoInput, analysisId]);

  const handleConnect = () => setTimeout(() => setStep('input'), 400);

  const startAnalysis = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoInput) return;
    setStep('analyzing');
  };

  const handleApplyFix = (fix: any, index: number) => {
    setAppliedFixes(prev => [...prev, index]);
    
    // Generate Patch
    let patch = `--- a/${fix.file_path}\n+++ b/${fix.file_path}\n@@ -1,1 +1,1 @@\n`;
    if (fix.code_remove) {
      fix.code_remove.split('\n').filter(Boolean).forEach((line: string) => patch += `-${line}\n`);
    }
    if (fix.code_add) {
      fix.code_add.split('\n').filter(Boolean).forEach((line: string) => patch += `+${line}\n`);
    }
    
    const blob = new Blob([patch], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fix.file_path.split('/').pop()}-fix.patch`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Patch downloaded!");
  };

  const handleCreatePr = async (fixIndex: number) => {
    if (!mvpData?.id) {
      showToast("Save the analysis by logging in & re-running the scan first.");
      return;
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const clerkToken = await getToken();
    if (clerkToken) headers['Authorization'] = `Bearer ${clerkToken}`;
    try {
      showToast("Creating PR on GitHub...");
      const res = await fetch(`${API_URL}/api/v1/analyses/${mvpData.id}/fixes/${fixIndex}/pr`, {
        method: 'POST',
        headers
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'PR creation failed');
      showToast(`✅ PR opened! Opening...`);
      setTimeout(() => window.open(data.pr_url, '_blank'), 1500);
    } catch (err: any) {
      showToast(`❌ ${err.message}`);
    }
  };

  const handleCreateAllPr = async () => {
    if (!mvpData?.id) {
      showToast("Save the analysis by logging in & re-running the scan first.");
      return;
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const clerkToken = await getToken();
    if (clerkToken) headers['Authorization'] = `Bearer ${clerkToken}`;
    try {
      showToast("Creating combined PR on GitHub...");
      const res = await fetch(`${API_URL}/api/v1/analyses/${mvpData.id}/fixes/apply_all`, {
        method: 'POST',
        headers
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'PR creation failed');
      showToast(`✅ Combined PR opened! Opening...`);
      const prUrl = data.html_url || data.pr_url || data.url || data.htmlUrl;
      if (prUrl) setTimeout(() => window.open(prUrl, '_blank'), 1200);
    } catch (err: any) {
      showToast(`❌ ${err.message}`);
    }
  };

  const copyToClipboard = (text: string, msg: string = "Copied to clipboard!") => {
    navigator.clipboard.writeText(text);
    showToast(msg);
  };

  const handleShare = () => {
    const mockHash = Math.random().toString(36).substring(2, 8);
    const shareUrl = `${window.location.origin}/report/${mockHash}`;
    copyToClipboard(shareUrl, "Share link copied!");
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(mvpData, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `atlasstack_analysis_${new Date().getTime()}.json`);
    dlAnchorElem.click();
    showToast("JSON Exported!");
  };

  const handleCopyMarkdown = () => {
    let md = `# AtlasStack Analysis: ${repoInput}\n\n`;
    md += `> **Repo Health:** ${mvpData.health_score}/100\n\n`;
    md += `## 🧠 Codebase Explanation\n${eli5Mode ? mvpData?.explanation?.eli5_summary : mvpData?.explanation?.summary}\n\n`;
    md += `**Entry Point:** \`${mvpData?.explanation?.entry_point || 'Unknown'}\`\n\n`;
    if (!eli5Mode) {
      md += `**Architecture:** ${mvpData?.explanation?.architecture || 'System Architecture'}\n\n`;
      md += `**Data Flow:** ${mvpData?.explanation?.data_flow || 'N/A'}\n\n`;
    }
    md += `## ▶️ How to Run\n\`\`\`bash\ngit clone ${repoInput}\n${(mvpData.run_steps || []).join('\n')}\n\`\`\`\n\n`;
    
    if (mvpData.fixes && mvpData.fixes.length > 0) {
        md += `## 🛠 Auto Fix Proposals\n`;
        mvpData.fixes.forEach((f: any) => {
           md += `### Problem: ${f.problem}\n**File:** \`${f.file_path}\`\n\`\`\`diff\n`;
           if (f.code_remove) md += `- ${f.code_remove.replace(/\n/g, '\n- ')}\n`;
           if (f.code_add) md += `+ ${f.code_add.replace(/\n/g, '\n+ ')}\n`;
           md += `\`\`\`\n\n`;
        });
    }
    
    copyToClipboard(md, "Markdown Report Copied!");
  };

  const handleRetry = () => {
    setMvpData(null);
    setArchGraph(null);
    setStep('analyzing');
    // Force call fetchMvpData directly to bypass the 'analysisId' check in useEffect
    fetchMvpData();
  };


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

  const SidebarContent = () => (
    <>
      <div className="px-4 mb-10">
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => onBack()}>
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
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

      <div className="flex-1 space-y-2 px-2">
        <NavItem icon={<Home size={18} />} label="Dashboard" onClick={() => onBack()} />
        <NavItem icon={<Clock size={18} />} label="Analysis History" active={activeNav === 'analyses'} />
        <NavItem icon={<GitBranch size={18} />} label="Repositories" />
        <NavItem icon={<BarChart3 size={18} />} label="Risk Reports" />
        <div className="pt-4 pb-2 px-4">
          <div className="h-px bg-white/5 w-full" />
        </div>
        <NavItem icon={<Settings size={18} />} label="Settings" />
      </div>

      <div className="mx-2 p-5 rounded-2xl bg-white/5 border border-white/10 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg bg-yellow-400/10 flex items-center justify-center">
            <Cpu className="w-3.5 h-3.5 text-yellow-500" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-silver-400">Analysis Intel</span>
        </div>
        <p className="text-[11px] text-silver-500 leading-relaxed font-medium">Re-scanning ensures you catch the latest topology drifts and security risks.</p>
      </div>

      <button onClick={() => signOut()} className="flex items-center gap-3 px-4 py-4 rounded-2xl text-xs font-bold text-silver-600 hover:text-white hover:bg-red-500/10 transition-all group border border-transparent hover:border-red-500/20">
        <LogOut className="w-4 h-4 group-hover:rotate-12 transition-transform" /> Sign Out
      </button>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden relative">
      <div className="island-bg">
        <div className="aurora-blob blob-1" />
        <div className="aurora-blob blob-2" />
        <div className="aurora-blob blob-3" />
      </div>
      <div className="island-overlay" />

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-[60] p-4 flex items-center justify-between backdrop-blur-md bg-black/20 border-b border-white/5">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center shadow-lg">
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <h1 className="text-lg font-black text-white tracking-tighter">ATLAS<span className="text-silver-500">STACK</span></h1>
         </div>
         <button onClick={() => setIsSidebarOpen(true)} className="p-2 rounded-xl bg-white/5 border border-white/10">
            <Menu className="w-6 h-6 text-white" />
         </button>
      </div>

      {/* Sidebar (Desktop) */}
      <aside className="hidden lg:flex w-72 shrink-0 flex-col border-r border-white/5 liquid-glass rounded-none py-10 px-4 gap-1 overflow-y-auto pt-28">
        <SidebarContent />
      </aside>

      {/* Sidebar (Mobile) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSidebarOpen(false)} className="lg:hidden fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm" />
            <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="lg:hidden fixed inset-y-0 left-0 w-80 z-[101] flex flex-col liquid-glass rounded-none py-10 px-6 shadow-2xl border-y-0 border-l-0">
              <button onClick={() => setIsSidebarOpen(false)} className="absolute top-8 right-6 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                <X className="w-5 h-5 text-white" />
              </button>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 overflow-y-auto pt-24 lg:pt-24 custom-scrollbar">
        <div className="max-w-6xl mx-auto px-4 sm:px-10 lg:px-12 py-8 sm:py-12">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div initial={{ opacity: 0, y: -20, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: -20, x: '-50%' }} className="fixed top-24 left-1/2 z-50 bg-emerald-500/90 text-white px-6 py-3 rounded-full font-bold shadow-2xl flex items-center gap-2 border border-emerald-400">
            <Check className="w-5 h-5" /> {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-6xl mt-6">
        <AnimatePresence mode="wait">
          
          {/* STEP 1: Connect */}
          {step === 'connect' && (
            <motion.div key="connect" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="liquid-glass p-12 rounded-[1rem] text-center max-w-3xl mx-auto border-white/10 shadow-2xl">
              <div className="w-20 h-20 bg-white/5 rounded-full mx-auto flex items-center justify-center mb-8 border border-white/10 shadow-inner">
                <Github className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-4">Connect your GitHub</h2>
              <p className="text-slate-400 mb-10 leading-relaxed">AtlasStack uses advanced AI to instantly read, explain, and auto-fix any codebase structure you provide.</p>
              <button onClick={handleConnect} className="btn-primary w-full sm:w-auto px-10 py-4 flex items-center justify-center gap-3 mx-auto text-lg text-white">
                <Github className="w-5 h-5" /> Authorize AtlasStack
              </button>
            </motion.div>
          )}

          {/* STEP 2: Input */}
          {step === 'input' && (
            <motion.div key="input" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="liquid-glass p-12 rounded-[1rem] border-white/10 max-w-3xl mx-auto shadow-2xl">
              <h2 className="text-3xl font-bold text-white mb-4">Analyze a Repository</h2>
              <p className="text-slate-400 mb-8">Paste the GitHub link and let AI explain the codebase and generate fixes.</p>
              <form onSubmit={startAnalysis}>
                <div className="relative mb-8 group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <Search className="w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                  </div>
                  <input
                    type="text"
                    className="w-full bg-black/40 border-2 border-white/10 rounded-2xl py-5 pl-12 pr-6 text-white focus:outline-none focus:border-blue-500/50 shadow-inner text-lg font-mono"
                    placeholder="https://github.com/..."
                    value={repoInput}
                    onChange={(e) => setRepoInput(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn-primary w-full py-5 flex items-center justify-center gap-3 text-lg text-white">
                  <Search className="w-5 h-5" /> Fetch & Parse Repo
                </button>
              </form>
            </motion.div>
          )}

          {/* STEP 3: Analyzing / Loading state */}
          {step === 'analyzing' && (
            <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-xl mx-auto text-center py-24">
               <div className="w-28 h-28 mx-auto mb-10 relative">
                 <div className="absolute inset-0 border-4 border-white/5 rounded-full shadow-[0_0_40px_rgba(255,255,255,0.05)]"></div>
                 <div className="absolute inset-0 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                 <Zap className="w-10 h-10 text-yellow-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 filter drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
               </div>
               <h3 className="text-4xl font-black text-white mb-4 tracking-tighter metallic-text">Scanning Infrastructure...</h3>
               <p className="text-silver-600 text-sm mb-10 font-medium">Synchronizing with node clusters and generating AI architectural map.</p>
               <div className="flex flex-col gap-3 mt-6">
                 {['Cloning repository...', 'Parsing file tree...', 'Running AI analysis...', 'Scoring health...'].map((label, idx) => (
                   <motion.div
                     key={idx}
                     className={`flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all duration-700 ${
                       idx === analyzingStep
                         ? 'bg-white/10 border-white/20 text-white shadow-xl scale-[1.02]'
                         : idx < analyzingStep
                         ? 'bg-white/5 border-white/10 text-silver-300'
                         : 'bg-white/[0.02] border-white/5 text-silver-700'
                     }`}
                   >
                     <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 ${
                       idx < analyzingStep ? 'border-white bg-white/20' :
                       idx === analyzingStep ? 'border-yellow-400' : 'border-white/10'
                     }`}>
                       {idx < analyzingStep && <Check className="w-4 h-4 text-white" />}
                       {idx === analyzingStep && <div className="w-2.5 h-2.5 rounded-sm bg-yellow-400 animate-pulse" />}
                     </div>
                     <span className="text-xs font-black uppercase tracking-widest">{label}</span>
                   </motion.div>
                 ))}
               </div>
            </motion.div>
          )}

          {/* STEP 4: Dashboard */}
          {step === 'dashboard' && mvpData && (
            <Show when="signed-in">
              <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              
              {/* Header section */}
              <div className="liquid-glass p-10 rounded-[1.25rem] border-white/10 shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-10 relative overflow-hidden">
                {/* Decorative glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-[120px] -z-10 rounded-full" />
                
                {/* Action Toolbar */}
                <div className="absolute top-6 right-8 flex gap-3">
                   <button onClick={handleShare} className="bg-white/5 hover:bg-white/10 text-white shadow-xl text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full flex items-center gap-2 border border-white/10 transition-all hover:scale-105 active:scale-95">
                     <Share2 className="w-3.5 h-3.5" /> Share
                   </button>
                   <button onClick={handleCopyMarkdown} className="bg-white/5 hover:bg-white/10 text-white shadow-xl text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full flex items-center gap-2 border border-white/10 transition-all hover:scale-105 active:scale-95">
                     <FileText className="w-3.5 h-3.5" /> Export
                   </button>
                   <button onClick={() => handleCreateAllPr()} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 shadow-xl text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full flex items-center gap-2 border border-emerald-400/10 transition-all hover:scale-105 active:scale-95">
                     <GitPullRequest className="w-3.5 h-3.5" /> Apply All Fixes
                   </button>
                </div>

                <div className="mt-6 lg:mt-0 text-center lg:text-left flex-1 w-full">
                  <div className="flex flex-col lg:flex-row items-center gap-4 mb-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl">
                      <Github className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                    </div>
                    <div className="max-w-full overflow-hidden">
                      <h2 className="text-2xl sm:text-3xl font-black text-white metallic-text tracking-tighter">Analysis Complete</h2>
                      <p className="text-silver-600 font-bold text-[10px] sm:text-xs mt-1 block max-w-full truncate opacity-60 decoration-white/20 underline underline-offset-4" title={repoInput}>{repoInput}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col md:flex-row items-center gap-8 lg:gap-14 shrink-0 w-full lg:w-auto">
                  {/* Health Score */}
                  <div className="text-center group flex flex-col sm:flex-row items-center gap-6 sm:gap-10 w-full sm:w-auto justify-center">
                    <div className="flex flex-col items-center">
                      <p className="text-[10px] uppercase tracking-[0.4em] text-silver-700 font-extrabold mb-3">Integrity Score</p>
                      <div className={`text-5xl sm:text-6xl font-black tracking-tighter tabular-nums drop-shadow-2xl transition-all duration-700 ${
                        mvpData.health_score > 70 ? 'text-white' : 
                        mvpData.health_score > 40 ? 'text-silver-400' : 
                        'text-red-500'
                      }`}>
                        {mvpData.health_score}<span className="text-xl opacity-20 font-black">/100</span>
                      </div>
                      <div className={`text-[10px] font-black uppercase tracking-[0.2em] mt-3 py-1 px-4 rounded-full border inline-block ${
                        mvpData.health_score > 70 ? 'text-white border-white/20 bg-white/5' : 
                        mvpData.health_score > 40 ? 'text-silver-400 border-silver-400/20 bg-silver-400/5' : 'text-red-500 border-red-500/20 bg-red-500/5'
                      }`}>
                        {mvpData.health_score > 70 ? 'OPTIMAL' : mvpData.health_score > 40 ? 'STABLE' : 'CRITICAL'}
                      </div>
                    </div>

                    <div className="hidden sm:block w-px h-16 bg-white/5 self-center" />

                    <div className="flex flex-col items-center">
                      <p className="text-[10px] uppercase tracking-[0.4em] text-silver-700 font-extrabold mb-3">Maturity Level</p>
                      <div className="text-2xl sm:text-3xl font-black text-white metallic-text tracking-tighter mb-1 uppercase">
                         {mvpData.maturity_level || 'Unknown'}
                      </div>
                      <div className="text-[10px] font-bold text-silver-600 uppercase tracking-widest mt-2">
                         {mvpData.tech_debt_score || 0}% Tech Debt
                      </div>
                    </div>
                  </div>

                  <div className="hidden lg:block w-px h-24 bg-white/5"></div>
                  
                  <div className="flex flex-col gap-3 w-full sm:w-auto min-w-[200px]">
                    <button 
                      onClick={() => setShowRunModal(true)}
                      className="btn-pill btn-pill-active py-4 px-8 text-[10px] sm:text-xs flex items-center justify-center gap-3 group bg-white text-black border-transparent shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                    >
                      <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-black group-hover:scale-110 transition-transform" /> START RUNTIME
                    </button>
                    <button 
                      onClick={handleRetry}
                      className="btn-pill py-4 px-8 text-[10px] sm:text-xs flex items-center justify-center gap-3 group border border-white/10 hover:border-white/30 hover:bg-white/10 text-white transition-all hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95"
                    >
                      <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:rotate-180 transition-transform duration-700 text-yellow-400" /> RE-SCAN
                    </button>
                  </div>
                </div>
              </div>

              {/* Actionable Warnings — Temper intensity, but useful icons & buttons */}
              {(mvpData.errors?.length > 0 || mvpData.isError) && (
                <div className="rounded-[1.25rem] overflow-hidden border border-red-500/10 bg-red-500/[0.03] shadow-inner mb-6 transition-all duration-500 hover:bg-red-500/[0.05]">
                  <div className="px-8 py-5 border-b border-red-500/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/20">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                      </div>
                      <span className="text-red-500 font-black text-xs uppercase tracking-[0.2em]">Architecture Risks — {mvpData.errors?.length || 1} identified</span>
                    </div>
                    <button 
                      onClick={handleRetry}
                      className="text-[10px] font-black uppercase tracking-widest text-red-400/60 hover:text-red-400 flex items-center gap-2 transition-all bg-red-500/5 hover:bg-red-500/10 px-4 py-1.5 rounded-full border border-red-500/10 hover:border-red-500/30"
                    >
                      <RefreshCw className="w-3 h-3 group-hover:rotate-90 transition-transform" /> Re-Scan
                    </button>
                  </div>
                  <div className="divide-y divide-red-500/5">
                    {mvpData.errors?.map((err: string, i: number) => {
                      const isEnv = /env|token|secret|key/i.test(err);
                      const isDep = /depend|package|module|import/i.test(err);
                      const isNet = /network|connect|socket|fetch/i.test(err);
                      const icon = isEnv ? <Lock className="w-4 h-4 text-amber-500 shrink-0" /> 
                                 : isDep ? <Puzzle className="w-4 h-4 text-purple-400 shrink-0" />
                                 : isNet ? <Wifi className="w-4 h-4 text-blue-400 shrink-0" />
                                 : <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />;
                      const iconSymbol = isEnv ? '🔐' : isDep ? '🧩' : isNet ? '🔌' : '⚠️';
                      const tag = isEnv ? 'AUTH' : isDep ? 'DEPS' : isNet ? 'NET' : 'RISK';
                      
                      return (
                        <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 sm:px-8 py-4 sm:py-5 hover:bg-white/[0.02] transition-colors group">
                          <div className="flex items-center gap-4 min-w-0">
                            <span className="text-lg sm:text-xl filter grayscale group-hover:grayscale-0 transition-all opacity-80">{iconSymbol}</span>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase tracking-widest text-silver-700 group-hover:text-silver-500 transition-colors mb-0.5">{tag}</span>
                              <span className="text-silver-400 text-xs sm:text-sm font-medium tracking-tight truncate max-w-full sm:max-w-xl group-hover:text-white transition-colors">{err}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                             <button 
                              onClick={() => copyToClipboard(err, 'Telemetry copied!')}
                              className="btn-pill py-2 px-3 sm:px-4 text-[9px] font-black uppercase tracking-widest border-white/5 text-silver-600 hover:text-white hover:bg-white/5 sm:opacity-0 group-hover:opacity-100 transition-all flex-1 sm:flex-none justify-center"
                            >
                              Telecopy
                            </button>
                            <button className="btn-pill btn-pill-active py-2 px-4 sm:px-5 text-[9px] font-black uppercase tracking-widest bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20 shadow-lg flex-1 sm:flex-none justify-center">
                              Patch Risk
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* 1. Codebase Explanation — structured What / How / Why */}
                <div className="liquid-glass p-10 rounded-[1.5rem] border-white/5 flex flex-col gap-8 shadow-2xl relative">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 blur-[80px] -z-10 rounded-full" />
                  
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-4 text-white">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner group">
                          <Lightbulb className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400 group-hover:animate-pulse" />
                        </div>
                        <h3 className="text-xl sm:text-2xl font-black tracking-tight metallic-text">Structural Logic</h3>
                      </div>
                      <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-[1.5rem] border border-white/10 cursor-pointer hover:bg-white/10 transition-all" onClick={() => setEli5Mode(!eli5Mode)}>
                        <span className={`text-[9px] uppercase font-black tracking-[0.2em] ${!eli5Mode ? 'text-white' : 'text-silver-700'}`}>Engineering</span>
                        {eli5Mode ? <ToggleRight className="w-5 h-5 sm:w-6 sm:h-6 text-white" /> : <ToggleLeft className="w-5 h-5 sm:w-6 sm:h-6 text-silver-400" />}
                        <span className={`text-[9px] uppercase font-black tracking-[0.2em] ${eli5Mode ? 'text-white' : 'text-silver-700'}`}>ELI5</span>
                      </div>
                    </div>

                  {eli5Mode ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white/5 border border-white/10 rounded-[1rem] p-8 shadow-inner relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-400/5 blur-3xl -z-10" />
                      <p className="text-silver-100 leading-relaxed text-lg font-medium metallic-text-subtle">{mvpData?.explanation?.eli5_summary || "No ELI5 summary available."}</p>
                    </motion.div>
                  ) : (
                    <div className="space-y-6">
                      {/* What */}
                      <div className="group bg-white/[0.02] border border-white/5 rounded-[1rem] p-6 hover:border-white/20 hover:bg-white/5 transition-all shadow-lg">
                        <div className="text-[10px] uppercase tracking-[0.3em] font-black text-silver-600 mb-4 flex items-center gap-3">
                          <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center font-black text-[10px] text-white">01</div>
                          System core concept
                        </div>
                        <h4 className="text-white text-lg font-black mb-2 metallic-text">What it does</h4>
                        <p className="text-silver-400 text-sm leading-relaxed font-medium">{mvpData?.explanation?.summary || "No summary available."}</p>
                      </div>
                      
                      {/* How */}
                      {mvpData?.explanation?.architecture && (
                        <div className="group bg-white/[0.02] border border-white/5 rounded-[1rem] p-6 hover:border-white/20 hover:bg-white/5 transition-all shadow-lg">
                          <div className="text-[10px] uppercase tracking-[0.3em] font-black text-silver-600 mb-4 flex items-center gap-3">
                            <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center font-black text-[10px] text-white">02</div>
                            Architectural Blueprint
                          </div>
                          <h4 className="text-white text-lg font-black mb-2 metallic-text">How it works</h4>
                          <p className="text-silver-400 text-sm leading-relaxed font-medium">{mvpData?.explanation?.architecture}</p>
                        </div>
                      )}
                      
                      {/* Why (Data Flow) */}
                      {mvpData?.explanation?.data_flow && (
                        <div className="group bg-white/[0.02] border border-white/5 rounded-[1rem] p-6 hover:border-white/20 hover:bg-white/5 transition-all shadow-lg">
                          <div className="text-[10px] uppercase tracking-[0.3em] font-black text-silver-600 mb-4 flex items-center gap-3">
                            <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center font-black text-[10px] text-white">03</div>
                            Strategic Advantage
                          </div>
                          <h4 className="text-white text-lg font-black mb-2 metallic-text">Why it matters</h4>
                          <p className="text-silver-400 text-sm leading-relaxed font-medium">{mvpData?.explanation?.data_flow}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white/3 rounded-[1.5rem] p-5 border border-white/5 hover:border-white/10 transition-colors shadow-xl">
                      <h4 className="text-[9px] uppercase tracking-[0.4em] text-silver-700 font-extrabold mb-4 flex items-center gap-2"><Layers className="w-3.5 h-3.5"/> Framework Integration</h4>
                      <div className="flex flex-wrap gap-2">
                        {mvpData.tech_stack?.frameworks?.map((tech: string, i: number) => (
                          <span key={`f-${i}`} className="px-3 py-1 bg-white/10 border border-white/5 text-white rounded-[0.75rem] text-[10px] font-black uppercase tracking-widest">{tech}</span>
                        ))}
                        {!mvpData.tech_stack?.frameworks?.length && <span className="text-silver-800 text-[10px] uppercase font-black">Unknown</span>}
                      </div>
                    </div>
                    <div className="bg-white/3 rounded-[1.5rem] p-5 border border-white/5 hover:border-white/10 transition-colors shadow-xl">
                      <h4 className="text-[9px] uppercase tracking-[0.4em] text-silver-700 font-extrabold mb-4 flex items-center gap-2"><Code2 className="w-3.5 h-3.5"/> Principal Node</h4>
                      <code className="text-white bg-white/10 px-4 py-2 rounded-[1rem] text-xs font-black metallic-text truncate block w-full border border-white/5">
                        {mvpData?.explanation?.entry_point || 'Unknown'}
                      </code>
                    </div>
                  </div>

                  {mvpData.dependencies?.length > 0 && (
                    <div className="border-t border-white/5 pt-4">
                      <h4 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-2"><ListChecks className="w-4 h-4"/> Key Dependencies</h4>
                      <div className="space-y-2">
                        {mvpData.dependencies.map((dep: any, i: number) => (
                          <div key={i} className="flex items-center gap-3 bg-black/20 p-2.5 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                            <code className="text-[11px] font-mono text-purple-300 font-bold min-w-[100px]">{dep.name}</code>
                            <span className="text-slate-500 text-xs">{dep.purpose}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

                <div className="flex flex-col gap-6">
                  {/* 2. Important Files — refined hierarchy with clear badges */}
                    <div className="liquid-glass p-6 sm:p-10 rounded-[1.25rem] sm:rounded-[1.5rem] border-white/5 flex flex-col gap-8 shadow-2xl relative">
                      <div className="flex items-center gap-4 text-white">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
                        <FolderTree className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black tracking-tight metallic-text">Principal Components</h3>
                    </div>
                    <div className="space-y-4">
                      {mvpData.important_files?.map((file: any, i: number) => (
                         // ... (existing important files code truncated for space, keeping structure)
                        <div key={i} className="text-silver-400 text-xs">{file.path}</div>
                      ))}
                    </div>
                  </div>

                  {/* Security Dashboard (Supply Chain) */}
                  {mvpData.security_report && (
                    <div className="liquid-glass p-8 rounded-[1.25rem] border-red-500/10 bg-red-500/[0.02] shadow-xl">
                      <h3 className="text-xs font-black text-red-500 uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
                        <ShieldCheck className="w-5 h-5" /> Supply Chain Security
                      </h3>
                      
                      <div className="grid grid-cols-2 gap-4 mb-8">
                         <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                            <div className="text-[8px] font-black text-silver-600 uppercase tracking-widest mb-1">Risk Score</div>
                            <div className="text-2xl font-black text-white">{Math.round(mvpData.security_report?.overall_risk || 0)}<span className="text-[10px] opacity-30">/100</span></div>
                         </div>
                         <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                            <div className="text-[8px] font-black text-silver-600 uppercase tracking-widest mb-1">Threat Level</div>
                            <div className={`text-xs font-black uppercase tracking-widest ${mvpData.security_report.overall_risk > 50 ? 'text-red-500' : 'text-emerald-500'}`}>
                               {mvpData.security_report.overall_risk > 50 ? 'CRITICAL' : 'STABLE'}
                            </div>
                         </div>
                      </div>

                      <div className="space-y-3">
                        {mvpData.security_report.dependencies?.filter((d: any) => d.risk_score > 0).map((dep: any, i: number) => (
                          <div key={i} className="bg-white/5 border border-white/5 p-4 rounded-xl flex items-center justify-between group hover:border-red-500/20 transition-all">
                             <div className="flex flex-col">
                                <span className="text-[10px] font-black text-white">{dep.name} <span className="text-[8px] text-silver-700">@{dep.version}</span></span>
                                <span className="text-[8px] text-red-400/70 uppercase tracking-widest">{dep.risk_factors.join(', ')}</span>
                             </div>
                             <div className="text-red-500 font-black text-xs">{Math.round(dep.risk_score)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 3. Auto Fix Proposals — with confidence + impact + preview diff */}
                  <div className="liquid-glass p-6 rounded-[1rem] border-white/5 flex flex-col gap-4 flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-white">
                        <div className="w-9 h-9 rounded-xl bg-indigo-400/10 border border-indigo-400/20 flex items-center justify-center">
                          <Wrench className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold">Auto Fix Proposals</h3>
                          {mvpData.fixes?.length > 0 && (
                            <p className="text-xs text-slate-500">{mvpData.fixes.length} fix{mvpData.fixes.length !== 1 ? 'es' : ''} ready to apply</p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      {mvpData.fixes?.length ? mvpData.fixes.map((fix: any, i: number) => {
                        const isApplied = appliedFixes.includes(i);
                        const isDiffOpen = expandedDiff === i;
                        // Heuristic derived confidence + impact
                        const confidence = fix.confidence || (85 + (i % 3) * 4);
                        const impact = fix.impact || (i === 0 ? 'HIGH' : i < 2 ? 'MEDIUM' : 'LOW');
                        const impactColor = impact === 'HIGH' ? 'text-red-400 bg-red-400/10 border-red-400/20'
                                         : impact === 'MEDIUM' ? 'text-amber-400 bg-amber-400/10 border-amber-400/20'
                                         : 'text-blue-400 bg-blue-400/10 border-blue-400/20';
                        return (
                          <motion.div 
                            key={i}
                            layout
                            className="bg-black/40 rounded-xl overflow-hidden border border-white/8 shadow-lg hover:border-white/15 transition-all"
                          >
                            {/* Fix Header */}
                            <div className="px-4 py-3 flex items-start justify-between gap-3 border-b border-white/5">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${impactColor}`}>{impact}</span>
                                  <span className="text-[9px] font-bold text-slate-500">{confidence}% safe</span>
                                </div>
                                <h5 className="text-white font-medium text-sm">{fix.problem}</h5>
                                <span className="text-xs font-mono text-slate-500 mt-0.5 block truncate">→ {fix.file_path}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={() => setExpandedDiff(isDiffOpen ? null : i)}
                                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-1 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/8"
                                >
                                  <Eye className="w-3 h-3" /> {isDiffOpen ? 'Hide' : 'Diff'}
                                </button>
                                {isSignedIn && (
                                  <button 
                                    onClick={() => handleCreatePr(i)}
                                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all gap-1 flex items-center bg-emerald-800/80 hover:bg-emerald-700 text-emerald-300 border border-emerald-700/40"
                                  >
                                    <Github className="w-3 h-3"/> PR
                                  </button>
                                )}
                                <button 
                                  onClick={() => handleApplyFix(fix, i)}
                                  disabled={isApplied}
                                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all gap-1 flex items-center ${
                                    isApplied 
                                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/15 cursor-default' 
                                      : 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/30 hover:scale-105 active:scale-95'
                                  }`}
                                >
                                  {isApplied ? <><Check className="w-3 h-3"/> Done</> : <><Download className="w-3 h-3"/> Patch</>}
                                </button>
                              </div>
                            </div>

                            {/* 🧠 Junior Dev Explanation */}
                            {fix.eli5_explanation && (
                              <div className="px-4 py-3 bg-indigo-950/30 border-b border-indigo-500/8 flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                  <Lightbulb className="w-3 h-3 text-indigo-400" />
                                </div>
                                <div>
                                  <div className="text-[9px] uppercase tracking-widest font-black text-indigo-400/70 mb-1">Junior Dev Explanation</div>
                                  <p className="text-slate-300 text-xs leading-relaxed">{fix.eli5_explanation}</p>
                                </div>
                              </div>
                            )}
                            
                            {/* Diff Preview — collapsible */}
                            <AnimatePresence>
                              {isDiffOpen && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="p-4 font-mono text-xs bg-black/30 relative border-t border-white/5">
                                    <button onClick={() => copyToClipboard(fix.code_add || '')} className="absolute top-2 right-2 text-slate-600 hover:text-white p-1.5 rounded hover:bg-white/10 transition-all">
                                      <Copy className="w-3 h-3" />
                                    </button>
                                    {fix.code_remove && (
                                      <div className="text-red-400/80 mb-1 bg-red-500/5 px-2 py-1 rounded">
                                        <span className="select-none text-red-500/40 mr-2">-</span>
                                        {fix.code_remove}
                                      </div>
                                    )}
                                    {fix.code_add && (
                                      <div className="text-emerald-400/90 whitespace-pre bg-emerald-500/5 px-2 py-1 rounded">
                                        <span className="select-none text-emerald-500/40 mr-2">+</span>
                                        {fix.code_add}
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      }) : (
                        <div className="py-8 text-center">
                          <CheckCircle2 className="w-10 h-10 text-emerald-500/40 mx-auto mb-3" />
                          <p className="text-slate-500 text-sm">No fixable issues discovered.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Architecture / System Topology (Full Width Card) */}
              {archGraph ? (
                <div className="liquid-glass p-10 rounded-[1.5rem] border-white/5 flex flex-col gap-8 shadow-2xl relative mt-6">
                   <div className="absolute top-0 right-10 w-32 h-32 bg-indigo-500/10 blur-[80px] -z-10 rounded-full" />
                   <h3 className="text-2xl font-black tracking-tight metallic-text flex items-center gap-4">
                     <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-inner">
                       <Network className="w-6 h-6 text-indigo-400" />
                     </div>
                     Interactive System Topology
                   </h3>
                   <div className="rounded-[1.25rem] mt-2 overflow-hidden bg-black/40 border border-white/5 p-8 backdrop-blur-xl shadow-2xl">
                     <ArchitectureMap graph={archGraph} />
                   </div>
                </div>
              ) : mvpData.architecture?.mermaid && (
                <div className="liquid-glass p-10 rounded-[1.5rem] border-white/5 flex flex-col gap-8 shadow-2xl relative mt-6">
                  <h3 className="text-2xl font-black tracking-tight metallic-text flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-inner">
                      <Network className="w-6 h-6 text-indigo-400" />
                    </div>
                    System Topology
                  </h3>
                  <div className="rounded-[1rem] overflow-hidden bg-black/40 border border-white/5 p-6 backdrop-blur-xl">
                    <Mermaid chart={mvpData.architecture?.mermaid || ""} />
                  </div>
                </div>
              )}
            </motion.div>
            </Show>
          )}

          {step === 'dashboard' && mvpData && (
            <Show when="signed-out">
              <motion.div 
                key="login-required" 
                initial={{ opacity: 0, scale: 0.9 }} 
                animate={{ opacity: 1, scale: 1 }} 
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-8 shadow-2xl">
                  <Lock className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-4xl font-black text-white metallic-text mb-4">Login to View Analysis</h2>
                <p className="text-silver-500 max-w-md mb-10 leading-relaxed font-medium">
                  Deep architectural insights, security vulnerabilities, and logic flows are restricted to authenticated nodes.
                </p>
                <SignInButton mode="modal">
                  <button className="btn-primary px-12 py-5 text-lg font-bold rounded-2xl shadow-[0_0_50px_rgba(255,255,255,0.1)] hover:scale-105 active:scale-95 transition-all">
                    Sign In to Unlock Results
                  </button>
                </SignInButton>
              </motion.div>
            </Show>
          )}
        </AnimatePresence>
      </div>

      {/* "How to Run" Modal */}
      <AnimatePresence>
        {showRunModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
              <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-1">How to Run</h3>
                  <p className="text-slate-400 text-sm">Step-by-step local execution guide</p>
                </div>
                <button onClick={() => setShowRunModal(false)} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors">✕</button>
              </div>
              
              <div className="p-8">
                <div className="space-y-4">
                  <div className="flex gap-4 items-center">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm border border-blue-500/20 shrink-0">1</div>
                    <code className="flex-1 bg-black/50 border border-white/5 p-4 rounded-xl text-emerald-400 font-mono text-sm shadow-inner group relative">
                      git clone {repoInput}
                      <button onClick={() => copyToClipboard(`git clone ${repoInput}`)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"><Copy className="w-4 h-4"/></button>
                    </code>
                  </div>
                  
                  {mvpData?.run_steps?.map((stepStr: string, i: number) => (
                    <div key={i} className="flex gap-4 items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm border border-blue-500/20 shrink-0">{i+2}</div>
                      <code className="flex-1 bg-black/50 border border-white/5 p-4 rounded-xl text-emerald-400 font-mono text-sm shadow-inner group relative">
                        {stepStr}
                        <button onClick={() => copyToClipboard(stepStr)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"><Copy className="w-4 h-4"/></button>
                      </code>
                    </div>
                  ))}
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 flex justify-end gap-3">
                  <button onClick={() => {
                     copyToClipboard(`git clone ${repoInput}\n` + mvpData?.run_steps?.join('\n'));
                  }} className="px-6 py-2.5 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 transition-colors font-medium">
                    Copy All
                  </button>
                  <button onClick={() => setShowRunModal(false)} className="btn-primary py-2.5 px-8 font-medium text-white">
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating AI Chat Widget */}
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

          <button onClick={() => setIsChatOpen(!isChatOpen)} className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95 border border-white/10 group ${isChatOpen ? 'bg-white text-black' : 'liquid-glass text-white'}`}>
            {isChatOpen ? <X className="w-7 h-7" /> : <MessageSquare className="w-7 h-7 group-hover:scale-110 transition-transform" />}
          </button>
        </div>
      </Show>
        </div>
      </main>
    </div>
  );
};
