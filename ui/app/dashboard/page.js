"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { ArrowLeft, Trash2, Zap, Clock, Timer } from "lucide-react";
import styles from "./Dashboard.module.css"; // <--- IMPORTING THE CSS

export default function Dashboard() {
  const [aggregates, setAggregates] = useState([]);

  useEffect(() => {
    const rawData = localStorage.getItem("inferenceHistory");
    if (rawData) {
      try {
        const data = JSON.parse(rawData);
        calculateAggregates(data);
      } catch (e) {
        localStorage.removeItem("inferenceHistory");
      }
    }
  }, []);

  const calculateAggregates = (data) => {
    if (!data || data.length === 0) return;
    const modelStats = {};

    data.forEach(run => {
      if (!run.stats) return;
      run.stats.forEach(stat => {
        if (!modelStats[stat.model]) {
          modelStats[stat.model] = { totalTps: 0, totalTtft: 0, totalLatency: 0, count: 0, totalTokens: 0 };
        }
        modelStats[stat.model].totalTps += parseFloat(stat.tps) || 0;
        modelStats[stat.model].totalTtft += parseFloat(stat.ttft) || 0;
        modelStats[stat.model].totalLatency += parseFloat(stat.latency) || 0;
        modelStats[stat.model].totalTokens += stat.tokenCount || 0;
        modelStats[stat.model].count += 1;
      });
    });

    const final = Object.keys(modelStats).map(model => ({
      name: model,
      avgTps: (modelStats[model].totalTps / modelStats[model].count).toFixed(2),
      avgTtft: (modelStats[model].totalTtft / modelStats[model].count).toFixed(3),
      avgLatency: (modelStats[model].totalLatency / modelStats[model].count).toFixed(2),
      totalTokens: modelStats[model].totalTokens,
    }));

    setAggregates(final);
  };

  const clearHistory = () => {
    localStorage.removeItem("inferenceHistory");
    setAggregates([]);
  };

  const CustomTooltip = ({ active, payload, label, unit }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: '#000', border: '1px solid #333', padding: '12px', borderRadius: '8px' }}>
          <p style={{ color: '#fff', fontWeight: 'bold', marginBottom: '4px' }}>{label}</p>
          <p style={{ color: '#a855f7', fontFamily: 'monospace', margin: 0 }}>
            {payload[0].value} {unit}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={styles.container}>
      {/* HEADER */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.titleGroup}>
            <Link href="/" className={styles.backButton}>
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className={styles.title}>Inference Telemetry</h1>
              <p className={styles.subtitle}>Real-time performance benchmarks</p>
            </div>
          </div>
          <button onClick={clearHistory} className={styles.resetButton}>
            <Trash2 size={18} /> Reset Data
          </button>
        </div>
      </div>

      {aggregates.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '100px', color: '#666' }}>
          <h2>No Data Found</h2>
          <p>Go back home and run some models!</p>
        </div>
      ) : (
        <div className={styles.grid}>
          
          {/* CHART 1: TPS */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={`${styles.iconBox} ${styles.purpleBox}`}>
                <Zap size={24} />
              </div>
              <div>
                <h3 className={styles.cardTitle}>Generation Speed</h3>
                <p className={styles.cardSub}>Tokens Per Second (Higher is Better)</p>
              </div>
            </div>
            <div className={styles.chartContainer}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aggregates}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                  <XAxis dataKey="name" stroke="#666" tick={{fill: '#888', fontSize: 12}} axisLine={false} tickLine={false} dy={10} />
                  <YAxis stroke="#666" tick={{fill: '#888', fontSize: 12}} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip unit="TPS" />} cursor={{fill: 'transparent'}} />
                  <Bar dataKey="avgTps" radius={[4, 4, 0, 0]}>
                    {aggregates.map((entry, index) => <Cell key={index} fill="#a855f7" />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CHART 2: TTFT */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={`${styles.iconBox} ${styles.blueBox}`}>
                <Clock size={24} />
              </div>
              <div>
                <h3 className={styles.cardTitle}>Responsiveness</h3>
                <p className={styles.cardSub}>Time to First Token (Lower is Better)</p>
              </div>
            </div>
            <div className={styles.chartContainer}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aggregates}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                  <XAxis dataKey="name" stroke="#666" tick={{fill: '#888', fontSize: 12}} axisLine={false} tickLine={false} dy={10} />
                  <YAxis stroke="#666" tick={{fill: '#888', fontSize: 12}} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip unit="s" />} cursor={{fill: 'transparent'}} />
                  <Bar dataKey="avgTtft" radius={[4, 4, 0, 0]}>
                    {aggregates.map((entry, index) => <Cell key={index} fill="#3b82f6" />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CHART 3: LATENCY */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={`${styles.iconBox} ${styles.orangeBox}`}>
                <Timer size={24} />
              </div>
              <div>
                <h3 className={styles.cardTitle}>Total Latency</h3>
                <p className={styles.cardSub}>Avg Completion Time (Lower is Better)</p>
              </div>
            </div>
            <div className={styles.chartContainer}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aggregates}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                  <XAxis dataKey="name" stroke="#666" tick={{fill: '#888', fontSize: 12}} axisLine={false} tickLine={false} dy={10} />
                  <YAxis stroke="#666" tick={{fill: '#888', fontSize: 12}} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip unit="s" />} cursor={{fill: 'transparent'}} />
                  <Bar dataKey="avgLatency" radius={[4, 4, 0, 0]}>
                    {aggregates.map((entry, index) => <Cell key={index} fill="#f97316" />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* STATS ROW */}
          <div className={styles.statsRow}>
             {aggregates.map(model => (
               <div key={model.name} className={styles.statItem}>
                 <div className={styles.statValue}>{model.totalTokens.toLocaleString()}</div>
                 <div className={styles.statLabel}>{model.name} TOKENS</div>
               </div>
             ))}
          </div>

        </div>
      )}
    </div>
  );
}