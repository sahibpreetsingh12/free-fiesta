"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from "recharts";
import { ArrowLeft, Trash2, Zap, Clock, Activity } from "lucide-react";

export default function Dashboard() {
  const [history, setHistory] = useState([]);
  const [aggregates, setAggregates] = useState([]);

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem("inferenceHistory") || "[]");
    setHistory(data);
    calculateAggregates(data);
  }, []);

  const calculateAggregates = (data) => {
    if (data.length === 0) return;
    const modelStats = {};

    data.forEach(run => {
      run.stats.forEach(stat => {
        if (!modelStats[stat.model]) {
          modelStats[stat.model] = { totalTps: 0, totalTtft: 0, count: 0, totalTokens: 0 };
        }
        modelStats[stat.model].totalTps += parseFloat(stat.tps);
        modelStats[stat.model].totalTtft += parseFloat(stat.ttft);
        modelStats[stat.model].totalTokens += stat.tokenCount;
        modelStats[stat.model].count += 1;
      });
    });

    const final = Object.keys(modelStats).map(model => ({
      name: model,
      avgTps: (modelStats[model].totalTps / modelStats[model].count).toFixed(2),
      avgTtft: (modelStats[model].totalTtft / modelStats[model].count).toFixed(3),
      totalTokens: modelStats[model].totalTokens
    }));
    setAggregates(final);
  };

  const clearHistory = () => {
    localStorage.removeItem("inferenceHistory");
    setHistory([]);
    setAggregates([]);
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans">
      <div className="flex justify-between items-center mb-8 max-w-6xl mx-auto">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 bg-gray-900 rounded-full hover:bg-gray-800 transition">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
            Inference Telemetry
          </h1>
        </div>
        <button onClick={clearHistory} className="flex items-center gap-2 px-4 py-2 bg-red-900/30 text-red-400 border border-red-900 rounded-lg hover:bg-red-900/50">
          <Trash2 size={16} /> Clear Data
        </button>
      </div>

      {history.length === 0 ? (
        <div className="text-center text-gray-500 mt-20">
          <p className="text-xl">No inference data yet.</p>
          <p className="text-sm">Run some comparisons on the home page first!</p>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* TPS Chart */}
          <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="text-yellow-400" />
              <h2 className="text-xl font-semibold">Inference Speed (Tokens/Sec)</h2>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aggregates}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="name" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                  <Bar dataKey="avgTps" name="Avg TPS" fill="#a855f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* TTFT Chart */}
          <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="text-blue-400" />
              <h2 className="text-xl font-semibold">Responsiveness (TTFT)</h2>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aggregates}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="name" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                  <Bar dataKey="avgTtft" name="Time to First Token (s)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}