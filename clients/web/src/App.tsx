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
  ArrowLeft,
  Sun,
  Moon,
  GitBranch,
  Play
} from 'lucide-react';

// --- Constants & API Config ---
const API_URL_STORAGE_KEY = "codesage_api_url";
const TOKEN_KEY = "codesage_access_token";
const THEME_KEY = "codesage_theme";

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

const Navbar = ({ onNavigate, currentPage, theme, onToggleTheme, token, onLogout }: { 
  onNavigate: (page: Page) => void, 
  currentPage: Page,
  theme: 'light' | 'dark',
  onToggleTheme: () => void,
  token: string | null,
  onLogout: () => void
}) => (
  <nav className="fixed top-0 left-0 right-0 z-50 px-8 py-6">
    <div className="max-w-7xl mx-auto flex items-center justify-between">
      <div 
        className="flex items-center gap-4 group cursor-pointer"
        onClick={() => onNavigate('landing')}
      >
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center overflow-hidden border border-white/10 shadow-2xl">
          <img 
            src="" 
            alt="Logo" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <span className="text-2xl font-display font-bold text-white tracking-tighter">AtlasStack</span>
      </div>
      
      <div className="hidden md:flex items-center gap-10">
        {currentPage === 'landing' && (
          <>
            <a href="#try" className="nav-link">Try it now</a>
          </>
        )}
        <div className="flex items-center gap-4">
          <button 
            onClick={onToggleTheme}
            className="p-2.5 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all"
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          {token ? (
            <>
              <button onClick={() => onNavigate('dashboard')} className="text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors">Dashboard</button>
              <button onClick={onLogout} className="btn-primary py-2.5 text-sm">Logout</button>
            </>
          ) : (
            <button 
              onClick={() => onNavigate('login')}
              className="btn-primary py-2.5 text-sm"
            >
              Sign In / Register
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
              onClick={() => window.location.href = `${apiUrl}/api/v1/auth/github/login`}
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

const LandingPage = ({ onNavigateToLogin, onNavigateToIDE, token, onLogout, apiUrl, onApiUrlChange }: { onNavigateToLogin: () => void, onNavigateToIDE: (repo: string) => void, token: string | null, onLogout: () => void, apiUrl: string, onApiUrlChange: (url: string) => void, key?: React.Key }) => {
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

  return (
    <div className="pt-32 pb-24">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-8 py-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="text-center max-w-5xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm mb-8 font-medium">
            <Zap className="w-4 h-4" />
            AtlasStack Beta Available
          </div>

          <h1 className="text-5xl lg:text-7xl font-bold tracking-tight mb-8">
            <span className="text-white">The autonomous</span>
            <br />
            <span className="metallic-text">software engineer.</span>
          </h1>

          <p className="text-xl text-slate-400 mb-12 leading-relaxed max-w-2xl mx-auto">
            AtlasStack continuously improves your codebase by analyzing repositories, finding bugs, and opening high-quality pull requests—while you sleep.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-32">
            <a href="#try" className="btn-primary flex items-center gap-3">
              Analyze a Repository <ChevronRight className="w-5 h-5" />
            </a>
          </div>

          <div className="mb-14 relative group cursor-pointer max-w-4xl mx-auto">
            <div className="w-full aspect-video bg-black/40 rounded-2xl border border-white/10 flex flex-col items-center justify-center overflow-hidden relative shadow-2xl transition-transform group-hover:scale-[1.01]">
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10 pointer-events-none" />
              
              <video 
                className="absolute inset-0 w-full h-full object-cover opacity-50"
                autoPlay loop muted playsInline
              >
              </video>
              
              <div className="z-20 text-center relative pointer-events-none">
                <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center mx-auto mb-4 group-hover:bg-white/20 transition-colors shadow-lg shadow-black/50">
                   <Play className="w-6 h-6 text-white ml-1" />
                </div>
                <p className="text-slate-300 font-medium text-sm drop-shadow-md">See AtlasStack generate a PR (30s demo)</p>
                <div className="text-[10px] text-slate-500 mt-2 font-mono">Place your demo.mp4 in the /public folder</div>
              </div>
            </div>
            <div className="absolute inset-0 bg-blue-500/20 blur-[100px] -z-10 rounded-full" />
          </div>
        </motion.div>
      </section>

      {/* Use Cases Section */}
      <section id="use-cases" className="max-w-7xl mx-auto px-8 py-32 border-t border-white/5">
        <div className="mb-20 text-center">
          <h2 className="text-4xl lg:text-5xl mb-6 metallic-text">Built to scale your engineering team</h2>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto">
            Stop wasting junior dev hours on trivial issues. Let the agent handle it.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              title: "Finds Bugs Autonomously",
              desc: "AtlasStack deeply analyzes your repository structure to find security vulnerabilities, edge cases, and runtime bugs before users do.",
              icon: <Zap className="w-6 h-6 text-yellow-400" />
            },
            {
              title: "Auto-Fixes Tech Debt",
              desc: "Schedule AtlasStack to run weekly and clean up deprecated APIs, dead code, and inconsistent styling across your entire monolithic codebase.",
              icon: <Network className="w-6 h-6 text-blue-400" />
            },
            {
              title: "One-Click PR Generation",
              desc: "Instead of just leaving a comment, AtlasStack clones the repo, makes the fix, and opens a perfectly formatted Pull Request for your review.",
              icon: <GitBranch className="w-6 h-6 text-purple-400" />
            }
          ].map((uc, i) => (
            <div key={i} className="liquid-glass p-8 rounded-[2rem] border-white/5 hover:border-white/10 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6">
                {uc.icon}
              </div>
              <h3 className="text-xl text-white font-semibold mb-3">{uc.title}</h3>
              <p className="text-slate-400 leading-relaxed text-sm">{uc.desc}</p>
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
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              name: "Free",
              price: "$0",
              desc: "Perfect for testing the waters on a single weekend project.",
              features: ["1 Repository", "5 Scans per month", "Basic Code Analysis", "Community Support"],
              button: "Get Started"
            },
            {
              name: "Pro",
              price: "$19",
              desc: "For serious developers who want to eliminate tech debt.",
              features: ["Unlimited Repositories", "Unlimited Scans", "Auto-Fix Patches", "GitHub PR Integration"],
              button: "Upgrade to Pro",
              highlight: true
            },
            {
              name: "Team",
              price: "$49",
              desc: "For startups needing CI/CD pipelines and history tracking.",
              features: ["Everything in Pro", "CI/CD Integration", "Compare Trends Over Time", "Enterprise Dashboards"],
              button: "Contact Sales"
            }
          ].map((tier, i) => (
             <div key={i} className={`liquid-glass p-10 rounded-[3rem] border ${tier.highlight ? 'border-blue-500/50 shadow-[0_0_50px_-12px_rgba(59,130,246,0.5)]' : 'border-white/5'} transition-transform hover:scale-[1.02] flex flex-col`}>
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
                  onClick={() => alert('Stripe integration coming soon!')}
                  className={`w-full py-4 rounded-full font-bold text-sm transition-colors ${tier.highlight ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'}`}
                >
                  {tier.button}
                </button>
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
  const [theme, setTheme] = useState<'light' | 'dark'>((localStorage.getItem(THEME_KEY) as 'light' | 'dark') || 'dark');
  const [apiUrl, setApiUrl] = useState<string>(detectDefaultApiUrl());

  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [token]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    if (theme === 'light') {
      document.body.classList.add('light');
    } else {
      document.body.classList.remove('light');
    }
  }, [theme]);

  useEffect(() => {
    const normalized = normalizeApiUrl(apiUrl);
    if (!normalized) {
      return;
    }
    localStorage.setItem(API_URL_STORAGE_KEY, normalized);
  }, [apiUrl]);

  useEffect(() => {
    // Handle GitHub Auth Callback
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      // Clear URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Exchange code for token
      fetch(`${apiUrl}/api/v1/auth/github/callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      })
      .then(res => res.json())
      .then(data => {
        if (data.access_token) {
          setToken(data.access_token);
        }
      })
      .catch(err => console.error("GitHub auth error:", err));
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

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="min-h-screen text-slate-400">
      <div className="app-background" />
      <div className="app-overlay" />
      
      <Navbar 
        onNavigate={setCurrentPage} 
        currentPage={currentPage} 
        theme={theme}
        onToggleTheme={toggleTheme}
        token={token}
        onLogout={handleLogout}
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
