'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, RotateCcw, Plus, Trash2, Settings, AlertCircle, Download } from 'lucide-react';
import { analyzeBeam, computeEffectiveIncrement, MAX_AXLES } from '@/lib/beam-engine';

// --- TYPES ---

type Span = {
  id: string;
  length: number;
};

type Axle = {
  id: string;
  load: number;
  spacing: number; // Spacing to the NEXT axle
};

type AnalysisConfig = {
  E: number; // Input in MPa
  I: number; // m^4
  nElemsPerSpan: number;
  truckIncrement: number;
  loadCase: 'truck' | 'lane' | 'envelope';
  dlaOverride?: number | null;
  dlaMultiplier?: number;
  laneUdl?: number | null;
};

type EnvelopePoint = {
  x: number;
  max: number;
  min: number;
};

type AnalysisResults = {
  shear: EnvelopePoint[];
  moment: EnvelopePoint[];
  deflection: EnvelopePoint[];
  xNodes: number[];
};

// --- CONSTANTS ---

const DEFAULT_SPANS: Span[] = [
  { id: 's1', length: 20 },
  { id: 's2', length: 25 },
  { id: 's3', length: 20 },
];

const DEFAULT_AXLES: Axle[] = [
  { id: 'a1', load: 50, spacing: 3.6 },
  { id: 'a2', load: 125, spacing: 1.2 },
  { id: 'a3', load: 125, spacing: 6.6 },
  { id: 'a4', load: 175, spacing: 6.6 },
  { id: 'a5', load: 150, spacing: 0 },
];

const DEFAULT_CONFIG: AnalysisConfig = {
  E: 200000, // MPa
  I: 0.005,
  nElemsPerSpan: 32,
  truckIncrement: 0.5,
  loadCase: 'truck',
  dlaOverride: null,
  dlaMultiplier: 1,
  laneUdl: 9,
};

// --- FEM ENGINE (ll-analyzer: src/lib/beam-engine.ts) ---
// Local BeamFEM replaced by analyzeBeam() from @/lib/beam-engine.ts
// (banded LDL^T, influence-line UDL zones, continuous truck optimisation,
// selected-axle DLA, envelope mode). See src/lib/beam-engine.ts.

// --- COMPONENTS ---

const calculateTicks = (min: number, max: number, targetCount: number) => {
  if (min === max) return [min];
  const span = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(span / targetCount)));
  const err = targetCount / (span / step);
  let finalStep = step;
  if (err <= .15) finalStep *= 10;
  else if (err <= .35) finalStep *= 5;
  else if (err <= .75) finalStep *= 2;
  const start = Math.ceil(min / finalStep) * finalStep;
  const end = Math.floor(max / finalStep) * finalStep;
  const ticks = [];
  const decimals = Math.max(0, -Math.floor(Math.log10(finalStep)));
  for (let val = start; val <= end + (finalStep/2); val += finalStep) {
     const cleanVal = parseFloat(val.toFixed(decimals));
     if (cleanVal >= min && cleanVal <= max) ticks.push(cleanVal);
  }
  return ticks;
};

