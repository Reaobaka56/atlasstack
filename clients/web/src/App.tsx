/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { IDEPage } from './IDEPage';
import { DashboardPage } from './DashboardPage';
import { AgentEyeDashboard } from './AgentEyeDashboard';
import {
  Shield, Github, ChevronRight, Terminal, CheckCircle2,
  X, Menu, ChevronDown, Zap, BarChart3, Network, GitBranch, ArrowLeft
} from 'lucide-react';
import {
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
  useUser
} from "@clerk/react";
import './index.css';

// ─── Types ────────────────────────────────────────────────────────
type Page = 'landing' | 'ide' | 'dashboard' | 'eye';

// ─── Helpers ──────────────────────────────────────────────────────
const API_URL_STORAGE_KEY = "atlasstack_api_url";
const normalizeApiUrl = (v?: string | null) => (v || '').trim().replace(/\/$/, '');
const detectDefaultApiUrl = () => {
  // 1. Check environment variable first
  const env = normalizeApiUrl((import.meta as any).env?.VITE_API_URL);
  if (env) {
    console.log('Using API URL from VITE_API_URL env:', env);
    return env;
  }
  
  const host = window.location.hostname;
  
  // 2. For Docker container environments
  if (host === 'api' || host === 'web') {
    const apiUrl = 'http://api:8000'; // ✅ Docker service name
    console.log('Using Docker service API URL:', apiUrl);
    return apiUrl;
  }
  
  // 3. For localhost development
  if (host === 'localhost' || host === '127.0.0.1') {
    const apiUrl = 'http://localhost:8000'; // ✅ Changed from 8005 to 8000
    console.log('Using localhost API URL:', apiUrl);
    return apiUrl;
  }
  
  // 4. For Render.com deployments
  if (host.includes('onrender.com')) {
    const apiUrl = `${window.location.protocol}//${host.replace('-web.', '-api.')}`;
    console.log('Using Render.com API URL:', apiUrl);
    return apiUrl;
  }
  
  // 5. For same-origin deployments
  const apiUrl = window.location.origin;
  console.log('Using same-origin API URL:', apiUrl);
  return apiUrl;
};

// ─── Show ─────────────────────────────────────────────────────────
const Show = ({ when, children }: { when: 'signed-in' | 'signed-out'; children: React.ReactNode }) => {
  const { isSignedIn } = useAuth();
  if (when === 'signed-in' && isSignedIn) return <>{children}</>;
  if (when === 'signed-out' && !isSignedIn) return <>{children}</>;
  return null;
};

// ─── Navbar ───────────────────────────────────────────────────────
const Navbar = ({ onNavigate, currentPage, scrolled }: {
  onNavigate: (p: Page) => void;
  currentPage: Page;
  scrolled: boolean;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
        <div
          className="nav-logo"
          onClick={() => { onNavigate('landing'); setOpen(false); }}
        >
          <img src="/logo.png" alt="AtlasStack" style={{ height: 28, width: 'auto', objectFit: 'contain' }} />
        </div>

        {/* Desktop */}
        <div className="nav-links">
          {currentPage === 'landing' ? (
            <>
              <span className="nav-link" onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}>How it works</span>
              <span className="nav-link" onClick={() => document.getElementById('stats')?.scrollIntoView({ behavior: 'smooth' })}>Stats</span>
            </>
          ) : (
            <button className="nav-link flex items-center gap-2" onClick={() => onNavigate('landing')}>
              <ArrowLeft size={14} /> Back
            </button>
          )}
          <a className="nav-link" href="https://github.com/Reaobaka56/atlasstack" target="_blank" rel="noreferrer">GitHub</a>
          <Show when="signed-in">
            <button className="nav-link" onClick={() => onNavigate('dashboard')}>Dashboard</button>
            <button className="nav-link" onClick={() => onNavigate('eye')}>AgentEye</button>
            <UserButton afterSignOutUrl="/" />
          </Show>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <span className="nav-link" style={{ padding: '8px 12px' }}>Sign in</span>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="btn-clay-primary" style={{ padding: '8px 20px', fontSize: '13px' }}>Get for Free</button>
            </SignUpButton>
          </Show>
        </div>

        {/* Mobile toggle */}
        <button
          className="mobile-toggle"
          onClick={() => setOpen(!open)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff' }}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              position: 'fixed', top: 60, left: 0, right: 0, zIndex: 99,
              background: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(32px)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              padding: '24px', display: 'flex', flexDirection: 'column', gap: 16
            }}
          >
            <Show when="signed-out">
              <SignInButton mode="modal"><button className="btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>Sign in</button></SignInButton>
              <SignUpButton mode="modal"><button className="btn-gradient" style={{ width: '100%', justifyContent: 'center' }}>Get for Free</button></SignUpButton>
            </Show>
            <Show when="signed-in">
              <button className="nav-link" onClick={() => { onNavigate('dashboard'); setOpen(false); }}>Dashboard</button>
              <button className="nav-link" onClick={() => { onNavigate('eye'); setOpen(false); }}>AgentEye</button>
            </Show>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// ─── Waveform ─────────────────────────────────────────────────────
