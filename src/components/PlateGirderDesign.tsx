
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Download, Settings, FileText, LayoutPanelTop } from 'lucide-react';

/**
 * Engineering Utility Functions
 */
const Utils = {
  num: (v: any, name: string) => {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error(`Invalid numeric input for ${name}.`);
    return n;
  },
  positive: (v: any, name: string, allowZero = false) => {
    const n = Utils.num(v, name);
    if (allowZero ? n < 0 : n <= 0) throw new Error(`${name} must be ${allowZero ? '>= 0' : '> 0'}.`);
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
    if (b <= 0 || h <= 0) throw new Error(`Non-positive dimensions for ${label}.`);
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

export function PlateGirderDesign() {
  const [inputs, setInputs] = useState({
    bfTop: 355.6, tfTop: 63.5,
    bfBot: 355.6, tfBot: 63.5,
    webT: 13, clearWebD: 3350,
    fyMPa: 230, unbracedL: 6515,
    stiffenerA: 1308,
    topAnglesEnabled: "1", topAngleH: 152.4, topAngleV: 203.2, topAngleT: 25.4,
    botAnglesEnabled: "1", botAngleH: 152.4, botAngleV: 203.2, botAngleT: 25.4
  });

  const [results, setResults] = useState<any>(null);
  const [libLoaded, setLibLoaded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Load external libraries for PDF generation
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
      const res = calculateAll(inputs);
      setResults(res);
    } catch (e) {
      console.error(e);
    }
  }, [inputs]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setInputs(prev => ({ ...prev, [name]: value }));
  }

  function calculateAll(raw: any) {
    const bfTop = Utils.positive(raw.bfTop, 'Top Width');
    const tfTop = Utils.positive(raw.tfTop, 'Top Thick');
    const bfBot = Utils.positive(raw.bfBot, 'Bot Width');
    const tfBot = Utils.positive(raw.tfBot, 'Bot Thick');
    const webT = Utils.positive(raw.webT, 'Web Thick');
    const clearWebD = Utils.positive(raw.clearWebD, 'Web Height');
    const fy = Utils.positive(raw.fyMPa, 'Fy');
    const L = Utils.positive(raw.unbracedL, 'L');
    const stiffA = Utils.positive(raw.stiffenerA, 'Stiffener Spacing');
    
    const Es = 200000, Gs = 77000, phiS = 0.95, omega2 = 1.0;

    const totalDepth = tfTop + clearWebD + tfBot;
    const rects: any[] = [];
    rects.push(Utils.rectProps(-bfTop/2, bfTop/2, tfBot + clearWebD, totalDepth, 'Top Flange'));
    rects.push(Utils.rectProps(-bfBot/2, bfBot/2, 0, tfBot, 'Bottom Flange'));
    rects.push(Utils.rectProps(-webT/2, webT/2, tfBot, tfBot + clearWebD, 'Web'));

    if (raw.topAnglesEnabled === "1") {
      const yT = tfBot + clearWebD;
      const tAH = Utils.num(raw.topAngleH, 'topAngleH'), tAV = Utils.num(raw.topAngleV, 'topAngleV'), tAT = Utils.num(raw.topAngleT, 'topAngleT');
      if (tAH > 0 && tAV > 0 && tAT > 0) {
          rects.push(Utils.rectProps(-webT/2 - tAT, -webT/2, yT - tAV, yT, 'TL Angle Vert'));
          rects.push(Utils.rectProps(webT/2, webT/2 + tAT, yT - tAV, yT, 'TR Angle Vert'));
          rects.push(Utils.rectProps(-webT/2 - tAH, -webT/2 - tAT, yT - tAT, yT, 'TL Angle Horiz'));
          rects.push(Utils.rectProps(webT/2 + tAT, webT/2 + tAH, yT - tAT, yT, 'TR Angle Horiz'));
      }
    }
    if (raw.botAnglesEnabled === "1") {
      const yB = tfBot;
      const bAH = Utils.num(raw.botAngleH, 'botAngleH'), bAV = Utils.num(raw.botAngleV, 'botAngleV'), bAT = Utils.num(raw.botAngleT, 'botAngleT');
      if (bAH > 0 && bAV > 0 && bAT > 0) {
          rects.push(Utils.rectProps(-webT/2 - bAT, -webT/2, yB, yB + bAV, 'BL Angle Vert'));
          rects.push(Utils.rectProps(webT/2, webT/2 + bAT, yB, yB + bAV, 'BR Angle Vert'));
          rects.push(Utils.rectProps(-webT/2 - bAH, -webT/2 - bAT, yB, yB + bAT, 'BL Angle Horiz'));
          rects.push(Utils.rectProps(webT/2 + bAT, webT/2 + bAH, yB, yB + bAT, 'BR Angle Horiz'));
      }
    }

    const Area = rects.reduce((s, r) => s + r.area, 0);
    const yBar = rects.reduce((s, r) => s + r.area * r.cy, 0) / Area;
    const Ix = rects.reduce((s, r) => s + r.IxLocal + r.area * Math.pow(r.cy - yBar, 2), 0);
    const Iy = rects.reduce((s, r) => s + r.IyLocal + r.area * Math.pow(r.cx, 2), 0);
    const J = rects.reduce((s, r) => s + Utils.rectangleJ(r.b, r.h), 0);
    const ho = clearWebD + (tfTop + tfBot)/2;
    const Cw = (Iy * Math.pow(ho, 2)) / 4;
    
    // Elastic Section Modulus
    const SxTop = Ix / (totalDepth - yBar);
    const SxBot = Ix / yBar;
    const SxMin = Math.min(SxTop, SxBot);
    
    const maxX = rects.reduce((max, r) => Math.max(max, Math.abs(r.x1), Math.abs(r.x2)), 0);
    const Sy = Iy / maxX;

    // Plastic Modulus Zx
    const Zx = rects.reduce((s, r) => {
      const y1 = r.y1 - yBar, y2 = r.y2 - yBar;
      if (y1 >= 0) return s + r.area * (r.cy - yBar);
      if (y2 <= 0) return s + r.area * (yBar - r.cy);
      const aAbove = (r.x2 - r.x1) * y2, aBelow = (r.x2 - r.x1) * (-y1);
      return s + (aAbove * y2/2 + aBelow * (-y1)/2);
    }, 0);

    // βx and Mu
    const Iyt = (tfTop * Math.pow(bfTop, 3)) / 12;
    const Iyb = (tfBot * Math.pow(bfBot, 3)) / 12;
    const dSC_top = ho * (Iyb / (Iyt + Iyb));
    const yo = (tfBot + clearWebD + tfTop/2 - dSC_top) - yBar;
    const integral = rects.reduce((s, r) => s + (r.area * (r.cy - yBar) * (Math.pow(r.cy - yBar, 2) + Math.pow(r.cx, 2) + r.h*r.h/12 + r.b*r.b/12)), 0);
    const betaX = (integral / Ix) - (2 * yo);

    const B1 = Math.PI * (betaX / (2 * L)) * Math.sqrt((Es * Iy) / (Gs * J));
    const B2 = (Math.PI * Math.PI * Es * Cw) / (L * L * Gs * J);
    const Mu = (omega2 * Math.PI / L) * Math.sqrt(Es * Iy * Gs * J) * (B1 + Math.sqrt(1 + B2 + B1*B1));

    // Classification
    const sqrtFy = Math.sqrt(fy);
    const flangeOutstand = (Math.max(bfTop, bfBot) - webT) / 2;
    const slFlange = flangeOutstand / Math.min(tfTop, tfBot);
    const slWeb = clearWebD / webT;

    const f1 = 145/sqrtFy, f2 = 170/sqrtFy, f3 = 200/sqrtFy;
    const w1 = 1100/sqrtFy, w2 = 1700/sqrtFy, w3 = 1900/sqrtFy;
    const fClass = slFlange <= f1 ? 1 : slFlange <= f2 ? 2 : slFlange <= f3 ? 3 : 4;
    const wClass = slWeb <= w1 ? 1 : slWeb <= w2 ? 2 : slWeb <= w3 ? 3 : 4;
    const gClass = Math.max(fClass, wClass);

    // Moment Capacities
    const Mp = Zx * fy, My = SxMin * fy;
    const Mbase = gClass <= 2 ? Mp : My;
    let Mr = (Mu > 0.67 * Mbase) ? 1.15 * phiS * Mbase * (1 - 0.28 * (Mbase / Mu)) : phiS * Mu;
    Mr = Math.min(Mr, phiS * Mbase);

    // Shear Resistance Vr
    const Aw = clearWebD * webT;
    const h_over_w = clearWebD / webT;
    const a_over_h = stiffA / clearWebD;
    
    let kv;
    if (a_over_h < 1) {
      kv = 4 + 5.34 / Math.pow(a_over_h, 2);
    } else {
      kv = 5.34 + 4 / Math.pow(a_over_h, 2);
    }

    const limit1 = 502 * Math.sqrt(kv / fy);
    const limit2 = 621 * Math.sqrt(kv / fy);
    
    let Fcr, Ft = 0;
    if (h_over_w <= limit1) {
      Fcr = 0.577 * fy;
    } else if (h_over_w <= limit2) {
      Fcr = (290 * Math.sqrt(kv * fy)) / h_over_w;
    } else {
      Fcr = (180000 * kv) / Math.pow(h_over_w, 2);
    }

    if (h_over_w > limit1) {
      Ft = (0.577 * fy - Fcr) / Math.sqrt(1 + Math.pow(a_over_h, 2));
    }

    const Fs = Fcr + Ft; 
    const Vr = phiS * Aw * Fs;

    return {
      raw, rects, Area, Ix, Iy, J, Cw, Zx, SxTop, SxBot, Sy, yBar, totalDepth, ho, betaX, yo, B1, B2, Mu, Mr, gClass,
      Aw, Fcr, Ft, Fs, Vr, kv, fy, L, h_over_w, stiffA, a_over_h, limit1, limit2, phiS, SxMin, My, Mp, Es, Gs, omega2,
      flangeOutstand, slFlange, slWeb, fClass, wClass
    };
  }

  const downloadPDF = async () => {
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
            logging: false
          });
          
          const imgData = canvas.toDataURL('image/png', 1.0);
          
          if (i > 0) {
            pdf.addPage();
          }
          
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        }

        pdf.save(`Girder_Design_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      } catch (e) {
        console.error("PDF Generation failed", e);
      } finally {
        setIsGenerating(false);
      }
    }, 100);
  };

  if (!results) return <div className="p-8 text-slate-400">Loading engineering model...</div>;

  return (
    <div className="bg-slate-950 min-h-screen text-slate-100 p-4 md:p-8 font-sans overflow-x-hidden rounded-xl">
      
      {/* -------------------- OFF-SCREEN PRINTABLE REPORT -------------------- */}
      <div style={{ position: 'absolute', top: 0, left: '-9999px', width: '800px', pointerEvents: 'none' }}>
        
        {/* PDF PAGE 1 */}
        <div className="pdf-page bg-white text-black relative" style={{ width: '800px', height: '1131px', padding: '48px', boxSizing: 'border-box' }}>
          <h1 className="text-3xl font-bold border-b-2 border-black pb-4 mb-8 text-center uppercase tracking-widest">
            Girder Design Report
            <div className="text-sm font-normal tracking-normal mt-2 text-gray-600">CSA S6-19 Compliance Calculation</div>
          </h1>

          <div className="flex gap-8 mb-10">
            <div className="w-1/2">
              <h2 className="text-xl font-bold mb-4 border-b border-gray-300 pb-1">1. Material & Geometry</h2>
              <PrintRow label="Yield Strength, Fy" val={results.fy} unit="MPa" />
              <PrintRow label="Elastic Modulus, E" val={results.Es.toLocaleString()} unit="MPa" />
              <PrintRow label="Shear Modulus, G" val={results.Gs.toLocaleString()} unit="MPa" />
              <PrintRow label="Top Flange (bf × tf)" val={`${results.raw.bfTop} × ${results.raw.tfTop}`} unit="mm" />
              <PrintRow label="Bot Flange (bf × tf)" val={`${results.raw.bfBot} × ${results.raw.tfBot}`} unit="mm" />
              <PrintRow label="Web (hw × tw)" val={`${results.raw.clearWebD} × ${results.raw.webT}`} unit="mm" />
              <PrintRow label="Unbraced Length, L" val={results.L.toLocaleString()} unit="mm" />
              <PrintRow label="Stiffener Spacing, a" val={results.stiffA.toLocaleString()} unit="mm" />
            </div>
            <div className="w-1/2 border border-gray-200 p-4 rounded bg-gray-50 flex items-center justify-center">
              <div className="w-full h-72">
                <GirderSVG results={results} printMode={true} />
              </div>
            </div>
          </div>

          <h2 className="text-xl font-bold mb-4 border-b border-gray-300 pb-1">2. Section Properties</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-8">
            <PrintMath label="Area" eq="A = Σ Aᵢ" val={results.Area} unit="mm²" />
            <PrintMath label="Centroid (from bottom)" eq="ȳ" val={results.yBar} unit="mm" />
            <PrintMath label="Moment of Inertia (X)" eq="Ix" val={results.Ix} scientific unit="mm⁴" />
            <PrintMath label="Moment of Inertia (Y)" eq="Iy" val={results.Iy} scientific unit="mm⁴" />
            <PrintMath label="Torsional Constant" eq="J" val={results.J} scientific unit="mm⁴" />
            <PrintMath label="Warping Constant" eq="Cw" val={results.Cw} scientific unit="mm⁶" />
            <PrintMath label="Elastic Modulus (Top)" eq="Sx,top" val={results.SxTop} scientific unit="mm³" />
            <PrintMath label="Elastic Modulus (Bot)" eq="Sx,bot" val={results.SxBot} scientific unit="mm³" />
            <PrintMath label="Plastic Modulus" eq="Zx" val={results.Zx} scientific unit="mm³" />
            <PrintMath label="Monosymmetry Offset" eq="yo" val={results.yo} unit="mm" />
          </div>
          
          <div className="absolute bottom-12 left-12 right-12 flex justify-between border-t border-gray-300 pt-2 text-xs text-gray-500">
            <span>Built-up I-Girder Calculator</span>
            <span>Page 1 of 3</span>
          </div>
        </div>

        {/* PDF PAGE 2 */}
        <div className="pdf-page bg-white text-black relative" style={{ width: '800px', height: '1131px', padding: '48px', boxSizing: 'border-box' }}>
          <div className="border-b border-gray-300 pb-2 mb-6 text-sm text-gray-500 flex justify-between uppercase tracking-widest">
            <span>Girder Design Report</span>
            <span>CSA S6-19</span>
          </div>

          <h2 className="text-xl font-bold mb-4 border-b border-gray-300 pb-1">3. Moment Capacity (CSA 10.10.3)</h2>
          <div className="space-y-4 mb-10">
            <div className="bg-gray-50 p-4 border border-gray-200 text-sm">
              <div className="font-semibold mb-2 text-base">Section Classification:</div>
              <div className="flex justify-between border-b border-gray-200 pb-1 mb-1">
                <span>Flange slenderness (b/t) = {results.slFlange.toFixed(2)}</span>
                <span className="font-bold">Class {results.fClass}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1 mb-1">
                <span>Web slenderness (hw/w) = {results.slWeb.toFixed(2)}</span>
                <span className="font-bold">Class {results.wClass}</span>
              </div>
              <div className="mt-3 font-bold text-blue-900 text-base">Governing Section Class = {results.gClass}</div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <PrintMath label="Monosymmetry Coeff." eq="βx" val={results.betaX} unit="mm" />
              <PrintMath label="LTB Parameter 1" eq="B1" val={results.B1} fixed={4} />
              <PrintMath label="LTB Parameter 2" eq="B2" val={results.B2} fixed={4} />
            </div>
            
            <div className="border-l-4 border-gray-400 pl-4 py-3 my-6 bg-gray-50">
              <p className="font-serif italic text-lg mb-3">Critical Elastic Moment Mu Formula Applied</p>
              <PrintMath label="Critical Elastic Moment" eq="Mu" val={results.Mu / 1e6} unit="kN·m" />
            </div>

            <div className="border-l-4 border-blue-500 pl-4 py-3 bg-blue-50">
              <p className="font-serif italic text-lg mb-3">Factored Moment Resistance Mr Formula Applied</p>
              <div className="flex justify-between items-center bg-white p-3 border border-blue-200 rounded">
                <span className="font-bold text-blue-900 text-lg">Factored Moment Resistance</span>
                <span className="text-2xl font-serif italic font-bold text-blue-900">Mr = {(results.Mr / 1e6).toLocaleString(undefined, {maximumFractionDigits:1})} kN·m</span>
              </div>
            </div>
          </div>

          <h2 className="text-xl font-bold mb-4 border-b border-gray-300 pb-1 mt-10">4. Shear Capacity (CSA 10.10.5.1)</h2>
          <div className="space-y-4 mb-8">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <PrintMath label="Aspect Ratio" eq="a/h" val={results.a_over_h} fixed={3} />
              <PrintMath label="Web Slenderness" eq="hw/w" val={results.h_over_w} fixed={1} />
            </div>

            <div className="bg-gray-50 p-4 border border-gray-200 my-4">
              <p className="font-serif italic mb-2 text-base">Shear Buckling Coeff kv Formula Applied</p>
              <PrintMath label="Shear Buckling Coeff." eq="kv" val={results.kv} fixed={2} />
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <PrintMath label="Elastic Limit" eq="502 √(kv/Fy)" val={results.limit1} fixed={1} />
              <PrintMath label="Inelastic Limit" eq="621 √(kv/Fy)" val={results.limit2} fixed={1} />
              <PrintMath label="Buckling Stress" eq="Fcr" val={results.Fcr} unit="MPa" fixed={1} />
              <PrintMath label="Tension Field Stress" eq="Ft" val={results.Ft} unit="MPa" fixed={1} />
            </div>

            <div className="border-l-4 border-green-500 pl-4 py-3 mt-6 bg-green-50">
              <p className="font-serif italic text-lg mb-3">Factored Shear Resistance Vr Formula Applied</p>
              <div className="flex justify-between items-center bg-white p-3 border border-green-200 rounded">
                <span className="font-bold text-green-900 text-lg">Factored Shear Resistance</span>
                <span className="text-2xl font-serif italic font-bold text-green-900">Vr = {(results.Vr / 1e3).toLocaleString(undefined, {maximumFractionDigits:1})} kN</span>
              </div>
            </div>
          </div>
          
          <div className="absolute bottom-12 left-12 right-12 flex justify-between border-t border-gray-300 pt-2 text-xs text-gray-500">
            <span>Built-up I-Girder Calculator</span>
            <span>Page 2 of 3</span>
          </div>
        </div>

        {/* PDF PAGE 3 */}
        <div className="pdf-page bg-white text-black relative" style={{ width: '800px', height: '1131px', padding: '48px', boxSizing: 'border-box' }}>
          <div className="border-b border-gray-300 pb-2 mb-6 text-sm text-gray-500 flex justify-between uppercase tracking-widest">
            <span>Girder Design Report</span>
            <span>CSA S6-19</span>
          </div>

          <h2 className="text-xl font-bold mb-6 border-b border-gray-300 pb-1">5. Component Breakdown</h2>
          <table className="w-full text-left border-collapse text-sm mb-12">
            <thead>
              <tr className="border-b-2 border-gray-400 bg-gray-50">
                <th className="py-3 px-2">Component</th>
                <th className="py-3 px-2">Dimensions (mm)</th>
                <th className="py-3 px-2 text-right">Area (mm²)</th>
                <th className="py-3 px-2 text-right">Centroid Y (mm)</th>
              </tr>
            </thead>
            <tbody>
              {results.rects.map((r: any, i: number) => (
                <tr key={i} className="border-b border-gray-200">
                  <td className="py-2 px-2 text-gray-800">{r.label}</td>
                  <td className="py-2 px-2 font-mono">{r.b.toFixed(1)} × {r.h.toFixed(1)}</td>
                  <td className="py-2 px-2 font-mono text-right">{r.area.toLocaleString(undefined, {maximumFractionDigits: 1})}</td>
                  <td className="py-2 px-2 font-mono text-right">{r.cy.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="absolute bottom-12 left-12 right-12 flex justify-between border-t border-gray-300 pt-2 text-xs text-gray-500">
            <span>Built-up I-Girder Calculator</span>
            <span>Page 3 of 3</span>
          </div>
        </div>
      </div>
      {/* ------------------------------------------------------------------- */}

      <div className="max-w-6xl mx-auto relative z-10">
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Built-up I-Girder Design (CSA S6-19)</h1>
            <p className="text-slate-400 italic">Plate Girder Section Property and Resistance Calculator</p>
          </div>
          <button 
            onClick={downloadPDF}
            disabled={!libLoaded || isGenerating}
            className={`${libLoaded && !isGenerating ? 'bg-sky-500 hover:opacity-90 active:scale-95' : 'bg-slate-700 opacity-50 cursor-not-allowed'} text-slate-950 font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-all shadow-lg`}
          >
            {isGenerating ? 'Generating PDF...' : !libLoaded ? 'Loading PDF Engine...' : <><Download className="w-5 h-5" /> Download Design PDF</>}
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl sticky top-8">
              <h2 className="text-xl font-semibold mb-4 border-b border-slate-800 pb-2 flex items-center gap-2">
                <Settings className="w-5 h-5" /> Girder Parameters
              </h2>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <PlateInput label="bf_top" unit="mm" name="bfTop" value={inputs.bfTop} onChange={handleInputChange} />
                <PlateInput label="tf_top" unit="mm" name="tfTop" value={inputs.tfTop} onChange={handleInputChange} />
                <PlateInput label="bf_bot" unit="mm" name="bfBot" value={inputs.bfBot} onChange={handleInputChange} />
                <PlateInput label="tf_bot" unit="mm" name="tfBot" value={inputs.tfBot} onChange={handleInputChange} />
                <PlateInput label="tw (w)" unit="mm" name="webT" value={inputs.webT} onChange={handleInputChange} />
                <PlateInput label="hw (h)" unit="mm" name="clearWebD" value={inputs.clearWebD} onChange={handleInputChange} />
                <PlateInput label="Fy" unit="MPa" name="fyMPa" value={inputs.fyMPa} onChange={handleInputChange} />
                <PlateInput label="L" unit="mm" name="unbracedL" value={inputs.unbracedL} onChange={handleInputChange} />
                <div className="col-span-2">
                  <PlateInput label="Stiffener Spacing (a)" unit="mm" name="stiffenerA" value={inputs.stiffenerA} onChange={handleInputChange} />
                </div>
              </div>

              <h3 className="text-sky-400 font-bold mt-6 mb-3 text-xs tracking-widest uppercase opacity-70">Angle Details</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <PlateInput label="Top Horiz" unit="mm" name="topAngleH" value={inputs.topAngleH} onChange={handleInputChange} />
                  <PlateInput label="Top Vert" unit="mm" name="topAngleV" value={inputs.topAngleV} onChange={handleInputChange} />
                  <PlateInput label="Top Thick" unit="mm" name="topAngleT" value={inputs.topAngleT} onChange={handleInputChange} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <PlateInput label="Bot Horiz" unit="mm" name="botAngleH" value={inputs.botAngleH} onChange={handleInputChange} />
                  <PlateInput label="Bot Vert" unit="mm" name="botAngleV" value={inputs.botAngleV} onChange={handleInputChange} />
                  <PlateInput label="Bot Thick" unit="mm" name="botAngleT" value={inputs.botAngleT} onChange={handleInputChange} />
                </div>
              </div>
            </section>
          </div>

          {/* Results View */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="bg-black rounded-xl border border-slate-800 p-4 flex flex-col items-center justify-center aspect-square shadow-inner">
                  <GirderSVG results={results} />
                </div>

                <div className="flex flex-col justify-between">
                  <div className="space-y-3">
                    <h2 className="text-xl font-bold border-b border-slate-800 pb-2">Governing Capacities</h2>
                    <ResultRow label="Mr (Factored Moment)" value={results.Mr / 1e6} unit="kN·m" accent />
                    <ResultRow label="Vr (Factored Shear)" value={results.Vr / 1e3} unit="kN" accent />
                    <div className="h-px bg-slate-800 my-2" />
                    <ResultRow label="Mu (Critical Elastic)" value={results.Mu / 1e6} unit="kN·m" />
                    <ResultRow label="Mp (Plastic Moment)" value={results.Mp / 1e6} unit="kN·m" />
                    <ResultRow label="My (Yield Moment)" value={results.My / 1e6} unit="kN·m" />
                    <div className="h-px bg-slate-800 my-2" />
                    <ResultRow label="Sx,top" value={results.SxTop / 1e3} unit="cm³" />
                    <ResultRow label="Sx,bot" value={results.SxBot / 1e3} unit="cm³" />
                    <ResultRow label="Sy" value={results.Sy / 1e3} unit="cm³" />
                  </div>
                  
                  <div className="mt-6 pt-4 border-t border-slate-800">
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm ${results.gClass <= 2 ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-500/30' : 'bg-amber-900/50 text-amber-400 border border-amber-500/30'}`}>
                      <LayoutPanelTop className="w-4 h-4" /> CSA S6 Section Class {results.gClass}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Area" value={results.Area} unit="mm²" />
                <StatCard label="Ix" value={results.Ix} unit="mm⁴" scientific />
                <StatCard label="Iy" value={results.Iy} unit="mm⁴" scientific />
                <StatCard label="Zx" value={results.Zx} unit="mm³" scientific />
                <StatCard label="J" value={results.J} unit="mm⁴" scientific />
                <StatCard label="Cw" value={results.Cw} unit="mm⁶" scientific />
                <StatCard label="h/w ratio" value={results.h_over_w} unit="" fixed={1} />
                <StatCard label="a/h ratio" value={results.a_over_h} unit="" fixed={3} />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <FileText className="w-5 h-5" /> Calculation Trace & Summary
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 text-[11px] font-mono mb-8">
                <div className="space-y-3">
                  <h3 className="text-sky-400 font-bold border-b border-slate-800 pb-1 uppercase tracking-widest text-[10px]">Material & Geometry</h3>
                  <ParamRow label="phi_s" value={results.phiS} />
                  <ParamRow label="E_s" value="200,000" unit="MPa" />
                  <ParamRow label="G_s" value="77,000" unit="MPa" />
                  <ParamRow label="Yield Strength (Fy)" value={results.fy} unit="MPa" />
                  <ParamRow label="Unbraced Length (L)" value={results.L} unit="mm" />
                  <ParamRow label="ho (Flange Offset)" value={results.ho.toFixed(1)} unit="mm" />
                  <ParamRow label="βx (Monosymmetry)" value={results.betaX.toFixed(1)} unit="mm" />
                  <ParamRow label="yo (CG to SC)" value={results.yo.toFixed(1)} unit="mm" />
                  <ParamRow label="B1 parameter" value={results.B1.toFixed(4)} />
                  <ParamRow label="B2 parameter" value={results.B2.toFixed(4)} />
                </div>
                
                <div className="space-y-3">
                  <h3 className="text-sky-400 font-bold border-b border-slate-800 pb-1 uppercase tracking-widest text-[10px]">Shear Strength (CSA 10.10.5)</h3>
                  <ParamRow label="Aw (Shear Area)" value={results.Aw.toFixed(0)} unit="mm²" />
                  <ParamRow label="k_v (Shear Buckling)" value={results.kv.toFixed(2)} />
                  <ParamRow label="Limit 1 (502√kv/Fy)" value={results.limit1.toFixed(1)} />
                  <ParamRow label="Limit 2 (621√kv/Fy)" value={results.limit2.toFixed(1)} />
                  <ParamRow label="Fcr (Buckling Stress)" value={results.Fcr.toFixed(1)} unit="MPa" />
                  <ParamRow label="Ft (Tension Field)" value={results.Ft.toFixed(1)} unit="MPa" />
                  <ParamRow label="Fs (Ultimate Stress)" value={results.Fs.toFixed(1)} unit="MPa" />
                  <ParamRow label="Vr (Resultant)" value={(results.Vr/1e3).toFixed(1)} unit="kN" />
                </div>
              </div>

              <h3 className="text-sky-400 font-bold border-b border-slate-800 pb-1 uppercase tracking-widest text-[10px] mb-4">Component Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm mb-6">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400">
                      <th className="py-2 font-medium">Component</th>
                      <th className="py-2 font-medium">Dimensions (mm)</th>
                      <th className="py-2 font-medium text-right">Area (mm²)</th>
                      <th className="py-2 font-medium text-right">Centroid Y (mm)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.rects.map((r: any, i: number) => (
                      <tr key={i} className="border-b border-slate-800/50">
                        <td className="py-2 text-slate-300">{r.label}</td>
                        <td className="py-2 font-mono text-slate-400">{r.b.toFixed(1)} × {r.h.toFixed(1)}</td>
                        <td className="py-2 font-mono text-slate-400 text-right">{r.area.toLocaleString(undefined, {maximumFractionDigits: 1})}</td>
                        <td className="py-2 font-mono text-slate-400 text-right">{r.cy.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800 text-[10px] text-slate-500 leading-relaxed">
                <p className="mb-2 uppercase font-bold tracking-tighter">Code Reference Notes:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Shear resistance Vr accounts for post-buckling tension field action in stiffened panels per CSA S6-19 Clause 10.10.5.1.</li>
                  <li>Critical elastic moment Mu uses the general monosymmetric formula from CSA S6.1 Clause C10.10.2.3.</li>
                  <li>Section classification based on width-to-thickness limits in Table 10.3.</li>
                  <li>Factored resistance Mr includes lateral-torsional buckling reduction using the 0.67 inelastic transition rule.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Printable Math Row ---
function PrintMath({ label, eq, val, unit, fixed, scientific }: any) {
  const displayVal = scientific 
    ? val.toExponential(2) 
    : val.toLocaleString(undefined, { maximumFractionDigits: fixed !== undefined ? fixed : 2 });
  
  return (
    <div className="flex flex-col py-2 border-b border-gray-200 text-sm">
      <div className="text-gray-700 font-semibold mb-1">{label}</div>
      <div className="flex justify-between items-end">
        <span className="font-serif italic text-gray-500">{eq}</span>
        <span className="font-mono font-bold text-black">
          = {displayVal} <span className="font-sans font-normal text-xs text-gray-500">{unit}</span>
        </span>
      </div>
    </div>
  );
}

function PrintRow({ label, val, unit }: any) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-200 text-sm">
      <span className="text-gray-700 font-semibold">{label}</span>
      <span className="font-mono font-bold text-black">
        {val} <span className="font-sans font-normal text-xs text-gray-500">{unit}</span>
      </span>
    </div>
  );
}

// --- UI Components ---

function GirderSVG({ results, printMode = false }: any) {
  const { rects, totalDepth, yBar } = results;
  const minX = Math.min(...rects.map((r: any) => r.x1)) - 60;
  const maxX = Math.max(...rects.map((r: any) => r.x2)) + 60;
  const width = maxX - minX;
  const height = totalDepth + 100;

  const mainFill = printMode ? "#f3f4f6" : "rgb(71 85 105)";
  const mainStroke = printMode ? "#1f2937" : "rgb(148 163 184)";
  const angleFill = printMode ? "#e5e7eb" : "rgb(51 65 85)";
  const angleStroke = printMode ? "#111827" : "rgb(100 116 139)";
  const naColor = printMode ? "#2563eb" : "#22c55e";

  return (
    <svg viewBox={`${minX} -50 ${width} ${height}`} className={`w-full h-full ${printMode ? '' : 'drop-shadow-2xl'}`}>
      {rects.map((r: any, i: number) => (
        <rect 
          key={i} 
          x={r.x1} 
          y={totalDepth - r.y2} 
          width={r.b} 
          height={r.h} 
          fill={r.label.includes('Angle') ? angleFill : mainFill}
          stroke={r.label.includes('Angle') ? angleStroke : mainStroke}
          strokeWidth={printMode ? "2" : "1.5"}
        />
      ))}
      <line x1={minX} y1={totalDepth - yBar} x2={maxX} y2={totalDepth - yBar} stroke={naColor} strokeWidth="3" strokeDasharray="15,10" />
      <text x={maxX - 95} y={totalDepth - yBar - 15} fill={naColor} fontSize="34" fontWeight="bold" style={printMode ? {} : { textShadow: '0 2px 10px rgba(34,197,94,0.3)' }}>N.A.</text>
    </svg>
  );
}

function PlateInput({ label, unit, ...props }: any) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center px-1">
        <label className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">{label}</label>
        {unit && <span className="text-[9px] text-slate-400 font-medium italic">{unit}</span>}
      </div>
      <input 
        className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs focus:border-sky-500 outline-none transition-colors w-full" 
        {...props} 
      />
    </div>
  );
}

