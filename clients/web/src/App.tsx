/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Editor from '@monaco-editor/react';
import { IDEPage } from './IDEPage';
import { DashboardPage } from './DashboardPage';
import { AgentEyeDashboard } from './AgentEyeDashboard';
import { 
  Shield, 
  Zap, 
  BarChart3, 
  Network, 
  Github, 
  BookOpen, 
  ChevronRight, 
  Terminal,
  Lock,
  Mail,
  Search,
  LogOut,
  Cpu,
  CheckCircle2,
  X,
  Menu,
  ArrowLeft,
  GitBranch,
  Play,
  KeyRound
} from 'lucide-react';
import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
  useUser
} from "@clerk/react";

// --- Constants & API Config ---
const API_URL_STORAGE_KEY = "atlasstack_api_url";
const TOKEN_KEY = "atlasstack_access_token";

const normalizeApiUrl = (value?: string | null) => (value || '').trim().replace(/\/$/, '');

const detectDefaultApiUrl = () => {
  // Check for explicitly defined API URL from environment (Vite/webpack style)
  const envApiUrl = normalizeApiUrl((import.meta as any).env?.VITE_API_URL);
  if (envApiUrl) return envApiUrl;

  const fromWindow = normalizeApiUrl((window as any).ATLASSTACK_API_URL);
  if (fromWindow) return fromWindow;

  const fromQuery = normalizeApiUrl(new URLSearchParams(window.location.search).get('api'));
  if (fromQuery) return fromQuery;

  const fromStorage = normalizeApiUrl(localStorage.getItem(API_URL_STORAGE_KEY));
  if (fromStorage) return fromStorage;

  // Render naming convention: myapp-web.onrender.com -> myapp-api.onrender.com
  if (window.location.hostname.includes('onrender.com')) {
    if (window.location.hostname.includes('-web.')) {
        return `${window.location.protocol}//${window.location.hostname.replace('-web.', '-api.')}`;
    }
    // If we can't guess, fallback to the current origin (e.g. monorepo deploy)
    return window.location.origin;
  }
  
  // Vercel fallback: often the API is served from the same domain under /api
  if (window.location.hostname.includes('vercel.app')) {
    return `${window.location.origin}`;
  }

  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
    return 'http://localhost:8005';
  }

  return `${window.location.protocol}//${host}:8005`;
};

// --- Types ---

interface Feature {
  title: string;
  description: string;
  icon: React.ReactNode;
}

type Page = 'landing' | 'login' | 'ide' | 'dashboard' | 'reset' | 'eye';

// --- Components ---