const Waveform = () => (
  <div className="waveform">
    {Array.from({ length: 20 }).map((_, i) => (
      <div key={i} className="waveform-bar" />
    ))}
  </div>
);

// ─── FAQ Item ─────────────────────────────────────────────────────
const FAQItem = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq-item${open ? ' open' : ''}`} onClick={() => setOpen(!open)}>
      <div className="faq-question">
        {q}
        <motion.div animate={{ rotate: open ? 180 : 0 }}>
          <ChevronDown className="faq-chevron" />
        </motion.div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="faq-answer">{a}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Landing Page ─────────────────────────────────────────────────
const LandingPage = ({ onNavigateToDashboard, isPro }: {
  onNavigateToDashboard: () => void;
  isPro: boolean;
}) => {
  const { isSignedIn } = useAuth();

  const faqs = [
    {
      q: 'Why use AtlasStack instead of just reading the code myself?',
      a: 'AtlasStack scans thousands of files in seconds, maps dependency graphs, identifies security vulnerabilities, and generates fix patches — tasks that would take a senior engineer days to do manually.'
    },
    {
      q: 'Who is AtlasStack for?',
      a: 'Engineering teams, solo developers, and code reviewers who want instant architectural insight into any GitHub repository without spending hours reading unfamiliar codebases.'
    },
    {
      q: 'Is AtlasStack free?',
      a: 'Yes — the free tier gives you 5 scans per month with full analysis reports. Pro unlocks unlimited scans and automated PR fix generation.'
    },
    {
      q: 'How does the CLI scanner work?',
      a: 'Install atlas via pip, point it at any GitHub URL, and AtlasStack clones, parses, and analyses the full repository topology in under 60 seconds, outputting a rich terminal report.'
    },
    {
      q: 'What languages are supported?',
      a: 'Python, TypeScript, JavaScript, Go, Rust, Java, and C# — with more being added continuously through the open-source parser engine.'
    },
    {
      q: 'Can I talk to support?',
      a: 'Yes — reach us at reaobaka@atlasstack.ai for any issues, enterprise inquiries, or feature requests.'
    },
  ];

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      {/* ── Background ── */}
      <div className="island-bg">
        <div className="aurora-blob blob-1" />
        <div className="aurora-blob blob-2" />
        <div className="aurora-blob blob-3" />
      </div>
      <div className="island-overlay" />

      {/* ── Hero ── */}
      <section className="hero">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>

          <h1 className="hero-title">
            AI that scans your repo,<br />
            <span className="text-gradient">not just reads it.</span>
          </h1>

          <p className="hero-sub">
            AtlasStack deeply analyses your repository topology to find architectural risks, security gaps, and performance bottlenecks — then generates the fix.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            {isSignedIn ? (
              <button className="btn-clay-primary" style={{ padding: '16px 36px', fontSize: '16px' }} onClick={onNavigateToDashboard}>
                <BarChart3 size={18} /> Go to Dashboard
              </button>
            ) : (
              <SignInButton mode="modal">
                <button className="btn-clay-primary" style={{ padding: '16px 36px', fontSize: '16px' }}>
                  <Terminal size={18} /> Login to Scan
                </button>
              </SignInButton>
            )}
            <button
              className="btn-clay-ghost"
              style={{ padding: '16px 36px', fontSize: '16px' }}
              onClick={() => {
                const link = document.createElement('a');
                link.href = 'https://github.com/Reaobaka56/atlasstack'; 
                link.target = '_blank';
                document.body.appendChild(link); link.click(); document.body.removeChild(link);
              }}
            >
              <Github size={18} /> View on GitHub
            </button>
          </div>

          <div style={{ marginTop: 80, opacity: 0.5 }}>
            <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 800, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>Trusted by engineering teams at</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 48, flexWrap: 'wrap', filter: 'grayscale(1) brightness(0.8)' }}>
              <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em', color: '#fff' }}>STELLAR</span>
              <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em', color: '#fff' }}>VORTEX</span>
              <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em', color: '#fff' }}>NEXUS</span>
              <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em', color: '#fff' }}>ORBIT</span>
            </div>
          </div>
        </motion.div>

        {/* Hero MacBook CLI screenshot */}
        <motion.div
          className="hero-visual"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <div className="hero-visual-glow" />
          <div className="macbook-frame">
            <div className="macbook-topbar">
              <div className="macbook-dots">
                <div className="macbook-dot macbook-dot-r" />
                <div className="macbook-dot macbook-dot-y" />
                <div className="macbook-dot macbook-dot-g" />
              </div>
              <div className="macbook-title">atlasstack — zsh — 120×36</div>
              <div style={{ width: 56 }} />
            </div>
            <div className="macbook-screen">
              <div className="macbook-cli-line"><span className="cli-prompt">❯</span> <span className="cli-cmd">pip install atlasstack</span></div>
              <div className="macbook-cli-line cli-muted">Collecting atlasstack...</div>
              <div className="macbook-cli-line cli-muted">Successfully installed atlasstack-2.0.1</div>
              <div className="macbook-cli-line" style={{ marginTop: 12 }}><span className="cli-prompt">❯</span> <span className="cli-cmd">atlas scan https://github.com/stripe/stripe-node</span></div>
              <div className="macbook-cli-line" style={{ marginTop: 8 }}>
                <span className="cli-cyan">◆ AtlasStack</span> <span className="cli-muted">v2.0.1 initializing...</span>
              </div>
              <div className="macbook-cli-line"><span className="cli-green">✓</span> Cloned repository in <span className="cli-white">1.2s</span></div>
              <div className="macbook-cli-line"><span className="cli-green">✓</span> Parsing <span className="cli-white">2,847 files</span> across <span className="cli-white">23 modules</span></div>
              <div className="macbook-cli-progress">
                <div className="macbook-progress-label"><span className="cli-cyan">▶</span> Analysing dependency graph</div>
                <div className="macbook-progress-bar"><div className="macbook-progress-fill" /></div>
                <div className="cli-muted" style={{ fontSize: 10, marginTop: 4 }}>████████████████░░░░░░  78%</div>
              </div>
              <div className="macbook-cli-line" style={{ marginTop: 12 }}><span className="cli-yellow">⚠</span>  <span className="cli-white">3 critical vulnerabilities</span> detected</div>
              <div className="macbook-cli-line"><span className="cli-cyan">◆</span> <span className="cli-white">12 performance bottlenecks</span> mapped</div>
              <div className="macbook-cli-line"><span className="cli-green">✓</span> Auto-patch PR <span className="cli-white">#842</span> generated</div>
              <div className="macbook-cli-line" style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                <span className="cli-muted">Report →</span> <span className="cli-indigo">atlasstack.ai/r/8f2a</span>
              </div>
              <div className="macbook-cursor-line">
                <span className="cli-prompt">❯</span> <span className="macbook-cursor" />
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── How AtlasStack Helps ── */}
      <section className="section" id="how">
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <p className="section-eyebrow">How it works</p>
          <h2 className="section-title">How AtlasStack helps during a scan</h2>
        </div>

        <div className="feature-grid">
          {/* Card 1 — Assist */}
          <div className="feature-card" style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center' }}>
              <div>
                <p className="section-eyebrow" style={{ marginBottom: 12 }}>Instant Assist</p>
                <h3 className="feature-card-title">When you need help, AtlasStack assists instantly.</h3>
                <p className="feature-card-text">
                  Hit <kbd style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)', borderRadius: 4, padding: '1px 6px', fontSize: 12, border: '1px solid rgba(255,255,255,0.15)' }}>Ctrl+Enter</kbd> and AtlasStack surfaces risk summaries, fix suggestions, and export options right in your terminal or browser.
                </p>
              </div>
              <div className="feature-card-visual">
                <div className="assist-card">
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>ASSIST</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <span className="assist-chip"><Shield size={12} /> View Risks</span>
                    <span className="assist-chip"><Zap size={12} /> Generate Fix</span>
                    <span className="assist-chip"><GitBranch size={12} /> Open PR</span>
                    <span className="assist-chip"><BarChart3 size={12} /> Full Report</span>
                  </div>
                  <p style={{ marginTop: 14, fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>Ctrl+Enter to assist</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3 — Notes / Reports */}
          <div className="feature-card" style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center' }}>
              <div>
                <p className="section-eyebrow" style={{ marginBottom: 12 }}>Instant Reports</p>
                <h3 className="feature-card-title">Instant architectural reports</h3>
                <p className="feature-card-text">
                  The easiest way to get beautiful, shareable architecture maps and security reports. AtlasStack generates them automatically after every scan.
                </p>
              </div>
              <div>
                <div className="mini-terminal">
                  <div className="mini-terminal-bar">
                    <div className="dot-r" /><div className="dot-y" /><div className="dot-g" />
                    <span>atlasstack — scan results</span>
                  </div>
                  <div className="mini-terminal-body">
                    <div className="t-indigo">▶ Scan complete for stripe/stripe-node</div>
                    <div className="t-green">✓ 2,847 files analysed</div>
                    <div className="t-yellow">⚠  3 critical vulnerabilities</div>
                    <div className="t-cyan">◆ 12 performance bottlenecks</div>
                    <div className="t-green">✓ Auto-patch PR #842 generated</div>
                    <div className="t-white" style={{ marginTop: 8 }}>Report → atlasstack.ai/r/8f2a</div>
                    <div className="t-gray" style={{ marginTop: 4 }}>Press any key to exit...</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="section" id="stats" style={{ paddingTop: 0 }}>
        <div style={{ textAlign: 'center' }}>
          <h2 className="section-title">Built for speed and accuracy</h2>
          <p className="section-sub" style={{ margin: '0 auto' }}>
            AtlasStack uses a purpose-built parser engine, not general-purpose LLMs, for blazing-fast results.
          </p>
        </div>
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-number text-gradient">&lt;60s</div>
            <div style={{ fontWeight: 700, color: '#fff', marginBottom: 6 }}>Scan time</div>
            <p className="stat-label">Full repository topology analysis in under 60 seconds. Tested against repos with 10,000+ files.</p>
          </div>
          <div className="stat-card">
            <div className="stat-number text-gradient">97%</div>
            <div style={{ fontWeight: 700, color: '#fff', marginBottom: 6 }}>Vulnerability detection rate</div>
            <p className="stat-label">Trusted by engineering teams for reliable detection. Benchmarked against OWASP Top 10 categories.</p>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <h2 className="section-title">Frequently asked questions</h2>
          </div>
          <div className="faq-list">
            {faqs.map((f, i) => <FAQItem key={i} q={f.q} a={f.a} />)}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="section">
        <div className="feature-card" style={{ 
          textAlign: 'center', 
          padding: '80px 40px',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 100%)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <h2 className="section-title" style={{ fontSize: 40, marginBottom: 16 }}>
            Ready to secure your code?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 40, fontSize: 18, maxWidth: 500, margin: '0 auto 40px' }}>
            Join hundreds of developers using AtlasStack to ship faster and safer.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            <SignInButton mode="modal">
              <button className="btn-clay-primary" style={{ padding: '16px 40px', fontSize: '16px' }}>
                Get Started Now
              </button>
            </SignInButton>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(3,3,3,0.8)', padding: '80px 0 40px' }}>
        <div className="section" style={{ padding: '0 40px', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 60 }}>
            <div>
              <div className="nav-logo" style={{ marginBottom: 24 }}>
                <img src="/logo.png" alt="AtlasStack" style={{ height: 28 }} />
              </div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, lineHeight: 1.6 }}>
                AI-native code intelligence for the modern engineering team.
              </p>
            </div>
            <div>
              <h4 style={{ color: '#fff', fontSize: 13, fontWeight: 700, marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Product</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <a href="#how" className="footer-link">How it works</a>
                <a href="#stats" className="footer-link">Stats</a>
                <a href="https://github.com/Reaobaka56/atlasstack" className="footer-link">CLI Tool</a>
              </div>
            </div>
            <div>
              <h4 style={{ color: '#fff', fontSize: 13, fontWeight: 700, marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Resources</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <a href="https://github.com/Reaobaka56/atlasstack" className="footer-link">GitHub</a>
                <a href="mailto:reaobaka@atlasstack.ai" className="footer-link">Support</a>
              </div>
            </div>
            <div>
              <h4 style={{ color: '#fff', fontSize: 13, fontWeight: 700, marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Legal</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <a href="#" className="footer-link">Privacy</a>
                <a href="#" className="footer-link">Terms</a>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 80, paddingTop: 40, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
            <span>© 2026 AtlasStack. All rights reserved.</span>
            <div style={{ display: 'flex', gap: 24 }}>
              <a href="https://github.com/Reaobaka56/atlasstack" className="footer-link"><Github size={16} /></a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

// ─── Cookie Banner ────────────────────────────────────────────────
const CookieBanner = () => {
  const [show, setShow] = useState(() => !localStorage.getItem('atlas_cookies'));
  if (!show) return null;
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      style={{
        position: 'fixed', bottom: 24, left: 24, right: 24, maxWidth: 420,
        marginLeft: 'auto', zIndex: 200,
        background: 'rgba(20,20,20,0.8)', backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24,
        padding: '28px', boxShadow: '0 12px 48px rgba(0,0,0,0.4)'
      }}
    >
      <h4 style={{ fontWeight: 700, color: '#fff', marginBottom: 8, fontSize: 16 }}>Privacy First</h4>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20, lineHeight: 1.6 }}>
        We use essential cookies to maintain security and analyse node cluster health.
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          className="btn-clay-primary"
          style={{ flex: 1, justifyContent: 'center', padding: '12px', fontSize: 13 }}
          onClick={() => { localStorage.setItem('atlas_cookies', '1'); setShow(false); }}
        >Accept</button>
        <button
          className="btn-ghost"
          style={{ flex: 1, justifyContent: 'center', padding: '12px', fontSize: 13 }}
          onClick={() => setShow(false)}
        >Decline</button>
      </div>
    </motion.div>
  );
};

// ─── Root App ─────────────────────────────────────────────────────
export default function App() {
  const { isLoaded, isSignedIn } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [currentRepo, setCurrentRepo] = useState('');
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [isPro] = useState(() => localStorage.getItem('atlas_pro') === '1');
  const [apiUrl] = useState(detectDefaultApiUrl());
  const [scrolled, setScrolled] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    localStorage.setItem(API_URL_STORAGE_KEY, normalizeApiUrl(apiUrl));
  }, [apiUrl]);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowDebug(true), 5000);
    return () => clearTimeout(timer);
  }, [isLoaded]);

  if (!isLoaded) {
    return (
      <div className="h-screen w-screen bg-[#030303] flex items-center justify-center relative overflow-hidden">
        <div className="noise-overlay opacity-20" />
        <div className="island-bg">
          <div className="aurora-blob blob-1" />
          <div className="aurora-blob blob-2" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] border border-white/10 flex items-center justify-center animate-pulse shadow-2xl relative overflow-hidden group">
             <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
             <Zap className="w-12 h-12 text-white fill-white relative z-10" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-white tracking-tighter metallic-text">SYNCHRONIZING</h2>
            <p className="text-[10px] font-black text-silver-700 uppercase tracking-[0.4em] mt-3 animate-pulse">Connecting to AtlasStack Clusters</p>
          </div>

          {showDebug && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 p-4 bg-white/5 rounded-xl border border-white/10 max-w-md w-full backdrop-blur-md"
            >
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">Diagnostic Report</span>
              </div>
              <div className="space-y-2 font-mono text-[9px] text-silver-500">
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>API_URL:</span>
                  <span className="text-white">{apiUrl || 'NOT_DETECTED'}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>AUTH_LOADED:</span>
                  <span className={isLoaded ? "text-emerald-400" : "text-rose-400"}>{isLoaded ? "TRUE" : "FALSE"}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>CLERK_KEY:</span>
                  <span className="text-white">
                    {import.meta.env.VITE_CLERK_PUBLISHABLE_KEY 
                      ? `${import.meta.env.VITE_CLERK_PUBLISHABLE_KEY.substring(0, 8)}...` 
                      : 'MISSING'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>ENVIRONMENT:</span>
                  <span className="text-white">{import.meta.env.MODE}</span>
                </div>
              </div>
              <button 
                onClick={() => window.location.reload()}
                className="mt-4 w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-[9px] font-bold text-white uppercase tracking-widest transition-colors"
              >
                Retry Connection
              </button>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="noise-overlay" />
      <Navbar onNavigate={setCurrentPage} currentPage={currentPage} scrolled={scrolled} />

      <AnimatePresence mode="wait">
        {currentPage === 'ide' ? (
          <IDEPage
            key="ide"
            repoUrl={currentRepo}
            analysisId={analysisId}
            onBack={() => { setCurrentPage('dashboard'); setAnalysisId(null); }}
            apiUrl={apiUrl}
          />
        ) : currentPage === 'dashboard' ? (
          <DashboardPage
            key="dashboard"
            apiUrl={apiUrl}
            onBack={() => setCurrentPage('landing')}
            onViewAnalysis={(id, repo) => { setAnalysisId(id); setCurrentRepo(repo); setCurrentPage('ide'); }}
          />
        ) : currentPage === 'eye' ? (
          <div style={{ paddingTop: 80 }}>
            <AgentEyeDashboard />
          </div>
        ) : (
          <LandingPage
            key="landing"
            onNavigateToDashboard={() => setCurrentPage('dashboard')}
            isPro={isPro}
          />
        )}
      </AnimatePresence>

      <CookieBanner />
    </>
  );
}
