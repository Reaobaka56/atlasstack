/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Code2,
  Download,
  GitBranch,
  Github,
  Layers3,
  Menu,
  Play,
  ShieldCheck,
  Sparkles,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { DashboardPage } from './DashboardPage';
import { IDEPage } from './IDEPage';
import { ClerkProvider, SignInButton, UserButton, useAuth, useUser } from '@clerk/react';
import './index.css';

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_Zml0LW1hbW1hbC02MC5jbGVyay5hY2NvdW50cy5kZXYk';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

type Page = 'landing' | 'dashboard' | 'studio' | 'ide';

const routeFromHash = (): Page => {
  const route = window.location.hash.replace('#/', '').replace('#', '') as Page;
  return ['landing', 'dashboard', 'studio', 'ide'].includes(route) ? route : 'landing';
};


const flowSteps = [
  {
    title: 'Connect context',
    body: 'Paste a repository, upload source maps, or start from the VS Code assistant.',
  },
  {
    title: 'Generate the runbook',
    body: 'AtlasStack turns architecture, risk, and dependency signals into an editable plan.',
  },
  {
    title: 'Ship verified fixes',
    body: 'Review patches, export reports, and keep every stakeholder aligned.',
  },
];

const useCases = [
  'Architecture drift reviews',
  'Security posture scans',
  'Dependency upgrade planning',
  'AI-generated remediation PRs',
];

const featureCards = [
  {
    icon: <Wand2 size={20} />,
    title: 'Prompt-to-audit workflows',
    body: 'Start from a goal and let AtlasStack build the checklist, execution order, and owner-ready summary.',
  },
  {
    icon: <Layers3 size={20} />,
    title: 'Reusable templates',
    body: 'Turn recurring reviews into repeatable playbooks for frontend, API, cloud, and compliance teams.',
  },
  {
    icon: <ShieldCheck size={20} />,
    title: 'Policy-aware output',
    body: 'Every recommendation is mapped to severity, evidence, affected surface, and follow-up action.',
  },
];

const demoRows = [
  ['repo', 'atlasstack/platform'],
  ['focus', 'security + architecture'],
  ['agents', 'scanner, mapper, fixer'],
  ['export', 'runbook.md + pull request'],
];

