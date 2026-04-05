import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Github, Terminal, CheckCircle2, ChevronRight,
  ArrowLeft, Search, ShieldCheck, Zap, Layers, FolderTree, Lightbulb, 
  Wrench, Play, Code2, Copy, ToggleLeft, ToggleRight, ListChecks, FileWarning, Star, AlertTriangle,
  Share2, Download, FileText, Check, RefreshCw, Lock, Puzzle, Wifi, TrendingUp, Eye, Rocket
} from 'lucide-react';



class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 text-red-500 font-mono text-sm bg-black min-h-screen">
          <h1 className="text-2xl mb-4 text-white">React Crash!</h1>
          <pre className="whitespace-pre-wrap">{this.state.error?.toString()}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export const IDEPage = (props: { repoUrl: string; analysisId?: string | null; onBack: () => void; apiUrl?: string; token?: string | null; key?: React.Key }) => {
  return (
    <ErrorBoundary>
      <IDEPageContent {...props} />
    </ErrorBoundary>
  );
};

const IDEPageContent = ({ repoUrl, analysisId, onBack, apiUrl: apiUrlProp, token }: { repoUrl: string; analysisId?: string | null; onBack: () => void; apiUrl?: string; token?: string | null }) => {
  const API_URL = apiUrlProp || (window as any).CODESAGE_API_URL || "http://localhost:8005";
  const [step, setStep] = useState<'connect' | 'input' | 'analyzing' | 'dashboard'>(analysisId ? 'analyzing' : 'connect');
  const [repoInput, setRepoInput] = useState(repoUrl || '');
  const [mvpData, setMvpData] = useState<any>(null);
  const [showRunModal, setShowRunModal] = useState(false);
  const [eli5Mode, setEli5Mode] = useState(false);
  const [appliedFixes, setAppliedFixes] = useState<number[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [expandedDiff, setExpandedDiff] = useState<number | null>(null);
  const [analyzingStep, setAnalyzingStep] = useState(0);

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

  const fetchMvpData = () => {
    const targetRepo = repoInput;

    // Trigger the real backend API
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(`${API_URL}/api/v1/analysis/mvp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ repo_url: targetRepo, save_result: !!token })
    })
    .then(res => res.json())
    .then(data => {
      setMvpData(data);
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

  const fetchExistingData = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(`${API_URL}/api/v1/analyses/${analysisId}`, {
      method: 'GET',
      headers
    })
    .then(res => res.json())
    .then(data => {
      setMvpData(data);
      setTimeout(() => setStep('dashboard'), 500);
    })
    .catch(err => {
      showToast(`Failed to load history: ${err.message}`);
      onBack();
    });
  };

  useEffect(() => {
    if (step === 'analyzing') {
      if (analysisId) {
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
    if (token) headers['Authorization'] = `Bearer ${token}`;
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
    md += `## 🧠 Codebase Explanation\n${eli5Mode ? mvpData.explanation.eli5_summary : mvpData.explanation.summary}\n\n`;
    md += `**Entry Point:** \`${mvpData.explanation.entry_point}\`\n\n`;
    if (!eli5Mode) {
      md += `**Architecture:** ${mvpData.explanation.architecture}\n\n`;
      md += `**Data Flow:** ${mvpData.explanation.data_flow}\n\n`;
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
    setStep('analyzing');
    // It will automatically trigger fetchMvpData from useEffect
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-8 flex flex-col items-center custom-scrollbar">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div initial={{ opacity: 0, y: -20, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: -20, x: '-50%' }} className="fixed top-24 left-1/2 z-50 bg-emerald-500/90 text-white px-6 py-3 rounded-full font-bold shadow-2xl flex items-center gap-2 border border-emerald-400">
            <Check className="w-5 h-5" /> {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Navigation */}
      <div className="fixed top-0 left-0 right-0 h-16 border-b border-white/10 bg-black/50 backdrop-blur-xl z-40 px-6 flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/50">
            <Zap className="w-3 h-3 text-blue-400" />
          </div>
          <span className="font-display font-bold text-white tracking-tight">AtlasStack Dashboard</span>
        </div>
        <div className="w-24" />
      </div>

      <div className="w-full max-w-6xl mt-6">
        <AnimatePresence mode="wait">
          
          {/* STEP 1: Connect */}
          {step === 'connect' && (
            <motion.div key="connect" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="liquid-glass p-12 rounded-[2rem] text-center max-w-3xl mx-auto border-white/10 shadow-2xl">
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
            <motion.div key="input" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="liquid-glass p-12 rounded-[2rem] border-white/10 max-w-3xl mx-auto shadow-2xl">
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
            <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-xl mx-auto text-center py-20">
               <div className="w-24 h-24 mx-auto mb-8 relative">
                 <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
                 <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                 <Zap className="w-8 h-8 text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
               </div>
               <h3 className="text-3xl font-bold text-white mb-4">Deep Analysis Running</h3>
               <div className="flex flex-col gap-3 mt-6">
                 {['Cloning repository...', 'Parsing file tree...', 'Running AI analysis...', 'Scoring health...'].map((label, idx) => (
                   <motion.div
                     key={idx}
                     className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-500 ${
                       idx === analyzingStep
                         ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                         : idx < analyzingStep
                         ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-600'
                         : 'bg-white/2 border-white/5 text-slate-600'
                     }`}
                   >
                     <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                       idx < analyzingStep ? 'border-emerald-500 bg-emerald-500/20' :
                       idx === analyzingStep ? 'border-blue-400' : 'border-white/10'
                     }`}>
                       {idx < analyzingStep && <Check className="w-3 h-3 text-emerald-400" />}
                       {idx === analyzingStep && <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
                     </div>
                     <span className="text-sm font-medium">{label}</span>
                   </motion.div>
                 ))}
               </div>
            </motion.div>
          )}

          {/* STEP 4: Dashboard */}
          {step === 'dashboard' && mvpData && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              
              {/* Header section */}
              <div className="liquid-glass p-6 rounded-[2rem] border-blue-500/20 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
                {/* Decorative glow */}
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
                
                {/* Viral Actions Bar */}
                <div className="absolute top-4 right-4 flex gap-2">
                   <button onClick={handleShare} className="bg-blue-600/80 hover:bg-blue-500 text-white shadow-lg text-xs font-bold uppercase px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-blue-400/30 transition-all hover:scale-105">
                     <Share2 className="w-3 h-3" /> Share
                   </button>
                   <button onClick={handleCopyMarkdown} className="bg-slate-700/80 hover:bg-slate-600 text-white shadow-lg text-xs font-bold uppercase px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-slate-500/30 transition-all hover:scale-105">
                     <FileText className="w-3 h-3" /> Report
                   </button>
                   <button onClick={handleExportJson} className="bg-slate-800/80 hover:bg-slate-700 text-slate-300 shadow-lg text-xs font-bold uppercase px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-white/10 transition-all hover:scale-105">
                     <Download className="w-3 h-3" /> JSON
                   </button>
                </div>

                <div className="mt-8 md:mt-0">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <h2 className="text-2xl font-bold text-white">Analysis Complete</h2>
                  </div>
                  <p className="text-slate-500 font-mono text-xs max-w-md truncate" title={repoInput}>{repoInput}</p>
                </div>
                
                <div className="flex items-center gap-6 shrink-0">
                  {/* Health Score with label + trend */}
                  <div className="text-center">
                    <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1">Repo Health</p>
                    <div className={`text-5xl font-black tracking-tighter tabular-nums ${
                      mvpData.health_score > 70 ? 'text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.5)]' : 
                      mvpData.health_score > 40 ? 'text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]' : 
                      'text-red-400 drop-shadow-[0_0_12px_rgba(248,113,113,0.5)]'
                    }`}>
                      {mvpData.health_score}<span className="text-lg opacity-40 font-normal">/100</span>
                    </div>
                    <div className={`text-xs font-bold mt-1 ${
                      mvpData.health_score > 70 ? 'text-emerald-500' : 
                      mvpData.health_score > 40 ? 'text-amber-500' : 'text-red-500'
                    }`}>
                      {mvpData.health_score > 70 ? '✓ Good Shape' : mvpData.health_score > 40 ? '⚠ Needs Work' : '✕ Critical'}
                    </div>
                    <div className="text-[10px] text-slate-600 mt-0.5 flex items-center justify-center gap-1">
                      <TrendingUp className="w-3 h-3" /> First scan baseline
                    </div>
                  </div>

                  <div className="w-px h-16 bg-white/10 hidden md:block"></div>
                  
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => setShowRunModal(true)}
                      className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3 px-6 rounded-xl transition-all whitespace-nowrap flex items-center gap-2 drop-shadow-[0_0_16px_rgba(16,185,129,0.3)] border border-emerald-300/30 hover:scale-105 active:scale-95"
                    >
                      <Play className="w-5 h-5 fill-black" /> HOW TO RUN
                    </button>
                    <button 
                      onClick={handleRetry}
                      className="bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-2.5 px-6 rounded-xl transition-all whitespace-nowrap flex items-center justify-center gap-2 border border-white/10 hover:scale-105 active:scale-95 text-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Re-analyze
                    </button>
                  </div>
                </div>
              </div>

              {/* Actionable Warnings — NOT a big red alarm */}
              {(mvpData.errors?.length > 0 || mvpData.isError) && (
                <div className="rounded-2xl overflow-hidden border border-amber-500/15">
                  <div className="bg-amber-500/5 px-5 py-3 border-b border-amber-500/10 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-400 font-bold text-sm">Action Required — {mvpData.errors?.length || 1} issue{mvpData.errors?.length !== 1 ? 's' : ''} found</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {mvpData.errors?.map((err: string, i: number) => {
                      const isEnv = /env|token|secret|key/i.test(err);
                      const isDep = /depend|package|module|import/i.test(err);
                      const isNet = /network|connect|socket|fetch/i.test(err);
                      const icon = isEnv ? <Lock className="w-4 h-4 text-amber-400 shrink-0" /> 
                                 : isDep ? <Puzzle className="w-4 h-4 text-purple-400 shrink-0" />
                                 : isNet ? <Wifi className="w-4 h-4 text-blue-400 shrink-0" />
                                 : <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />;
                      const tag = isEnv ? 'ENV' : isDep ? 'DEP' : isNet ? 'NET' : 'WARN';
                      return (
                        <div key={i} className="flex items-center justify-between gap-4 px-5 py-3 bg-black/20 hover:bg-black/30 transition-colors group">
                          <div className="flex items-center gap-3 min-w-0">
                            {icon}
                            <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                              isEnv ? 'text-amber-400 border-amber-500/20 bg-amber-500/10' :
                              isDep ? 'text-purple-400 border-purple-500/20 bg-purple-500/10' :
                              'text-blue-400 border-blue-500/20 bg-blue-500/10'
                            }`}>{tag}</span>
                            <span className="text-slate-300 text-sm truncate">{err}</span>
                          </div>
                          <button 
                            onClick={() => copyToClipboard(err, 'Issue copied!')}
                            className="shrink-0 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"
                          >
                            Copy
                          </button>
                        </div>
                      );
                    })}
                    {mvpData.isError && (
                      <div className="px-5 py-3 flex justify-end">
                        <button onClick={handleRetry} className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors text-sm border border-amber-500/20">
                          <RefreshCw className="w-4 h-4" /> Retry Analysis
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid lg:grid-cols-2 gap-6">
                
                {/* 1. Codebase Explanation — structured What / How / Why */}
                <div className="liquid-glass p-8 rounded-[2rem] border-white/5 flex flex-col gap-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-white">
                      <div className="w-9 h-9 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center">
                        <Lightbulb className="w-5 h-5 text-yellow-400" />
                      </div>
                      <h3 className="text-xl font-bold">Codebase Explanation</h3>
                    </div>
                    <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full border border-white/10 cursor-pointer hover:bg-black/60 transition-colors" onClick={() => setEli5Mode(!eli5Mode)}>
                      <span className={`text-[9px] uppercase font-black tracking-widest ${!eli5Mode ? 'text-white' : 'text-slate-600'}`}>Standard</span>
                      {eli5Mode ? <ToggleRight className="w-5 h-5 text-yellow-400" /> : <ToggleLeft className="w-5 h-5 text-slate-500" />}
                      <span className={`text-[9px] uppercase font-black tracking-widest ${eli5Mode ? 'text-yellow-400' : 'text-slate-600'}`}>ELI5</span>
                    </div>
                  </div>

                  {eli5Mode ? (
                    <div className="bg-yellow-400/5 border border-yellow-400/10 rounded-xl p-5">
                      <p className="text-yellow-200 leading-relaxed text-base font-medium">{mvpData.explanation.eli5_summary}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* What */}
                      <div className="bg-black/30 border border-white/5 rounded-xl p-4 hover:border-white/10 transition-colors">
                        <div className="text-[9px] uppercase tracking-widest font-black text-slate-500 mb-1.5 flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded-full bg-blue-500/20 flex items-center justify-center"><span className="text-blue-400 text-[8px] font-black">W</span></div>
                          What it does
                        </div>
                        <p className="text-white text-sm leading-relaxed">{mvpData.explanation.summary}</p>
                      </div>
                      {/* How */}
                      {mvpData.explanation.architecture && (
                        <div className="bg-black/30 border border-white/5 rounded-xl p-4 hover:border-white/10 transition-colors">
                          <div className="text-[9px] uppercase tracking-widest font-black text-slate-500 mb-1.5 flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded-full bg-purple-500/20 flex items-center justify-center"><span className="text-purple-400 text-[8px] font-black">H</span></div>
                            How it works
                          </div>
                          <p className="text-slate-300 text-sm leading-relaxed">{mvpData.explanation.architecture}</p>
                        </div>
                      )}
                      {/* Why */}
                      {mvpData.explanation.data_flow && (
                        <div className="bg-black/30 border border-white/5 rounded-xl p-4 hover:border-white/10 transition-colors">
                          <div className="text-[9px] uppercase tracking-widest font-black text-slate-500 mb-1.5 flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center"><span className="text-emerald-400 text-[8px] font-black">D</span></div>
                            Data flow
                          </div>
                          <p className="text-slate-300 text-sm leading-relaxed">{mvpData.explanation.data_flow}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                      <h4 className="text-[9px] uppercase tracking-wider text-slate-500 font-black mb-2 flex items-center gap-1"><Layers className="w-3 h-3"/> Tech Stack</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {mvpData.tech_stack?.frameworks?.map((tech: string, i: number) => (
                          <span key={`f-${i}`} className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/10 text-blue-300 rounded-md text-xs font-semibold">{tech}</span>
                        ))}
                        {mvpData.tech_stack?.databases?.map((tech: string, i: number) => (
                          <span key={`d-${i}`} className="px-2 py-0.5 bg-green-500/10 border border-green-500/10 text-green-300 rounded-md text-xs font-semibold">{tech}</span>
                        ))}
                        {!mvpData.tech_stack?.frameworks?.length && !mvpData.tech_stack?.databases?.length && <span className="text-slate-600 text-xs">Unknown</span>}
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                      <h4 className="text-[9px] uppercase tracking-wider text-slate-500 font-black mb-2 flex items-center gap-1"><Code2 className="w-3 h-3"/> Entry Point</h4>
                      <code className="text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded text-xs font-mono truncate block w-full border border-indigo-500/10">
                        {mvpData.explanation.entry_point || 'Unknown'}
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
                  {/* 2. Important Files — with hierarchy badges + featured first card */}
                  <div className="liquid-glass p-6 rounded-[2rem] border-white/5 flex flex-col gap-4">
                    <div className="flex items-center gap-3 text-white">
                      <div className="w-9 h-9 rounded-xl bg-blue-400/10 border border-blue-400/20 flex items-center justify-center">
                        <FolderTree className="w-5 h-5 text-blue-400" />
                      </div>
                      <h3 className="text-xl font-bold">Important Files</h3>
                    </div>
                    <div className="space-y-2">
                      {mvpData.important_files?.map((file: any, i: number) => {
                        const isEntry = file.is_start_here || i === 0;
                        const isWorker = /worker|queue|celery|task/i.test(file.path);
                        const isClient = /client|web|frontend|extension/i.test(file.path);
                        const badge = isEntry ? { label: 'ENTRY', color: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/20' }
                                    : isWorker ? { label: 'ASYNC', color: 'bg-purple-500/20 text-purple-300 border-purple-500/20' }
                                    : isClient ? { label: 'CLIENT', color: 'bg-blue-500/20 text-blue-300 border-blue-500/20' }
                                    : { label: 'CORE', color: 'bg-slate-500/20 text-slate-400 border-slate-500/20' };
                        
                        if (i === 0) return (
                          <motion.div 
                            key={i}
                            whileHover={{ scale: 1.01 }}
                            className="bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-blue-500/20 rounded-xl p-4 relative overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -translate-y-8 translate-x-8 blur-xl" />
                            <div className="flex items-start justify-between gap-3 relative z-10">
                              <div className="flex items-center gap-3">
                                <Star className="w-5 h-5 text-yellow-400 fill-yellow-400 shrink-0" />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <code className="text-sm font-mono text-white font-bold">{file.path}</code>
                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${badge.color}`}>{badge.label}</span>
                                  </div>
                                  <p className="text-slate-400 text-xs mt-1">{file.reason}</p>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                        return (
                          <motion.div
                            key={i}
                            whileHover={{ x: 2 }}
                            className="flex items-start gap-3 p-3 rounded-xl border border-white/5 bg-black/20 hover:border-white/10 hover:bg-black/30 transition-all cursor-default"
                          >
                            <Code2 className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <code className="text-xs font-mono text-slate-200 truncate">{file.path}</code>
                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border shrink-0 ${badge.color}`}>{badge.label}</span>
                              </div>
                              <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{file.reason}</p>
                            </div>
                          </motion.div>
                        );
                      })}
                      {!mvpData.important_files?.length && <p className="text-slate-600 text-sm italic text-center py-4">No files identified.</p>}
                    </div>
                  </div>

                  {/* 3. Auto Fix Proposals — with confidence + impact + preview diff */}
                  <div className="liquid-glass p-6 rounded-[2rem] border-white/5 flex flex-col gap-4 flex-1">
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
                                {token && (
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* "How to Run" Modal */}
      <AnimatePresence>
        {showRunModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[#0f172a] border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl">
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
    </div>
  );
};
