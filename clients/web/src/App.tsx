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
  X, Menu, ChevronDown, Zap, BarChart3, Network, GitBranch
} from 'lucide-react';
import {
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth
} from "@clerk/react";
import './index.css';

// ─── Types ────────────────────────────────────────────────────────
type Page = 'landing' | 'ide' | 'dashboard' | 'eye';

// ─── Helpers ──────────────────────────────────────────────────────
const API_URL_STORAGE_KEY = "atlasstack_api_url";
const normalizeApiUrl = (v?: string | null) => (v || '').trim().replace(/\/$/, '');
const detectDefaultApiUrl = () => {
  const env = normalizeApiUrl((import.meta as any).env?.VITE_API_URL);
  if (env) return env;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:8005';
  if (window.location.hostname.includes('onrender.com'))
    return `${window.location.protocol}//${window.location.hostname.replace('-web.', '-api.')}`;
  return window.location.origin;
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
          <span className="nav-link" onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}>How it works</span>
          <span className="nav-link" onClick={() => document.getElementById('stats')?.scrollIntoView({ behavior: 'smooth' })}>Stats</span>
          <a className="nav-link" href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>
          <Show when="signed-in">
            <button className="nav-link" onClick={() => onNavigate('dashboard')}>Dashboard</button>
            <button className="nav-link" onClick={() => onNavigate('eye')}>AgentEye</button>
            <UserButton afterSignOutUrl="/" />
          </Show>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="btn-clay-primary" style={{ padding: '8px 18px', fontSize: '14px' }}>Sign in</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="btn-clay-primary">Get for Free</button>
            </SignUpButton>
          </Show>
        </div>

        {/* Mobile toggle */}
        <button
          style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer' }}
          className="mobile-toggle"
          onClick={() => setOpen(!open)}
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
              background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)',
              borderBottom: '1px solid rgba(0,0,0,0.08)',
              padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16
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
        <ChevronDown className="faq-chevron" />
      </div>
      <div className="faq-answer">{a}</div>
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

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      {/* Island aerial background */}
      <div className="island-bg" />
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

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            {isSignedIn ? (
              <button className="btn-clay-primary" style={{ padding: '14px 28px', fontSize: '16px' }} onClick={onNavigateToDashboard}>
                <BarChart3 size={18} /> Go to Dashboard
              </button>
            ) : (
              <SignInButton mode="modal">
                <button className="btn-clay-primary" style={{ padding: '14px 28px', fontSize: '16px' }}>
                  <Terminal size={18} /> Login to Scan
                </button>
              </SignInButton>
            )}
            <button
              className="btn-clay-ghost"
              style={{ padding: '14px 28px', fontSize: '16px' }}
              onClick={() => {
                const link = document.createElement('a');
                link.href = 'https://pypi.org/project/atlasstack/';
                link.target = '_blank';
                document.body.appendChild(link); link.click(); document.body.removeChild(link);
              }}
            >
              <Terminal size={16} /> AtlasStack CLI <ChevronRight size={16} />
            </button>
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
          <div className="feature-card">
            <p className="section-eyebrow" style={{ marginBottom: 12 }}>Instant Assist</p>
            <h3 className="feature-card-title">When you need help, AtlasStack assists instantly.</h3>
            <p className="feature-card-text">
              Hit <kbd style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)', borderRadius: 4, padding: '1px 6px', fontSize: 12, border: '1px solid rgba(255,255,255,0.15)' }}>Ctrl+Enter</kbd> and AtlasStack surfaces risk summaries, fix suggestions, and export options right in your terminal or browser.
            </p>
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
      <section className="final-cta">
        <h2 className="final-cta-title">
          Code intelligence that works during the review, not after.
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.55)', marginBottom: 32, fontSize: 17 }}>
          Try AtlasStack on your next repository today.
        </p>
        {isSignedIn ? (
          <button className="btn-clay-primary" style={{ padding: '16px 36px', fontSize: '16px' }} onClick={onNavigateToDashboard}>
            <BarChart3 size={18} /> Open Dashboard
          </button>
        ) : (
          <SignInButton mode="modal">
            <button className="btn-clay-primary" style={{ padding: '16px 36px', fontSize: '16px' }}>
              <Terminal size={18} /> Login to Scan
            </button>
          </SignInButton>
        )}
      </section>

      {/* ── Footer ── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="footer">
          <div className="nav-logo" style={{ cursor: 'default' }}>
            <img src="/logo.png" alt="AtlasStack" style={{ height: 24, width: 'auto', objectFit: 'contain' }} />
          </div>
          <div className="footer-links">
            <a className="footer-link" href="https://github.com/Reaobaka56/atlasstack" target="_blank" rel="noreferrer">Resources</a>
            <a className="footer-link" href="mailto:reaobaka@atlasstack.ai">Support</a>
            <a className="footer-link" href="#">Legal</a>
          </div>
          <span style={{ fontSize: 13, color: '#d1d5db' }}>© 2026 AtlasStack AI</span>
        </div>
      </div>
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
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(0,0,0,0.08)', borderRadius: 20,
        padding: '24px 28px', boxShadow: '0 8px 40px rgba(0,0,0,0.12)'
      }}
    >
      <h4 style={{ fontWeight: 700, color: '#111827', marginBottom: 8, fontSize: 16 }}>Cookies</h4>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 1.6 }}>
        We use cookies to analyse usage and improve your experience.
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          className="btn-gradient"
          style={{ flex: 1, justifyContent: 'center', padding: '10px' }}
          onClick={() => { localStorage.setItem('atlas_cookies', '1'); setShow(false); }}
        >Accept</button>
        <button
          className="btn-ghost"
          style={{ flex: 1, justifyContent: 'center', padding: '10px' }}
          onClick={() => setShow(false)}
        >Dismiss</button>
      </div>
    </motion.div>
  );
};

// ─── Root App ─────────────────────────────────────────────────────
export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [currentRepo, setCurrentRepo] = useState('');
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [isPro] = useState(() => localStorage.getItem('atlas_pro') === '1');
  const [apiUrl] = useState(detectDefaultApiUrl());
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    localStorage.setItem(API_URL_STORAGE_KEY, normalizeApiUrl(apiUrl));
  }, [apiUrl]);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  return (
    <>
      <Navbar onNavigate={setCurrentPage} currentPage={currentPage} scrolled={scrolled} />

      <AnimatePresence mode="wait">
        {currentPage === 'ide' ? (
          <IDEPage
            key="ide"
            repoUrl={currentRepo}
            analysisId={analysisId}
            onBack={() => { setCurrentPage('landing'); setAnalysisId(null); }}
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
