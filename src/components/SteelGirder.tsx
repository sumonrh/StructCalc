'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Settings, FileText, Download, LayoutPanelTop } from 'lucide-react';

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
    if (b <= 0 || h <= 0) {
        // Return a dummy object if dimensions are invalid to prevent crash
        return { label, x1, x2, y1, y2, b: 0, h: 0, area: 0, cx: 0, cy: 0, IxLocal: 0, IyLocal: 0 };
    }
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

export function SteelGirder() {
  const [activeTab, setActiveTab] = useState<'i-girder' | 'box-girder'>('i-girder');
  const [inputs, setInputs] = useState({
    // I-Girder Defaults
    bfTop: 355.6, tfTop: 63.5,
    bfBot: 355.6, tfBot: 63.5,
    webT: 12.7, clearWebD: 3352.8,
    fyMPa: 230, unbracedL: 6515,
    stiffenerA: 1308,
    topAnglesEnabled: "1", topAngleH: 152.4, topAngleV: 203.2, topAngleT: 25.4,
    botAnglesEnabled: "1", botAngleH: 152.4, botAngleV: 203.2, botAngleT: 25.4,
    // Box Girder Defaults
    boxBfTop: 1016, boxTfTop: 36.6,
    boxBfBot: 1016, boxTfBot: 36.6,
    boxWebT: 12.7, boxClearWebD: 2051,
    boxFy: 230, boxL: 6515,
    boxStiffenerA: 1308,
    boxWebSpacing: 610,
    boxAngleH: 203.2, boxAngleV: 152.4, boxAngleT: 25.4
  });

  const [results, setResults] = useState<any>(null);
  const [libLoaded, setLibLoaded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
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
      const res = calculateAll(inputs, activeTab);
      setResults(res);
    } catch (e) {
      console.error("Calculation error in SteelGirder", e);
    }
  }, [inputs, activeTab]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setInputs(prev => ({ ...prev, [name]: value }));
  }

  function calculateAll(raw: any, type: string) {
    const bfTop = type === 'i-girder' ? Utils.positive(raw.bfTop, 'Top Width') : Utils.positive(raw.boxBfTop, 'Top Width');
    const tfTop = type === 'i-girder' ? Utils.positive(raw.tfTop, 'Top Thick') : Utils.positive(raw.boxTfTop, 'Top Thick');
    const bfBot = type === 'i-girder' ? Utils.positive(raw.bfBot, 'Bot Width') : Utils.positive(raw.boxBfBot, 'Bot Width');
    const tfBot = type === 'i-girder' ? Utils.positive(raw.tfBot, 'Bot Thick') : Utils.positive(raw.boxTfBot, 'Bot Thick');
    const webT = type === 'i-girder' ? Utils.positive(raw.webT, 'Web Thick') : Utils.positive(raw.boxWebT, 'Web Thick');
    const clearWebD = type === 'i-girder' ? Utils.positive(raw.clearWebD, 'Web Height') : Utils.positive(raw.boxClearWebD, 'Web Height');
    const fy = type === 'i-girder' ? Utils.positive(raw.fyMPa, 'Fy') : Utils.positive(raw.boxFy, 'Fy');
    const L = type === 'i-girder' ? Utils.positive(raw.unbracedL, 'L') : Utils.positive(raw.boxL, 'L');
    const stiffA = type === 'i-girder' ? Utils.positive(raw.stiffenerA, 'Stiffener Spacing') : Utils.positive(raw.boxStiffenerA, 'Stiffener Spacing');
    
    const Es = 200000, Gs = 77000, phiS = 0.95, omega2 = 1.0;
    const totalDepth = tfTop + clearWebD + tfBot;
    const rects: any[] = [];

    if (type === 'i-girder') {
      rects.push(Utils.rectProps(-bfTop/2, bfTop/2, tfBot + clearWebD, totalDepth, 'Top Flange'));
      rects.push(Utils.rectProps(-bfBot/2, bfBot/2, 0, tfBot, 'Bottom Flange'));
      rects.push(Utils.rectProps(-webT/2, webT/2, tfBot, tfBot + clearWebD, 'Web'));

      if (raw.topAnglesEnabled === "1") {
        const yT = tfBot + clearWebD;
        const tAH = Utils.num(raw.topAngleH, 'topAngleH'), tAV = Utils.num(raw.topAngleV, 'topAngleV'), tAT = Utils.num(raw.topAngleT, 'topAngleT');
        if (tAV > tAT && tAT > 0) {
            rects.push(Utils.rectProps(-webT/2 - tAT, -webT/2, yT - tAV, yT, 'TL Angle Vert'));
            rects.push(Utils.rectProps(webT/2, webT/2 + tAT, yT - tAV, yT, 'TR Angle Vert'));
        }
        if (tAH > tAT && tAT > 0) {
            rects.push(Utils.rectProps(-webT/2 - tAH, -webT/2 - tAT, yT - tAT, yT, 'TL Angle Horiz'));
            rects.push(Utils.rectProps(webT/2 + tAT, webT/2 + tAH, yT - tAT, yT, 'TR Angle Horiz'));
        }
      }
      if (raw.botAnglesEnabled === "1") {
        const yB = tfBot;
        const bAH = Utils.num(raw.botAngleH, 'botAngleH'), bAV = Utils.num(raw.botAngleV, 'botAngleV'), bAT = Utils.num(raw.botAngleT, 'botAngleT');
        if (bAV > bAT && bAT > 0) {
            rects.push(Utils.rectProps(-webT/2 - bAT, -webT/2, yB, yB + bAV, 'BL Angle Vert'));
            rects.push(Utils.rectProps(webT/2, webT/2 + bAT, yB, yB + bAV, 'BR Angle Vert'));
        }
        if (bAH > bAT && bAT > 0) {
            rects.push(Utils.rectProps(-webT/2 - bAH, -webT/2 - bAT, yB, yB + bAT, 'BL Angle Horiz'));
            rects.push(Utils.rectProps(webT/2 + bAT, webT/2 + bAH, yB, yB + bAT, 'BR Angle Horiz'));
        }
      }
    } else {
      const sWeb = Utils.positive(raw.boxWebSpacing, 'Web Spacing');
      const aH = Utils.num(raw.boxAngleH, 'boxAngleH');
      const aV = Utils.num(raw.boxAngleV, 'boxAngleV');
      const aT = Utils.num(raw.boxAngleT, 'boxAngleT');

      rects.push(Utils.rectProps(-bfTop/2, bfTop/2, tfBot + clearWebD, totalDepth, 'Top Flange Plate'));
      rects.push(Utils.rectProps(-bfBot/2, bfBot/2, 0, tfBot, 'Bottom Flange Plate'));
      rects.push(Utils.rectProps(-sWeb/2 - webT/2, -sWeb/2 + webT/2, tfBot, tfBot + clearWebD, 'Left Web'));
      rects.push(Utils.rectProps(sWeb/2 - webT/2, sWeb/2 + webT/2, tfBot, tfBot + clearWebD, 'Right Web'));

      const yTopWeb = tfBot + clearWebD;
      const yBotWeb = tfBot;
      const xLWebOuter = -sWeb/2 - webT/2;
      const xRWebOuter = sWeb/2 + webT/2;

      if (aV > aT && aT > 0) {
          rects.push(Utils.rectProps(xLWebOuter - aT, xLWebOuter, yTopWeb - aV, yTopWeb, 'TL Angle Vert'));
          rects.push(Utils.rectProps(xRWebOuter, xRWebOuter + aT, yTopWeb - aV, yTopWeb, 'TR Angle Vert'));
          rects.push(Utils.rectProps(xLWebOuter - aT, xLWebOuter, yBotWeb, yBotWeb + aV, 'BL Angle Vert'));
          rects.push(Utils.rectProps(xRWebOuter, xRWebOuter + aT, yBotWeb, yBotWeb + aV, 'BR Angle Vert'));
      }
      if (aH > aT && aT > 0) {
          rects.push(Utils.rectProps(xLWebOuter - aH, xLWebOuter - aT, yTopWeb - aT, yTopWeb, 'TL Angle Horiz'));
          rects.push(Utils.rectProps(xRWebOuter + aT, xRWebOuter + aH, yTopWeb - aT, yTopWeb, 'TR Angle Horiz'));
          rects.push(Utils.rectProps(xLWebOuter - aH, xLWebOuter - aT, yBotWeb, yBotWeb + aT, 'BL Angle Horiz'));
          rects.push(Utils.rectProps(xRWebOuter + aT, xRWebOuter + aH, yBotWeb, yBotWeb + aT, 'BR Angle Horiz'));
      }
    }

    const validRects = rects.filter(r => r.area > 0);
    const Area = validRects.reduce((s, r) => s + r.area, 0);
    const yBar = Area > 0 ? validRects.reduce((s, r) => s + r.area * r.cy, 0) / Area : totalDepth / 2;
    const Ix = validRects.reduce((s, r) => s + r.IxLocal + r.area * Math.pow(r.cy - yBar, 2), 0);
    const Iy = validRects.reduce((s, r) => s + r.IyLocal + r.area * Math.pow(r.cx, 2), 0);
    const J = validRects.reduce((s, r) => s + Utils.rectangleJ(r.b, r.h), 0);
    const ho = clearWebD + (tfTop + tfBot)/2;
    const Cw = (Iy * Math.pow(ho, 2)) / 4;
    const SxTop = Ix / Math.max(1, (totalDepth - yBar));
    const SxBot = Ix / Math.max(1, yBar);
    const SxMin = Math.min(SxTop, SxBot);
    const maxX = validRects.reduce((max, r) => Math.max(max, Math.abs(r.x1), Math.abs(r.x2)), 0);
    const Sy = Iy / Math.max(1, maxX);

    const Zx = validRects.reduce((s, r) => {
      const y1 = r.y1 - yBar, y2 = r.y2 - yBar;
      if (y1 >= 0) return s + r.area * (r.cy - yBar);
      if (y2 <= 0) return s + r.area * (yBar - r.cy);
      const aAbove = (r.x2 - r.x1) * y2, aBelow = (r.x2 - r.x1) * (-y1);
      return s + (aAbove * y2/2 + aBelow * (-y1)/2);
    }, 0);

    const Iyt = (tfTop * Math.pow(bfTop, 3)) / 12;
    const Iyb = (tfBot * Math.pow(bfBot, 3)) / 12;
    const dSC_top = ho * (Iyb / Math.max(1, (Iyt + Iyb)));
    const yo = (tfBot + clearWebD + tfTop/2 - dSC_top) - yBar;
    const integral = validRects.reduce((s, r) => s + (r.area * (r.cy - yBar) * (Math.pow(r.cy - yBar, 2) + Math.pow(r.cx, 2) + r.h*r.h/12 + r.b*r.b/12)), 0);
    const betaX = (integral / Math.max(1, Ix)) - (2 * yo);
    const B1 = Math.PI * (betaX / (2 * Math.max(1, L))) * Math.sqrt((Es * Iy) / Math.max(1, (Gs * J)));
    const B2 = (Math.PI * Math.PI * Es * Cw) / (Math.max(1, L * L) * Math.max(1, Gs * J));
    const Mu = (omega2 * Math.PI / Math.max(1, L)) * Math.sqrt(Es * Iy * Gs * J) * (B1 + Math.sqrt(Math.max(0, 1 + B2 + B1*B1)));

    const sqrtFy = Math.sqrt(fy);
    let slFlange, f1, f2, f3;
    if (type === 'i-girder') {
      slFlange = ((bfTop - webT)/2 / Math.max(1, tfTop));
      f1 = 145/sqrtFy; f2 = 170/sqrtFy; f3 = 200/sqrtFy;
    } else {
      const bClear = Utils.num(raw.boxWebSpacing, 'boxWebSpacing') - webT;
      slFlange = bClear / Math.max(1, tfTop);
      f1 = 420/sqrtFy; f2 = 525/sqrtFy; f3 = 670/sqrtFy;
    }
    
    const slWeb = clearWebD / Math.max(1, webT);
    const w1 = 1100/sqrtFy, w2 = 1700/sqrtFy, w3 = 1900/sqrtFy;
    const fClass = slFlange <= f1 ? 1 : slFlange <= f2 ? 2 : slFlange <= f3 ? 3 : 4;
    const wClass = slWeb <= w1 ? 1 : slWeb <= w2 ? 2 : slWeb <= w3 ? 3 : 4;
    const gClass = Math.max(fClass, wClass);

    const Mp = Zx * fy, My = SxMin * fy;
    let Mr;
    if (type === 'i-girder') {
      const Mbase = gClass <= 2 ? Mp : My;
      Mr = (Mu > 0.67 * Mbase) ? 1.15 * phiS * Mbase * (1 - 0.28 * (Mbase / Mu)) : phiS * Mu;
      Mr = Math.min(Mr, phiS * Mbase);
    } else {
      Mr = (gClass <= 2) ? (phiS * Mp) : (phiS * My);
    }

    const nWebs = type === 'i-girder' ? 1 : 2;
    const Aw = nWebs * clearWebD * webT;
    const h_over_w = clearWebD / Math.max(1, webT);
    const a_over_h = stiffA / Math.max(1, clearWebD);
    let kv = a_over_h < 1 ? (4 + 5.34/Math.pow(Math.max(0.1, a_over_h), 2)) : (5.34 + 4/Math.pow(Math.max(0.1, a_over_h), 2));
    const limit1 = 502 * Math.sqrt(kv / fy), limit2 = 621 * Math.sqrt(kv / fy);
    let Fcr, Ft = 0;
    if (h_over_w <= limit1) Fcr = 0.577 * fy;
    else if (h_over_w <= limit2) Fcr = (290 * Math.sqrt(kv * fy)) / Math.max(1, h_over_w);
    else Fcr = (180000 * kv) / Math.pow(Math.max(1, h_over_w), 2);
    if (h_over_w > limit1) Ft = (0.577 * fy - Fcr) / Math.sqrt(1 + Math.pow(a_over_h, 2));
    const Fs = Fcr + Ft; 
    const Vr = phiS * Aw * Fs;

    return {
      raw, type, rects: validRects, Area, Ix, Iy, J, Cw, Zx, SxTop, SxBot, Sy, yBar, totalDepth, ho, betaX, yo, B1, B2, Mu, Mr, gClass,
      Aw, Fcr, Ft, Fs, Vr, kv, fy, L, h_over_w, stiffA, a_over_h, limit1, limit2, phiS, SxMin, My, Mp, Es, Gs, omega2,
      slFlange, slWeb, fClass, wClass, f1, f2, f3, w1, w2, w3, bfTop, clearWebD, webT
    };
  }

  const downloadReport = async () => {
    if (!libLoaded || !results) return;
    setIsGenerating(true);
    
    setTimeout(async () => {
      try {
        const { jsPDF } = (window as any).jspdf;
        const html2canvas = (window as any).html2canvas;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        const pages = document.querySelectorAll('.pdf-page');

        for (let i = 0; i < pages.length; i++) {
          const canvas = await html2canvas(pages[i], { 
            scale: 2, 
            useCORS: true, 
            backgroundColor: '#ffffff', 
            logging: false,
            width: 800,
            height: 1131
          });
          const imgData = canvas.toDataURL('image/png', 1.0);
          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        }
        pdf.save(`${activeTab}_Design_Report.pdf`);
      } catch (e) {
        console.error("PDF Generation failed", e);
      } finally {
        setIsGenerating(false);
      }
    }, 500);
  };

  if (!results) return <div className="p-8 text-slate-400">Loading engineering model...</div>;

  return (
    <div className="bg-slate-950 text-slate-100 font-sans overflow-x-hidden rounded-[3rem]">
      
      <div style={{ position: 'fixed', top: 0, left: '-2000px', zIndex: -100, pointerEvents: 'none' }}>
        <div className="pdf-page bg-white text-black" style={{ width: '800px', height: '1131px', padding: '60px', boxSizing: 'border-box' }}>
          <h1 className="text-3xl font-black border-b-4 border-sky-900 pb-4 mb-8 text-center uppercase tracking-widest text-sky-900">
            {results.type === 'i-girder' ? 'I-Girder' : 'Box Girder'} Design Report
            <div className="text-sm font-normal tracking-normal mt-2 text-gray-600 italic">CSA S6-19 Compliance Calculation</div>
          </h1>
          <div className="flex gap-10 mb-12">
            <div className="w-1/2">
              <h2 className="text-lg font-black mb-4 border-b border-gray-300 pb-1 text-sky-800 uppercase tracking-tighter">1. Input Configuration</h2>
              <PrintRow label="Steel Yield Stress (Fy)" val={results.fy} unit="MPa" />
              <PrintRow label="Elastic Modulus (E)" val={results.Es.toLocaleString()} unit="MPa" />
              <PrintRow label="Flange Dimensions" val={`${results.bfTop} x ${results.raw.boxTfTop || results.raw.tfTop}`} unit="mm" />
              <PrintRow label="Web Depth (hw)" val={results.clearWebD} unit="mm" />
              <PrintRow label="Web Thickness (tw)" val={results.webT} unit="mm" />
              <PrintRow label="Unbraced Segment (L)" val={results.L} unit="mm" />
              <PrintRow label="Stiffener Pitch (a)" val={results.stiffA} unit="mm" />
            </div>
            <div className="w-1/2 border-2 border-gray-100 p-6 rounded-2xl bg-gray-50 flex items-center justify-center">
              <div className="w-full h-80"><GirderSVG results={results} printMode={true} /></div>
            </div>
          </div>
          <h2 className="text-lg font-black mb-6 border-b border-gray-300 pb-1 text-sky-800 uppercase tracking-tighter">2. Section Properties</h2>
          <div className="grid grid-cols-2 gap-x-12 gap-y-5">
            <PrintMath label="Total Area" eq="A = sum(b*t)" val={results.Area} unit="mm^2" />
            <PrintMath label="Neutral Axis" eq="y_bar = sum(A_i*y_i) / A" val={results.yBar} unit="mm" />
            <PrintMath label="Major Inertia" eq={"Ix = sum(Ix,loc + A_i * dy^2)"} val={results.Ix} scientific unit="mm^4" />
            <PrintMath label="Minor Inertia" eq={"Iy = sum(Iy,loc + A_i * dx^2)"} val={results.Iy} scientific unit="mm^4" />
            <PrintMath label="Plastic Modulus" eq={"Zx = sum(A_i * |y_i - y_bar|)"} val={results.Zx} scientific unit="mm^3" />
            <PrintMath label="Elastic Modulus" eq="Sx = Ix / y_max" val={results.SxTop} scientific unit="mm^3" />
            <PrintMath label="Torsional Constant" eq={"J = sum(1/3 * b * t^3)"} val={results.J} scientific unit="mm^4" />
            <PrintMath label="Warping Constant" eq="Cw = Iy*ho^2/4" val={results.Cw} scientific unit="mm^6" />
          </div>
        </div>

        <div className="pdf-page bg-white text-black" style={{ width: '800px', height: '1131px', padding: '60px', boxSizing: 'border-box' }}>
          <h2 className="text-lg font-black mb-6 border-b border-gray-300 pb-1 text-sky-800 uppercase tracking-tighter">3. Capacity Evaluation</h2>
          <div className="space-y-8">
            <div className="bg-sky-50 p-8 border border-sky-200 rounded-2xl text-sm">
              <div className="grid grid-cols-2 gap-12">
                <div>
                  <div className="font-black text-sky-900 mb-2 uppercase text-xs tracking-widest">Compression Flange</div>
                  <div className="flex justify-between mb-1"><span>Ratio (b/t)</span><span className="font-mono font-bold">{results.slFlange.toFixed(2)}</span></div>
                  <div className="flex justify-between font-black text-sky-800 mt-2 border-t border-sky-100 pt-1"><span>RESULT</span><span>CLASS {results.fClass}</span></div>
                </div>
                <div>
                  <div className="font-black text-sky-900 mb-2 uppercase text-xs tracking-widest">Flexural Web</div>
                  <div className="flex justify-between mb-1"><span>Ratio (hw/w)</span><span className="font-mono font-bold">{results.slWeb.toFixed(2)}</span></div>
                  <div className="flex justify-between font-black text-sky-800 mt-2 border-t border-sky-100 pt-1"><span>RESULT</span><span>CLASS {results.wClass}</span></div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-6 mt-4">
               <div className="border-l-8 border-blue-600 pl-6 py-6 bg-blue-50 rounded-r-2xl shadow-sm text-black">
                  <div className="text-blue-900 font-black uppercase text-[10px] mb-1 tracking-widest">Moment Resistance (Mr)</div>
                  <div className="text-4xl font-mono font-black text-blue-900 tracking-tighter">{(results.Mr / 1e6).toLocaleString(undefined, {maximumFractionDigits:1})} <span className="text-sm font-normal">kN-m</span></div>
               </div>
               <div className="border-l-8 border-green-600 pl-6 py-6 bg-green-50 rounded-r-2xl shadow-sm text-black">
                  <div className="text-green-900 font-black uppercase text-[10px] mb-1 tracking-widest">Shear Resistance (Vr)</div>
                  <div className="text-4xl font-mono font-black text-green-900 tracking-tighter">{(results.Vr / 1e3).toLocaleString(undefined, {maximumFractionDigits:1})} <span className="text-sm font-normal">kN</span></div>
               </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10 p-4 md:p-8">
        <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Girder Designer</h1>
            <div className="flex gap-4 mt-4">
              <button onClick={() => setActiveTab('i-girder')} className={`px-8 py-2.5 rounded-2xl text-xs font-black transition-all border-2 uppercase tracking-widest ${activeTab === 'i-girder' ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-xl scale-105' : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-700'}`}>I-Section</button>
              <button onClick={() => setActiveTab('box-girder')} className={`px-8 py-2.5 rounded-2xl text-xs font-black transition-all border-2 uppercase tracking-widest ${activeTab === 'box-girder' ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-xl scale-105' : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-700'}`}>Box-Section</button>
            </div>
          </div>
          <button 
            onClick={downloadReport}
            disabled={!libLoaded || isGenerating}
            className={`${libLoaded && !isGenerating ? 'bg-sky-500 hover:opacity-90 active:scale-95' : 'bg-slate-700 opacity-50 cursor-not-allowed'} text-slate-950 font-black px-10 py-5 rounded-3xl flex items-center gap-4 transition-all shadow-2xl uppercase tracking-tighter text-lg`}
          >
            {isGenerating ? 'Generating...' : !libLoaded ? 'Booting Engine...' : <><Download className="w-6 h-6" /> Download Report</>}
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4 space-y-8">
            <section className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 shadow-2xl sticky top-8">
              <h2 className="text-xl font-black mb-8 border-b border-slate-800 pb-4 flex items-center gap-4 text-white uppercase tracking-tighter"><Settings className="w-5 h-5" /> {activeTab === 'i-girder' ? 'I-Girder' : 'Box Girder'} Data</h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                <PlateInput label="bf_top" unit="mm" name={activeTab === 'i-girder' ? "bfTop" : "boxBfTop"} value={activeTab === 'i-girder' ? inputs.bfTop : inputs.boxBfTop} onChange={handleInputChange} />
                <PlateInput label="tf_top" unit="mm" name={activeTab === 'i-girder' ? "tfTop" : "boxTfTop"} value={activeTab === 'i-girder' ? inputs.tfTop : inputs.boxTfTop} onChange={handleInputChange} />
                <PlateInput label="bf_bot" unit="mm" name={activeTab === 'i-girder' ? "bfBot" : "boxBfBot"} value={activeTab === 'i-girder' ? inputs.bfBot : inputs.boxBfBot} onChange={handleInputChange} />
                <PlateInput label="tf_bot" unit="mm" name={activeTab === 'i-girder' ? "tfBot" : "boxTfBot"} value={activeTab === 'i-girder' ? inputs.tfBot : inputs.boxTfBot} onChange={handleInputChange} />
                <PlateInput label="tw (web)" unit="mm" name={activeTab === 'i-girder' ? "webT" : "boxWebT"} value={activeTab === 'i-girder' ? inputs.webT : inputs.boxWebT} onChange={handleInputChange} />
                <PlateInput label="hw (web)" unit="mm" name={activeTab === 'i-girder' ? "clearWebD" : "boxClearWebD"} value={activeTab === 'i-girder' ? inputs.clearWebD : inputs.boxClearWebD} onChange={handleInputChange} />
                <PlateInput label="Fy (Steel)" unit="MPa" name={activeTab === 'i-girder' ? "fyMPa" : "boxFy"} value={activeTab === 'i-girder' ? inputs.fyMPa : inputs.boxFy} onChange={handleInputChange} />
                <PlateInput label="L (Unbraced)" unit="mm" name={activeTab === 'i-girder' ? "unbracedL" : "boxL"} value={activeTab === 'i-girder' ? inputs.unbracedL : inputs.boxL} onChange={handleInputChange} />
                <div className="col-span-2 mt-4"><PlateInput label="Stiffener Spacing (a)" unit="mm" name={activeTab === 'i-girder' ? "stiffenerA" : "boxStiffenerA"} value={activeTab === 'i-girder' ? inputs.stiffenerA : inputs.boxStiffenerA} onChange={handleInputChange} /></div>
                
                {activeTab === 'i-girder' && (
                  <>
                    <div className="col-span-2 mt-4 flex items-center justify-between border-b border-slate-800 pb-2">
                      <h3 className="text-sky-400 font-bold text-[10px] tracking-widest uppercase opacity-70">Connection Angles</h3>
                    </div>
                    <PlateInput label="Top Angle H" unit="mm" name="topAngleH" value={inputs.topAngleH} onChange={handleInputChange} />
                    <PlateInput label="Top Angle V" unit="mm" name="topAngleV" value={inputs.topAngleV} onChange={handleInputChange} />
                    <PlateInput label="Top Angle T" unit="mm" name="topAngleT" value={inputs.topAngleT} onChange={handleInputChange} />
                    <div className="col-span-1" />
                    <PlateInput label="Bot Angle H" unit="mm" name="botAngleH" value={inputs.botAngleH} onChange={handleInputChange} />
                    <PlateInput label="Bot Angle V" unit="mm" name="botAngleV" value={inputs.botAngleV} onChange={handleInputChange} />
                    <PlateInput label="Bot Angle T" unit="mm" name="botAngleT" value={inputs.botAngleT} onChange={handleInputChange} />
                  </>
                )}

                {activeTab === 'box-girder' && (
                  <>
                    <div className="col-span-2"><PlateInput label="Web Center Spacing" unit="mm" name="boxWebSpacing" value={inputs.boxWebSpacing} onChange={handleInputChange} /></div>
                    <div className="col-span-2 mt-4 flex items-center justify-between border-b border-slate-800 pb-2">
                      <h3 className="text-sky-400 font-bold text-[10px] tracking-widest uppercase opacity-70">Box Angles</h3>
                    </div>
                    <PlateInput label="Angle Horiz" unit="mm" name="boxAngleH" value={inputs.boxAngleH} onChange={handleInputChange} />
                    <PlateInput label="Angle Vert" unit="mm" name="boxAngleV" value={inputs.boxAngleV} onChange={handleInputChange} />
                    <PlateInput label="Angle Thick" unit="mm" name="boxAngleT" value={inputs.boxAngleT} onChange={handleInputChange} />
                  </>
                )}
              </div>
            </section>
          </div>

          <div className="lg:col-span-8 space-y-8">
            <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-12 shadow-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-12">
                <div className="bg-black rounded-3xl border border-slate-800 p-8 flex flex-col items-center justify-center aspect-square shadow-inner overflow-hidden relative"><GirderSVG results={results} /></div>
                <div className="flex flex-col justify-between">
                  <div className="space-y-5">
                    <h2 className="text-2xl font-black border-b-2 border-slate-800 pb-4 text-white uppercase tracking-tight">Capacities</h2>
                    <ResultRow label="Mr (Factored Moment)" value={results.Mr / 1e6} unit="kN·m" accent />
                    <ResultRow label="Vr (Factored Shear)" value={results.Vr / 1e3} unit="kN" accent />
                    <div className="h-px bg-slate-800 my-4" />
                    <ResultRow label="Mp (Plastic Cap)" value={results.Mp / 1e6} unit="kN·m" />
                    <ResultRow label="My (Yield Cap)" value={results.My / 1e6} unit="kN·m" />
                  </div>
                  <div className="mt-12">
                    <div className={`inline-flex items-center gap-4 px-8 py-4 rounded-2xl font-black text-sm border-2 ${results.gClass <= 2 ? 'bg-emerald-950/30 text-emerald-400 border-emerald-500/20' : 'bg-amber-950/30 text-amber-400 border-amber-500/20'}`}>
                      <div className={`w-3 h-3 rounded-full animate-ping ${results.gClass <= 2 ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      CSA S6 SECTION CLASS {results.gClass}
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <StatCard label="Total Area" value={results.Area} unit="mm²" />
                <StatCard label="Plastic Zx" value={results.Zx} unit="mm³" scientific />
                <StatCard label="Inertia Ix" value={results.Ix} unit="mm⁴" scientific />
                <StatCard label="Torsion J" value={results.J} unit="mm⁴" scientific />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 shadow-2xl">
              <h2 className="text-xl font-black mb-10 flex items-center gap-4 uppercase text-white tracking-tighter"><FileText className="w-5 h-5" /> Calculation Metadata</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-8 text-[12px] font-mono mb-12 text-slate-300 font-bold">
                 <div className="space-y-4">
                   <h3 className="text-sky-400 font-black border-b border-slate-800 pb-3 uppercase tracking-widest text-[10px]">Material / Setup</h3>
                   <ParamRow label="phi_s" value={results.phiS} />
                   <ParamRow label="Steel Fy" value={results.fy} unit="MPa" />
                   <ParamRow label="Unbraced Segment" value={results.L} unit="mm" />
                 </div>
                 <div className="space-y-4">
                   <h3 className="text-sky-400 font-black border-b border-slate-800 pb-3 uppercase tracking-widest text-[10px]">Shear Strength</h3>
                   <ParamRow label="Aw (Shear Area)" value={results.Aw} unit="mm^2" />
                   <ParamRow label="kv (Buckling Coeff)" value={results.kv} />
                   <ParamRow label="Vr (Resultant)" value={results.Vr/1e3} unit="kN" />
                 </div>
              </div>
              <h3 className="text-sky-400 font-black border-b border-slate-800 pb-3 uppercase tracking-widest text-[10px] mb-6">Component Breakdown</h3>
              <div className="overflow-x-auto rounded-3xl border-2 border-slate-800 shadow-inner">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead><tr className="bg-slate-950 text-slate-500"><th className="py-4 px-6 font-black uppercase tracking-widest">Component Part</th><th className="py-4 px-6 font-black uppercase tracking-widest text-center">Dimensions (mm)</th><th className="py-4 px-6 text-right font-black uppercase tracking-widest">Area (mm²)</th></tr></thead>
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
    <div className="flex flex-col py-3 border-b border-gray-100 text-sm">
      <div className="text-sky-900 font-black text-[9px] uppercase mb-1.5 tracking-widest">{label}</div>
      <div className="flex justify-between items-end">
        <span className="font-serif italic text-gray-900 text-[10px] font-bold bg-gray-50 px-2 rounded-md">{eq}</span>
        <span className="font-mono font-black text-black tracking-tighter">
          = {displayVal} <span className="font-sans font-normal text-[9px] text-gray-500 uppercase">{unit}</span>
        </span>
      </div>
    </div>
  );
}

function GirderSVG({ results, printMode = false }: any) {
  const { rects, totalDepth, yBar, bfTop, clearWebD, raw, type } = results;
  const minX = Math.min(...rects.map((r: any) => r.x1)) - 120;
  const maxX = Math.max(...rects.map((r: any) => r.x2)) + 120;
  const width = maxX - minX;
  const height = totalDepth + 200;
  const mainFill = printMode ? "rgb(203, 213, 225)" : "rgb(71 85 105)";
  const mainStroke = "#000000";
  const naColor = printMode ? "#1d4ed8" : "#22c55e";

  return (
    <svg viewBox={`${minX} -120 ${width} ${height}`} className={`w-full h-full ${printMode ? '' : 'drop-shadow-2xl'}`}>
      {rects.map((r: any, i: number) => (
        <rect key={i} x={r.x1} y={totalDepth - r.y2} width={Math.max(0.1, r.b)} height={Math.max(0.1, r.h)} fill={r.label.includes('Angle') ? (printMode ? '#cbd5e1' : '#334155') : mainFill} stroke={mainStroke} strokeWidth={printMode ? "3.5" : "1.5"} />
      ))}
      <line x1={minX} y1={totalDepth - yBar} x2={maxX} y2={totalDepth - yBar} stroke={naColor} strokeWidth="5" strokeDasharray="20,10" />
      <text x={maxX - 140} y={totalDepth - yBar - 20} fill={naColor} fontSize="52" fontWeight="900">N.A.</text>
    </svg>
  );
}

function PlateInput({ label, unit, ...props }: any) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center px-1">
        <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest">{label}</label>
        {unit && <span className="text-[8px] text-sky-500 font-bold uppercase tracking-tighter">{unit}</span>}
      </div>
      <input className="bg-slate-950 border-2 border-slate-800 rounded-2xl p-4 text-xs font-bold text-white focus:border-sky-500 outline-none transition-all w-full shadow-inner" {...props} />
    </div>
  );
}

function ResultRow({ label, value, unit, accent }: any) {
  return (
    <div className={`flex justify-between items-center py-3.5 px-6 rounded-2xl border-2 border-transparent transition-all ${accent ? 'bg-sky-500/10 border-sky-500/20 shadow-xl' : 'hover:bg-slate-800/30'}`}>
      <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className={`font-mono text-2xl font-black tracking-tighter ${accent ? 'text-sky-400' : 'text-slate-100'}`}>{value.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
        <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest">{unit}</span>
      </div>
    </div>
  );
}

function ParamRow({ label, value, unit }: any) {
  return (
    <div className="flex justify-between py-2.5 border-b border-slate-800/60 group">
      <span className="text-slate-600 group-hover:text-slate-400 transition-colors uppercase text-[9px] font-black">{label}</span>
      <span className="text-slate-300 font-black tracking-tighter">{typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value} <span className="text-[9px] text-slate-600 uppercase font-normal">{unit}</span></span>
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
