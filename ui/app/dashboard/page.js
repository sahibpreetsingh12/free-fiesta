"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { ArrowLeft, Trash2, Zap, Clock, Activity, Timer } from "lucide-react";

export default function Dashboard() {
  const [history, setHistory] = useState([]);
  const [aggregates, setAggregates] = useState([]);

  useEffect(() => {
    // Load data from local storage
    const rawData = localStorage.getItem("inferenceHistory");
    if (rawData) {
      try {
        const data = JSON.parse(rawData);
        setHistory(data);
        calculateAggregates(data);
      } catch (e) {
        console.error("Data corrupted, clearing...", e);
        clearHistory();
      }
    }
  }, []);

  const calculateAggregates = (data) => {
    if (!data || data.length === 0) return;

    const modelStats = {};

    data.forEach(run => {
      if (!run.stats) return; // Skip malformed runs
      run.stats.forEach(stat => {
        if (!modelStats[stat.model]) {
          modelStats[stat.model] = { 
            totalTps: 0, 
            totalTtft: 0, 
            totalLatency: 0,
            count: 0, 
            totalTokens: 0 
          };
        }
        // Safety parsing
        const tps = parseFloat(stat.tps) || 0;
        const ttft = parseFloat(stat.ttft) || 0;
        const latency = parseFloat(stat.latency) || 0;
        
        modelStats[stat.model].totalTps += tps;
        modelStats[stat.model].totalTtft += ttft;
        modelStats[stat.model].totalLatency += latency;
        modelStats[stat.model].totalTokens += stat.tokenCount || 0;
        modelStats[stat.model].count += 1;
      });
    });

    // Calculate averages
    const final = Object.keys(modelStats).map(model => ({
      name: model,
      avgTps: (modelStats[model].totalTps / modelStats[model].count).toFixed(2),
      avgTtft: (modelStats[model].totalTtft / modelStats[model].count).toFixed(3),
      avgLatency: (modelStats[model].totalLatency / modelStats[model].count).toFixed(2),
      totalTokens: modelStats[model].totalTokens,
      runs: modelStats[model].count
    }));

    setAggregates(final);
  };

  const clearHistory = () => {
    localStorage.removeItem("inferenceHistory");
    setHistory([]);
    setAggregates([]);
  };

  // Custom Tooltip for Charts
  const CustomTooltip = ({ active, payload, label, unit }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#111] border border-[#333] p-3 rounded-lg shadow-xl">
          <p className="text-gray-200 font-bold mb-1">{label}</p>
          <p className="text-purple-400 font-mono">
            {payload[0].value} {unit}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-purple-500/30 pb-20">
      
      {/* --- HEADER --- */}
      <div className="max-w-7xl mx-auto px-6 pt-12 pb-8 border-b border-[#222]">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-5">
            <Link 
              href="/" 
              className="p-3 bg-[#1a1a1a] rounded-full hover:bg-[#333] transition-colors border border-[#333] group"
            >
              <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
            </Link>
            <div>
              <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
                Inference Telemetry
              </h1>
              <p className="text-gray-500 mt-1">Real-time performance benchmarks</p>
            </div>
          </div>
          
          <button 
            onClick={clearHistory}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-all font-medium"
          >
            <Trash2 size={18} /> Reset Data
          </button>
        </div>
      </div>

      {/* --- EMPTY STATE --- */}
      {aggregates.length === 0 ? (
        <div className="flex flex-col items-center justify-center mt-32 text-gray-500 animate-fade-in">
          <Activity size={64} className="mb-6 opacity-20" />
          <h2 className="text-2xl font-semibold text-gray-400">No telemetry data found</h2>
          <p className="mt-2 text-gray-600">Run some comparisons on the home page to populate charts.</p>
          <Link href="/" className="mt-8 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">
            Start Benchmarking
          </Link>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-6 mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* --- CHART 1: SPEED (TPS) --- */}
          <div className="bg-[#111] border border-[#222] p-6 rounded-2xl shadow-2xl hover:border-purple-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Zap className="text-purple-400" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-200">Generation Speed</h3>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Tokens Per Second (Higher is Better)</p>
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aggregates}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                  <XAxis dataKey="name" stroke="#666" tick={{fill: '#888', fontSize: 12}} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#666" tick={{fill: '#888', fontSize: 12}} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip unit="TPS" />} cursor={{fill: '#ffffff05'}} />
                  <Bar dataKey="avgTps" radius={[6, 6, 0, 0]}>
                    {aggregates.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#a855f7" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* --- CHART 2: RESPONSIVENESS (TTFT) --- */}
          <div className="bg-[#111] border border-[#222] p-6 rounded-2xl shadow-2xl hover:border-blue-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Clock className="text-blue-400" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-200">Responsiveness</h3>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Time to First Token (Lower is Better)</p>
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aggregates}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                  <XAxis dataKey="name" stroke="#666" tick={{fill: '#888', fontSize: 12}} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#666" tick={{fill: '#888', fontSize: 12}} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip unit="s" />} cursor={{fill: '#ffffff05'}} />
                  <Bar dataKey="avgTtft" radius={[6, 6, 0, 0]}>
                    {aggregates.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#3b82f6" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* --- CHART 3: TOTAL LATENCY (New!) --- */}
          <div className="bg-[#111] border border-[#222] p-6 rounded-2xl shadow-2xl hover:border-orange-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Timer className="text-orange-400" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-200">Total Latency</h3>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Avg Completion Time (Lower is Better)</p>
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aggregates}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                  <XAxis dataKey="name" stroke="#666" tick={{fill: '#888', fontSize: 12}} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#666" tick={{fill: '#888', fontSize: 12}} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip unit="s" />} cursor={{fill: '#ffffff05'}} />
                  <Bar dataKey="avgLatency" radius={[6, 6, 0, 0]}>
                    {aggregates.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#f97316" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* --- BOTTOM STATS ROW --- */}
          <div className="lg:col-span-3 bg-[#111] border border-[#222] p-8 rounded-2xl flex flex-wrap justify-around items-center gap-8">
             {aggregates.map(model => (
               <div key={model.name} className="text-center group cursor-default">
                 <div className="text-sm text-gray-500 mb-1 group-hover:text-purple-400 transition-colors">{model.name}</div>
                 <div className="text-4xl font-extrabold text-white mb-1">
                   {model.totalTokens.toLocaleString()}
                 </div>
                 <div className="text-xs text-gray-600 font-mono bg-[#1a1a1a] px-2 py-1 rounded inline-block">
                   TOKENS GENERATED
                 </div>
               </div>
             ))}
          </div>

        </div>
      )}
    </div>
  );
}