const Navbar = ({ page, navigate }: { page: Page; navigate: (page: Page) => void }) => {
  const [open, setOpen] = useState(false);
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  const links = useMemo(
    () => [
      { label: 'Capabilities', onClick: () => document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth' }) },
      { label: 'Dashboard', onClick: () => navigate('dashboard') },
      { label: 'Studio', onClick: () => navigate('studio') },
    ],
    [navigate],
  );

  return (
    <header className="site-nav">
      <button className="brand-mark" onClick={() => navigate('landing')} aria-label="Go to AtlasStack home">
        <img src="/logo.png" alt="AtlasStack" className="brand-logo-img" />
        <span>AtlasStack</span>
      </button>

      <nav className="nav-center" aria-label="Primary navigation">
        {links.map((link) => (
          <button key={link.label} className={page.toLowerCase() === link.label.toLowerCase() ? 'active' : ''} onClick={link.onClick}>
            {link.label}
          </button>
        ))}
      </nav>

      <div className="nav-actions">
        {isSignedIn ? (
          <>
            <button className="ghost-button" onClick={() => navigate('dashboard')}>My runs</button>
            <UserButton afterSignOutUrl="/" />
          </>
        ) : (
          <SignInButton mode="modal">
            <button className="primary-button">Sign in</button>
          </SignInButton>
        )}
      </div>

      <button className="menu-button" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>

      {open && (
        <div className="mobile-panel">
          {links.map((link) => (
            <button key={link.label} onClick={() => { link.onClick(); setOpen(false); }}>
              {link.label}
            </button>
          ))}
          {!isSignedIn && (
            <SignInButton mode="modal">
              <button>Sign in</button>
            </SignInButton>
          )}
        </div>
      )}
    </header>
  );
};

const HeroPreview = () => (
  <motion.div className="hero-preview" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
    <div className="preview-toolbar">
      <span className="dot red" />
      <span className="dot yellow" />
      <span className="dot green" />
      <span className="preview-title">atlasstack runbook</span>
    </div>
    <div className="preview-body">
      <div className="preview-sidebar">
        <div className="sidebar-pill active">Scan</div>
        <div className="sidebar-pill">Map</div>
        <div className="sidebar-pill">Patch</div>
      </div>
      <div className="preview-main">
        <div className="status-row">
          <span className="live-dot" />
          <span>AI audit in progress</span>
          <strong>82%</strong>
        </div>
        {demoRows.map(([label, value]) => (
          <div className="terminal-row" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
        <div className="risk-card">
          <div>
            <p>Top finding</p>
            <h3>Auth callback exposes stale token path</h3>
          </div>
          <button>Fix queued</button>
        </div>
      </div>
    </div>
  </motion.div>
);

const LandingPage = ({ navigate }: { navigate: (page: Page) => void }) => {
  const { isSignedIn } = useAuth();
  
  return (
    <main>
      <section className="hero-shell">
        <div className="hero-copy">
          <motion.div className="eyebrow" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Sparkles size={16} /> Autonomous Software Delivery
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            Ship verified fix plans, not just empty pull requests.
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            AtlasStack scans your repository context, identifies architecture drift, finds high-risk bugs, and generates production-ready patches with a single click.
          </motion.p>
          <motion.div className="hero-actions" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <button className="primary-button large" onClick={() => navigate('studio')}>
              Start a scan <Play size={16} />
            </button>
            <button className="ghost-button large" onClick={() => navigate('dashboard')}>
              {isSignedIn ? 'My dashboard' : 'Sign in to explore'} <ChevronRight size={16} />
            </button>
          </motion.div>
        </div>
        <HeroPreview />
      </section>

      <section id="workflow" className="section-wrap">
        <div className="section-heading">
          <span className="eyebrow centered"><Zap size={16} /> Core Capabilities</span>
          <h2>Professional engineering review at scale.</h2>
        </div>
        <div className="feature-grid">
          <article className="soft-card">
            <div className="card-icon"><ShieldCheck size={20} /></div>
            <h3>Bug & Security Audit</h3>
            <p>Deep scan for SQLi, XSS, and logic flaws with AI-reasoned evidence.</p>
          </article>
          <article className="soft-card">
            <div className="card-icon"><GitBranch size={20} /></div>
            <h3>Architecture Mapping</h3>
            <p>Visualize dependencies and data flow to prevent architectural drift.</p>
          </article>
          <article className="soft-card">
            <div className="card-icon"><Code2 size={20} /></div>
            <h3>Remediation Engine</h3>
            <p>Don't just find problems. Generate real patches and open PRs instantly.</p>
          </article>
        </div>
      </section>

      <section className="cta-panel">
        <div>
          <span className="eyebrow"><Code2 size={16} /> Ready for Private Repos</span>
          <h2>Connect your GitHub and audit any codebase.</h2>
          <p>Full support for private repositories, organizational audits, and team-wide security posture tracking.</p>
        </div>
        <button className="primary-button large" onClick={() => navigate('studio')}>Get started <ArrowRight size={16} /></button>
      </section>
    </main>
  );
};

const StudioPage = ({ navigate }: { navigate: (page: Page, params?: any) => void }) => {
  const [url, setUrl] = useState('');
  return (
    <main className="studio-page">
      <section className="studio-card">
        <div className="studio-copy">
          <span className="eyebrow"><GitBranch size={16} /> New run</span>
          <h1>Create an AtlasStack audit</h1>
          <p>Choose the repository, desired outcome, and deliverables. The redesigned flow keeps setup short and sends finished work straight to the dashboard.</p>
        </div>
        <form className="run-form" onSubmit={(event) => { 
          event.preventDefault(); 
          if (url) navigate('ide', { repo: url }); 
        }}>
          <label>
            Repository URL
            <input 
              placeholder="https://github.com/acme/product" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </label>
          <label>
            Goal
            <select defaultValue="architecture">
              <option value="architecture">Architecture review</option>
              <option value="security">Security scan</option>
              <option value="upgrade">Dependency upgrade plan</option>
            </select>
          </label>
          <label>
            Output
            <select defaultValue="runbook">
              <option value="runbook">Runbook + prioritized fixes</option>
              <option value="pull-request">Pull request draft</option>
              <option value="brief">Executive brief</option>
            </select>
          </label>
          <button className="primary-button large" type="submit">Generate run <Sparkles size={16} /></button>
        </form>
      </section>
    </main>
  );
};

export default function App() {
  const [page, setPage] = useState<Page>(routeFromHash());
  const [params, setParams] = useState<any>({});

  useEffect(() => {
    if (window.location.pathname !== '/') {
      window.history.replaceState(null, '', '/' + window.location.hash);
    }
    const onHashChange = () => setPage(routeFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (nextPage: Page, nextParams: any = {}) => {
    setParams(nextParams);
    window.location.hash = nextPage === 'landing' ? '#/' : `#/${nextPage}`;
  };

  return (
    <div className="app-shell">
      <div className="bg-orb orb-one" />
      <div className="bg-orb orb-two" />
      <Navbar page={page} navigate={navigate} />
      {page === 'landing' && <LandingPage navigate={navigate} />}
      {page === 'dashboard' && (
        <AuthGatedDashboard apiUrl={API_URL} onCreateRun={() => navigate('studio')} navigate={navigate} />
      )}
      {page === 'studio' && <StudioPage navigate={navigate} />}
      {page === 'ide' && <IDEPage repoUrl={params.repo || ''} onBack={() => navigate('dashboard')} apiUrl={API_URL} />}
      <footer className="site-footer">
        <div className="footer-brand">
          <img src="/logo.png" alt="" className="brand-logo-img-small" />
          <span>AtlasStack</span>
        </div>
        <span>The autonomous engineering engine for professional teams.</span>
        <a href="/atlasstack.vsix" download><Download size={14} /> VS Code extension</a>
      </footer>
    </div>
  );
}

function AuthGatedDashboard({ apiUrl, onCreateRun, navigate }: { apiUrl: string; onCreateRun: () => void; navigate: (page: Page, params?: any) => void }) {
  const { isSignedIn, isLoaded } = useAuth();
  
  if (!isLoaded) return <div className="loading-screen">Loading...</div>;
  
  if (!isSignedIn) {
    return (
      <div className="auth-gate-full">
        <div className="auth-card">
          <Zap size={40} className="text-indigo-500 mb-6" />
          <h1>Sign in to AtlasStack</h1>
          <p>Access your dashboard, runs, and AI audit reports.</p>
          <SignInButton mode="modal">
            <button className="primary-button large">Continue to Dashboard</button>
          </SignInButton>
        </div>
      </div>
    );
  }
  
  return <DashboardPage apiUrl={apiUrl} onCreateRun={onCreateRun} onAnalyze={(url) => navigate('ide', { repo: url })} />;
}
