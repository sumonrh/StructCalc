'use client';

import React, { useState, useEffect, useRef } from 'react';

/**
 * Engineering Utility Functions
 */
const Utils = {
  num: (v: any, name: string) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return n;
  },
  positive: (v: any, name: string, allowZero = false) => {
    const n = Utils.num(v, name);
    if (allowZero ? n < 0 : n <= 0) return 0;
    return n;
  },
  round: (v: number, d = 3) => {
    const p = Math.pow(10, d);
    return Math.round((v + Number.EPSILON) * p) / p;
  },
  rectangleJ: (a: number, b: number) => {
    let long = Math.max(a, b);
    let short = Math.min(a, b);
    if (short <= 0 || long <= 0) return 0;
    const ratio = short / long;
    return long * Math.pow(short, 3) * (1 / 3 - 0.21 * ratio * (1 - Math.pow(short, 4) / (12 * Math.pow(long, 4))));
  },
  rectProps: (x1: number, x2: number, y1: number, y2: number, label: string) => {
    const b = x2 - x1;
    const h = y2 - y1;
    if (b <= 0 || h <= 0) return { label, x1, x2, y1, y2, b: 0, h: 0, area: 0, cx: 0, cy: 0, IxLocal: 0, IyLocal: 0 };
    return { 
      label, x1, x2, y1, y2, b, h, 
      area: b * h, 
      cx: (x1 + x2) / 2, 
      cy: (y1 + y2) / 2,
      IxLocal: b * Math.pow(h, 3) / 12,
      IyLocal: h * Math.pow(b, 3) / 12
    };
  }
};

// --- Icons ---
const DownloadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
);
const SettingsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
);
const FileTextIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
);

// --- Sub-Components ---

function PrintRow({ label, val, unit }: any) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-gray-100 text-sm">
      <span className="text-gray-900 font-black uppercase text-[10px] tracking-widest">{label}</span>
      <span className="font-mono font-black text-black tracking-tighter">{val} <span className="font-sans font-normal text-[9px] text-gray-500 uppercase">{unit}</span></span>
    </div>
  );
}

function PrintMath({ label, eq, val, unit, fixed, scientific }: any) {
  const displayVal = scientific ? val.toExponential(2) : val.toLocaleString(undefined, { maximumFractionDigits: fixed !== undefined ? fixed : 2 });
  return (
    <div className="flex flex-col py-3 border-b border-gray-100 text-sm text-black font-bold">
      <div className="text-sky-900 font-black text-[9px] uppercase mb-1.5 tracking-widest">{label}</div>
      <div className="flex justify-between items-end">
        <span className="font-serif italic text-gray-700 text-[10px] font-bold bg-gray-50 px-2 rounded-md">{eq}</span>
        <span className="font-mono font-black text-black tracking-tighter">
          = {displayVal} <span className="font-sans font-normal text-[9px] text-gray-500 uppercase">{unit}</span>
        </span>
      </div>
    </div>
  );
}

function GirderSVG({ results, printMode = false }: any) {
  if (!results) return null;
  const { rects, totalDepth, yBar, bfTop, clearWebD, raw, type } = results;
  const minX = Math.min(...rects.map((r: any) => r.x1)) - 150;
  const maxX = Math.max(...rects.map((r: any) => r.x2)) + 150;
  const width = maxX - minX;
  const height = totalDepth + 250;
  const mainFill = printMode ? "rgb(241, 245, 249)" : "rgb(71 85 105)";
  const mainStroke = "#000000";
  const naColor = printMode ? "#1d4ed8" : "#22c55e";

  return (
    <svg viewBox={`${minX} -120 ${width} ${height}`} className={`w-full h-full ${printMode ? '' : 'drop-shadow-2xl'}`}>
      {rects.map((r: any, i: number) => (
        <rect key={i} x={r.x1} y={totalDepth - r.y2} width={r.b} height={r.h} fill={r.label.includes('Angle') ? (printMode ? '#cbd5e1' : '#334155') : mainFill} stroke={mainStroke} strokeWidth={printMode ? "3.5" : "1.5"} />
      ))}
      <line x1={minX} y1={totalDepth - yBar} x2={maxX} y2={totalDepth - yBar} stroke={naColor} strokeWidth="5" strokeDasharray="20,10" />
      <text x={maxX - 160} y={totalDepth - yBar - 20} fill={naColor} fontSize="82" fontWeight="black">N.A.</text>

      {printMode && (
        <g stroke="#000" strokeWidth="2.5" fill="#000" fontSize="82" fontWeight="black">
          <line x1={-bfTop/2} y1="-50" x2={bfTop/2} y2="-50" />
          <line x1={-bfTop/2} y1="-80" x2={-bfTop/2} y2="-20" />
          <line x1={bfTop/2} y1="-80" x2={bfTop/2} y2="-20" />
          <text x="0" y="-105" textAnchor="middle">bf = {(bfTop || 0).toFixed(0)}</text>
          
          <line x1={maxX - 80} y1={totalDepth - (totalDepth - clearWebD)/2} x2={maxX - 80} y2={(totalDepth - clearWebD)/2} />
          <line x1={maxX - 110} y1={totalDepth - (totalDepth - clearWebD)/2} x2={maxX - 50} y2={totalDepth - (totalDepth - clearWebD)/2} />
          <line x1={maxX - 110} y1={(totalDepth - clearWebD)/2} x2={maxX - 50} y2={(totalDepth - clearWebD)/2} />
          <text x={maxX + 100} y={totalDepth/2} textAnchor="middle" transform={`rotate(90, ${maxX + 100}, ${totalDepth/2})`}>hw = {(clearWebD || 0).toFixed(0)}</text>
          
          {type === 'box-girder' && (
            <React.Fragment>
              <line x1={-raw.boxWebSpacing/2} y1={totalDepth/2} x2={raw.boxWebSpacing/2} y2={totalDepth/2} strokeDasharray="15,10" strokeWidth="4" />
              <text x="0" y={totalDepth/2 + 115} textAnchor="middle">s = {raw.boxWebSpacing}</text>
            </React.Fragment>
          )}
        </g>
      )}
    </svg>
  );
}