const EnvelopeChart = ({ data, dataKeyMax, dataKeyMin, title, unit, color }: any) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const height = 300;
  const padding = { top: 40, right: 30, bottom: 50, left: 70 };
  const [hoverData, setHoverData] = useState<{ x: number; svgX: number; max: number; min: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setWidth(container.clientWidth);
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0].contentRect.width;
      if (measured > 0) setWidth(measured);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  if (!data || data.length === 0) return <div className="h-[300px] flex items-center justify-center text-slate-600">No Data</div>;

  const xVals = data.map((d: any) => d.x);
  const maxVals = data.map((d: any) => d[dataKeyMax]);
  const minVals = data.map((d: any) => d[dataKeyMin]);
  const allY = [...maxVals, ...minVals];
  const xMin = Math.min(...xVals), xMax = Math.max(...xVals);
  let yMin = Math.min(...allY), yMax = Math.max(...allY);
  const yRange = yMax - yMin;
  if (yRange === 0) { yMax += 1; yMin -= 1; }
  else { yMax += yRange * 0.1; yMin -= yRange * 0.1; }

  let globalMaxVal = -Infinity;
  let globalMaxX = xMin;
  let globalMinVal = Infinity;
  let globalMinX = xMin;
  for (let i = 0; i < data.length; i++) {
    const curMax = data[i][dataKeyMax];
    const curMin = data[i][dataKeyMin];
    if (curMax > globalMaxVal) { globalMaxVal = curMax; globalMaxX = data[i].x; }
    if (curMin < globalMinVal) { globalMinVal = curMin; globalMinX = data[i].x; }
  }
  
  const xTicks = calculateTicks(xMin, xMax, 8);
  const yTicks = calculateTicks(yMin, yMax, 6);
  const xScale = (val: number) => padding.left + ((val - xMin) / (xMax - xMin)) * (width - padding.left - padding.right);
  const yScale = (val: number) => height - padding.bottom - ((val - yMin) / (yMax - yMin)) * (height - padding.top - padding.bottom);

  const pathMax = maxVals.map((y: number, i: number) => `${i===0?'M':'L'} ${xScale(data[i].x)} ${yScale(y)}`).join(' ');
  const pathMin = minVals.map((y: number, i: number) => `${i===0?'M':'L'} ${xScale(data[i].x)} ${yScale(y)}`).join(' ');
  const pathFill = `${pathMax} L ${xScale(data[data.length-1].x)} ${yScale(minVals[minVals.length-1])} ` + 
                   minVals.slice().reverse().map((y: number, i: number) => `L ${xScale(data[data.length-1-i].x)} ${yScale(y)}`).join(' ') + " Z";

  const zeroY = yScale(0);
  const unitSymbol = unit.includes('(') ? unit.split('(')[1].replace(')', '') : unit;
  const formatVal = (val: number) => {
    if (!Number.isFinite(val)) return '0.00';
    if (Math.abs(val) < 1e-6) return '0.00';
    if (Math.abs(val) < 0.005) return val.toFixed(4);
    return val.toFixed(2);
  };
  const formatValWithDetail = (val: number) => {
    if (!Number.isFinite(val)) return '0.00 ' + unitSymbol;
    if (unitSymbol.toLowerCase() === 'm') {
      const mm = (val * 1000).toFixed(2);
      return `${val.toFixed(4)} m (${mm} mm)`;
    }
    return `${formatVal(val)} ${unitSymbol}`;
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svgRect = e.currentTarget.getBoundingClientRect();
    if (svgRect.width <= 0) return;
    const clientX = e.clientX - svgRect.left;
    const plotWidth = width - padding.left - padding.right;
    if (plotWidth <= 0) return;
    const rawRatio = (clientX - padding.left) / plotWidth;
    const clampedRatio = Math.max(0, Math.min(1, rawRatio));
    const targetX = xMin + clampedRatio * (xMax - xMin);
    let bestMax = 0;
    let bestMin = 0;
    let found = false;
    for (let i = 0; i < data.length - 1; i++) {
      const x1 = data[i].x;
      const x2 = data[i + 1].x;
      if (x1 === x2) continue;
      const minSegX = Math.min(x1, x2);
      const maxSegX = Math.max(x1, x2);
      if (targetX >= minSegX && targetX <= maxSegX) {
        const t = (targetX - x1) / (x2 - x1);
        bestMax = data[i][dataKeyMax] + t * (data[i + 1][dataKeyMax] - data[i][dataKeyMax]);
        bestMin = data[i][dataKeyMin] + t * (data[i + 1][dataKeyMin] - data[i][dataKeyMin]);
        found = true;
        break;
      }
    }
    if (!found) {
      let nearestDist = Infinity;
      let nearestIdx = 0;
      for (let i = 0; i < data.length; i++) {
        const dist = Math.abs(data[i].x - targetX);
        if (dist < nearestDist) { nearestDist = dist; nearestIdx = i; }
      }
      bestMax = data[nearestIdx][dataKeyMax];
      bestMin = data[nearestIdx][dataKeyMin];
    }
    setHoverData({ x: targetX, svgX: xScale(targetX), max: bestMax, min: bestMin });
  };
  const handlePointerLeave = () => setHoverData(null);

  const tooltipWidth = 205;
  const tooltipHeight = 68;
  const tooltipX = hoverData
    ? hoverData.svgX > width - tooltipWidth - 20
      ? Math.max(padding.left + 5, hoverData.svgX - tooltipWidth - 12)
      : Math.min(width - padding.right - tooltipWidth - 5, hoverData.svgX + 12)
    : 0;
  const tooltipY = Math.max(padding.top + 6, Math.min(height - padding.bottom - tooltipHeight - 6, padding.top + 8));

  return (
    <div ref={containerRef} className="w-full bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-800 p-8 mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h3 className="text-lg font-black text-white uppercase tracking-tighter">{title}</h3>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-300">
            <span className="text-slate-500">Max:</span>
            <span className="font-mono">{formatVal(globalMaxVal)} {unitSymbol}</span>
            <span className="text-slate-500">@ {globalMaxX.toFixed(2)}m</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300">
            <span className="text-slate-500">Min:</span>
            <span className="font-mono">{formatVal(globalMinVal)} {unitSymbol}</span>
            <span className="text-slate-500">@ {globalMinX.toFixed(2)}m</span>
          </div>
        </div>
      </div>
      <svg width={width} height={height} className="overflow-visible select-none" onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave}>
        {xTicks.map(tick => (
          <g key={`x-${tick}`}>
            <line x1={xScale(tick)} y1={padding.top} x2={xScale(tick)} y2={height - padding.bottom} stroke="currentColor" className="text-slate-800" strokeWidth="1" />
            <text x={xScale(tick)} y={height - padding.bottom + 15} textAnchor="middle" fontSize="10" className="fill-slate-500 font-bold">{tick}</text>
          </g>
        ))}
        {yTicks.map(tick => (
          <g key={`y-${tick}`}>
             <line x1={padding.left} y1={yScale(tick)} x2={width - padding.right} y2={yScale(tick)} stroke="currentColor" className="text-slate-800" strokeWidth="1" />
             <text x={padding.left - 8} y={yScale(tick) + 3} textAnchor="end" fontSize="10" className="fill-slate-500 font-bold">{tick}</text>
          </g>
        ))}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height-padding.bottom} stroke="currentColor" className="text-slate-700" strokeWidth="1" />
        <line x1={padding.left} y1={height-padding.bottom} x2={width-padding.right} y2={height-padding.bottom} stroke="currentColor" className="text-slate-700" strokeWidth="1" />
        {zeroY > padding.top && zeroY < height - padding.bottom && (
           <line x1={padding.left} y1={zeroY} x2={width-padding.right} y2={zeroY} stroke="currentColor" className="text-slate-600" strokeWidth="1.5" strokeDasharray="4 4" />
        )}
        <text x={padding.left + (width - padding.left - padding.right) / 2} y={height - 10} textAnchor="middle" fontSize="10" className="fill-slate-400 font-black uppercase tracking-widest">Length (m)</text>
        <text x={15} y={padding.top + (height - padding.top - padding.bottom) / 2} textAnchor="middle" fontSize="10" className="fill-slate-400 font-black uppercase tracking-widest transform -rotate-90" style={{transformBox: 'fill-box'}}>{unit}</text>
        <path d={pathFill} fill={color} fillOpacity="0.15" />
        <path d={pathMax} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        <path d={pathMin} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
        {Number.isFinite(globalMaxVal) && (
          <circle cx={xScale(globalMaxX)} cy={yScale(globalMaxVal)} r="4.5" fill={color} stroke="#0f172a" strokeWidth="1.5">
            <title>{`Max: ${formatVal(globalMaxVal)} ${unitSymbol} at x = ${globalMaxX.toFixed(2)} m`}</title>
          </circle>
        )}
        {Number.isFinite(globalMinVal) && (
          <circle cx={xScale(globalMinX)} cy={yScale(globalMinVal)} r="4.5" fill="#ef4444" stroke="#0f172a" strokeWidth="1.5">
            <title>{`Min: ${formatVal(globalMinVal)} ${unitSymbol} at x = ${globalMinX.toFixed(2)} m`}</title>
          </circle>
        )}
        {hoverData && (
          <g pointerEvents="none">
            <line x1={hoverData.svgX} y1={padding.top} x2={hoverData.svgX} y2={height - padding.bottom} stroke="#475569" strokeWidth="1.2" strokeDasharray="3 3" />
            <circle cx={hoverData.svgX} cy={yScale(hoverData.max)} r="4.5" fill={color} stroke="#ffffff" strokeWidth="2" />
            <circle cx={hoverData.svgX} cy={yScale(hoverData.min)} r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
            <rect x={tooltipX} y={tooltipY} width={tooltipWidth} height={tooltipHeight} rx="6" fill="#0f172a" opacity="0.94" />
            <text x={tooltipX + 10} y={tooltipY + 18} fill="#f8fafc" fontSize="11" fontWeight="700">x = {hoverData.x.toFixed(2)} m</text>
            <text x={tooltipX + 10} y={tooltipY + 36} fill="#60a5fa" fontSize="10" fontWeight="500">Max: {formatValWithDetail(hoverData.max)}</text>
            <text x={tooltipX + 10} y={tooltipY + 54} fill="#f87171" fontSize="10" fontWeight="500">Min: {formatValWithDetail(hoverData.min)}</text>
          </g>
        )}
        <rect x={padding.left} y={padding.top} width={width - padding.left - padding.right} height={height - padding.top - padding.bottom} fill="transparent" className="cursor-crosshair" />
      </svg>
      <div className="flex justify-center gap-8 mt-6 text-[10px] font-black uppercase tracking-widest">
        <div className="flex items-center gap-2 text-sky-400"><div className="w-4 h-1 rounded-full" style={{backgroundColor: color}}></div> Max Envelope</div>
        <div className="flex items-center gap-2 text-red-400"><div className="w-4 h-1 rounded-full bg-red-500"></div> Min Envelope</div>
      </div>
    </div>
  );
};