function ResultRow({ label, value, unit, accent }: any) {
  return (
    <div className={`flex justify-between items-center py-2 px-3 rounded-xl border border-transparent ${accent ? 'bg-slate-800/50 border-slate-700/50' : 'hover:bg-slate-800/20'}`}>
      <span className="text-slate-400 text-xs font-medium">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={`font-mono text-lg font-bold ${accent ? 'text-sky-400' : 'text-slate-100'}`}>
          {value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
        </span>
        <span className="text-[10px] text-slate-500 font-bold">{unit}</span>
      </div>
    </div>
  );
}

function ParamRow({ label, value, unit }: any) {
  return (
    <div className="flex justify-between py-1 border-b border-slate-800/30 group">
      <span className="text-slate-500 group-hover:text-slate-400 transition-colors">{label}</span>
      <span className="text-slate-300">
        {typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value} {unit}
      </span>
    </div>
  );
}

function StatCard({ label, value, unit, scientific, scientificD = 2, fixed }: any) {
  const displayValue = scientific 
    ? value.toExponential(scientificD) 
    : value.toLocaleString(undefined, { maximumFractionDigits: fixed !== undefined ? fixed : 0 });
    
  return (
    <div className="bg-slate-800/20 p-3 rounded-xl border border-slate-800/50 hover:border-slate-700 transition-colors">
      <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="font-mono font-bold text-sm text-slate-200">{displayValue}</span>
        <span className="text-[9px] text-slate-600 font-bold">{unit}</span>
      </div>
    </div>
  );
}