function LocalInput({ label, unit, value, ...props }: any) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center px-1">
        <label className={`text-[9px] uppercase font-black tracking-widest ${props.disabled ? 'text-slate-700' : 'text-slate-500'}`}>{label}</label>
        {unit && <span className={`text-[8px] font-bold uppercase tracking-tighter ${props.disabled ? 'text-slate-700' : 'text-sky-500'}`}>{unit}</span>}
      </div>
      <input 
        {...props} 
        value={value !== undefined && value !== null ? value : ''}
        className={`border-2 rounded-2xl p-4 text-xs font-bold outline-none transition-all w-full shadow-inner ${props.disabled ? 'bg-slate-900 border-slate-800 text-slate-700 cursor-not-allowed' : 'bg-slate-950 border-slate-800 text-white focus:border-sky-500'}`} 
      />
    </div>
  );
}

function ResultRow({ label, value, unit, accent, subValue, subLabel }: any) {
  return (
    <div className={`flex flex-col py-3.5 px-6 rounded-2xl border-2 border-transparent transition-all ${accent ? 'bg-sky-500/10 border-sky-500/20 shadow-xl' : 'hover:bg-slate-800/30'}`}>
      <div className="flex justify-between items-center">
        <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{label}</span>
        <div className="flex items-baseline gap-2">
          <span className={`font-mono text-2xl font-black tracking-tighter ${accent ? 'text-sky-400' : 'text-slate-100'}`}>{value.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
          <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest">{unit}</span>
        </div>
      </div>
      {subValue !== undefined && (
        <div className="flex justify-end gap-2 mt-1 opacity-60">
           <span className="text-[9px] uppercase font-bold text-slate-500">{subLabel}:</span>
           <span className="text-[10px] font-mono font-bold text-slate-300">{subValue.toLocaleString(undefined, { maximumFractionDigits: 1 })} {unit}</span>
        </div>
      )}
    </div>
  );
}

function ParamRow({ label, value, unit }: any) {
  return (
    <div className="flex justify-between py-2.5 border-b border-slate-800/60 group text-slate-100">
      <span className="text-slate-600 group-hover:text-slate-400 transition-colors uppercase text-[9px] font-black">{label}</span>
      <span className="font-black tracking-tighter">{typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value} <span className="text-[9px] text-slate-600 uppercase font-normal">{unit}</span></span>
    </div>
  );
}

function StatCard({ label, value, unit, scientific, scientificD = 2, fixed }: any) {
  const displayValue = scientific ? value.toExponential(scientificD) : value.toLocaleString(undefined, { maximumFractionDigits: fixed !== undefined ? fixed : 0 });
  return (
    <div className="bg-slate-950/50 p-5 rounded-[1.75rem] border border-slate-800/80 hover:border-sky-500/30 transition-all shadow-inner group text-slate-100">
      <p className="text-[9px] text-slate-600 uppercase font-black tracking-[0.1em] mb-2 group-hover:text-sky-500 transition-colors">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono font-black text-sm text-slate-200 tracking-tighter">{displayValue}</span>
        <span className="text-[8px] text-slate-700 font-black uppercase">{unit}</span>
      </div>
    </div>
  );
}

export function SteelGirder() {
  const [activeTab, setActiveTab] = useState<'i-girder' | 'box-girder'>('box-girder');
  const [inputs, setInputs] = useState({
    bfTop: 355.6, tfTop: 63.5,
    bfBot: 355.6, tfBot: 63.5,
    webT: 12.7, clearWebD: 3352.8,
    fyMPa: 230, unbracedL: 6515,
    stiffenerA: 1308,
    iAnglesEnabled: "1", 
    topAngleH: 152.4, topAngleV: 203.2, topAngleT: 25.4,
    botAngleH: 152.4, botAngleV: 203.2, botAngleT: 25.4,
    fastenerSpacingI: 210,

    boxBfTop: 1016, boxTfTop: 46.7,
    boxBfBot: 1016, boxTfBot: 46.7,
    boxWebT: 12.7, boxClearWebD: 2026.6,
    boxFy: 230, boxL: 6515,
    boxStiffenerA: 1308,
    boxWebSpacing: 610,
    boxAnglesEnabled: "1", 
    boxAngleH: 203.2, boxAngleV: 152.4, boxAngleT: 25.4,
    fastenerSpacingBox: 640
  });

  const [results, setResults] = useState<any>(null);
  const [libLoaded, setLibLoaded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  
  useEffect(() => {
    const loadScript = (src: string) => {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')
    ]).then(() => {
      setLibLoaded(true);
    }).catch(err => console.error("Failed to load PDF libraries", err));
  }, []);

  useEffect(() => {
    try {
      const output = calculateAll(inputs, activeTab);
      setResults(output.res);
      setWarnings(output.logs);
    } catch (e) {
      console.error(e);
    }
  }, [inputs, activeTab]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setInputs(prev => ({ ...prev, [name]: value }));
  }

  function calculateAll(raw: any, type: string) {
    const logs: string[] = [];
    const bfTop = type === 'i-girder' ? Utils.positive(raw.bfTop, 'bf_top') : Utils.positive(raw.boxBfTop, 'bf_top');
    const tfTop = type === 'i-girder' ? Utils.positive(raw.tfTop, 'tf_top') : Utils.positive(raw.boxTfTop, 'tf_top');
    const bfBot = type === 'i-girder' ? Utils.positive(raw.bfBot, 'bf_bot') : Utils.positive(raw.boxBfBot, 'bf_bot');
    const tfBot = type === 'i-girder' ? Utils.positive(raw.tfBot, 'tf_bot') : Utils.positive(raw.boxTfBot, 'tf_bot');
    const webT = type === 'i-girder' ? Utils.positive(raw.webT, 'web_t') : Utils.positive(raw.boxWebT, 'web_t');
    const clearWebD = type === 'i-girder' ? Utils.positive(raw.clearWebD, 'web_hw') : Utils.positive(raw.boxClearWebD, 'web_hw');
    const fy = type === 'i-girder' ? Utils.positive(raw.fyMPa, 'Fy') : Utils.positive(raw.boxFy, 'Fy');
    const L = type === 'i-girder' ? Utils.positive(raw.unbracedL, 'L') : Utils.positive(raw.boxL, 'L');
    const stiffA = type === 'i-girder' ? Utils.positive(raw.stiffenerA, 'stiffA') : Utils.positive(raw.boxStiffenerA, 'stiffA');
    
    const Es = 200000, Gs = 77000, phiS = 0.95, omega2 = 1.0;
    const totalDepth = tfTop + clearWebD + tfBot;
    const rects: any[] = [];

    let fastenersActive = false;
    let sFast = webT;

    if (type === 'i-girder') {
      rects.push(Utils.rectProps(-bfTop/2, bfTop/2, tfBot + clearWebD, totalDepth, 'Top Flange'));
      rects.push(Utils.rectProps(-bfBot/2, bfBot/2, 0, tfBot, 'Bottom Flange'));
      rects.push(Utils.rectProps(-webT/2, webT/2, tfBot, tfBot + clearWebD, 'Web'));

      if (raw.iAnglesEnabled === "1") {
        fastenersActive = true;
        sFast = Utils.num(raw.fastenerSpacingI, 'fastenerSpacingI');
        const tAH = Utils.num(raw.topAngleH, 'topAH'), tAV = Utils.num(raw.topAngleV, 'topAV'), tAT = Utils.num(raw.topAngleT, 'topAT');
        const bAH = Utils.num(raw.botAngleH, 'botAH'), bAV = Utils.num(raw.botAngleV, 'botAV'), bAT = Utils.num(raw.botAngleT, 'botAT');

        if (sFast <= webT) logs.push("⚠️ I-Section: Fastener spacing must exceed web thickness.");
        if (sFast > webT + 2 * Math.min(tAH, bAH)) logs.push("⚠️ I-Section: Fasteners outside angle horizontal legs.");

        const yT = tfBot + clearWebD;
        rects.push(Utils.rectProps(-webT/2 - tAT, -webT/2, yT - tAV, yT, 'TL Angle Vert'));
        rects.push(Utils.rectProps(webT/2, webT/2 + tAT, yT - tAV, yT, 'TR Angle Vert'));
        rects.push(Utils.rectProps(-webT/2 - tAH, -webT/2 - tAT, yT - tAT, yT, 'TL Angle Horiz'));
        rects.push(Utils.rectProps(webT/2 + tAT, webT/2 + tAH, yT - tAT, yT, 'TR Angle Horiz'));

        const yB = tfBot;
        rects.push(Utils.rectProps(-webT/2 - bAT, -webT/2, yB, yB + bAV, 'BL Angle Vert'));
        rects.push(Utils.rectProps(webT/2, webT/2 + bAT, yB, yB + bAV, 'BR Angle Vert'));
        rects.push(Utils.rectProps(-webT/2 - bAH, -webT/2 - bAT, yB, yB + bAT, 'BL Angle Horiz'));
        rects.push(Utils.rectProps(webT/2 + bAT, webT/2 + bAH, yB, yB + bAT, 'BR Angle Horiz'));
      }
    } else {
      const boxS = Utils.positive(raw.boxWebSpacing, 'Web Spacing');
      const boxAH = Utils.num(raw.boxAngleH, 'boxAH'), boxAV = Utils.num(raw.boxAngleV, 'boxAV'), boxAT = Utils.num(raw.boxAngleT, 'boxAT');

      if ((boxS + webT) > bfTop) logs.push(`⚠️ Web footprint exceeds flange width.`);

      rects.push(Utils.rectProps(-bfTop/2, bfTop/2, tfBot + clearWebD, totalDepth, 'Top Flange Plate'));
      rects.push(Utils.rectProps(-bfBot/2, bfBot/2, 0, tfBot, 'Bottom Flange Plate'));
      rects.push(Utils.rectProps(-boxS/2 - webT/2, -boxS/2 + webT/2, tfBot, tfBot + clearWebD, 'Left Web'));
      rects.push(Utils.rectProps(boxS/2 - webT/2, boxS/2 + webT/2, tfBot, tfBot + clearWebD, 'Right Web'));

      if (raw.boxAnglesEnabled === "1") {
        fastenersActive = true;
        sFast = Utils.num(raw.fastenerSpacingBox, 'fastenerSpacingBox');
        const webOuterWidth = boxS + webT;
        if (sFast <= webOuterWidth) logs.push("⚠️ Box: Fasteners must clear outer face of side webs.");
        if (sFast > webOuterWidth + 2 * boxAH) logs.push("⚠️ Box: Fasteners fall off outward angle legs.");

        const yTopWeb = tfBot + clearWebD, yBotWeb = tfBot;
        const xLWebOuter = -boxS/2 - webT/2, xRWebOuter = boxS/2 + webT/2;

        rects.push(Utils.rectProps(xLWebOuter - boxAT, xLWebOuter, yTopWeb - boxAV, yTopWeb, 'TL Angle Vert'));
        rects.push(Utils.rectProps(xRWebOuter, xRWebOuter + boxAT, yTopWeb - boxAV, yTopWeb, 'TR Angle Vert'));
        rects.push(Utils.rectProps(xLWebOuter - boxAT, xLWebOuter, yBotWeb, yBotWeb + boxAV, 'BL Angle Vert'));
        rects.push(Utils.rectProps(xRWebOuter, xRWebOuter + boxAT, yBotWeb, yBotWeb + boxAV, 'BR Angle Vert'));
        rects.push(Utils.rectProps(xLWebOuter - boxAH, xLWebOuter - boxAT, yTopWeb - boxAT, yTopWeb, 'TL Angle Horiz'));
        rects.push(Utils.rectProps(xRWebOuter + boxAT, xRWebOuter + boxAH, yTopWeb - boxAT, yTopWeb, 'TR Angle Horiz'));
        rects.push(Utils.rectProps(xLWebOuter - boxAH, xLWebOuter - boxAT, yBotWeb, yBotWeb + boxAT, 'BL Angle Horiz'));
        rects.push(Utils.rectProps(xRWebOuter + boxAT, xRWebOuter + boxAH, yBotWeb, yBotWeb + boxAT, 'BR Angle Horiz'));
      } else {
        sFast = boxS - webT;
      }
    }

    const Area = rects.reduce((s, r) => s + r.area, 0);
    const xBar = rects.reduce((s, r) => s + r.area * r.cx, 0) / Area;
    const yBar = rects.reduce((s, r) => s + r.area * r.cy, 0) / Area;
    const Ix = rects.reduce((s, r) => s + r.IxLocal + r.area * Math.pow(r.cy - yBar, 2), 0);
    const Iy = rects.reduce((s, r) => s + r.IyLocal + r.area * Math.pow(r.cx - xBar, 2), 0);
    const J = rects.reduce((s, r) => s + Utils.rectangleJ(r.b, r.h), 0);
    const ho = clearWebD + (tfTop + tfBot)/2;
    const Cw = (Iy * Math.pow(ho, 2)) / 4;
    const SxTop = Ix / (totalDepth - yBar);
    const SxBot = Ix / yBar;
    const SxMin = Math.min(SxTop, SxBot);

    // --- RIGOROUS PNA SOLVER (STRIP INTEGRATION) ---
    const sortedYs = [...new Set(rects.flatMap(r => [r.y1, r.y2]))].sort((a, b) => a - b);
    let halfArea = Area / 2, accumulatedArea = 0, yPNA = 0;
    
    for (let i = 0; i < sortedYs.length - 1; i++) {
      const y1 = sortedYs[i];
      const y2 = sortedYs[i + 1];
      const h = y2 - y1;
      if (h <= 1e-9) continue;

      const activeRects = rects.filter(r => r.y1 <= y1 + 1e-9 && r.y2 >= y2 - 1e-9);
      const bTotal = activeRects.reduce((sum, r) => sum + r.b, 0);
      const stripArea = bTotal * h;

      if (accumulatedArea + stripArea >= halfArea - 1e-9) {
        yPNA = y1 + (halfArea - accumulatedArea) / bTotal;
        break;
      }
      accumulatedArea += stripArea;
    }

    const Zx = rects.reduce((s, r) => {
      const y1Rel = r.y1 - yPNA, y2Rel = r.y2 - yPNA;
      if (y1Rel >= 0) return s + r.area * (r.cy - yPNA);
      if (y2Rel <= 0) return s + r.area * (yPNA - r.cy);
      const hAbove = y2Rel, hBelow = -y1Rel;
      return s + (r.b * hAbove * (hAbove / 2) + r.b * hBelow * (hBelow / 2));
    }, 0);

    const sqrtFy = Math.sqrt(fy);
    const bMid = fastenersActive ? sFast : (type === 'box-girder' ? (raw.boxWebSpacing - webT) : webT);
    const slMid = bMid / tfTop;
    const limitMid1 = 420/sqrtFy, limitMid2 = 525/sqrtFy, limitMid3 = 670/sqrtFy;
    const midClass = slMid <= limitMid1 ? 1 : slMid <= limitMid2 ? 2 : slMid <= limitMid3 ? 3 : 4;

    const bOut = fastenersActive ? (bfTop - sFast)/2 : (type === 'box-girder' ? (bfTop - raw.boxWebSpacing - webT)/2 : (bfTop - webT)/2);
    const slOut = bOut / tfTop;
    const limitOut1 = 145/sqrtFy, limitOut2 = 170/sqrtFy, limitOut3 = 200/sqrtFy;
    const outClass = slOut <= limitOut1 ? 1 : slOut <= limitOut2 ? 2 : slOut <= limitOut3 ? 3 : 4;

    const slWeb = clearWebD / webT;
    const w1 = 1100/sqrtFy, w2 = 1700/sqrtFy, w3 = 1900/sqrtFy;
    const wClass = slWeb <= w1 ? 1 : slWeb <= w2 ? 2 : slWeb <= w3 ? 3 : 4;
    const gClass = Math.max(midClass, outClass, wClass);

    const Mp = Zx * fy;
    const My = SxMin * fy;
    const M_yield = gClass <= 2 ? Mp : My;

    let Mr = 0, Mu = 0, betaX = 0, B1 = 0, B2 = 0;

    if (type === 'i-girder') {
      const Iyt = (tfTop * Math.pow(bfTop, 3)) / 12, Iyb = (tfBot * Math.pow(bfBot, 3)) / 12;
      const dSC_top = ho * (Iyb / (Iyt + Iyb));
      const yo = (tfBot + clearWebD + tfTop/2 - dSC_top) - yBar;
      const integral = rects.reduce((s, r) => s + (r.area * (r.cy - yBar) * (Math.pow(r.cy - yBar, 2) + Math.pow(r.cx, 2) + r.h*r.h/12 + r.b*r.b/12)), 0);
      betaX = (integral / Ix) - (2 * yo);
      B1 = Math.PI * (betaX / (2 * L)) * Math.sqrt((Es * Iy) / (Gs * J));
      B2 = (Math.PI * Math.PI * Es * Cw) / (L * L * Gs * J);
      Mu = (omega2 * Math.PI / L) * Math.sqrt(Es * Iy * Gs * J) * (B1 + Math.sqrt(1 + B2 + B1*B1));
      
      if (Mu > 0.67 * M_yield) {
        Mr = 1.15 * phiS * M_yield * (1 - 0.28 * M_yield / Mu);
        Mr = Math.min(Mr, phiS * M_yield);
      } else {
        Mr = phiS * Mu;
      }
    } else {
      Mr = phiS * M_yield;
    }
    
    const nWebs = type === 'i-girder' ? 1 : 2, Aw = nWebs * clearWebD * webT;
    const kv = (stiffA/clearWebD) < 1 ? (4 + 5.34/Math.pow(stiffA/clearWebD, 2)) : (5.34 + 4/Math.pow(stiffA/clearWebD, 2));
    const Fcr = (clearWebD/webT <= 502*Math.sqrt(kv/fy)) ? 0.577*fy : (290*Math.sqrt(kv*fy))/(clearWebD/webT);
    const Ft = (clearWebD/webT > 502*Math.sqrt(kv/fy)) ? (0.577*fy - Fcr)/Math.sqrt(1 + Math.pow(stiffA/clearWebD, 2)) : 0;
    const Vr = phiS * Aw * (Fcr + Ft);

    return { res: {
      raw, type, rects, Area, Ix, Iy, J, Cw, Zx, SxTop, SxMin, yBar, yPNA, totalDepth, ho, Mu, Mr, gClass,
      Aw, Fcr, Ft, Vr, kv, fy, L, stiffA, slMid, slOut, midClass, outClass, slWeb, wClass, limitMid1, limitOut1, w1, sFast, fastenersActive, bfTop, clearWebD, webT,
      betaX, B1, B2, Mp, My, Es, Gs, omega2
    }, logs };
  }

  const downloadReport = async () => {
    if (!libLoaded || !results) return;
    setIsGenerating(true);
    setTimeout(async () => {
      try {
        const { jsPDF } = (window as any).jspdf;
        const html2canvas = (window as any).html2canvas;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pages = document.querySelectorAll('.pdf-page');
        for (let i = 0; i < pages.length; i++) {
          const canvas = await html2canvas(pages[i], { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
          if (i > 0) pdf.addPage();
          pdf.addImage(canvas.toDataURL('image/png', 1.0), 'PNG', 0, 0, 210, 297);
        }
        pdf.save(`${activeTab}_Compliance_Report.pdf`);
      } finally { setIsGenerating(false); }
    }, 100);
  };

  if (!results) return <div className="p-8 text-slate-400 text-center font-bold uppercase tracking-widest">Synchronizing structural engine...</div>;

  return (
    <div className="bg-slate-950 min-h-screen text-slate-100 font-sans overflow-x-hidden rounded-[3rem] p-4 md:p-8">
      
      {/* -------------------- HIDDEN PRINT REPORT -------------------- */}
      <div style={{ position: 'absolute', top: 0, left: '-9999px', width: '800px', pointerEvents: 'none' }}>
        
        <div className="pdf-page bg-white text-black relative p-[60px]" style={{ width: '800px', height: '1131px' }}>
          <h1 className="text-3xl font-black border-b-4 border-sky-900 pb-4 mb-8 text-center uppercase tracking-widest text-sky-900">
            {results.type === 'i-girder' ? 'I-Girder' : 'Box Girder'} Design Report
          </h1>
          <div className="flex gap-10 mb-12">
            <div className="w-1/2 text-black font-bold">
              <h2 className="text-lg font-black mb-4 border-b border-gray-300 pb-1 text-sky-800 uppercase tracking-tighter">1. Input Configuration</h2>
              <PrintRow label="Yield Strength (Fy)" val={results.fy} unit="MPa" />
              <PrintRow label="Flange bf x tf" val={`${results.bfTop} x ${results.raw.boxTfTop || results.raw.tfTop}`} unit="mm" />
              <PrintRow label="Web Depth (hw)" val={results.clearWebD} unit="mm" />
              {results.fastenersActive && <PrintRow label="Fastener spacing (s_fast)" val={results.sFast} unit="mm" />}
              <PrintRow label="Unbraced Length (L)" val={results.L} unit="mm" />
            </div>
            <div className="w-1/2 border-2 border-gray-100 p-6 rounded-2xl bg-gray-50 flex items-center justify-center text-black font-black">
              <div className="w-full h-80"><GirderSVG results={results} printMode={true} /></div>
            </div>
          </div>
        </div>

        <div className="pdf-page bg-white text-black relative p-[60px]" style={{ width: '800px', height: '1131px' }}>
          <h2 className="text-lg font-black mb-6 border-b border-gray-300 pb-1 text-sky-800 uppercase">2. Section Properties</h2>
          <div className="grid grid-cols-2 gap-x-12 gap-y-5 text-black font-bold">
            <PrintMath label="Total Area" eq="A = sum(b*t)" val={results.Area} unit="mm^2" />
            <PrintMath label="Plastic Neutral Axis" eq="y_pna" val={results.yPNA} unit="mm" />
            <PrintMath label="Elastic Neutral Axis" eq="y_bar" val={results.yBar} unit="mm" />
            <PrintMath label="Plastic Modulus" eq={"Zx"} val={results.Zx} scientific unit="mm^3" />
            <PrintMath label="Elastic Modulus" eq="Sx = Ix / y_max" val={results.SxMin} scientific unit="mm^3" />
            <PrintMath label="Major Inertia" eq={"Ix"} val={results.Ix} scientific unit="mm^4" />
          </div>
        </div>

        <div className="pdf-page bg-white text-black relative p-[60px]" style={{ width: '800px', height: '1131px' }}>
          <h2 className="text-lg font-black mb-6 border-b border-gray-300 pb-1 text-sky-800 uppercase">3. Slenderness Checks (S6-19 Cl. 10.10.3)</h2>
          <div className="bg-sky-50 p-8 rounded-2xl text-black font-bold border border-sky-200 mb-8">
            <div className="space-y-4">
              <div className="border-b border-sky-200 pb-2">
                <div className="text-[10px] uppercase text-sky-700 mb-1">Internal Flange (Two edges supported)</div>
                <div className="flex justify-between font-mono text-black"><span>b_mid / t_f = {results.slMid.toFixed(2)}</span><span>Limit (f1) = {results.limitMid1.toFixed(1)}</span></div>
              </div>
              <div className="border-b border-sky-200 pb-2">
                <div className="text-[10px] uppercase text-sky-700 mb-1">Outstand Flange (One edge supported)</div>
                <div className="flex justify-between font-mono text-black"><span>b_out / t_f = {results.slOut.toFixed(2)}</span><span>Limit (f1) = {results.limitOut1.toFixed(1)}</span></div>
              </div>
            </div>
            <div className="text-center text-xl mt-6 uppercase text-sky-900 font-black">Governing Class: {results.gClass}</div>
          </div>
        </div>

        <div className="pdf-page bg-white text-black relative p-[60px]" style={{ width: '800px', height: '1131px' }}>
          <h2 className="text-lg font-black mb-6 border-b border-gray-300 pb-1 text-sky-800 uppercase">4. Capacity Evaluation</h2>
          
          {results.type === 'i-girder' ? (
            <div className="mb-6 p-6 border-4 border-double border-sky-100 bg-sky-50 rounded-2xl text-sm font-black leading-relaxed">
              <div className="text-[11px] font-serif text-gray-800 mb-2 italic">LTB Calculation (Clause C10.10.2.3):</div>
              <PrintMath label="B1 parameter" eq="B1" val={results.B1} fixed={4} />
              <PrintMath label="B2 parameter" eq="B2" val={results.B2} fixed={4} />
              <PrintMath label="Critical Elastic LTB Moment" eq="Mu" val={results.Mu/1e6} unit="kN-m" />
            </div>
          ) : (
            <div className="mb-6 p-6 border-4 border-double border-sky-100 bg-sky-50 rounded-2xl text-sm font-black leading-relaxed">
              LTB ANALYSIS: Box Girders are classified as torsionally stiff members. Per CSA S6-19 Clause 10.10.2.2, Lateral Torsional Buckling is ignored.
            </div>
          )}

          <div className="grid grid-cols-2 gap-6 font-bold text-black text-center">
            <div className="p-6 bg-blue-50 border-l-8 border-blue-600 rounded-r-2xl shadow-sm">
              <div className="text-[10px] uppercase text-blue-800 mb-1">Moment (Mr)</div>
              <div className="text-xs text-gray-600 mb-2 italic">Mr = {results.gClass <= 2 ? "φ_s · Mp" : "φ_s · My"}</div>
              <div className="text-3xl text-blue-900">{(results.Mr/1e6).toFixed(1)} kN-m</div>
            </div>
            <div className="p-6 bg-green-50 border-l-8 border-green-600 rounded-r-2xl shadow-sm">
              <div className="text-[10px] uppercase text-green-800 mb-1">Shear (Vr)</div>
              <div className="text-3xl text-green-900">{(results.Vr/1e3).toFixed(1)} kN</div>
            </div>
          </div>
        </div>

        <div className="pdf-page bg-white text-black relative p-[60px]" style={{ width: '800px', height: '1131px' }}>
          <h2 className="text-lg font-black mb-8 border-b border-gray-300 pb-1 text-sky-800 uppercase tracking-tighter">5. Component Matrix</h2>
          <table className="w-full text-left border-collapse text-sm mb-12 rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <thead>
              <tr className="bg-sky-900 text-white font-black uppercase text-[10px] tracking-widest">
                <th className="py-4 px-4 text-left">Component Part</th>
                <th className="py-4 px-4 text-center">Dimensions (mm)</th>
                <th className="py-4 px-4 text-right">Area (mm²)</th>
              </tr>
            </thead>
            <tbody>
              {results.rects.map((r: any, i: number) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="py-3 px-4 border-b border-gray-100 text-gray-900 font-bold">{r.label}</td>
                  <td className="py-3 px-4 border-b border-gray-100 font-mono text-gray-800 text-center">{r.b.toFixed(1)} x {r.h.toFixed(1)}</td>
                  <td className="py-3 px-4 border-b border-gray-100 font-mono text-right text-sky-900 font-black">{r.area.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* -------------------- MAIN INTERFACE -------------------- */}
      <div className="max-w-6xl mx-auto relative z-10">
        <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Girder Designer</h1>
            <div className="flex gap-4 mt-4">
              <button onClick={() => setActiveTab('i-girder')} className={`px-8 py-2.5 rounded-2xl text-xs font-black transition-all border-2 uppercase tracking-widest ${activeTab === 'i-girder' ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-xl scale-105' : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-700'}`}>I-Section</button>
              <button onClick={() => setActiveTab('box-girder')} className={`px-8 py-2.5 rounded-2xl text-xs font-black transition-all border-2 uppercase tracking-widest ${activeTab === 'box-girder' ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-xl scale-105' : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-700'}`}>Box-Section</button>
            </div>
          </div>
          <button onClick={downloadReport} disabled={!libLoaded || isGenerating} className="bg-sky-500 text-slate-950 font-black px-10 py-5 rounded-3xl flex items-center gap-4 transition-all shadow-2xl uppercase tracking-tighter text-lg active:scale-95">
            {isGenerating ? 'Generating...' : <React.Fragment><DownloadIcon /> Download Report</React.Fragment>}
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4 space-y-8">
            <section className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 shadow-2xl sticky top-8">
              <h2 className="text-xl font-black mb-8 border-b border-slate-800 pb-4 flex items-center gap-4 text-white uppercase tracking-tighter"><SettingsIcon /> Parameters</h2>
              
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                <LocalInput label="bf_top" unit="mm" name={activeTab === 'i-girder' ? "bfTop" : "boxBfTop"} value={activeTab === 'i-girder' ? inputs.bfTop : inputs.boxBfTop} onChange={handleInputChange} />
                <LocalInput label="tf_top" unit="mm" name={activeTab === 'i-girder' ? "tfTop" : "boxTfTop"} value={activeTab === 'i-girder' ? inputs.tfTop : inputs.boxTfTop} onChange={handleInputChange} />
                <LocalInput label="bf_bot" unit="mm" name={activeTab === 'i-girder' ? "bfBot" : "boxBfBot"} value={activeTab === 'i-girder' ? inputs.bfBot : inputs.boxBfBot} onChange={handleInputChange} />
                <LocalInput label="tf_bot" unit="mm" name={activeTab === 'i-girder' ? "tfBot" : "boxTfBot"} value={activeTab === 'i-girder' ? inputs.tfBot : inputs.boxTfBot} onChange={handleInputChange} />
                <LocalInput label="tw (web)" unit="mm" name={activeTab === 'i-girder' ? "webT" : "boxWebT"} value={activeTab === 'i-girder' ? inputs.webT : inputs.boxWebT} onChange={handleInputChange} />
                <LocalInput label="hw (web)" unit="mm" name={activeTab === 'i-girder' ? "clearWebD" : "boxClearWebD"} value={activeTab === 'i-girder' ? inputs.clearWebD : inputs.boxClearWebD} onChange={handleInputChange} />
                <LocalInput label="Fy" unit="MPa" name={activeTab === 'i-girder' ? "fyMPa" : "boxFy"} value={activeTab === 'i-girder' ? inputs.fyMPa : inputs.boxFy} onChange={handleInputChange} />
                <LocalInput label="Stiffener Pitch (a)" unit="mm" name={activeTab === 'i-girder' ? "stiffenerA" : "boxStiffenerA"} value={activeTab === 'i-girder' ? inputs.stiffenerA : inputs.boxStiffenerA} onChange={handleInputChange} />
                {activeTab === 'box-girder' && <LocalInput label="Web C-C Spacing" unit="mm" name="boxWebSpacing" value={inputs.boxWebSpacing} onChange={handleInputChange} />}
              </div>
              
              <h3 className="text-sky-400 font-black mt-10 mb-5 text-[10px] tracking-[0.2em] uppercase opacity-70 border-b border-sky-900 pb-2">Fasteners</h3>
              <LocalInput label="Line Spacing (s_fast)" unit="mm" name={activeTab === 'i-girder' ? "fastenerSpacingI" : "fastenerSpacingBox"} value={activeTab === 'i-girder' ? inputs.fastenerSpacingI : inputs.fastenerSpacingBox} onChange={handleInputChange} disabled={(activeTab === 'i-girder' && inputs.iAnglesEnabled === "0") || (activeTab === 'box-girder' && inputs.boxAnglesEnabled === "0")} />

              {warnings.length > 0 && (
                <div className="mt-8 bg-amber-950/20 border border-amber-500/50 p-4 rounded-2xl shadow-inner uppercase tracking-widest text-[9px] font-black text-amber-500">
                  {warnings.map((w, idx) => <p key={idx} className="mb-1 leading-tight">{w}</p>)}
                </div>
              )}

              <h3 className="text-sky-400 font-black mt-10 mb-5 text-[10px] tracking-[0.2em] uppercase opacity-70 border-b border-sky-900 pb-2 flex justify-between items-center text-white">
                <span>Angles Configuration</span>
                <select name={activeTab === 'i-girder' ? "iAnglesEnabled" : "boxAnglesEnabled"} value={activeTab === 'i-girder' ? inputs.iAnglesEnabled : inputs.boxAnglesEnabled} onChange={handleInputChange} className="bg-slate-950 text-white text-[10px] p-1 rounded border border-slate-800">
                  <option value="1">Enabled</option>
                  <option value="0">Disabled</option>
                </select>
              </h3>

              {activeTab === 'i-girder' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <LocalInput label="Top Hor" unit="mm" name="topAngleH" value={inputs.topAngleH} onChange={handleInputChange} disabled={inputs.iAnglesEnabled === "0"} />
                    <LocalInput label="Top Ver" unit="mm" name="topAngleV" value={inputs.topAngleV} onChange={handleInputChange} disabled={inputs.iAnglesEnabled === "0"} />
                    <LocalInput label="Top Thk" unit="mm" name="topAngleT" value={inputs.topAngleT} onChange={handleInputChange} disabled={inputs.iAnglesEnabled === "0"} />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <LocalInput label="Bot Hor" unit="mm" name="botAngleH" value={inputs.botAngleH} onChange={handleInputChange} disabled={inputs.iAnglesEnabled === "0"} />
                    <LocalInput label="Bot Ver" unit="mm" name="botAngleV" value={inputs.botAngleV} onChange={handleInputChange} disabled={inputs.iAnglesEnabled === "0"} />
                    <LocalInput label="Bot Thk" unit="mm" name="botAngleT" value={inputs.botAngleT} onChange={handleInputChange} disabled={inputs.iAnglesEnabled === "0"} />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <LocalInput label="H-Leg" unit="mm" name="boxAngleH" value={inputs.boxAngleH} onChange={handleInputChange} disabled={inputs.boxAnglesEnabled === "0"} />
                  <LocalInput label="V-Leg" unit="mm" name="boxAngleV" value={inputs.boxAngleV} onChange={handleInputChange} disabled={inputs.boxAnglesEnabled === "0"} />
                  <LocalInput label="Thk" unit="mm" name="boxAngleT" value={inputs.boxAngleT} onChange={handleInputChange} disabled={inputs.boxAnglesEnabled === "0"} />
                </div>
              )}
            </section>
          </div>

          <div className="lg:col-span-8 space-y-8">
            <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-12 shadow-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-12">
                <div className="bg-black rounded-3xl border border-slate-800 p-8 flex flex-col items-center justify-center aspect-square shadow-inner relative overflow-hidden"><GirderSVG results={results} /></div>
                <div className="flex flex-col justify-between">
                  <div className="space-y-5">
                    <h2 className="text-2xl font-black border-b-2 border-slate-800 pb-4 text-white uppercase tracking-tight">Capacities</h2>
                    <ResultRow label="Mr (Design Moment)" value={results.Mr / 1e6} unit="kN·m" accent />
                    <div className="h-px bg-slate-800 my-4" />
                    <ResultRow label="Mp (Plastic Cap)" value={results.Mp / 1e6} unit="kN·m" />
                    <ResultRow label="My (Elastic Cap)" value={results.My / 1e6} unit="kN·m" />
                    <div className="h-px bg-slate-800 my-4" />
                    <ResultRow label="Vr (Design Shear)" value={results.Vr / 1e3} unit="kN" accent />
                  </div>
                  <div className="mt-12 bg-emerald-950/30 text-emerald-400 border border-emerald-500/20 px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest text-center shadow-lg uppercase">CSA S6 Class {results.gClass}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <StatCard label="Plastic Zx" value={results.Zx} unit="mm³" scientific />
                <StatCard label="Elastic Sx" value={results.SxMin} unit="mm³" scientific />
                <StatCard label="Inertia Ix" value={results.Ix} unit="mm⁴" scientific />
                <StatCard label="Total Area" value={results.Area} unit="mm²" />
              </div>
            </div>
            
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 shadow-2xl">
              <h2 className="text-xl font-black mb-8 flex items-center gap-4 uppercase text-white tracking-tighter"><FileTextIcon /> Analysis Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-8 text-[12px] font-mono mb-12 text-slate-300 font-bold">
                 <div className="space-y-4">
                   <h3 className="text-sky-400 font-black border-b border-slate-800 pb-3 uppercase tracking-widest text-[10px]">Classification Check</h3>
                   <ParamRow label="Mid-Part b/t" value={results.slMid} unit={results.slMid <= results.limitMid1 ? "(C1)" : "(C3+)"} />
                   <ParamRow label="Outstand b/t" value={results.slOut} unit={results.slOut <= results.limitOut1 ? "(C1)" : "(C3+)"} />
                 </div>
                 <div className="space-y-4">
                   <h3 className="text-sky-400 font-black border-b border-slate-800 pb-3 uppercase tracking-widest text-[10px]">Shear Strength</h3>
                   <ParamRow label="Aw (Shear Area)" value={results.Aw} unit="mm^2" />
                   <ParamRow label="Vr (Factored)" value={results.Vr/1e3} unit="kN" />
                 </div>
              </div>
              <h3 className="text-sky-400 font-black border-b border-slate-800 pb-3 uppercase tracking-widest text-[10px] mb-6">Component Matrix</h3>
              <div className="overflow-x-auto rounded-3xl border-2 border-slate-800 shadow-inner">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead><tr className="bg-slate-950 text-slate-500 font-black uppercase tracking-widest"><th className="py-4 px-6 text-left">Part</th><th className="py-4 px-6 text-center">Dimensions (mm)</th><th className="py-4 px-6 text-right">Area (mm²)</th></tr></thead>
                  <tbody>{results.rects.map((r: any, i: number) => (<tr key={i} className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-all font-bold"><td className="py-4 px-6 text-slate-200">{r.label}</td><td className="py-4 px-6 text-slate-400 text-center font-mono">{r.b.toFixed(1)} x {r.h.toFixed(1)}</td><td className="py-4 px-6 text-right text-sky-400 font-black font-mono">{r.area.toLocaleString()}</td></tr>))}</tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