const Navbar = ({ onNavigate, currentPage, scrolled }: { 
  onNavigate: (page: Page) => void, 
  currentPage: Page,
  scrolled: boolean
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleDownloadExtension = (e: React.MouseEvent) => {
    e.preventDefault();
    const link = document.createElement('a');
    link.href = '/atlasstack.vsix';
    link.download = 'atlasstack.vsix';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => {
      window.location.href = 'vscode://';
    }, 500);
  };

  const navItems = (
    <>
      {currentPage === 'landing' && (
        <a href="#try" onClick={() => setIsMobileMenuOpen(false)} className="nav-link">Try it now</a>
      )}
      <Show when="signed-in">
        <button onClick={() => { onNavigate('dashboard'); setIsMobileMenuOpen(false); }} className="text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors">Dashboard</button>
        <button onClick={() => { onNavigate('eye'); setIsMobileMenuOpen(false); }} className="text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors">AgentEye</button>
      </Show>
      <Show when="signed-out">
        <div className="flex flex-col w-full gap-3 md:w-auto md:flex-row md:items-center md:gap-2">
          <SignInButton mode="modal">
            <button className="btn-primary py-2.5 text-sm w-full md:w-auto">Sign In</button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="btn-pill py-2.5 text-sm w-full md:w-auto">Sign Up</button>
          </SignUpButton>
        </div>
      </Show>
      <Show when="signed-in">
        <UserButton afterSignOutUrl="/" />
      </Show>
    </>
  );

  return (
    <nav className={`fixed top-0 left-0 right-0 z-[60] px-6 sm:px-8 py-5 transition-all duration-500 ${
      scrolled || isMobileMenuOpen ? 'backdrop-blur-xl bg-black/60 border-b border-white/5 py-3' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div 
          className="flex items-center gap-3 sm:gap-4 group cursor-pointer"
          onClick={() => { onNavigate('landing'); setIsMobileMenuOpen(false); }}
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black flex items-center justify-center overflow-hidden border border-white/10 shadow-2xl">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="text-xl sm:text-2xl font-display font-bold text-white tracking-tighter">AtlasStack</span>
        </div>
        
        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-10">
          <a href="/atlasstack.vsix" onClick={handleDownloadExtension} className="text-[10px] font-black uppercase tracking-[0.2em] text-silver-500 hover:text-white transition-colors mr-2">VS Code Extension</a>
          {navItems}
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          className="md:hidden w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Content */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden overflow-hidden mt-4 pb-4"
          >
            <div className="flex flex-col gap-6 p-4 liquid-glass rounded-3xl border-white/10">
              <a href="/atlasstack.vsix" onClick={handleDownloadExtension} className="text-[10px] font-black uppercase tracking-[0.2em] text-silver-500 hover:text-white transition-colors">Install VS Code Extension</a>
              {navItems}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const FeatureCard = ({ feature }: { feature: Feature; key?: React.Key }) => (
  <motion.div 
    className="p-10 rounded-[2.5rem] liquid-glass card-hover group"
  >
    <div className="w-14 h-14 rounded-2xl mb-8 flex items-center justify-center bg-white/5 text-white border border-white/10 group-hover:border-white/20 transition-colors">
      {feature.icon}
    </div>
    <h3 className="text-2xl mb-4 text-white">{feature.title}</h3>
    <p className="text-slate-500 leading-relaxed text-base">{feature.description}</p>
  </motion.div>
);


const CookieBanner = () => {
  const [show, setShow] = useState(() => !localStorage.getItem('atlasstack_cookies_accepted'));

  if (!show) return null;

  const handleAccept = () => {
    localStorage.setItem('atlasstack_cookies_accepted', 'true');
    setShow(false);
  };

  return (
    <motion.div 
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-8 left-8 right-8 md:left-auto md:right-8 md:w-[400px] z-[100]"
    >
      <div className="liquid-glass p-8 rounded-[2.5rem] border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl -z-10 rounded-full" />
        <h4 className="text-white font-bold text-lg mb-3">Cookies & Topology</h4>
        <p className="text-silver-500 text-sm leading-relaxed mb-6">
          We use cookies to analyze node traffic and optimize your architectural experience. By continuing, you agree to our standard telemetry protocols.
        </p>
        <div className="flex gap-4">
          <button onClick={handleAccept} className="btn-pill btn-pill-active py-2.5 px-6 text-xs flex-1 justify-center">Accept All</button>
          <button onClick={() => setShow(false)} className="btn-pill py-2.5 px-6 text-xs flex-1 justify-center">Dismiss</button>
        </div>
      </div>
    </motion.div>
  );
};


const LandingPage = ({ onNavigateToLogin, onNavigateToIDE, token, onLogout, apiUrl, onApiUrlChange, isPro, setIsPro }: { onNavigateToLogin: () => void, onNavigateToIDE: (repo: string) => void, token: string | null, onLogout: () => void, apiUrl: string, onApiUrlChange: (url: string) => void, isPro: boolean, setIsPro: (val: boolean) => void, key?: React.Key }) => {
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleDownloadExtension = (e: React.MouseEvent) => {
    e.preventDefault();
    const link = document.createElement('a');
    link.href = '/atlasstack.vsix';
    link.download = 'atlasstack.vsix';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => {
      window.location.href = 'vscode://';
    }, 500);
  };

  const now = new Date();
  const hours = now.getHours();
  const greeting = hours < 12 ? 'Good Morning' : hours < 18 ? 'Good Afternoon' : 'Good Evening';

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl) return;

    setIsAnalyzing(true);
    setStatusMessage("Initializing analysis engine...");

    try {
      if (token) {
        const authHeaders = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        };

        const createRepoRes = await fetch(`${apiUrl}/api/v1/repositories`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ url: repoUrl, branch }),
        });

        const createRepoPayload = await createRepoRes.json();
        if (!createRepoRes.ok) {
          if (createRepoRes.status === 401) {
            onLogout();
            setStatusMessage("Session expired. Please log in again.");
            setIsAnalyzing(false);
            return;
          }
          setStatusMessage(`Error: ${createRepoPayload.detail || "Repository registration failed"}`);
          setIsAnalyzing(false);
          return;
        }
      }
      onNavigateToIDE(repoUrl);
    } catch (error: any) {
      setStatusMessage(`Network error: Unable to reach API at ${apiUrl}`);
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen pt-32 pb-20 px-6 sm:px-10 lg:px-20 max-w-7xl mx-auto">
      {/* Hero Section â€” Centered Cluely Style */}
      <section className="text-center mb-32 flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-8 justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.3em] text-silver-400 backdrop-blur-xl">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               Autonomous Engineering Standard
            </div>
          </div>
          <h1 className="text-4xl sm:text-7xl lg:text-8xl metallic-text font-display-bold mb-6 sm:mb-8 max-w-4xl mx-auto leading-[1.1] sm:leading-[0.95]">
            Architect <br/> the future.
          </h1>
          <p className="text-base sm:text-xl text-silver-400 font-medium max-w-2xl mx-auto opacity-70 leading-relaxed mb-8 sm:mb-12 px-4 sm:px-0">
            AtlasStack deeply scans your repository topology to identify architectural risks, performance bottlenecks, and security gaps.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
             <button onClick={() => document.getElementById('try')?.scrollIntoView({ behavior: 'smooth' })} className="btn-primary px-10 py-5 rounded-full text-base">
               Start Analysis Now
             </button>
             <button 
               onClick={handleDownloadExtension}
               className="btn-secondary px-10 py-5 rounded-full text-base flex items-center gap-3"
             >
               VS Code Extension <ChevronRight className="w-5 h-5" />
             </button>
             <button 
               onClick={() => document.getElementById('docs')?.scrollIntoView({ behavior: 'smooth' })}
               className="btn-secondary px-10 py-5 rounded-full text-base flex items-center gap-3 border-indigo-500/20 text-indigo-400"
             >
               <Terminal className="w-5 h-5" /> Atlas CLI
             </button>
          </div>
        </motion.div>

        {/* Hero Visual â€” The Tool Preview */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="w-full mt-20 relative"
          id="try"
        >
          <div className="liquid-glass p-2 rounded-[3.5rem] border-white/10 shadow-[0_80px_150px_-30px_rgba(0,0,0,0.8)]">
             <div className="bg-[#08080c] rounded-[3rem] p-10 sm:p-16 border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/[0.02] blur-3xl rounded-full" />
                
                <div className="max-w-2xl mx-auto text-center space-y-12">
                   <div>
                     <h2 className="text-3xl metallic-text font-display-bold mb-4">Start Analysis</h2>
                     <p className="text-silver-600 text-sm font-medium">Enter your repository node to begin deep architectural scanning.</p>
                   </div>

                   <form onSubmit={handleAnalyze} className="space-y-8 text-left">
                     <div className="space-y-3">
                       <label className="block text-[10px] uppercase tracking-[0.4em] text-silver-600 font-black ml-1">Repository Node</label>
                       <div className="relative">
                         <Github className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-silver-500" />
                         <input 
                           type="url" 
                           className="input-field pl-16 py-6 text-lg rounded-[1.5rem]" 
                           placeholder="https://github.com/owner/repository"
                           value={repoUrl}
                           onChange={(e) => setRepoUrl(e.target.value)}
                           required
                         />
                       </div>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-3">
                         <label className="block text-[10px] uppercase tracking-[0.4em] text-silver-600 font-black ml-1">Branch</label>
                         <input 
                           type="text" 
                           className="input-field py-6 px-8 text-lg rounded-[1.5rem]" 
                           value={branch}
                           onChange={(e) => setBranch(e.target.value)}
                           required
                         />
                       </div>
                       <div className="space-y-3">
                         <label className="block text-[10px] uppercase tracking-[0.4em] text-silver-600 font-black ml-1">Tier</label>
                         <div className="input-field py-6 px-8 opacity-50 cursor-not-allowed text-lg rounded-[1.5rem]">
                           {isPro ? "Pro Node" : "Free Tier"}
                         </div>
                       </div>
                     </div>

                     <button 
                       type="submit" 
                       disabled={isAnalyzing}
                       className="btn-primary w-full py-8 text-xl flex items-center justify-center gap-4 disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] rounded-[2rem]"
                     >
                       {isAnalyzing ? (
                         <>
                           <div className="w-6 h-6 border-3 border-black/30 border-t-black rounded-full animate-spin" />
                           Node Scanning...
                         </>
                       ) : (
                         <>Begin Deep Scan <ChevronRight className="w-6 h-6" /></>
                       )}
                     </button>
                     
                     {statusMessage && (
                       <p className="text-sm text-center text-silver-400 animate-pulse mt-6 bg-white/5 py-4 rounded-2xl border border-white/10 uppercase tracking-[0.3em] text-[10px] font-black">{statusMessage}</p>
                     )}
                   </form>
                </div>
             </div>
          </div>
          
          {/* Floaters for depth */}
          <div className="absolute -top-12 -left-12 w-48 h-48 bg-white/[0.03] blur-3xl -z-10 rounded-full animate-float" />
          <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-white/[0.02] blur-3xl -z-10 rounded-full animate-float" style={{ animationDelay: '2s' }} />
        </motion.div>
      </section>

      {/* Feature Grid â€” 2-Column Cluely Pattern */}
      <section className="py-48 space-y-32">
        <div className="text-center max-w-3xl mx-auto mb-20">
           <h2 className="text-4xl sm:text-6xl metallic-text font-display-bold mb-8">Engineering with <br/> superpowers.</h2>
           <p className="text-xl text-silver-500 font-medium leading-relaxed">AtlasStack automates the routine so your team can focus on the architectural breakthroughs.</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10">
          <div className="liquid-glass p-12 rounded-[2.5rem] flex flex-col justify-between group h-[500px] overflow-hidden">
             <div>
               <h3 className="text-3xl text-white font-display-bold mb-6">Autonomous <br/> Scoping</h3>
               <p className="text-silver-400 text-base leading-relaxed max-w-xs">Identifying structural risks and performance leaks across your entire repository node.</p>
             </div>
             <div className="relative mt-12 transform translate-y-8 group-hover:translate-y-4 transition-transform duration-700">
                <div className="liquid-glass rounded-2xl p-6 border-white/5 shadow-2xl">
                   <div className="flex items-center justify-between mb-4">
                      <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                        <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                      </div>
                      <span className="text-[10px] font-mono text-silver-700 uppercase tracking-widest">Topology Analysis</span>
                   </div>
                   <div className="space-y-3 font-mono">
                      <div className="h-2 w-3/4 bg-white/5 rounded-full" />
                      <div className="h-2 w-1/2 bg-white/5 rounded-full" />
                      <div className="h-2 w-2/3 bg-white/5 rounded-full" />
                   </div>
                </div>
             </div>
          </div>

          <div className="liquid-glass p-12 rounded-[2.5rem] bg-indigo-500/5 flex flex-col justify-between group h-[500px] overflow-hidden border-indigo-500/10">
             <div>
               <div className="flex items-center gap-3 mb-6">
                 <div className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-400 text-[8px] font-black uppercase tracking-widest border border-indigo-500/30">New Release</div>
                 <h3 className="text-3xl text-white font-display-bold">Atlas <br/> CLI Engine</h3>
               </div>
               <p className="text-silver-400 text-base leading-relaxed max-w-xs">A high-fidelity terminal interface using <b>Rich</b> rendering to bring autonomous engineering to your local machine.</p>
             </div>
             <div className="relative mt-12 transform translate-y-8 group-hover:translate-y-4 transition-transform duration-700">
                <div className="bg-[#050508] rounded-2xl p-6 border border-white/10 shadow-2xl font-mono text-[10px]">
                   <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-silver-700 ml-2">powershell - atlas.py</span>
                   </div>
                   <div className="space-y-2">
                      <div className="text-white">█████╗ ████████╗██╗      █████╗</div>
                      <div className="text-indigo-400">[info] Initializing analysis engine...</div>
                      <div className="flex gap-2">
                        <span className="text-emerald-400">?</span>
                        <span className="text-silver-400">Analyzing repository...</span>
                      </div>
                      <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                        <div className="w-1/2 h-full bg-indigo-500" />
                      </div>
                   </div>
                </div>
             </div>
          </div>

          <div className="liquid-glass p-12 rounded-[2.5rem] flex flex-col justify-between group h-[500px] overflow-hidden">
             <div>
               <h3 className="text-3xl text-white font-display-bold mb-6">Patch <br/> Generation</h3>
               <p className="text-silver-400 text-base leading-relaxed max-w-xs">One-click PRs for security vulnerabilities and architectural technical debt.</p>
             </div>
             <div className="relative mt-12 bg-white/5 rounded-2xl p-8 border border-white/10 transform translate-y-8 group-hover:translate-y-4 transition-transform duration-700 shadow-2xl">
                <div className="flex items-center gap-4 mb-6">
                   <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                   </div>
                   <span className="text-sm font-bold text-white tracking-tight">PR #842 Ready for Merge</span>
                </div>
                <div className="space-y-2 opacity-40">
                   <div className="h-1.5 w-full bg-emerald-400/50 rounded-full" />
                   <div className="h-1.5 w-full bg-emerald-400/50 rounded-full" />
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* Pricing Banner for Free users */}
      {!isPro && token && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1 }}
          className="mt-20 liquid-glass p-8 rounded-[2.5rem] border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6"
        >
          <div>
            <h4 className="text-white font-bold text-xl mb-1">Upgrade to Pro</h4>
            <p className="text-silver-400 text-sm">Unlock unlimited scans and automated PR fixes today.</p>
          </div>
          <button 
            onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
            className="btn-pill btn-pill-active py-3 px-8 text-base shadow-[0_0_20px_rgba(255,255,255,0.2)]"
          >
            Upgrade for $19/mo
          </button>
        </motion.div>
      )}

      {/* Docs Section */}
      <section id="docs" className="scroll-mt-32 py-48">
        <div className="grid lg:grid-cols-2 gap-32 items-center">
          <div>
            <h2 className="text-5xl lg:text-6xl mb-10 metallic-text">Documentation</h2>
            <p className="text-silver-500 mb-16 text-xl leading-relaxed">
              Get started with the backend API, run the platform locally, and configure AI models for your specific needs.
            </p>
            <div className="grid sm:grid-cols-2 gap-6">
              {[
                { label: "Backend API", path: "services/api" },
                { label: "LLM Service", path: "services/llm" },
                { label: "Analysis Engine", path: "services/analysis" },
                { label: "Knowledge Graph", path: "services/knowledge" }
              ].map((doc, i) => (
                <div key={i} className="flex items-center gap-5 p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 hover:border-white/20 transition-all group cursor-pointer shadow-lg hover:bg-white/[0.05]">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-silver-500 group-hover:text-white transition-colors border border-white/10">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-white font-black text-sm mb-0.5 tracking-tight">{doc.label}</div>
                    <code className="text-[9px] text-silver-800 font-mono uppercase tracking-widest">{doc.path}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden lg:block relative h-full">
            <div className="relative liquid-glass rounded-[2.5rem] p-12 border-white/5 shadow-2xl h-full flex flex-col justify-between overflow-hidden">
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/5 blur-3xl -z-10 rounded-full" />
              <div>
                <div className="flex items-center gap-4 mb-10">
                  <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
                  <span className="text-[10px] font-mono text-silver-800 uppercase tracking-[0.4em] font-black">API Reference Node</span>
                </div>
                <div className="space-y-10 font-mono text-base">
                  <div className="group cursor-pointer">
                    <div className="text-white font-black group-hover:text-silver-200 transition-colors">GET /api/v1/analysis/:id</div>
                    <div className="text-silver-700 text-[10px] mt-2 uppercase tracking-widest font-black"># Architectural Insight Mapping</div>
                  </div>
                  <div className="group cursor-pointer">
                    <div className="text-white font-black group-hover:text-silver-200 transition-colors">POST /api/v1/scan/:id</div>
                    <div className="text-silver-700 text-[10px] mt-2 uppercase tracking-widest font-black"># Trigger deep node scanning</div>
                  </div>
                </div>
              </div>
              <div className="mt-12 flex items-center gap-3 text-silver-800 text-[9px] font-black uppercase tracking-[0.4em]">
                <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" /> Nodes syncing...
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="scroll-mt-32 py-32 border-t border-white/5">
        <div className="text-center mb-20">
          <h2 className="text-4xl lg:text-5xl mb-6 metallic-text">Simple, transparent pricing</h2>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto">
            Start free, upgrade when you need more power to ship faster.
          </p>
          {isPro && (
            <div className="mt-6 inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-5 py-2 rounded-full text-sm font-bold">
              <CheckCircle2 className="w-4 h-4 text-indigo-400" /> You are on Pro (Test Mode) â€”
              <button onClick={() => { localStorage.removeItem('atlas_pro'); setIsPro(false); }} className="underline hover:no-underline text-indigo-400 ml-1">Disable</button>
            </div>
          )}
        </div>
        <div className="grid md:grid-cols-3 gap-10">
          {[
            {
              name: "Free Node",
              price: "$0",
              desc: "Perfect for testing the waters on a single weekend project.",
              features: ["1 Repository", "5 Scans per month", "Basic Code Analysis", "Community Support"],
              button: token ? "You're on Free" : "Get Started",
              action: () => onNavigateToLogin(),
              highlight: false,
            },
            {
              name: "Pro Node",
              price: "$19",
              desc: "For serious developers who want to eliminate tech debt.",
              features: ["Unlimited Repositories", "Unlimited Scans", "Auto-Fix Patches", "GitHub PR Integration"],
              button: isPro ? "âœ“ Pro Active" : "Test Pro Mode",
              action: () => {
                localStorage.setItem('atlas_pro', '1');
                window.location.reload();
              },
              highlight: true,
            },
            {
              name: "Enterprise",
              price: "$49",
              desc: "For startups needing CI/CD pipelines and history tracking.",
              features: ["Everything in Pro", "CI/CD Integration", "Compare Trends Over Time", "Enterprise Dashboards"],
              button: "Contact Sales",
              action: () => window.open('mailto:reaobaka@atlasstack.ai?subject=AtlasStack Team Plan', '_blank'),
              highlight: false,
            }
          ].map((tier, i) => (
             <div key={i} className={`liquid-glass p-12 rounded-[2.5rem] border ${tier.highlight ? 'border-white/20' : 'border-white/5'} transition-all hover:scale-[1.02] flex flex-col group h-full`}>
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-lg font-black text-silver-400 uppercase tracking-[0.3em]">{tier.name}</h3>
                   {tier.highlight && (
                     <div className="bg-white/10 text-white text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-white/20">Popular</div>
                   )}
                </div>
                <div className="text-5xl font-display-bold text-white mb-6 metallic-text">{tier.price}<span className="text-lg text-silver-600 font-medium">/mo</span></div>
                <p className="text-sm text-silver-500 mb-10 min-h-[40px] font-medium leading-relaxed">{tier.desc}</p>
                <div className="h-px bg-white/5 mb-10" />
                <ul className="space-y-5 mb-12 flex-1">
                  {tier.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-4 text-sm text-silver-300 font-medium">
                      <div className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                        <CheckCircle2 className={`w-3 h-3 ${tier.highlight ? 'text-white' : 'text-silver-600'}`} />
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>
                <button 
                  onClick={tier.action}
                  disabled={tier.highlight && isPro}
                  className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl ${
                    tier.highlight && isPro
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default'
                      : tier.highlight
                      ? 'bg-white text-black hover:bg-silver-100 hover:scale-[1.02]'
                      : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {tier.button}
                </button>
             </div>
          ))}
        </div>
      </section>


      {/* Footer */}
      <footer className="pt-24 pb-16 border-t border-white/5">
        <div className="flex flex-col md:flex-row justify-between items-center gap-16">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <span className="font-bold text-white">&lt;/&gt;</span>
            </div>
            <span className="text-2xl font-display font-bold text-white tracking-tighter">AtlasStack</span>
          </div>
          
          <div className="flex items-center gap-12 text-[11px] uppercase tracking-[0.4em] font-bold text-slate-600">
            <a href="#" className="hover:text-white transition-colors flex items-center gap-2">
              <Github className="w-5 h-5" /> GitHub
            </a>
            <a href="#" className="hover:text-white transition-colors">License</a>
          </div>
          
          <div className="text-[11px] uppercase tracking-[0.4em] font-bold text-slate-800">
            &copy; 2026 AtlasStack AI.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [currentRepo, setCurrentRepo] = useState<string>('');
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [isPro, setIsPro] = useState<boolean>(localStorage.getItem('atlas_pro') === '1');
  const [apiUrl, setApiUrl] = useState<string>(detectDefaultApiUrl());
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (isSignedIn) {
      getToken().then(t => {
        if (t) setToken(t);
      });
    } else {
      setToken(null);
    }
  }, [isSignedIn, getToken]);


  useEffect(() => {
    const normalized = normalizeApiUrl(apiUrl);
    if (!normalized) {
      return;
    }
    localStorage.setItem(API_URL_STORAGE_KEY, normalized);
  }, [apiUrl]);

  // Check for reset_token in URL params
  const [resetToken, setResetToken] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('reset_token');
  });

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // Handle GitHub Auth Callback â€” GitHub redirects back to the frontend with ?code=...
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const resetTk = params.get("reset_token");

    if (resetTk) {
      window.history.replaceState({}, document.title, window.location.pathname);
      setResetToken(resetTk);
      setCurrentPage('reset');
      return;
    }

    if (code) {
      window.history.replaceState({}, document.title, window.location.pathname);
      
      fetch(`${apiUrl}/api/v1/auth/github/callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      })
      .then(res => res.json())
      .then(data => {
        if (data.access_token) {
          localStorage.setItem(TOKEN_KEY, data.access_token);
          setToken(data.access_token);
          setCurrentPage('dashboard'); // redirect to dashboard after login
        } else {
          console.error("GitHub OAuth failed:", data);
          alert(`GitHub login failed: ${data.detail || 'Unknown error'}`);
        }
      })
      .catch(err => {
        console.error("GitHub auth error:", err);
        alert('GitHub login failed: Cannot reach backend API');
      });
    }
  }, [apiUrl]);



  return (
    <div className="min-h-screen text-slate-400">
      <div className="app-background" />
      <div className="app-overlay" />
      
      <Navbar 
        onNavigate={setCurrentPage} 
        currentPage={currentPage} 
        scrolled={scrolled}
      />

      <AnimatePresence mode="wait">
        {currentPage === 'ide' ? (
          <IDEPage 
            key="ide"
            repoUrl={currentRepo}
            analysisId={analysisId}
            onBack={() => {
              setCurrentPage('landing');
              setAnalysisId(null);
            }}
            apiUrl={apiUrl}
            token={token}
          />
        ) : currentPage === 'dashboard' ? (
          <DashboardPage 
            key="dashboard"
            token={token!}
            apiUrl={apiUrl}
            onBack={() => setCurrentPage('landing')}
            onViewAnalysis={(id: string, repo: string) => { 
               setAnalysisId(id); 
               setCurrentRepo(repo); 
               setCurrentPage('ide'); 
            }}
          />
        ) : currentPage === 'eye' ? (
          <div className="pt-32 px-10 max-w-7xl mx-auto h-[calc(100vh-80px)]">
            <AgentEyeDashboard />
          </div>
        ) : currentPage === 'landing' ? (
          <LandingPage 
            key="landing"
            onNavigateToLogin={() => {}}
            onNavigateToIDE={(repo: string) => { 
               setAnalysisId(null);
               setCurrentRepo(repo); 
               setCurrentPage('ide'); 
            }}
            token={token}
            onLogout={() => {}}
            apiUrl={apiUrl}
            onApiUrlChange={setApiUrl}
            isPro={isPro}
            setIsPro={setIsPro}
          />
        ) : null}
      </AnimatePresence>
      <CookieBanner />
    </div>
  );
}
