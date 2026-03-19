'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, Plus, Trash2, Settings, AlertCircle, Download } from 'lucide-react';

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
  loadCase: 'truck' | 'lane';
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
};

// --- FEM ENGINE ---

class BeamFEM {
  private config: AnalysisConfig;
  private spans: Span[];
  private axles: Axle[];

  constructor(spans: Span[], axles: Axle[], config: AnalysisConfig) {
    this.spans = spans;
    this.axles = axles;
    this.config = config;
  }

  private solveSystem(K: number[][], F: number[], constrained: boolean[]): number[] {
    const n = F.length;
    const map: number[] = [];
    for (let i = 0; i < n; i++) {
      if (!constrained[i]) map.push(i);
    }
    
    const nFree = map.length;
    if (nFree === 0) return Array(n).fill(0);

    const K_red: number[][] = Array(nFree).fill(0).map(() => Array(nFree).fill(0));
    const F_red: number[] = Array(nFree).fill(0);

    for (let i = 0; i < nFree; i++) {
      F_red[i] = F[map[i]];
      for (let j = 0; j < nFree; j++) {
        K_red[i][j] = K[map[i]][map[j]];
      }
    }

    for (let k = 0; k < nFree - 1; k++) {
      for (let i = k + 1; i < nFree; i++) {
        const factor = K_red[i][k] / K_red[k][k];
        for (let j = k; j < nFree; j++) {
          K_red[i][j] -= factor * K_red[k][j];
        }
        F_red[i] -= factor * F_red[k];
      }
    }

    const U_red: number[] = Array(nFree).fill(0);
    for (let i = nFree - 1; i >= 0; i--) {
      let sum = 0;
      for (let j = i + 1; j < nFree; j++) {
        sum += K_red[i][j] * U_red[j];
      }
      U_red[i] = (F_red[i] - sum) / K_red[i][i];
    }

    const U_Full: number[] = Array(n).fill(0);
    for (let i = 0; i < nFree; i++) {
      U_Full[map[i]] = U_red[i];
    }
    return U_Full;
  }

