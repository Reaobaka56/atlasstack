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
import './index.css';

type Page = 'landing' | 'dashboard' | 'studio';

const routeFromHash = (): Page => {
  const route = window.location.hash.replace('#/', '').replace('#', '') as Page;
  return ['landing', 'dashboard', 'studio'].includes(route) ? route : 'landing';
};

const useHashRoute = () => {
  const [page, setPage] = useState<Page>(routeFromHash);

<<<<<<< codex/redesign-ui-and-dashboard-logic-zq272e
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
            <UserButton />
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
=======
  useEffect(() => {
    const onHashChange = () => setPage(routeFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
>>>>>>> main

  const navigate = (nextPage: Page) => {
    window.location.hash = nextPage === 'landing' ? '#/' : `#/${nextPage}`;
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return { page, navigate };
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
  const links = useMemo(
    () => [
      { label: 'How it works', onClick: () => document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth' }) },
      { label: 'Dashboard', onClick: () => navigate('dashboard') },
      { label: 'Studio', onClick: () => navigate('studio') },
    ],
    [navigate],
  );

  return (
<<<<<<< codex/redesign-ui-and-dashboard-logic-zq272e
    <div className="landing-shell" style={{ minHeight: '100vh', position: 'relative' }}>
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
=======
    <header className="site-nav">
      <button className="brand-mark" onClick={() => navigate('landing')} aria-label="Go to AtlasStack home">
        <span className="brand-glyph">A</span>
        <span>AtlasStack</span>
      </button>

      <nav className="nav-center" aria-label="Primary navigation">
        {links.map((link) => (
          <button key={link.label} className={page.toLowerCase() === link.label.toLowerCase() ? 'active' : ''} onClick={link.onClick}>
            {link.label}
          </button>
        ))}
        <a href="https://github.com/Reaobaka56/atlasstack" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </nav>
>>>>>>> main

      <div className="nav-actions">
        <button className="ghost-button" onClick={() => navigate('dashboard')}>View runs</button>
        <button className="primary-button" onClick={() => navigate('studio')}>Start scan <ArrowRight size={16} /></button>
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
          <button onClick={() => { navigate('studio'); setOpen(false); }}>Start scan</button>
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

const LandingPage = ({ navigate }: { navigate: (page: Page) => void }) => (
  <main>
    <section className="hero-shell">
      <div className="hero-copy">
        <motion.div className="eyebrow" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Sparkles size={16} /> AI software delivery engine
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          Move from messy codebase to shippable fix plan in one focused workspace.
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          A Bluma-inspired, lightweight interface for creating repo audits, architecture maps, security summaries, and AI-assisted remediation workflows without stitching together separate tools.
        </motion.p>
        <motion.div className="hero-actions" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <button className="primary-button large" onClick={() => navigate('studio')}>
            Create a run <Play size={16} />
          </button>
          <button className="ghost-button large" onClick={() => navigate('dashboard')}>
            Explore dashboard <ChevronRight size={16} />
          </button>
        </motion.div>
        <div className="trust-strip">
          {useCases.map((item) => (
            <span key={item}><CheckCircle2 size={15} /> {item}</span>
          ))}
        </div>
      </div>
      <HeroPreview />
    </section>

    <section id="workflow" className="section-wrap">
      <div className="section-heading">
        <span className="eyebrow centered"><Zap size={16} /> What AtlasStack helps you ship</span>
        <h2>Designed for high-volume engineering review where speed and consistency matter.</h2>
      </div>
      <div className="feature-grid">
        {featureCards.map((card) => (
          <article className="soft-card" key={card.title}>
            <div className="card-icon">{card.icon}</div>
            <h3>{card.title}</h3>
            <p>{card.body}</p>
          </article>
        ))}
      </div>
    </section>

    <section className="workflow-band">
      {flowSteps.map((step, index) => (
        <article key={step.title}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          <h3>{step.title}</h3>
          <p>{step.body}</p>
        </article>
      ))}
    </section>

    <section className="cta-panel">
      <div>
        <span className="eyebrow"><Code2 size={16} /> Studio ready</span>
        <h2>Launch a fresh audit workspace with only the routes your team needs.</h2>
        <p>Landing, dashboard, and studio are now the core product paths—no extra observability screens or dead-end auth gates.</p>
      </div>
      <button className="primary-button large" onClick={() => navigate('studio')}>Open studio <ArrowRight size={16} /></button>
    </section>
  </main>
);

const StudioPage = ({ navigate }: { navigate: (page: Page) => void }) => (
  <main className="studio-page">
    <section className="studio-card">
      <div className="studio-copy">
        <span className="eyebrow"><GitBranch size={16} /> New run</span>
        <h1>Create an AtlasStack audit</h1>
        <p>Choose the repository, desired outcome, and deliverables. The redesigned flow keeps setup short and sends finished work straight to the dashboard.</p>
      </div>
      <form className="run-form" onSubmit={(event) => { event.preventDefault(); navigate('dashboard'); }}>
        <label>
          Repository URL
          <input placeholder="https://github.com/acme/product" />
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

export default function App() {
  const { page, navigate } = useHashRoute();

  return (
    <div className="app-shell">
      <div className="bg-orb orb-one" />
      <div className="bg-orb orb-two" />
      <Navbar page={page} navigate={navigate} />
      {page === 'landing' && <LandingPage navigate={navigate} />}
      {page === 'dashboard' && <DashboardPage onCreateRun={() => navigate('studio')} />}
      {page === 'studio' && <StudioPage navigate={navigate} />}
      <footer className="site-footer">
        <span>AtlasStack</span>
        <span>AI runbooks for code review, architecture, and remediation.</span>
        <a href="/atlasstack.vsix" download><Download size={14} /> VS Code extension</a>
      </footer>
    </div>
  );
}
