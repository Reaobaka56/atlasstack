import React, { useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Edge,
  type Node
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Shield, Activity, Terminal, CheckCircle2, AlertCircle, Clock, Zap, Database } from 'lucide-react';

// Custom Node for Neumorphic styling in AtlasStack
const AgentNode = ({ data, isConnectable }: any) => {
  const getStatusIcon = () => {
    switch(data.status) {
      case 'success': return <CheckCircle2 size={16} className="text-[#10b981]" />;
      case 'failed': return <AlertCircle size={16} className="text-[#ef4444]" />;
      case 'active': return <Zap size={16} className="text-white animate-pulse" />;
      default: return <Clock size={16} className="text-silver-400" />;
    }
  };

  return (
    <div className={`liquid-glass p-4 border border-white/10 rounded-2xl ${data.status === 'active' ? 'ring-2 ring-white/20' : ''}`} style={{ width: '280px' }}>
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!bg-bg-dark !border-white/20" />
      
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="text-silver-100">
            {data.icon}
          </div>
          <span className="font-display font-medium text-sm text-white">{data.label}</span>
        </div>
        <div className={`status-badge text-[10px] flex items-center gap-1 font-bold uppercase tracking-wider ${data.status === 'success' ? 'text-green-400' : 'text-silver-400'}`}>
          {getStatusIcon()}
          <span>{data.status}</span>
        </div>
      </div>
      
      <div className="bg-black/40 rounded-xl text-xs font-mono text-silver-400 p-3 border border-white/5">
        {data.detail}
      </div>

      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="!bg-bg-dark !border-white/20" />
    </div>
  );
};

const nodeTypes = {
  agentNode: AgentNode,
};

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'agentNode',
    position: { x: 250, y: 50 },
    data: { 
      label: 'ATLAS INGEST', 
      icon: <Terminal size={18} />, 
      status: 'success',
      detail: '> Buffer: 124 commits\n> Status: Indexed'
    }
  },
  {
    id: '2',
    type: 'agentNode',
    position: { x: 250, y: 200 },
    data: { 
      label: 'NEURAL PLANNER', 
      icon: <Activity size={18} />, 
      status: 'success',
      detail: '> Reasoning: Step 4/4\n> Confidence: 98%'
    }
  },
  {
    id: '3',
    type: 'agentNode',
    position: { x: 100, y: 350 },
    data: { 
      label: 'CODER CORE', 
      icon: <Database size={18} />, 
      status: 'active',
      detail: '> Patching: app.tsx\n> Line: 442 (Refactor)'
    }
  },
  {
    id: '4',
    type: 'agentNode',
    position: { x: 400, y: 350 },
    data: { 
      label: 'AUDIT SENTINEL', 
      icon: <Shield size={18} />, 
      status: 'pending',
      detail: '> Waiting for push...\n> Policy: Zero-Trust'
    }
  }
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: 'rgba(255,255,255,0.1)' } },
  { id: 'e2-3', source: '2', target: '3', animated: true, style: { stroke: '#fff', strokeWidth: 2 } },
  { id: 'e2-4', source: '2', target: '4', animated: true, style: { stroke: 'rgba(255,255,255,0.1)' } }
];

export const AgentEyeDashboard: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [logs] = useState([
    { timestamp: '14:22:01', step: 'EYE', desc: 'AgentEye monitoring linked.' },
    { timestamp: '14:22:05', step: 'INIT', desc: 'AtlasStack core engaged.' },
    { timestamp: '14:22:12', step: 'PLAN', desc: 'Autonomous DAG computed.' },
  ]);

  return (
    <div className="w-full h-full flex flex-col text-silver-300">
      {/* Internal Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl">
            <Shield className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold text-white leading-tight">Agent<span className="metallic-text">Eye</span></h2>
            <p className="text-xs text-silver-500 font-medium tracking-widest uppercase">Observability & Compliance Sentinel</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button className="btn-pill btn-pill-active">
            <Activity size={16} /> Live View
          </button>
          <button className="btn-pill">
            <Terminal size={16} /> Raw Logs
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 flex gap-6 overflow-hidden min-h-[500px]">
        {/* Left: DAG */}
        <div className="flex-[2] liquid-glass border border-white/10 rounded-[2.5rem] relative overflow-hidden shadow-2xl">
          <div className="absolute top-4 left-6 z-10 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[10px] font-bold text-silver-400 uppercase tracking-tighter">Real-time Thought Stream</span>
          </div>
          
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            className="bg-transparent"
          >
            <Background color="rgba(255,255,255,0.03)" gap={20} />
            <Controls className="!bg-bg-dark !border-white/10 !rounded-xl overflow-hidden shadow-2xl" />
          </ReactFlow>
        </div>

        {/* Right: Insights */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Security Pulse */}
          <div className="liquid-glass border border-white/10 rounded-[2.5rem] p-8 flex flex-col shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={16} className="text-silver-400" />
              <span className="text-xs font-bold text-silver-400 uppercase tracking-widest">Security Pulse</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center shadow-inner">
                <div className="text-3xl font-display font-bold text-white mb-1">0</div>
                <div className="text-[10px] text-silver-500 uppercase font-bold">Leaks</div>
              </div>
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center shadow-inner">
                <div className="text-3xl font-display font-bold text-green-400 mb-1">OK</div>
                <div className="text-[10px] text-silver-500 uppercase font-bold">Compliance</div>
              </div>
            </div>
          </div>

          {/* Activity Logs */}
          <div className="liquid-glass border border-white/10 rounded-[2.5rem] p-8 flex-1 flex flex-col overflow-hidden shadow-2xl">
             <div className="flex items-center gap-2 mb-4">
              <Terminal size={16} className="text-silver-400" />
              <span className="text-xs font-bold text-silver-400 uppercase tracking-widest">Execution Stream</span>
            </div>
            <div className="bg-white/5 border border-white/5 rounded-2xl flex-1 overflow-y-auto p-4 space-y-3 font-mono text-[10px] shadow-inner">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-3 opacity-60 hover:opacity-100 transition-opacity">
                  <span className="text-silver-500">[{log.timestamp}]</span>
                  <span className="text-white font-bold">{log.step}</span>
                  <span className="text-silver-300">{log.desc}</span>
                </div>
              ))}
              <div className="flex gap-3 animate-pulse text-white">
                <span className="text-silver-500">[{new Date().toLocaleTimeString('en-US', { hour12: false })}]</span>
                <span className="font-bold">CORE</span>
                <span>Synthesizing repository patterns...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
