import os

IDE_PAGE_CODE = """import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Editor from '@monaco-editor/react';
import { 
  Folder, File, Settings, Terminal as TerminalIcon, Play, Bot,
  ChevronRight, ChevronDown, MoreVertical, Search, ArrowLeft,
  X, Zap, Lock, Cpu, LayoutGrid, Github, TerminalSquare, Box, GitBranch, Command
} from 'lucide-react';

import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebContainer } from '@webcontainer/api';
import 'xterm/css/xterm.css';

class ErrorBoundary extends React.Component<{children: any}, {hasError: boolean, error: any}> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  componentDidCatch(error: any, info: any) { console.error("ErrorBoundary caught an error", error, info); }
  render() {
    if (this.state.hasError) {
      return <div style={{padding: 20, color: 'red', background: 'black'}}><h1>Something went wrong.</h1><pre>{this.state.error?.toString()}</pre><pre>{this.state.error?.stack}</pre></div>;
    }
    return this.props.children;
  }
}

type SidePanel = 'explorer' | 'search' | 'source_control' | 'agent';

export const IDEPage = (props: any) => (
  <ErrorBoundary>
    <IDEPageInner {...props} />
  </ErrorBoundary>
);

const IDEPageInner = ({ repoUrl, onBack }: { repoUrl: string, onBack: () => void }) => {
  // UI State
  const [activePanel, setActivePanel] = useState<SidePanel>('explorer');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'output' | 'terminal'>('terminal');
  
  // File State
  const [activeFile, setActiveFile] = useState<string | null>('package.json');
  const [openedFiles, setOpenedFiles] = useState<string[]>(['package.json', 'index.js']);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  
  // Tree State
  const [treeData, setTreeData] = useState<any[]>([]);
  const [isLoadingTree, setIsLoadingTree] = useState(true);
  
  // Agent / Terminal State
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<{role: 'user'|'assistant', text: string}[]>([
    { role: 'assistant', text: `Welcome to CodeSage Local IDE powered by WebContainers. I have booted up a Node.js OS right here in your browser. Open the terminal panel to interact with it!` }
  ]);
  const [isAgentActive, setIsAgentActive] = useState(false);
  const [agentLogs, setAgentLogs] = useState<string[]>(['[System] WebContainer Operating System booting...']);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // WebContainer Refs
  const terminalRef = useRef<HTMLDivElement>(null);
  const [wcInstance, setWcInstance] = useState<WebContainer | null>(null);

  // Refresh Tree Helper
  const refreshTree = async (wc: WebContainer) => {
    async function readDir(path: string): Promise<any[]> {
      const entries = await wc.fs.readdir(path, { withFileTypes: true });
      const nodes = [];
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const fullPath = path === '/' ? entry.name : `${path}/${entry.name}`;
        if (entry.isDirectory()) {
          nodes.push({ name: entry.name, type: 'folder', isOpen: true, children: await readDir(fullPath), fullPath });
        } else {
          nodes.push({ name: entry.name, type: 'file', fullPath });
        }
      }
      return nodes.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'folder' ? -1 : 1;
      });
    }
    const tree = await readDir('/');
    setTreeData(tree);
    setIsLoadingTree(false);
  };

  // Boot WebContainer
  useEffect(() => {
    let isMounted = true;
    async function boot() {
      try {
        const wc = await WebContainer.boot();
        if (!isMounted) return;
        setWcInstance(wc);
        setAgentLogs(prev => [...prev, '[System] WebContainer OS Successfully Booted.', '[System] Providing Mock Boilerplate...']);
        
        await wc.mount({
          'package.json': { file: { contents: '{\\n  "name": "codesage-demo",\\n  "version": "1.0.0",\\n  "scripts": { "start": "node index.js" }\\n}' } },
          'index.js': { file: { contents: 'const http = require("http");\\n\\nhttp.createServer((req, res) => res.end("Hello from WebContainer!")).listen(3011, () => console.log("Serving at http://localhost:3011"));\\n' } },
          'src': { directory: { 'utils.js': { file: { contents: 'export const hello = () => "world";' } } } }
        });
        
        await refreshTree(wc);
        
        // Load initial files
        const pkg = await wc.fs.readFile('package.json', 'utf-8');
        const idx = await wc.fs.readFile('index.js', 'utf-8');
        setFileContents({ 'package.json': pkg, 'index.js': idx });

      } catch(e: any) {
        setAgentLogs(prev => [...prev, `[System] Boot Error: ${e.message}`]);
      }
    }
    boot();
    return () => { isMounted = false; };
  }, []);

  // Initialize Terminal Instance
  useEffect(() => {
    if (!wcInstance || !terminalRef.current) return;
    
    // Clear the container
    terminalRef.current.innerHTML = '';
    
    const fitAddon = new FitAddon();
    const terminal = new Terminal({
      theme: { background: 'transparent', foreground: '#cbd5e1', cursor: '#818cf8', selectionBackground: '#4f46e540' },
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas',
      fontSize: 12,
      convertEol: true,
      cursorBlink: true
    });
    
    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current);
    fitAddon.fit();

    const resizeOb = new ResizeObserver(() => fitAddon.fit());
    resizeOb.observe(terminalRef.current);

    let jsh: any = null;

    wcInstance.spawn('jsh').then(shell => {
      jsh = shell;
      shell.output.pipeTo(
        new WritableStream({ write(data) { terminal.write(data); } })
      );
      const input = shell.input.getWriter();
      terminal.onData(data => {
        input.write(data);
      });
    });

    return () => { 
      resizeOb.disconnect(); 
      terminal.dispose(); 
      if (jsh) jsh.kill();
    };
  }, [wcInstance, terminalRef]);

  // Load Active File Content if not loaded
  useEffect(() => {
    if (!activeFile || !wcInstance || fileContents[activeFile]) return;
    wcInstance.fs.readFile(activeFile, 'utf-8')
      .then(content => {
        setFileContents(prev => ({ ...prev, [activeFile]: content }));
      })
      .catch(e => {
        setFileContents(prev => ({ ...prev, [activeFile]: '// Error loading file limit' }));
      });
  }, [activeFile, wcInstance]);

  // Auto-scroll Agent Logs
  useEffect(() => {
    if (logsEndRef.current && activeTab === 'output') {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [agentLogs, activeTab]);

  // Handlers
  const handleFileSelect = (path: string) => {
    if (!openedFiles.includes(path)) setOpenedFiles(prev => [...prev, path]);
    setActiveFile(path);
  };

  const closeFile = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    const newFiles = openedFiles.filter(f => f !== path);
    setOpenedFiles(newFiles);
    if (activeFile === path) setActiveFile(newFiles.length > 0 ? newFiles[newFiles.length - 1] : null);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isAgentActive) return;
    setMessages(prev => [...prev, { role: 'user', text: chatInput }]);
    setChatInput('');
    setAgentLogs(prev => [...prev, `[Chat] User: ${chatInput}`]);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'assistant', text: "Executing autonomous task on WebContainer..." }]);
      setAgentLogs(prev => [...prev, `[Chat] Agent: Task processed.`]);
    }, 1000);
  };

  const handleEditorChange = (val: string | undefined) => {
    if (!val || !activeFile || !wcInstance) return;
    setFileContents(prev => ({ ...prev, [activeFile]: val }));
    // Save to WebContainer
    wcInstance.fs.writeFile(activeFile, val);
  };

  return (
    <div className="h-screen w-screen overflow-hidden text-slate-300 flex flex-col font-sans select-none relative z-50">
      {/* Background from main theme */}
      <div className="absolute inset-0 -z-10 overflow-hidden bg-[#0d0f17]">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/10 blur-[120px]" />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-emerald-500/10 blur-[100px]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
      </div>

      {/* Title Bar Layer */}
      <div className="h-10 border-b border-white/5 bg-black/40 backdrop-blur-md flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-indigo-400" />
            <span className="text-[11px] font-bold tracking-widest uppercase text-white/90">CodeSage Engine</span>
          </div>
        </div>
        
        {/* Title / Command center */}
        <div className="flex-1 max-w-md mx-4">
          <div className="w-full h-6 bg-white/5 border border-white/10 rounded-md flex items-center justify-center gap-2 text-xs text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer">
            <Search className="w-3 h-3" />
            <span>WebContainer OS Embedded</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className={`flex items-center gap-2 px-3 py-1 rounded border text-[10px] font-bold uppercase tracking-widest transition-all text-indigo-300 border-indigo-500/40 bg-indigo-500/20`}>
            <Cpu className="w-3 h-3" /> 
            Active
          </button>
        </div>
      </div>

      {/* Main App Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Activity Bar */}
        <div className="w-12 bg-black/60 border-r border-white/5 flex flex-col items-center py-4 gap-4 shrink-0 backdrop-blur-md">
          <IconBtn icon={<File />} active={activePanel === 'explorer'} onClick={() => { setActivePanel('explorer'); setIsSidebarOpen(true); }} />
          <IconBtn icon={<Search />} active={activePanel === 'search'} onClick={() => { setActivePanel('search'); setIsSidebarOpen(true); }} />
          <IconBtn icon={<GitBranch />} active={activePanel === 'source_control'} onClick={() => { setActivePanel('source_control'); setIsSidebarOpen(true); }} />
          <IconBtn icon={<Bot />} active={activePanel === 'agent'} onClick={() => { setActivePanel('agent'); setIsSidebarOpen(true); }} isSpecial />
          <div className="flex-1" />
          <IconBtn icon={<Settings />} />
        </div>

        {/* Primary Sidebar */}
        {isSidebarOpen && (
          <div className="w-64 bg-black/30 border-r border-white/5 flex flex-col shrink-0 backdrop-blur-sm">
            <div className="h-9 px-4 flex items-center justify-between border-b border-white/5">
              <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400">
                {activePanel === 'explorer' && 'Explorer'}
                {activePanel === 'search' && 'Search'}
                {activePanel === 'source_control' && 'Source Control'}
                {activePanel === 'agent' && 'Sage Agent'}
              </span>
              <button className="text-slate-500 hover:text-white" onClick={() => setIsSidebarOpen(false)}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            
            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto">
              {activePanel === 'explorer' && (
                <div className="py-2">
                  <div className="px-3 py-1 flex items-center gap-1.5 text-xs font-semibold text-white cursor-pointer hover:bg-white/5">
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span className="uppercase tracking-wider text-[10px]">WebContainer</span>
                  </div>
                  {isLoadingTree ? (
                    <div className="px-6 py-4 text-xs text-slate-600 animate-pulse">Booting OS...</div>
                  ) : (
                    treeData.map((node, i) => (
                      <FileTreeNode key={i} node={node} depth={1} activeFile={activeFile} onSelect={handleFileSelect} />
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Editor & Bottom Panel Area */}
        <div className="flex-1 flex flex-col relative min-w-0">
          
          {/* Tabs Bar */}
          <div className="flex bg-black/40 border-b border-white/5 h-9 shrink-0 overflow-x-auto custom-scrollbar backdrop-blur-md">
            {openedFiles.map(path => (
              <div 
                key={path} onClick={() => setActiveFile(path)}
                className={`group flex items-center gap-2 px-3 min-w-[120px] max-w-[200px] border-r border-white/5 cursor-pointer transition-colors ${activeFile === path ? 'bg-white/5 text-indigo-300 border-t-2 border-t-indigo-500' : 'bg-transparent text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
              >
                <File className={`w-3.5 h-3.5 shrink-0 ${activeFile === path ? 'text-indigo-400' : 'opacity-60'}`} />
                <span className="text-xs font-mono truncate flex-1 select-none">{path.split('/').pop()}</span>
                <div onClick={(e) => closeFile(e, path)} className={`w-4 h-4 rounded flex items-center justify-center hover:bg-white/10 ${activeFile === path ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                  <X className="w-3 h-3" />
                </div>
              </div>
            ))}
          </div>

          {/* Monaco Editor Component */}
          <div className="flex-1 relative bg-black/20">
            {activeFile ? (
              <Editor
                 height="100%"
                 language={activeFile.endsWith('.json') ? 'json' : activeFile.endsWith('.md') ? 'markdown' : activeFile.endsWith('.js') ? 'javascript' : 'typescript'}
                 theme="vs-dark"
                 value={fileContents[activeFile] || '// Loading object blob...'}
                 onChange={handleEditorChange}
                 options={{
                   minimap: { enabled: false },
                   fontSize: 13,
                   fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                   padding: { top: 16 },
                   smoothScrolling: true,
                   cursorBlinking: 'smooth',
                   renderLineHighlight: 'all'
                 }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center flex-col gap-4 text-slate-600">
                <Box className="w-16 h-16 opacity-20" />
                <p className="text-sm font-mono tracking-widest uppercase">No File Active</p>
              </div>
            )}
          </div>

          {/* Bottom Terminal Panel */}
          <div style={{ display: isTerminalOpen ? 'flex' : 'none' }} className="h-64 border-t border-white/5 bg-black/80 flex flex-col shrink-0 backdrop-blur-xl relative z-20">
            <div className="flex bg-white/5 border-b border-white/5 h-9 shrink-0 px-2 justify-between items-center">
              <div className="flex h-full">
                <div onClick={() => setActiveTab('terminal')} className={`flex items-center gap-2 px-4 border-b-2 text-xs font-bold uppercase tracking-widest cursor-pointer transition-colors ${activeTab === 'terminal' ? 'border-indigo-500 text-indigo-300' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                  <TerminalIcon className="w-3.5 h-3.5" /> Terminal
                </div>
                <div onClick={() => setActiveTab('output')} className={`flex items-center gap-2 px-4 border-b-2 text-xs font-bold uppercase tracking-widest cursor-pointer transition-colors ${activeTab === 'output' ? 'border-indigo-500 text-indigo-300' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                  <Command className="w-3.5 h-3.5" /> Output
                </div>
              </div>
              <div className="flex gap-2 pr-2">
                <button onClick={() => setIsTerminalOpen(false)} className="text-slate-500 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            
            {/* Terminal Tab */}
            <div style={{ display: activeTab === 'terminal' ? 'block' : 'none' }} className="flex-1 w-full bg-black/60 relative">
               {!wcInstance && <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 animate-pulse">Booting Native OS env...</div>}
               <div ref={terminalRef} className="absolute inset-2" />
            </div>

            {/* Output Tab */}
            <div style={{ display: activeTab === 'output' ? 'block' : 'none' }} className="flex-1 overflow-y-auto p-4 font-mono text-[11px] space-y-2 custom-scrollbar text-slate-300 bg-black/60">
              {agentLogs.map((log, i) => (
                <div key={i} className="flex gap-3 leading-relaxed">
                  <span className="text-slate-600 shrink-0 select-none">[{new Date().toLocaleTimeString('en-US', {hour12:false})}]</span>
                  <span className={`${
                    log.includes('Booted') ? 'text-emerald-400 font-bold'
                    : log.includes('Error') ? 'text-red-400' 
                    : log.includes('User:') ? 'text-purple-400'
                    : log.includes('System') ? 'text-slate-500 italic'
                    : 'text-slate-300'
                  }`}>
                    {log}
                  </span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>

          </div>
        </div>
      </div>

      {/* VSCode-like Status Bar */}
      <div className={`h-6 flex items-center justify-between px-3 text-[10px] shrink-0 font-mono tracking-wider transition-colors z-30 ${isAgentActive ? 'bg-red-900 border-t border-red-500/30 text-white' : 'bg-[#007acc]/80 backdrop-blur-md border-t border-white/10 text-white'}`}>
        <div className="flex items-center gap-4">
          <span className="hover:bg-white/20 px-1.5 py-0.5 rounded cursor-pointer transition-colors flex items-center gap-1.5">
            <GitBranch className="w-3 h-3" /> native
          </span>
          <span className="hover:bg-white/20 px-1.5 py-0.5 rounded cursor-pointer transition-colors flex items-center gap-1">
            <X className="w-3 h-3" /> 0 
            <Zap className="w-3 h-3 ml-1" /> 0
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hover:bg-white/20 px-1.5 py-0.5 rounded cursor-pointer transition-colors">UTF-8</span>
          <span className="hover:bg-white/20 px-1.5 py-0.5 rounded cursor-pointer transition-colors">Native Node</span>
          <span className="hover:bg-white/20 px-1.5 py-0.5 rounded cursor-pointer transition-colors flex items-center gap-1 font-bold">
            <Cpu className="w-3 h-3" /> 
            WC Online
          </span>
          <span 
            className="hover:bg-white/20 px-1.5 py-0.5 rounded cursor-pointer transition-colors flex items-center gap-1 font-bold"
            onClick={() => setIsTerminalOpen(!isTerminalOpen)}
          >
            <TerminalSquare className="w-3 h-3" /> Terminal
          </span>
        </div>
      </div>
    </div>
  );
};

// --- Helpers ---

const IconBtn = ({ icon, active, onClick, isSpecial }: any) => (
  <button 
    onClick={onClick}
    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative group
      ${active ? (isSpecial ? 'text-indigo-400 bg-indigo-500/10' : 'text-white bg-white/10') : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
  >
    {React.cloneElement(icon, { className: \`w-5 h-5 \${isSpecial ? 'drop-shadow-lg' : ''}\` })}
    {active && <div className={\`absolute left-0 w-0.5 h-6 rounded-r-md \${isSpecial ? 'bg-indigo-500' : 'bg-white'}\`} />}
  </button>
);

const FileTreeNode = ({ node, depth, activeFile, onSelect }: any) => {
  const [isOpen, setIsOpen] = useState(node.isOpen ?? false);
  const isFile = node.type === 'file';
  const isActive = isFile && activeFile === node.fullPath;

  return (
    <div>
      <div 
        className={\`flex items-center gap-1.5 px-2 py-0.5 cursor-pointer select-none border-l-[1.5px] group
          \${isActive ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border-transparent'}\`}
        style={{ paddingLeft: \`\${depth * 12 + 8}px\` }}
        onClick={() => isFile ? onSelect(node.fullPath) : setIsOpen(!isOpen)}
      >
        <div className="w-4 h-4 flex items-center justify-center shrink-0">
          {!isFile ? (
            <ChevronRight className={\`w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-transform \${isOpen ? 'rotate-90' : ''}\`} />
          ) : (
            <File className="w-3.5 h-3.5 opacity-60" />
          )}
        </div>
        {node.name === 'src' && !isFile ? <Folder className="w-3.5 h-3.5 text-blue-400" /> : null}
        <span className="text-[11px] truncate tracking-wide">{node.name}</span>
      </div>
      {isOpen && node.children && (
        <div className="flex flex-col">
          {node.children.map((child: any, i: number) => (
            <FileTreeNode 
              key={i} node={child} depth={depth + 1} 
              activeFile={activeFile} onSelect={onSelect} 
            />
          ))}
        </div>
      )}
    </div>
  );
};
"""

with open(r"c:\Users\reaob\Downloads\PythonProject33\codesage\clients\web\src\IDEPage.tsx", "w", encoding='utf-8') as f:
    f.write(IDE_PAGE_CODE)
