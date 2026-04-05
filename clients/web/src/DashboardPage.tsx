import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Search, Activity, Calendar, GitBranch, 
  Github, ChevronRight, ShieldCheck, Clock, Server
} from 'lucide-react';

export const DashboardPage = ({ 
  token, 
  apiUrl, 
  onBack, 
  onViewAnalysis 
}: { 
  token: string; 
  apiUrl: string; 
  onBack: () => void;
  onViewAnalysis: (id: string, repoUrl: string) => void;
  key?: React.Key;
}) => {
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalyses();
  }, [token]);

  const fetchAnalyses = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiUrl}/api/v1/analyses`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired. Please log in again.");
        }
        throw new Error("Failed to fetch history");
      }
      const data = await res.json();
      // Backend returns a plain array from our new endpoint
      setAnalyses(Array.isArray(data) ? data : (data.analyses || []));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-8 flex flex-col items-center custom-scrollbar">
      {/* Top Navigation */}
      <div className="fixed top-0 left-0 right-0 h-16 border-b border-white/10 bg-black/50 backdrop-blur-xl z-40 px-6 flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/50">
            <Activity className="w-3 h-3 text-indigo-400" />
          </div>
          <span className="font-display font-bold text-white tracking-tight">Project History</span>
        </div>
        <div className="w-24" />
      </div>

      <div className="w-full max-w-5xl mt-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-white/10 pb-8">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Your Scans</h1>
              <p className="text-slate-400">Review your past repository analyses and track health scores over time.</p>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-slate-500 uppercase tracking-widest mb-1">Total Scans</div>
              <div className="text-3xl font-black text-white">{analyses.length}</div>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-400">Loading your history...</p>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
              <p className="text-red-400">{error}</p>
            </div>
          ) : analyses.length === 0 ? (
            <div className="liquid-glass p-12 rounded-[2rem] text-center border-white/5 shadow-2xl">
              <Server className="w-16 h-16 text-slate-600 mx-auto mb-6" />
              <h3 className="text-2xl font-bold text-white mb-2">No scans yet</h3>
              <p className="text-slate-400 mb-8 max-w-md mx-auto">You haven't run any repository analyses yet. Go back to the home page and trigger your first scan!</p>
              <button onClick={onBack} className="btn-primary py-3 px-8 text-white">Start New Scan</button>
            </div>
          ) : (
            <div className="grid gap-4">
              {analyses.map((analysis, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={analysis.id}
                  onClick={() => onViewAnalysis(analysis.id, analysis.repo_url)}
                  className="bg-black/40 hover:bg-black/60 border border-white/10 hover:border-indigo-500/30 p-6 rounded-2xl transition-all cursor-pointer group flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/0 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex-1 min-w-0 z-10">
                    <div className="flex items-center gap-3 mb-2">
                       <Github className="w-5 h-5 text-slate-400" />
                       <h3 className="text-lg font-bold text-white truncate" title={analysis.repo_url}>
                         {analysis.repo_url.replace("https://github.com/", "")}
                       </h3>
                    </div>
                    <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">
                      {analysis.summary || "No summary generated."}
                    </p>
                  </div>

                  <div className="flex items-center gap-8 z-10 shrink-0 border-t border-white/5 md:border-none pt-4 md:pt-0">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">Health</span>
                      <div className={`text-2xl font-black ${
                        analysis.health_score > 70 ? 'text-green-400' : 
                        analysis.health_score > 40 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {analysis.health_score}<span className="text-xs opacity-50 font-normal">/100</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-center">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">Date</span>
                      <div className="flex items-center gap-1.5 text-slate-300 font-mono text-xs">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(analysis.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white text-slate-500 transition-colors">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