export function LiveLoadAnalysis() {
  const [spans, setSpans] = useState<Span[]>(DEFAULT_SPANS);
  const [axles, setAxles] = useState<Axle[]>(DEFAULT_AXLES);
  const [config, setConfig] = useState<AnalysisConfig>(DEFAULT_CONFIG);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'results'>('config');

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
    script.async = true;
    document.body.appendChild(script);
    return () => { if(document.body.contains(script)) document.body.removeChild(script); }
  }, []);

  const addSpan = () => setSpans([...spans, { id: `s${Date.now()}`, length: 20 }]);
  const removeSpan = (id: string) => spans.length > 1 && setSpans(spans.filter(s => s.id !== id));
  const updateSpan = (id: string, val: number) => setSpans(spans.map(s => s.id === id ? { ...s, length: val } : s));

  const addAxle = () => {
    if (axles.length >= MAX_AXLES) return;
    setAxles([
      ...axles.map((a, i) => (i === axles.length - 1 ? { ...a, spacing: 3.6 } : a)),
      { id: `a${Date.now()}`, load: 100, spacing: 0 },
    ]);
  };
  const removeAxle = (id: string) => axles.length > 1 && setAxles(axles.filter((a) => a.id !== id));
  const updateAxle = (id: string, patch: Partial<Axle>) =>
    setAxles(axles.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const resetAxles = () => setAxles(DEFAULT_AXLES);

  const stepInfo = useMemo(
    () => computeEffectiveIncrement(spans, axles, config.truckIncrement, config.nElemsPerSpan),
    [spans, axles, config.truckIncrement, config.nElemsPerSpan]
  );

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      try {
        const result = analyzeBeam({
          spans,
          axles,
          config: {
            E: config.E * 1e6,
            I: config.I,
            nElemsPerSpan: config.nElemsPerSpan,
            truckIncrement: config.truckIncrement,
            loadCase: config.loadCase,
            dlaOverride: config.dlaOverride ?? null,
            dlaMultiplier: config.dlaMultiplier ?? 1,
            laneUdl: config.laneUdl ?? 9,
          },
        });
        setResults({
          shear: result.shear,
          moment: result.moment,
          deflection: result.deflection,
          xNodes: result.xNodes,
        });
        setActiveTab('results');
      } catch (e) { console.error(e); }
      setIsAnalyzing(false);
    }, 100);
  };

  const downloadExcel = () => {
    if (!results || !(window as any).XLSX) return;
    const wb = (window as any).XLSX.utils.book_new();
    const formatData = (data: EnvelopePoint[]) => data.map(d => ({ "Position (m)": d.x, "Max": d.max, "Min": d.min }));
    (window as any).XLSX.utils.book_append_sheet(wb, (window as any).XLSX.utils.json_to_sheet(formatData(results.shear)), "Shear Force");
    (window as any).XLSX.utils.book_append_sheet(wb, (window as any).XLSX.utils.json_to_sheet(formatData(results.moment)), "Bending Moment");
    (window as any).XLSX.utils.book_append_sheet(wb, (window as any).XLSX.utils.json_to_sheet(formatData(results.deflection)), "Deflection");
    (window as any).XLSX.writeFile(wb, "beam_analysis_results.xlsx");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl gap-6">
        <div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic flex items-center gap-4">
            <span className="bg-sky-500 text-slate-950 px-3 py-1 rounded-xl text-sm font-black not-italic shadow-lg shadow-sky-500/20">FEM</span>
            Live Load Analysis
          </h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Moving Load Envelopes (CL-625)</p>
        </div>
        <button 
          onClick={runAnalysis} 
          disabled={isAnalyzing} 
          className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl ${isAnalyzing ? 'bg-slate-800 text-slate-600 cursor-wait' : 'bg-sky-500 text-slate-950 hover:bg-sky-400 active:scale-95'}`}
        >
          {isAnalyzing ? <RotateCcw className="animate-spin w-4 h-4"/> : <Play className="w-4 h-4"/>}
          {isAnalyzing ? 'Calculating...' : 'Run Analysis'}
        </button>
      </div>

      <div className="flex gap-4 bg-slate-900 p-1.5 rounded-2xl border-2 border-slate-800 w-fit">
        <button onClick={() => setActiveTab('config')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'config' ? 'bg-sky-500 text-slate-950 shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}>Configuration</button>
        <button onClick={() => setActiveTab('results')} disabled={!results} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'results' ? 'bg-sky-500 text-slate-950 shadow-xl' : 'text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed'}`}>Results</button>
      </div>

      {activeTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 p-10 rounded-[2.5rem] shadow-2xl space-y-8">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3"><Settings className="w-5 h-5 text-sky-500" /> Geometry</h3>
              <button onClick={addSpan} className="text-[9px] font-black uppercase bg-slate-800 text-sky-400 px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors flex items-center gap-2 border border-sky-500/20"><Plus className="w-3 h-3" /> Add Span</button>
            </div>
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {spans.map((span, idx) => (
                <div key={span.id} className="flex items-center gap-4 p-5 bg-slate-950/50 rounded-2xl border-2 border-slate-800/80 group shadow-inner">
                  <span className="text-[10px] font-black text-slate-600 w-8">#{idx + 1}</span>
                  <div className="flex-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Length (m)</label>
                    <input 
                      type="number" 
                      value={span.length} 
                      onChange={(e) => updateSpan(span.id, parseFloat(e.target.value) || 0)} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-bold text-white focus:border-sky-500 outline-none transition-all shadow-inner" 
                    />
                  </div>
                  <button onClick={() => removeSpan(span.id)} className="text-slate-700 hover:text-red-500 p-2 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-6 border-t border-slate-800 flex justify-between items-baseline">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Total System Length</span>
              <span className="text-3xl font-mono font-black text-sky-400 tracking-tighter">{spans.reduce((a, b) => a + b.length, 0).toFixed(2)} <span className="text-sm font-normal text-slate-600">m</span></span>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-8">
            <div className="bg-slate-900 border border-slate-800 p-10 rounded-[2.5rem] shadow-2xl">
              <h3 className="text-xl font-black text-white uppercase tracking-tighter border-b border-slate-800 pb-4 mb-8">Analysis Core</h3>
              <div className="space-y-6">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Load Case Configuration</label>
                  <select 
                    value={config.loadCase} 
                    onChange={(e) => setConfig({ ...config, loadCase: e.target.value as 'truck' | 'lane' | 'envelope' })} 
                    className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl px-4 py-4 text-xs font-bold text-white focus:border-sky-500 outline-none transition-all shadow-inner appearance-none cursor-pointer"
                  >
                    <option value="truck">CL-625 Truck Only (Auto DLA 40%/30%/25%)</option>
                    <option value="lane">{`CL-625 Lane Load (80% Truck + ${config.laneUdl ?? 9} kN/m UDL)`}</option>
                    <option value="envelope">Envelope (max of Truck and Lane)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Lane UDL (kN/m)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={config.laneUdl ?? ''}
                      placeholder="9 (default)"
                      onChange={(e) => setConfig({ ...config, laneUdl: e.target.value === '' ? null : e.target.valueAsNumber })}
                      className="w-1/3 bg-slate-950 border-2 border-slate-800 rounded-2xl p-4 text-xs font-bold text-white focus:border-sky-500 outline-none shadow-inner"
                    />
                    <span className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase tracking-wide">
                      Blank = 9 kN/m (CL-625). Zero removes only the UDL; the 80% lane truck remains. Lane + Envelope.
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Dynamic Load Allowance (DLA)</label>
                    <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={config.dlaOverride !== null && config.dlaOverride !== undefined}
                        onChange={(e) => setConfig({ ...config, dlaOverride: e.target.checked ? (config.dlaOverride ?? 0.25) : null })}
                        className="rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-sky-500 h-3.5 w-3.5 cursor-pointer"
                      />
                      Override DLA
                    </label>
                  </div>
                  {config.dlaOverride === null || config.dlaOverride === undefined ? (
                    <div className="bg-sky-950/20 border border-sky-500/20 rounded-2xl p-4 flex items-center justify-between gap-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-sky-400">
                        Auto: 40%/30%/25% × d={(config.dlaMultiplier ?? 1).toFixed(2)}
                      </span>
                      <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">CSA S6 Cl. 3.8.4.5</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={config.dlaOverride}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setConfig({ ...config, dlaOverride: isNaN(val) ? 0 : val });
                        }}
                        placeholder="e.g. 0.30"
                        className="w-1/3 bg-slate-950 border-2 border-amber-500/40 rounded-2xl p-4 text-xs font-bold text-white focus:border-amber-400 outline-none shadow-inner"
                      />
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                        Manual: {((config.dlaOverride ?? 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                  <p className="text-[9px] font-bold text-slate-600 leading-relaxed uppercase tracking-wide mt-2">
                    Auto per placement: 40% (1 axle), 30% (2 axles / front-three), 25% (≥3 axles), × d. Lane gets no DLA.
                  </p>
                  <div className="mt-3">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Truck DLA Multiplier, d (0–1)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={config.dlaMultiplier ?? 1}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setConfig({ ...config, dlaMultiplier: isNaN(val) ? 1 : Math.max(0, Math.min(1, val)) });
                        }}
                        placeholder="e.g. 1.00"
                        className="w-1/3 bg-slate-950 border-2 border-slate-800 rounded-2xl p-4 text-xs font-bold text-white focus:border-sky-500 outline-none shadow-inner"
                      />
                      <span className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase tracking-wide">
                        d=0 off, d=1 full. Applies to truck DLA (auto or override).
                      </span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">E (MPa)</label>
                    <input type="number" value={config.E} onChange={(e) => setConfig({ ...config, E: parseFloat(e.target.value) })} className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-4 text-xs font-bold text-white focus:border-sky-500 outline-none shadow-inner" />
                   </div>
                   <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">I (m⁴)</label>
                    <input type="number" value={config.I} onChange={(e) => setConfig({ ...config, I: parseFloat(e.target.value) })} className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-4 text-xs font-bold text-white focus:border-sky-500 outline-none shadow-inner" />
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">Elements / Span</label>
                    <input type="number" min="2" max="200" step="1" value={config.nElemsPerSpan} onChange={(e) => setConfig({ ...config, nElemsPerSpan: Number(e.target.value) })} className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-4 text-xs font-bold text-white focus:border-sky-500 outline-none shadow-inner" />
                   </div>
                   <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">Truck Step, Base (m)</label>
                    <input type="number" min="0.02" max="2" step="0.05" value={config.truckIncrement} onChange={(e) => setConfig({ ...config, truckIncrement: Number(e.target.value) })} className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-4 text-xs font-bold text-white focus:border-sky-500 outline-none shadow-inner" />
                   </div>
                </div>
                <div className="bg-sky-950/20 border border-sky-500/20 p-5 rounded-2xl flex gap-4">
                  <AlertCircle className="w-5 h-5 text-sky-500 shrink-0" />
                  <p className="text-[10px] font-bold text-sky-400/80 leading-relaxed uppercase tracking-wide">
                    Mesh: {config.nElemsPerSpan} elements/span. Sweep uses {stepInfo.effective.toFixed(3)}m{stepInfo.wasAdjusted ? ` (adjusted from ${config.truckIncrement}m — ${stepInfo.reason})` : ` (base ${config.truckIncrement}m)`}. Exact support alignments included.
                  </p>
                </div>
              </div>
            </div>
             <div className="bg-slate-900 border border-slate-800 p-10 rounded-[2.5rem] shadow-2xl">
               <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-6">
                 <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Truck Configuration (kN / m)</h3>
                 <div className="flex gap-2">
                   <button onClick={addAxle} disabled={axles.length >= MAX_AXLES} className="text-[9px] font-black uppercase bg-slate-800 text-sky-400 px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors flex items-center gap-2 border border-sky-500/20 disabled:opacity-30 disabled:cursor-not-allowed"><Plus className="w-3 h-3" /> Add Axle</button>
                   <button onClick={resetAxles} className="text-[9px] font-black uppercase bg-slate-800 text-slate-400 px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors border border-slate-700">Reset CL-625</button>
                 </div>
               </div>
               <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-4">CL-625 defaults; customize up to {MAX_AXLES} axles. Spacing is to the next axle.</p>
               <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                 {axles.map((axle, i) => (
                   <div key={axle.id} className="flex items-end gap-3 p-4 bg-slate-950/50 rounded-2xl border-2 border-slate-800/80 shadow-inner">
                     <span className="text-[10px] font-black text-slate-600 w-8 pb-2">#{i + 1}</span>
                     <div className="flex-1">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Load (kN)</label>
                       <input
                         type="number"
                         min="0"
                         value={axle.load}
                         onChange={(e) => updateAxle(axle.id, { load: Number(e.target.value) })}
                         className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-bold text-white focus:border-sky-500 outline-none transition-all shadow-inner"
                       />
                     </div>
                     {i < axles.length - 1 && (
                       <div className="flex-1">
                         <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Spacing ↓ (m)</label>
                         <input
                           type="number"
                           min="0"
                           step="0.1"
                           value={axle.spacing}
                           onChange={(e) => updateAxle(axle.id, { spacing: Number(e.target.value) })}
                           className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-bold text-white focus:border-sky-500 outline-none transition-all shadow-inner"
                         />
                       </div>
                     )}
                     <button aria-label={`Remove axle ${i + 1}`} disabled={axles.length <= 1} onClick={() => removeAxle(axle.id)} className="text-slate-700 hover:text-red-500 p-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><Trash2 className="w-4 h-4" /></button>
                   </div>
                 ))}
               </div>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'results' && results && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
           <EnvelopeChart title="Shear Force Envelope (V)" data={results.shear} dataKeyMax="max" dataKeyMin="min" unit="Shear (kN)" color="#38bdf8" />
           <EnvelopeChart title="Bending Moment Envelope (M)" data={results.moment} dataKeyMax="max" dataKeyMin="min" unit="Moment (kNm)" color="#10b981" />
           <EnvelopeChart title="Deflection Envelope (δ)" data={results.deflection} dataKeyMax="max" dataKeyMin="min" unit="Deflection (m)" color="#a855f7" />
           <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8">
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Analysis Export</h3>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-2">Generate comprehensive multi-sheet engineering dataset (XLSX).</p>
              </div>
              <button 
                onClick={downloadExcel} 
                className="bg-emerald-500 text-slate-950 px-10 py-5 rounded-3xl font-black uppercase tracking-widest text-xs hover:bg-emerald-400 active:scale-95 transition-all shadow-xl shadow-emerald-500/20 flex items-center gap-3"
              >
                <Download className="w-5 h-5" /> Download Analysis Data
              </button>
           </div>
        </div>
      )}
    </div>
  );
}
