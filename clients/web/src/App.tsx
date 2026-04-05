/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Editor from '@monaco-editor/react';
import { IDEPage } from './IDEPage';
import { DashboardPage } from './DashboardPage';
import { 
  Shield, Zap, BarChart3, Network, Github, BookOpen, ChevronRight, Terminal,
  Lock, Mail, Search, LogOut, Cpu, CheckCircle2, X, ArrowLeft, GitBranch,
  Play, Wrench, Package, TrendingDown, GitPullRequest, ScanLine, Activity
} from 'lucide-react';

// --- Constants & API Config ---
const API_URL_STORAGE_KEY = "codesage_api_url";
const TOKEN_KEY = "codesage_access_token";

const normalizeApiUrl = (value?: string | null) => (value || '').trim().replace(/\/$/, '');

const detectDefaultApiUrl = () => {
  const fromWindow = normalizeApiUrl((window as any).CODESAGE_API_URL);
  if (fromWindow) return fromWindow;

  const fromQuery = normalizeApiUrl(new URLSearchParams(window.location.search).get('api'));
  if (fromQuery) return fromQuery;

  const fromStorage = normalizeApiUrl(localStorage.getItem(API_URL_STORAGE_KEY));
  if (fromStorage) return fromStorage;

  if (window.location.hostname.includes('onrender.com')) {
    return `${window.location.protocol}//${window.location.hostname.replace(/-web(?=\.)/, '-api')}`;
  }

  return 'http://localhost:8005';
};

// --- Types ---

interface Feature {
  title: string;
  description: string;
  icon: React.ReactNode;
}

type Page = 'landing' | 'login' | 'ide' | 'dashboard';

// --- Components ---