  public runAnalysis(): AnalysisResults {
    // Convert E from MPa to Pascals for the solver
    const E_Pa = this.config.E * 1e6;
    const { I, nElemsPerSpan, truckIncrement, loadCase } = this.config;
    
    const numSpans = this.spans.length;
    const nTotalElems = numSpans * nElemsPerSpan;
    const nNodes = nTotalElems + 1;
    const nDOF = nNodes * 2;

    const elemLens: number[] = [];
    const xNodes: number[] = [0];
    let currentX = 0;
    const xShear: number[] = [];

    for (const span of this.spans) {
      const le = span.length / nElemsPerSpan;
      for (let i = 0; i < nElemsPerSpan; i++) {
        xShear.push(currentX);
        currentX += le;
        xShear.push(currentX);
        xNodes.push(currentX);
        elemLens.push(le);
      }
    }

    const K_Global: number[][] = Array(nDOF).fill(0).map(() => Array(nDOF).fill(0));
    for (let i = 0; i < nTotalElems; i++) {
      const le = elemLens[i];
      const coeff = (E_Pa * I) / Math.pow(le, 3);
      const k_loc = [
        [12, 6*le, -12, 6*le],
        [6*le, 4*le*le, -6*le, 2*le*le],
        [-12, -6*le, 12, -6*le],
        [6*le, 2*le*le, -6*le, 4*le*le]
      ];
      const mapDOFs = [i*2, i*2+1, (i+1)*2, (i+1)*2+1];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          K_Global[mapDOFs[r]][mapDOFs[c]] += k_loc[r][c] * coeff;
        }
      }
    }

    const constrained: boolean[] = Array(nDOF).fill(false);
    let nodeIdx = 0;
    constrained[0] = true;
    for (let i = 0; i < numSpans; i++) {
      nodeIdx += nElemsPerSpan;
      constrained[nodeIdx * 2] = true;
    }

    const initEnvelope = (len: number) => Array(len).fill(0).map(() => ({ max: -Infinity, min: Infinity }));
    const shearEnv = initEnvelope(nTotalElems * 2).map((p, i) => ({ ...p, x: xShear[i] }));
    const momEnv = initEnvelope(nNodes).map((p, i) => ({ ...p, x: xNodes[i] }));
    const defEnv = initEnvelope(nNodes).map((p, i) => ({ ...p, x: xNodes[i] }));

    let activeAxles = [...this.axles];
    let w_udl = 0;
    if (loadCase === 'lane') {
      w_udl = 9;
      activeAxles = activeAxles.map(a => ({ ...a, load: a.load * 0.8 }));
    } else {
      activeAxles = activeAxles.map(a => ({ ...a, load: a.load * 1.25 }));
    }

    const udlEnv = {
        vMax: Array(xShear.length).fill(0),
        vMin: Array(xShear.length).fill(0),
        mMax: Array(nNodes).fill(0),
        mMin: Array(nNodes).fill(0),
        dMax: Array(nNodes).fill(0),
        dMin: Array(nNodes).fill(0)
    };
    if (w_udl > 0) this.solveUDLPatterns(w_udl, nTotalElems, nNodes, elemLens, constrained, K_Global, udlEnv, E_Pa, I);

    const totalLen = xNodes[xNodes.length - 1];
    const truckLen = activeAxles.reduce((acc, a) => acc + a.spacing, 0);
    const startPos = -truckLen;
    const endPos = totalLen + truckLen;

    const runPass = (axles: Axle[]) => {
      for (let pos = startPos; pos <= endPos; pos += truckIncrement) {
        const F = Array(nDOF).fill(0);
        let axPos = pos;
        this.applyPointLoad(F, axPos, axles[0].load, elemLens, xNodes);
        for (let k = 0; k < axles.length - 1; k++) {
          axPos -= axles[k].spacing;
          this.applyPointLoad(F, axPos, axles[k + 1].load, elemLens, xNodes);
        }
        const U = this.solveSystem(K_Global, F, constrained);
        const { v, m, d } = this.calculateForces(U, nTotalElems, elemLens, E_Pa, I);
        for (let i = 0; i < v.length; i++) {
          const valMax = v[i] + udlEnv.vMax[i];
          const valMin = v[i] + udlEnv.vMin[i];
          if (valMax > shearEnv[i].max) shearEnv[i].max = valMax;
          if (valMin < shearEnv[i].min) shearEnv[i].min = valMin;
        }
        for (let i = 0; i < m.length; i++) {
          const valMMax = m[i] + udlEnv.mMax[i];
          const valMMin = m[i] + udlEnv.mMin[i];
          if (valMMax > momEnv[i].max) momEnv[i].max = valMMax;
          if (valMMin < momEnv[i].min) momEnv[i].min = valMMin;
          const valDMax = d[i] + udlEnv.dMax[i];
          const valDMin = d[i] + udlEnv.dMin[i];
          if (valDMax > defEnv[i].max) defEnv[i].max = valDMax;
          if (valDMin < defEnv[i].min) defEnv[i].min = valDMin;
        }
      }
    };

    runPass(activeAxles);
    const vbaRevAxles = activeAxles.map((_, i) => activeAxles[activeAxles.length - 1 - i]);
    for(let i=0; i<vbaRevAxles.length - 1; i++) vbaRevAxles[i].spacing = activeAxles[activeAxles.length - 2 - i].spacing;
    vbaRevAxles[vbaRevAxles.length-1].spacing = 0;
    runPass(vbaRevAxles);

    return { shear: shearEnv, moment: momEnv, deflection: defEnv, xNodes };
  }

  private solveUDLPatterns(w_udl: number, nTotalElems: number, nNodes: number, elemLens: number[], constrained: boolean[], K_Global: number[][], results: any, E_Pa: number, I: number) {
    const nPatterns = 1 << this.spans.length;
    const { nElemsPerSpan } = this.config;
    results.vMax.fill(-Infinity); results.vMin.fill(Infinity);
    results.mMax.fill(-Infinity); results.mMin.fill(Infinity);
    results.dMax.fill(-Infinity); results.dMin.fill(Infinity);

    for (let p = 0; p < nPatterns; p++) {
        const F_UDL = Array(constrained.length).fill(0);
        let elemCounter = 0;
        for (let s = 0; s < this.spans.length; s++) {
            const isLoaded = (p >> s) & 1;
            const le = this.spans[s].length / nElemsPerSpan;
            if (isLoaded) {
                 const Fy = -w_udl * le / 2 * 1000;
                 const Mom = -w_udl * le * le / 12 * 1000;
                 for(let e=0; e<nElemsPerSpan; e++) {
                   F_UDL[elemCounter * 2] += Fy;
                   F_UDL[elemCounter * 2 + 1] += Mom;
                   F_UDL[(elemCounter + 1) * 2] += Fy;
                   F_UDL[(elemCounter + 1) * 2 + 1] -= Mom;
                   elemCounter++;
                 }
            } else elemCounter += nElemsPerSpan;
        }
        const U_UDL = this.solveSystem(K_Global, F_UDL, constrained);
        const { v, m, d } = this.calculateForces(U_UDL, nTotalElems, elemLens, E_Pa, I);
        for(let i=0; i<v.length; i++) {
            results.vMax[i] = Math.max(results.vMax[i], v[i]);
            results.vMin[i] = Math.min(results.vMin[i], v[i]);
        }
        for(let i=0; i<m.length; i++) {
            results.mMax[i] = Math.max(results.mMax[i], m[i]);
            results.mMin[i] = Math.min(results.mMin[i], m[i]);
            results.dMax[i] = Math.max(results.dMax[i], d[i]);
            results.dMin[i] = Math.min(results.dMin[i], d[i]);
        }
    }
  }

  private applyPointLoad(F: number[], pos: number, mag: number, elemLens: number[], xNodes: number[]) {
    if (pos < 0 || pos > xNodes[xNodes.length - 1]) return;
    let elemIdx = -1;
    for(let i=0; i<elemLens.length; i++) {
        if (pos <= xNodes[i+1] + 0.000001) {
            elemIdx = i; break;
        }
    }
    if (elemIdx === -1) elemIdx = elemLens.length - 1;
    const le = elemLens[elemIdx];
    const localX = pos - xNodes[elemIdx];
    const xi = localX / le;
    const N1 = 1 - 3*xi*xi + 2*xi*xi*xi;
    const N2 = le * (xi - 2*xi*xi + xi*xi*xi);
    const N3 = 3*xi*xi - 2*xi*xi*xi;
    const N4 = le * (-(xi*xi) + xi*xi*xi);
    F[elemIdx * 2] -= mag * N1 * 1000;
    F[elemIdx * 2 + 1] -= mag * N2 * 1000;
    F[(elemIdx + 1) * 2] -= mag * N3 * 1000;
    F[(elemIdx + 1) * 2 + 1] -= mag * N4 * 1000;
  }

  private calculateForces(U: number[], nElems: number, elemLens: number[], E_Pa: number, I: number) {
    const v: number[] = [];
    const m: number[] = Array(nElems + 1).fill(0);
    const d: number[] = Array(nElems + 1).fill(0);
    const elemForces = [];
    for (let e = 0; e < nElems; e++) {
      const le = elemLens[e];
      const coeff = (E_Pa * I) / Math.pow(le, 3);
      const u_loc = [U[e*2], U[e*2+1], U[(e+1)*2], U[(e+1)*2+1]];
      const k_loc = [
        [12, 6*le, -12, 6*le],
        [6*le, 4*le*le, -6*le, 2*le*le],
        [-12, -6*le, 12, -6*le],
        [6*le, 2*le*le, -6*le, 4*le*le]
      ];
      const f_loc = [0,0,0,0];
      for(let r=0; r<4; r++) for(let c=0; c<4; c++) f_loc[r] += k_loc[r][c] * coeff * u_loc[c];
      elemForces.push(f_loc);
      v.push(f_loc[0] / 1000); v.push(-f_loc[2] / 1000);
    }
    for(let n=0; n <= nElems; n++) {
      d[n] = U[n*2];
      let valM = 0;
      if (n === 0) valM = elemForces[0][1];
      else if (n === nElems) valM = -elemForces[nElems-1][3];
      else valM = (-elemForces[n-1][3] + elemForces[n][1]) / 2;
      m[n] = -valM / 1000;
    }
    return { v, m, d };
  }
}

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

  useEffect(() => {
    if(containerRef.current) setWidth(containerRef.current.clientWidth);
    const handleResize = () => containerRef.current && setWidth(containerRef.current.clientWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
  
  const xTicks = calculateTicks(xMin, xMax, 8);
  const yTicks = calculateTicks(yMin, yMax, 6);
  const xScale = (val: number) => padding.left + ((val - xMin) / (xMax - xMin)) * (width - padding.left - padding.right);
  const yScale = (val: number) => height - padding.bottom - ((val - yMin) / (yMax - yMin)) * (height - padding.top - padding.bottom);

  const pathMax = maxVals.map((y: number, i: number) => `${i===0?'M':'L'} ${xScale(data[i].x)} ${yScale(y)}`).join(' ');
  const pathMin = minVals.map((y: number, i: number) => `${i===0?'M':'L'} ${xScale(data[i].x)} ${yScale(y)}`).join(' ');
  const pathFill = `${pathMax} L ${xScale(data[data.length-1].x)} ${yScale(minVals[minVals.length-1])} ` + 
                   minVals.slice().reverse().map((y: number, i: number) => `L ${xScale(data[data.length-1-i].x)} ${yScale(y)}`).join(' ') + " Z";

  const zeroY = yScale(0);

  return (
    <div ref={containerRef} className="w-full bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-800 p-8 mb-8">
      <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-6">{title}</h3>
      <svg width={width} height={height} className="overflow-visible">
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

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      try {
        const solver = new BeamFEM(spans, axles, config);
        setResults(solver.runAnalysis());
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
                    onChange={(e) => setConfig({ ...config, loadCase: e.target.value as 'truck' | 'lane' })} 
                    className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl px-4 py-4 text-xs font-bold text-white focus:border-sky-500 outline-none transition-all shadow-inner appearance-none cursor-pointer"
                  >
                    <option value="truck">CL-625 Truck Only (Impact DLA Included)</option>
                    <option value="lane">CL-625 Lane Load (80% Truck + 9 kN/m UDL)</option>
                  </select>
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
                <div className="bg-sky-950/20 border border-sky-500/20 p-5 rounded-2xl flex gap-4">
                  <AlertCircle className="w-5 h-5 text-sky-500 shrink-0" />
                  <p className="text-[10px] font-bold text-sky-400/80 leading-relaxed uppercase tracking-wide">
                    Mesh Refinement: {config.nElemsPerSpan} elements/span. Truck Movement Increment: {config.truckIncrement}m. Numerical accuracy depends on element density.
                  </p>
                </div>
              </div>
            </div>
             <div className="bg-slate-900 border border-slate-800 p-10 rounded-[2.5rem] shadow-2xl">
               <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] border-b border-slate-800 pb-4 mb-6">Standard Axle Profile (kN)</h3>
               <div className="flex flex-wrap gap-3">
                 {axles.map((axle, i) => (
                   <div key={axle.id} className="flex-1 bg-slate-950/50 border border-slate-800 rounded-2xl p-4 text-center shadow-inner group hover:border-sky-500/30 transition-all">
                     <div className="text-[8px] font-black text-slate-600 uppercase mb-1">Axle {i+1}</div>
                     <div className="font-mono text-lg text-sky-400 font-black tracking-tighter">{axle.load}</div>
                     {i < axles.length - 1 && <div className="text-[8px] font-black text-slate-700 mt-2 border-t border-slate-800 pt-2 group-hover:text-slate-500 transition-colors">↓ {axle.spacing}m</div>}
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