const Navbar = ({ onNavigate, currentPage, token, onLogout }: { 
  onNavigate: (page: Page) => void, 
  currentPage: Page,
  token: string | null,
  onLogout: () => void
}) => (
  <nav className="fixed top-0 left-0 right-0 z-50 px-8 py-5">
    <div className="max-w-7xl mx-auto flex items-center justify-between">
      <div 
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => onNavigate('landing')}
      >
        <div className="w-8 h-8 rounded-lg glass-card flex items-center justify-center">
          <Zap className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.7)' }} />
        </div>
        <span className="text-base font-black tracking-tight" style={{ color: 'rgba(255,255,255,0.85)' }}>AtlasStack</span>
      </div>
      
      <div className="hidden md:flex items-center gap-8">
        {currentPage === 'landing' && (
          <a href="#try" className="nav-link">Try it now</a>
        )}
        <div className="flex items-center gap-3">
          {token ? (
            <>
              <button onClick={() => onNavigate('dashboard')} className="nav-link text-sm">Dashboard</button>
              <button onClick={onLogout} className="btn-secondary text-xs px-4 py-2">Sign Out</button>
            </>
          ) : (
            <button 
              onClick={() => onNavigate('login')}
              className="btn-primary text-xs px-5 py-2.5"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  </nav>
);

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

const LoginPage = ({ onBack, onLoginSuccess, apiUrl }: { onBack: () => void, onLoginSuccess: (token: string) => void, apiUrl: string, key?: React.Key }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [isError, setIsError] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(mode === 'login' ? "Authenticating..." : "Creating account...");
    setIsError(false);
    try {
      const endpoint = mode === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/register';
      const res = await fetch(`${apiUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload.detail || JSON.stringify(payload));
      }
      setStatusMessage(mode === 'register' ? "Account created! Signing you in..." : null);
      onLoginSuccess(payload.access_token);
    } catch (err: any) {
      setIsError(true);
      setStatusMessage(mode === 'login' ? `Login failed: ${err.message}` : `Registration failed: ${err.message}`);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen flex items-center justify-center px-6"
    >
      <div className="w-full max-w-lg">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors mb-12 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to platform
        </button>
        
        <div className="liquid-glass p-12 rounded-[3rem] border-white/5 shadow-2xl">
          {/* Tab switcher */}
          <div className="flex mb-10 rounded-2xl overflow-hidden border border-white/10 bg-white/5">
            <button type="button" onClick={() => setMode('login')} className={`flex-1 py-3 text-sm font-bold transition-colors ${mode === 'login' ? 'bg-white text-black' : 'text-slate-400 hover:text-white'}`}>Sign In</button>
            <button type="button" onClick={() => setMode('register')} className={`flex-1 py-3 text-sm font-bold transition-colors ${mode === 'register' ? 'bg-white text-black' : 'text-slate-400 hover:text-white'}`}>Register</button>
          </div>
          <h2 className="text-4xl mb-2 metallic-text">{mode === 'login' ? 'Welcome back' : 'Create account'}</h2>
          <p className="text-slate-500 mb-10">{mode === 'login' ? 'Enter your credentials to access the analysis engine.' : 'Create a free account to save your analyses.'}</p>
          
          <form onSubmit={handleLogin} className="space-y-8">
            <div className="space-y-3">
              <label className="block text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
                <input 
                  type="email" 
                  className="input-field pl-16" 
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-3">
              <label className="block text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
                <input 
                  type="password" 
                  className="input-field pl-16" 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            
            <button 
              type="button" 
              onClick={async () => {
                try {
                  const res = await fetch(`${apiUrl}/api/v1/auth/github/login`);
                  const data = await res.json();
                  if (data.url) {
                    window.location.href = data.url;
                  } else {
                    alert('GitHub OAuth not configured. Check GITHUB_CLIENT_ID in .env');
                  }
                } catch (e) {
                  alert('Cannot reach backend. Make sure the API is running at ' + apiUrl);
                }
              }}
              className="w-full py-5 text-lg font-bold bg-[#24292e] text-white rounded-2xl hover:bg-[#2f363d] transition-colors flex items-center justify-center gap-3 border border-white/10"
            >
              <Github className="w-6 h-6" /> Continue with GitHub
            </button>
            <button type="submit" className="btn-primary w-full py-5 text-lg">{mode === 'login' ? 'Sign In with Email' : 'Create Account'}</button>
            {statusMessage && (
              <p className={`text-sm text-center animate-pulse ${isError ? "text-red-400" : "text-slate-500"}`}>{statusMessage}</p>
            )}
          </form>
        </div>
      </div>
    </motion.div>
  );
};

const LandingPage = ({ onNavigateToLogin, onNavigateToIDE, token, onLogout, apiUrl, onApiUrlChange, isPro }: { onNavigateToLogin: () => void, onNavigateToIDE: (repo: string) => void, token: string | null, onLogout: () => void, apiUrl: string, onApiUrlChange: (url: string) => void, isPro: boolean, key?: React.Key }) => {
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl) return;

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setStatusMessage("Initializing analysis engine...");

    try {
      // If the user is logged in, register the repo first; otherwise go straight to IDE analysis
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

      // Navigate to the IDE page which handles the actual deep analysis
      onNavigateToIDE(repoUrl);
    } catch (error: any) {
      setStatusMessage(`Network error: Unable to reach API at ${apiUrl}`);
      setIsAnalyzing(false);
    }
  };

  // Time-based greeting
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';



  return (
    <div className="pb-0">
      {/* ── HERO: Full-viewport cinematic ── */}
      <section className="relative w-full h-screen min-h-[640px] overflow-hidden">

        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/hero_bg.png')" }}
        />
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-black/15" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/35" />

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col px-10 md:px-16 py-10">

          {/* Inline top bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <Zap className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.65)' }} />
              </div>
              <span className="text-sm font-black tracking-tight" style={{ color: 'rgba(255,255,255,0.82)' }}>AtlasStack</span>
            </div>
            <div>
              {token ? (
                <button
                  onClick={() => (window as any).__setPage?.('dashboard')}
                  className="pill text-xs"
                >
                  Dashboard
                </button>
              ) : (
                <button onClick={onNavigateToLogin} className="pill text-xs">
                  Sign In
                </button>
              )}
            </div>
          </div>

          {/* Hero text */}
          <div className="flex-1 flex flex-col justify-center max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-sm font-medium mb-4 tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {timeGreeting} — What would you like to ship today?
              </p>
              <h1 className="text-5xl md:text-[4.5rem] font-black text-white leading-[1.04] tracking-tight mb-6 drop-shadow-2xl">
                The Autonomous<br />
                <span className="metallic-text">Code Engineer.</span>
              </h1>
              <p className="text-base leading-relaxed mb-10 max-w-md" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Paste a GitHub URL. Get a health score, auto-fixes, and one-click PR generation — in under 60 seconds.
              </p>

              {/* Quick action pills — icons only, no emoji */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="flex flex-wrap gap-2"
              >
                {[
                  { label: 'Analyze Repo',    Icon: ScanLine },
                  { label: 'Auto Fix',        Icon: Wrench },
                  { label: 'Security Scan',   Icon: Shield },
                  { label: 'Open PR',         Icon: GitPullRequest },
                  { label: 'Tech Debt',       Icon: TrendingDown },
                  { label: 'Dependencies',    Icon: Package },
                ].map(({ label, Icon }, i) => (
                  <motion.button
                    key={label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 + i * 0.04 }}
                    onClick={() => {
                      if (label === 'Analyze Repo') {
                        document.getElementById('try')?.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    className="pill"
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.5)' }} />
                    {label}
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Top-right: Quick Scan card */}
        <motion.div
          initial={{ opacity: 0, x: 40, y: -20 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="absolute top-20 right-10 w-72 rounded-2xl overflow-hidden"
          style={{ background: 'rgba(6,6,14,0.8)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(24px)' }}
        >
          <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>Quick Scan</span>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.35)' }} />
          </div>
          <form onSubmit={handleAnalyze} className="p-4 space-y-3">
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Repository URL</p>
              <div className="relative">
                <Github className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.25)' }} />
                <input
                  type="url"
                  placeholder="github.com/owner/repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 text-xs rounded-xl outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)' }}
                />
              </div>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Branch</p>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full px-3 py-2.5 text-xs rounded-xl outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)' }}
              />
            </div>
            <button
              type="submit"
              disabled={isAnalyzing || !repoUrl}
              className="w-full py-2.5 rounded-xl font-bold text-xs text-white transition-all flex items-center justify-center gap-2 hover:scale-105 active:scale-95 disabled:opacity-35"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              {isAnalyzing ? (
                <><div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" /> Analyzing</>
              ) : (
                <><ScanLine className="w-3.5 h-3.5" /> Start Analysis</>
              )}
            </button>
            {statusMessage && (
              <p className="text-[10px] text-center animate-pulse" style={{ color: 'rgba(255,255,255,0.4)' }}>{statusMessage}</p>
            )}
          </form>
        </motion.div>

        {/* Bottom-right: AI Tools card */}
        <motion.div
          initial={{ opacity: 0, x: 40, y: 40 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ delay: 0.6, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="absolute bottom-10 right-10 w-60 rounded-2xl"
          style={{ background: 'rgba(6,6,14,0.8)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(24px)' }}
        >
          <div className="p-4">
            <p className="text-xs font-black mb-3" style={{ color: 'rgba(255,255,255,0.7)' }}>Analysis Capabilities</p>
            <div className="space-y-3">
              {[
                { label: 'Auto-Fix Engine',   pct: 94 },
                { label: 'Security Scanner',  pct: 87 },
                { label: 'PR Generator',      pct: 76 },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{item.label}</span>
                    <span className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.55)' }}>{item.pct}%</span>
                  </div>
                  <div className="h-px rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                    <div className="h-full rounded-full" style={{ width: `${item.pct}%`, background: 'rgba(255,255,255,0.25)' }} />
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => document.getElementById('try')?.scrollIntoView({ behavior: 'smooth' })}
              className="mt-4 w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}
            >
              Get Started
            </button>
          </div>
        </motion.div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1" style={{ opacity: 0.3 }}>
          <span className="text-white text-[9px] uppercase tracking-widest font-bold">Scroll</span>
          <div className="w-px h-8" style={{ background: 'rgba(255,255,255,0.3)' }} />
        </div>
      </section>

      {/* Use Cases Section */}
      <section id="use-cases" className="max-w-7xl mx-auto px-8 py-32" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="mb-20 text-center">
          <h2 className="text-4xl lg:text-5xl mb-5 metallic-text">Built to scale your engineering team</h2>
          <p className="text-lg max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Stop wasting engineering hours on trivial issues. Let the agent handle it.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              title: "Autonomous Bug Detection",
              desc: "Deep repository analysis to find security vulnerabilities, edge cases, and runtime bugs before users do.",
              Icon: ScanLine,
            },
            {
              title: "Auto-Fix Tech Debt",
              desc: "Schedule weekly runs to clean up deprecated APIs, dead code, and inconsistencies across your entire codebase.",
              Icon: Wrench,
            },
            {
              title: "One-Click PR Generation",
              desc: "AtlasStack clones the repo, applies the fix, and opens a formatted Pull Request — ready for your review.",
              Icon: GitPullRequest,
            }
          ].map((uc, i) => (
            <div key={i} className="liquid-glass p-8 rounded-3xl card-hover">
              <div className="w-10 h-10 rounded-xl mb-6 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <uc.Icon className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.55)' }} />
              </div>
              <h3 className="text-base font-bold mb-2" style={{ color: 'rgba(255,255,255,0.82)' }}>{uc.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>{uc.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Try Section */}
      <section id="try" className="max-w-7xl mx-auto px-8 py-48">
        <div className="liquid-glass rounded-[4rem] p-12 lg:p-24 relative overflow-hidden border-white/5">
          <div className="grid lg:grid-cols-2 gap-24 relative z-10">
            <div>
              <h2 className="text-5xl lg:text-6xl mb-10 metallic-text">Try it in seconds</h2>
              <p className="text-xl text-slate-500 mb-16 leading-relaxed">
                Connect your repository and instantly receive a comprehensive analysis report. No complex setup required.
              </p>
              
              <div className="space-y-12">
                <div className="flex items-start gap-6">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white border border-white/10 flex-shrink-0 mt-1">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xl text-white font-semibold mb-3">Instant Feedback</h4>
                    <p className="text-slate-500 leading-relaxed">Get results in under 60 seconds for most repositories.</p>
                  </div>
                </div>
                <div className="flex items-start gap-6">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white border border-white/10 flex-shrink-0 mt-1">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xl text-white font-semibold mb-3">Secure by Design</h4>
                    <p className="text-slate-500 leading-relaxed">Your code is analyzed in isolated environments and never stored.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-10">
              <div className="liquid-glass p-12 rounded-[3rem] border-white/5 shadow-2xl">
                <div className="flex items-center justify-between mb-10">
                  <h3 className="text-3xl metallic-text">Analyze Repo</h3>
                  {token && (
                    <button 
                      onClick={onLogout}
                      className="text-[10px] uppercase tracking-[0.3em] text-slate-600 hover:text-white flex items-center gap-2 transition-colors font-bold"
                    >
                      <LogOut className="w-4 h-4" /> Logout
                    </button>
                  )}
                </div>
                
                <form onSubmit={handleAnalyze} className="space-y-8">
                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold ml-1">API URL</label>
                    <input
                      type="url"
                      className="input-field"
                      placeholder="http://localhost:8000"
                      value={apiUrl}
                      onChange={(e) => onApiUrlChange(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold ml-1">Repository URL</label>
                    <div className="relative">
                      <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
                      <input 
                        type="url" 
                        className="input-field pl-16" 
                        placeholder="https://github.com/owner/repository"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold ml-1">Branch</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      required
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={isAnalyzing}
                    className="btn-primary w-full py-5 flex items-center justify-center gap-4 disabled:opacity-50"
                  >
                    {isAnalyzing ? (
                      <>
                        <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Start Analysis"
                    )}
                  </button>
                  {statusMessage && (
                    <p className="text-sm text-center text-slate-500 animate-pulse">{statusMessage}</p>
                  )}
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Docs Section */}
      <section id="docs" className="max-w-7xl mx-auto px-8 py-48">
        <div className="grid lg:grid-cols-2 gap-32 items-center">
          <div>
            <h2 className="text-5xl lg:text-6xl mb-10 metallic-text">Documentation</h2>
            <p className="text-slate-500 mb-16 text-xl leading-relaxed">
              Get started with the backend API, run the platform locally, and configure AI models for your specific needs.
            </p>
            <div className="grid sm:grid-cols-2 gap-6">
              {[
                { label: "Backend API", path: "services/api" },
                { label: "LLM Service", path: "services/llm" },
                { label: "Analysis Engine", path: "services/analysis" },
                { label: "Knowledge Graph", path: "services/knowledge" }
              ].map((doc, i) => (
                <div key={i} className="flex items-center gap-5 p-6 rounded-3xl bg-white/5 border border-white/5 hover:border-white/20 transition-all group">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-white font-medium text-base mb-1">{doc.label}</div>
                    <code className="text-[11px] text-slate-600 font-mono">{doc.path}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden lg:block relative">
            <div className="relative liquid-glass rounded-[3rem] p-12 border-white/5 shadow-2xl">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
                <span className="text-[11px] font-mono text-slate-600 uppercase tracking-[0.4em] font-bold">API Reference</span>
              </div>
              <div className="space-y-8 font-mono text-base">
                <div className="group cursor-pointer">
                  <div className="text-white/80 group-hover:text-white transition-colors">GET /api/v1/analysis/:id</div>
                  <div className="text-slate-600 text-xs mt-2"># Returns full analysis report object</div>
                </div>
                <div className="group cursor-pointer">
                  <div className="text-white/80 group-hover:text-white transition-colors">POST /api/v1/repositories/:id/analyze</div>
                  <div className="text-slate-600 text-xs mt-2"># Triggers new asynchronous repository scan</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="max-w-7xl mx-auto px-8 py-32 border-t border-white/5">
        <div className="text-center mb-20">
          <h2 className="text-4xl lg:text-5xl mb-6 metallic-text">Simple, transparent pricing</h2>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto">
            Start free, upgrade when you need more power to ship faster.
          </p>
          {isPro && (
            <div className="mt-6 inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-5 py-2 rounded-full text-sm font-bold">
              <CheckCircle2 className="w-4 h-4 text-indigo-400" /> You are on Pro (Test Mode) —
              <button onClick={() => { localStorage.removeItem('atlas_pro'); onLogout(); }} className="underline hover:no-underline text-indigo-400 ml-1">Disable</button>
            </div>
          )}
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              name: "Free",
              price: "$0",
              desc: "Perfect for testing the waters on a single weekend project.",
              features: ["1 Repository", "5 Scans per month", "Basic Code Analysis", "Community Support"],
              button: token ? "You're on Free" : "Get Started",
              action: () => onNavigateToLogin(),
              highlight: false,
            },
            {
              name: "Pro",
              price: "$19",
              desc: "For serious developers who want to eliminate tech debt.",
              features: ["Unlimited Repositories", "Unlimited Scans", "Auto-Fix Patches", "GitHub PR Integration"],
              button: isPro ? "✓ Pro Active" : "Test Pro Mode",
              action: () => {
                localStorage.setItem('atlas_pro', '1');
                window.location.reload();
              },
              highlight: true,
            },
            {
              name: "Team",
              price: "$49",
              desc: "For startups needing CI/CD pipelines and history tracking.",
              features: ["Everything in Pro", "CI/CD Integration", "Compare Trends Over Time", "Enterprise Dashboards"],
              button: "Contact Sales",
              action: () => window.open('mailto:reaobaka@atlasstack.ai?subject=AtlasStack Team Plan', '_blank'),
              highlight: false,
            }
          ].map((tier, i) => (
             <div key={i} className={`liquid-glass p-10 rounded-[3rem] border ${tier.highlight ? 'border-blue-500/50 shadow-[0_0_50px_-12px_rgba(59,130,246,0.5)]' : 'border-white/5'} transition-transform hover:scale-[1.02] flex flex-col`}>
                {tier.highlight && (
                  <div className="bg-blue-500/20 text-blue-300 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-blue-500/20 w-fit mb-4">Most Popular</div>
                )}
                <h3 className="text-2xl font-bold text-white mb-2">{tier.name}</h3>
                <div className="text-4xl font-display font-bold text-white mb-4">{tier.price}<span className="text-lg text-slate-500 font-normal">/mo</span></div>
                <p className="text-sm text-slate-400 mb-8 h-10">{tier.desc}</p>
                <ul className="space-y-4 mb-10 flex-1">
                  {tier.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-3 text-sm text-slate-300">
                      <CheckCircle2 className={`w-5 h-5 ${tier.highlight ? 'text-blue-400' : 'text-slate-500'}`} /> {f}
                    </li>
                  ))}
                </ul>
                <button 
                  onClick={tier.action}
                  disabled={tier.highlight && isPro}
                  className={`w-full py-4 rounded-full font-bold text-sm transition-all ${
                    tier.highlight && isPro
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 cursor-default'
                      : tier.highlight
                      ? 'bg-blue-600 text-white hover:bg-blue-500 hover:scale-105'
                      : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {tier.button}
                </button>
                {tier.highlight && !isPro && (
                  <p className="text-center text-xs text-slate-600 mt-3">No credit card required for test mode</p>
                )}
             </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-8 py-32 text-center border-t border-white/5">
        <h2 className="text-3xl metallic-text mb-6">Why I built AtlasStack</h2>
        <p className="text-lg text-slate-400 leading-relaxed italic mb-8 max-w-2xl mx-auto">
          "I was tired of spending hours on routine engineering tasks—fixing low-level bugs, resolving tech debt, and updating dependencies. I wanted an autonomous engineer that could analyze a repository and submit PRs while my team focused on the hard problems. That's why I built AtlasStack."
        </p>
        <div className="text-white font-semibold text-lg">Reaobaka Mogajane</div>
        <div className="text-slate-500 text-sm mt-1 uppercase tracking-widest">Founder, AtlasStack</div>
      </section>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-8 pt-24 pb-16 border-t border-white/5">
        <div className="flex flex-col md:flex-row justify-between items-center gap-16">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <span className="font-bold">&lt;/&gt;</span>
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
  const [token, setToken] = useState<string | null>(localStorage.getItem(TOKEN_KEY));
  const [isPro, setIsPro] = useState<boolean>(localStorage.getItem('atlas_pro') === '1');
  const [apiUrl, setApiUrl] = useState<string>(detectDefaultApiUrl());

  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [token]);


  useEffect(() => {
    const normalized = normalizeApiUrl(apiUrl);
    if (!normalized) {
      return;
    }
    localStorage.setItem(API_URL_STORAGE_KEY, normalized);
  }, [apiUrl]);

  useEffect(() => {
    // Handle GitHub Auth Callback — GitHub redirects back to the frontend with ?code=...
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
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
          setCurrentPage('landing'); // redirect to landing after login
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

  const handleLoginSuccess = (newToken: string) => {
    setToken(newToken);
    setCurrentPage('landing');
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentPage('landing');
  };


  return (
    <div className="min-h-screen text-slate-400">
      <div className="app-background" />
      <div className="app-overlay" />
      
      {/* Hide global navbar on landing — it has its own inline nav in the hero */}
      {currentPage !== 'landing' && (
        <Navbar 
          onNavigate={setCurrentPage} 
          currentPage={currentPage} 
          token={token}
          onLogout={handleLogout}
        />
      )}
      {/* Expose setCurrentPage for the landing page's inline dashboard button */}
      {typeof window !== 'undefined' && ((window as any).__setPage = setCurrentPage)}

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
        ) : currentPage === 'landing' ? (
          <LandingPage 
            key="landing"
            onNavigateToLogin={() => setCurrentPage('login')}
            onNavigateToIDE={(repo: string) => { 
               setAnalysisId(null);
               setCurrentRepo(repo); 
               setCurrentPage('ide'); 
            }}
            token={token}
            onLogout={handleLogout}
            apiUrl={apiUrl}
            onApiUrlChange={setApiUrl}
            isPro={isPro}
          />
        ) : (
          <LoginPage 
            key="login"
            onBack={() => setCurrentPage('landing')}
            onLoginSuccess={handleLoginSuccess}
            apiUrl={apiUrl}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
