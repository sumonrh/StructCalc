'use client';

import React, { useState, useMemo } from 'react';
import { 
  Settings2, Calculator, ArrowRight, Layers, Ruler, 
  Mountain, ShieldAlert, HelpCircle, Info, Activity, 
  Table, FileText, CheckCircle2, AlertCircle 
} from 'lucide-react';
import { cn } from '@/lib/utils';

const BAR_SIZES = {
  '10M': { area: 100, d: 11.3 },
  '15M': { area: 200, d: 16.0 },
  '20M': { area: 300, d: 19.5 },
  '25M': { area: 500, d: 25.2 },
  '30M': { area: 700, d: 29.9 },
  '35M': { area: 1000, d: 35.7 },
};

export function WingwallDesign() {
  const [params, setParams] = useState({
    Lw: 6.0, tw: 0.5, h1: 5.0, h3: 2.0, L3: 0.5, Lc: 1.5, tc: 0.8, h2: 4.5,
    gsoil: 20.0, phi: 32.0, theta: 0.0,
    fc: 35.0, fy: 400.0, phic: 0.65, phis: 0.85, cover: 50, 
    barSizeMain: '20M',
    barSizeSec: '15M',
    psur: 12.0, pcomp: 10.0, hc: 1.5, Pcol: 50.0,
    lf1: 1.25, lf2: 1.5, lf3: 1.5, lf4: 1.0
  });

  const [activeSubTab, setActiveSubTab] = useState('input');

  const handleParamChange = (key: string, value: string) => {
    setParams(prev => ({ ...prev, [key]: parseFloat(value) || 0 }));
  };

  const handleTextChange = (key: string, value: string) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  // --------------------------------------------------------------------------
  // Core Engineering Calculations
  // --------------------------------------------------------------------------
  const results = useMemo(() => {
    const {
      Lw, h1, h3, L3, Lc, tc, h2, gsoil, phi, theta,
      fc, fy, phic, phis, cover, barSizeMain, barSizeSec,
      psur, pcomp, hc, Pcol, lf1, lf2, lf3, lf4, tw
    } = params;

    const rad = Math.PI / 180;
    
    // 1. Earth Pressure Coefficient
    let Ka = 0;
    if (theta >= phi) Ka = 1.0; 
    else {
      const cosT = Math.cos(theta * rad);
      const cosP = Math.cos(phi * rad);
      const root = Math.sqrt(Math.max(0, cosT * cosT - cosP * cosP));
      Ka = cosT * (cosT - root) / (cosT + root);
    }

    // 2. Numerical Integration for Cantilever Moments
    const points = 60;
    const dx = Lw / points;
    const momentCurve: any[] = [];
    let V_ep = 0, M_ep = 0, V_sur = 0, M_sur = 0, V_comp = 0, M_comp = 0;

    const getH = (x: number) => {
      if (x <= Lc) return h1 + (h2 - h1) * (x / Lc);
      if (x <= Lw - L3) {
        const span = Lw - Lc - L3;
        return span > 0 ? h2 + (h3 - h2) * ((x - Lc) / span) : h3;
      }
      return h3;
    };

    for (let j = 0; j <= points; j++) {
      const x_cut = j * dx;
      let m_total_at_x = 0;
      const subSlices = 50;
      const subDx = (Lw - x_cut) / subSlices;
      
      for(let i = 0; i < subSlices; i++) {
        const x_curr = x_cut + i * subDx + subDx/2;
        const H = getH(x_curr);
        const lever = x_curr - x_cut;
        const dV_ep = 0.5 * Ka * gsoil * Math.pow(H, 2) * subDx;
        const dV_sur = Ka * psur * H * subDx;
        const H_comp = Math.min(H, hc);
        const dV_comp = pcomp * H_comp * subDx;
        m_total_at_x += (lf1 * dV_ep + lf2 * dV_sur + lf3 * dV_comp) * lever;
        if (j === 0) {
           V_ep += dV_ep; M_ep += dV_ep * x_curr;
           V_sur += dV_sur; M_sur += dV_sur * x_curr;
           V_comp += dV_comp; M_comp += dV_comp * x_curr;
        }
      }
      if (x_cut < Lw - 0.5) { m_total_at_x += lf4 * Pcol * (Lw - 0.5 - x_cut); }
      momentCurve.push({ x: x_cut, m: m_total_at_x });
    }

    const V_col = Pcol;
    const M_col = Pcol * (Lw - 0.5);
    const M_total_root = momentCurve[0].m;
    const Mf_per_m = M_total_root / h1;

    // 3. Reinforcement Analysis
    const barMain = BAR_SIZES[barSizeMain as keyof typeof BAR_SIZES];
    const dMain = tc * 1000 - cover - (barMain.d / 2); 
    const b = 1000;
    const alpha1 = Math.max(0.67, 0.85 - 0.0015 * fc);
    const constA = Math.pow(fy * phis, 2) / (2 * alpha1 * fc * phic * b);
    const constB = -fy * phis * dMain;
    const constC = Mf_per_m * 1e6;
    const disc = constB * constB - 4 * constA * constC;
    
    let As_req = 0;
    if (disc >= 0 && dMain > 0) {
      As_req = Math.min((-constB + Math.sqrt(disc)) / (2 * constA), (-constB - Math.sqrt(disc)) / (2 * constA));
    }

    const fcr = 0.4 * Math.sqrt(fc);
    const Ig = (b * Math.pow(tc * 1000, 3)) / 12;
    const Mcr = (fcr * Ig / (tc * 500)) / 1e6; 
    const As_min = 0.002 * b * (tc * 1000); 
    const As_final_main = Math.max(As_req, Mf_per_m < 1.2 * Mcr ? As_min : 0);
    let spacingMain = Math.floor((barMain.area * 1000) / As_final_main);
    spacingMain = Math.min(300, Math.max(75, Math.floor(spacingMain / 25) * 25));

    const barSec = BAR_SIZES[barSizeSec as keyof typeof BAR_SIZES];
    const As_sec = 0.002 * b * (tw * 1000); 
    let spacingSec = Math.floor((barSec.area * 1000) / As_sec);
    spacingSec = Math.min(300, Math.max(100, Math.floor(spacingSec / 25) * 25));

    return {
      Ka, M_total_root, Mf_per_m, As_req, spacingMain, spacingSec, momentCurve, flexureOK: disc >= 0,
      breakdown: {
        ep: { V: V_ep, M: M_ep, lf: lf1 },
        sur: { V: V_sur, M: M_sur, lf: lf2 },
        comp: { V: V_comp, M: M_comp, lf: lf3 },
        col: { V: V_col, M: M_col, lf: lf4 }
      }
    };
  }, [params]);

  // SVG Drawing Values
  const Lw_val = params.Lw || 1;
  const H_max = Math.max(params.h1, params.h2, params.h3) || 1;
  const elScale = Math.min(650 / Lw_val, 400 / H_max);
  const tx = (x: number) => 120 + x * elScale;
  const ty = (y: number) => 40 + y * elScale;

  const generateReport = () => {
    const reportHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Wingwall Design Report</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.5; color: #333; max-width: 900px; margin: 40px auto; padding: 0 20px; }
          h1 { font-size: 24px; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 30px; text-transform: uppercase; color: #1e3a8a; }
          h2 { font-size: 18px; margin-top: 30px; color: #475569; text-transform: uppercase; border-left: 4px solid #3b82f6; padding-left: 10px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
          th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
          th { background-color: #f8fafc; color: #64748b; font-weight: bold; text-transform: uppercase; font-size: 11px; }
          .summary { background: #eff6ff; padding: 20px; border-radius: 12px; border: 1px solid #bfdbfe; margin-top: 30px; }
          .summary-title { font-weight: 900; color: #1e40af; margin-bottom: 10px; font-size: 14px; }
          .rebar { font-size: 24px; font-weight: 900; color: #2563eb; }
          .footer { margin-top: 50px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
          svg { width: 100%; height: auto; background: #f8fafc; border-radius: 8px; border: 1px solid #f1f5f9; margin: 10px 0; }
          @media print { .no-print { display: none; } body { margin: 20px; } }
        </style>
      </head>
      <body>
        <h1>Wingwall Structural Design Report</h1>
        <p style="font-size: 12px; color: #64748b;">Generated on: ${new Date().toLocaleString()}</p>

        <h2>1. Design Parameters</h2>
        <table>
          <tr><th>Wall Length (Lw)</th><td>${params.Lw} m</td><th>Fixed Height (h1)</th><td>${params.h1} m</td></tr>
          <tr><th>Cleat Height (h2)</th><td>${params.h2} m</td><th>Free Height (h3)</th><td>${params.h3} m</td></tr>
          <tr><th>Wall Thick. (tc/tw)</th><td>${params.tc} / ${params.tw} m</td><th>Concrete (fc')</th><td>${params.fc} MPa</td></tr>
          <tr><th>Yield Strength (fy)</th><td>${params.fy} MPa</td><th>Friction Angle (phi)</th><td>${params.phi}&deg;</td></tr>
        </table>

        <h2>2. Load Breakdown (Section 1-1 Root)</h2>
        <table>
          <thead>
            <tr><th>Load Case</th><th>Unfactored V (kN)</th><th>Unfactored M (kNm)</th><th>Factor</th><th>Factored M (kNm)</th></tr>
          </thead>
          <tbody>
            <tr><td>Earth Pressure</td><td>${results.breakdown.ep.V.toFixed(1)}</td><td>${results.breakdown.ep.M.toFixed(1)}</td><td>${results.breakdown.ep.lf}</td><td>${(results.breakdown.ep.M * results.breakdown.ep.lf).toFixed(1)}</td></tr>
            <tr><td>Surcharge</td><td>${results.breakdown.sur.V.toFixed(1)}</td><td>${results.breakdown.sur.M.toFixed(1)}</td><td>${results.breakdown.sur.lf}</td><td>${(results.breakdown.sur.M * results.breakdown.sur.lf).toFixed(1)}</td></tr>
            <tr><td>Compaction</td><td>${results.breakdown.comp.V.toFixed(1)}</td><td>${results.breakdown.comp.M.toFixed(1)}</td><td>${results.breakdown.comp.lf}</td><td>${(results.breakdown.comp.M * results.breakdown.comp.lf).toFixed(1)}</td></tr>
            <tr><td>Collision</td><td>${results.breakdown.col.V.toFixed(1)}</td><td>${results.breakdown.col.M.toFixed(1)}</td><td>${results.breakdown.col.lf}</td><td>${(results.breakdown.col.M * results.breakdown.col.lf).toFixed(1)}</td></tr>
          </tbody>
          <tfoot>
            <tr style="background:#f1f5f9; font-weight:bold;"><td>TOTAL ROOT DEMAND</td><td></td><td></td><td></td><td>${results.M_total_root.toFixed(1)} kNm</td></tr>
          </tfoot>
        </table>

        <div class="summary">
          <div class="summary-title">RECOMMENDED REINFORCEMENT SCHEDULE</div>
          <div class="rebar">${params.barSizeMain} @ ${results.spacingMain} mm (Horizontal Main)</div>
          <div style="font-size: 18px; font-weight: 600; color: #64748b; margin-top:5px;">${params.barSizeSec} @ ${results.spacingSec} mm (Vertical Secondary)</div>
          <div style="margin-top: 15px; font-size: 12px; font-weight: bold; color: #1e3a8a;">
            Design Demand Mf = ${results.Mf_per_m.toFixed(1)} kNm/m | Status: ${results.flexureOK ? 'PASS' : 'FAIL - REVISE THICKNESS'}
          </div>
        </div>

        <div class="footer">
          Design Tool Version 1.2 | For engineering estimation only. Not for construction.
        </div>
        <div class="no-print" style="margin-top: 20px;">
           <button onclick="window.print()" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Print or Save as PDF</button>
        </div>
      </body>
      </html>
    `;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(reportHtml);
      win.document.close();
    }
  };

  return (
    <section className="bg-card border-2 border-border rounded-[2.5rem] p-8 shadow-2xl space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-border pb-6">
        <div className="flex items-center gap-4">
          <Mountain className="h-8 w-8 text-sky-500" />
          <div>
            <h2 className="text-2xl font-black text-foreground uppercase tracking-tighter italic">Wingwall Design Pro</h2>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Cantilever Retaining Element (Root Fixed)</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-background p-1.5 rounded-2xl border border-border shadow-inner">
          <button onClick={generateReport} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-foreground text-background hover:opacity-90 transition-all shadow-lg">
            <FileText className="w-3.5 h-3.5" /> Generate Report
          </button>
          <div className="h-8 w-px bg-border mx-1" />
          <div className="flex gap-1">
            {['input', 'results', 'help'].map(tab => (
              <button key={tab} onClick={() => setActiveSubTab(tab)} className={cn("px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", activeSubTab === tab ? "bg-sky-500 text-white dark:text-slate-950" : "text-muted-foreground hover:text-foreground")}>
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Parameters Sidebar */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-background/50 border border-border p-6 rounded-[2rem] space-y-8 shadow-inner max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-sky-500 uppercase tracking-widest flex items-center gap-2"><Ruler className="w-3 h-3" /> Geometry</h3>
              <div className="grid grid-cols-2 gap-4">
                <WingInput label="Lw (Len)" unit="m" value={params.Lw} onChange={(v: string) => handleParamChange('Lw', v)} />
                <WingInput label="h1 (Fixed)" unit="m" value={params.h1} onChange={(v: string) => handleParamChange('h1', v)} />
                <WingInput label="h2 (Cleat)" unit="m" value={params.h2} onChange={(v: string) => handleParamChange('h2', v)} />
                <WingInput label="h3 (Free)" unit="m" value={params.h3} onChange={(v: string) => handleParamChange('h3', v)} />
                <WingInput label="tc (Root)" unit="m" value={params.tc} onChange={(v: string) => handleParamChange('tc', v)} />
                <WingInput label="tw (End)" unit="m" value={params.tw} onChange={(v: string) => handleParamChange('tw', v)} />
              </div>
            </div>

            <div className="space-y-4 border-t border-border pt-6">
              <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-2"><ShieldAlert className="w-3 h-3" /> Reinforcement</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1 block">Main Bar (Horiz)</label>
                  <select className="w-full bg-background border-2 border-border rounded-xl p-3 text-xs font-bold text-foreground outline-none focus:border-sky-500 transition-all" value={params.barSizeMain} onChange={(e) => handleTextChange('barSizeMain', e.target.value)}>
                    {Object.keys(BAR_SIZES).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <WingInput label="Cover" unit="mm" value={params.cover} onChange={(v: string) => handleParamChange('cover', v)} />
                <WingInput label="Yield fy" unit="MPa" value={params.fy} onChange={(v: string) => handleParamChange('fy', v)} />
              </div>
            </div>

            <div className="space-y-4 border-t border-border pt-6">
              <h3 className="text-[10px] font-black text-sky-500 uppercase tracking-widest flex items-center gap-2"><Mountain className="w-3 h-3" /> Site Loads</h3>
              <div className="grid grid-cols-2 gap-4">
                <WingInput label="Fric. φ" unit="°" value={params.phi} onChange={(v: string) => handleParamChange('phi', v)} />
                <WingInput label="Dens. γ" unit="kN/m³" value={params.gsoil} onChange={(v: string) => handleParamChange('gsoil', v)} />
                <WingInput label="Surcharge" unit="kPa" value={params.psur} onChange={(v: string) => handleParamChange('psur', v)} />
                <WingInput label="Collision" unit="kN" value={params.Pcol} onChange={(v: string) => handleParamChange('Pcol', v)} />
              </div>
            </div>
          </div>
        </aside>

        {/* Dynamic Display Area */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          {activeSubTab === 'input' && (
            <div className="flex flex-col gap-8 flex-grow">
              <div className="bg-background rounded-[2.5rem] border-4 border-border shadow-inner p-10 flex flex-col items-center relative group">
                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-6 w-full flex items-center gap-2"><Info className="w-3 h-3 text-sky-500" /> Elevation Visualization</h4>
                <div className="w-full aspect-[16/9] flex items-center justify-center">
                  <svg viewBox="0 0 800 500" className="w-full h-full drop-shadow-2xl overflow-visible">
                    <path d={`M ${tx(0)} ${ty(0)} L ${tx(params.Lw)} ${ty(0)} L ${tx(params.Lw)} ${ty(params.h3)} L ${tx(params.Lw - params.L3)} ${ty(params.h3)} L ${tx(params.Lc)} ${ty(params.h2)} L ${tx(0)} ${ty(params.h1)} Z`} 
                      fill="currentColor" className="text-sky-500/10" stroke="currentColor" className="text-sky-500" strokeWidth="3" strokeLinejoin="round" />
                    <text x={tx(params.Lw/2)} y={ty(0)-35} fontSize="14" fill="currentColor" className="text-muted-foreground" textAnchor="middle" fontWeight="black" className="uppercase tracking-widest">Lw = {params.Lw} m</text>
                    <text x={tx(0)-50} y={ty(params.h1/2)} fontSize="14" fill="currentColor" className="text-sky-500" textAnchor="middle" transform={`rotate(-90 ${tx(0)-50} ${ty(params.h1/2)})`} fontWeight="black">H1 = {params.h1} m</text>
                    <line x1={tx(0)} y1={ty(0)} x2={tx(0)} y2={ty(params.h1)} stroke="currentColor" className="text-red-500" strokeWidth="4" strokeDasharray="10 5" />
                    <text x={tx(0)+15} y={ty(params.h1/2)} fontSize="10" fill="currentColor" className="text-red-500" fontWeight="black" className="uppercase tracking-widest italic">Fixed Root</text>
                  </svg>
                </div>
              </div>

              <div className="bg-background rounded-[2.5rem] border border-border shadow-inner p-8">
                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-6 flex items-center gap-2"><Activity className="w-3 h-3 text-emerald-500" /> Factored Moment Profile</h4>
                <div className="w-full h-48 flex items-center justify-center">
                  <svg viewBox="0 0 800 240" className="w-full h-full overflow-visible">
                    <defs><linearGradient id="momentGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#10b981" stopOpacity="0.2" /><stop offset="100%" stopColor="#10b981" stopOpacity="0" /></linearGradient></defs>
                    <line x1={tx(0)} y1={30} x2={tx(params.Lw)} y2={30} stroke="currentColor" className="text-border" strokeWidth="2" />
                    <path d={`M ${tx(0)} 30 ${results.momentCurve.map(p => `L ${tx(p.x)} ${30 + (p.m / results.M_total_root) * 160}`).join(' ')} L ${tx(params.Lw)} 30 Z`} fill="url(#momentGrad)" />
                    <path d={`M ${tx(0)} 30 ${results.momentCurve.map(p => `L ${tx(p.x)} ${30 + (p.m / results.M_total_root) * 160}`).join(' ')}`} fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round" />
                    <text x={tx(0)-20} y={210} fontSize="20" fill="#10b981" fontWeight="black" textAnchor="end" className="tracking-tighter font-mono">{results.M_total_root.toFixed(0)} <tspan fontSize="10">kNm</tspan></text>
                  </svg>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'results' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
              <div className="bg-background border-2 border-border rounded-[2.5rem] shadow-xl overflow-hidden">
                <div className="bg-card px-10 py-5 border-b border-border flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Table className="w-4 h-4 text-sky-500" />
                    <h3 className="font-black uppercase text-[10px] text-foreground tracking-[0.2em]">Factored Load Integration</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Root Demand:</span>
                    <span className="text-xl font-black text-sky-500 font-mono tracking-tighter">{results.M_total_root.toFixed(1)} kNm</span>
                  </div>
                </div>
                <div className="p-10 overflow-x-auto">
                  <table className="w-full text-left text-xs font-bold">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border font-black uppercase text-[9px] tracking-widest">
                        <th className="pb-4 px-2">Load Component</th>
                        <th className="pb-4 px-2">Unfactored V (kN)</th>
                        <th className="pb-4 px-2">Unfactored M (kNm)</th>
                        <th className="pb-4 px-2">Factor</th>
                        <th className="pb-4 px-2 text-right">Factored M (kNm)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { name: "Earth Pressure", key: "ep" }, { name: "Surcharge Load", key: "sur" },
                        { name: "Compaction Pres.", key: "comp" }, { name: "Barrier / Crash", key: "col" }
                      ].map((row, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-sky-500/5 transition-colors">
                          <td className="py-5 px-2 text-foreground">{row.name}</td>
                          <td className="py-5 px-2 font-mono">{results.breakdown[row.key as keyof typeof results.breakdown].V.toFixed(1)}</td>
                          <td className="py-5 px-2 font-mono">{results.breakdown[row.key as keyof typeof results.breakdown].M.toFixed(1)}</td>
                          <td className="py-5 px-2 text-muted-foreground italic">x{results.breakdown[row.key as keyof typeof results.breakdown].lf}</td>
                          <td className="py-5 px-2 text-right text-sky-500 font-black font-mono">{(results.breakdown[row.key as keyof typeof results.breakdown].M * results.breakdown[row.key as keyof typeof results.breakdown].lf).toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className={cn("p-10 rounded-[2.5rem] border-2 shadow-2xl flex flex-col justify-center gap-2", results.flexureOK ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20")}>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Calculator className="w-3 h-3" /> Flexural Capacity</h3>
                    {results.flexureOK ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] font-black uppercase text-foreground">Demand (Mf)</span>
                    <span className="text-3xl font-mono font-black tracking-tighter text-foreground">{results.Mf_per_m.toFixed(1)} <span className="text-xs font-normal opacity-50">kNm/m</span></span>
                  </div>
                  <p className={cn("text-[9px] font-black uppercase tracking-widest mt-2", results.flexureOK ? "text-emerald-500" : "text-red-500")}>
                    {results.flexureOK ? "Strength Criteria Pass" : "Fail - Increase Root Thickness (tc)"}
                  </p>
                </div>

                <div className="bg-background/50 border border-border p-10 rounded-[2.5rem] flex flex-col justify-center gap-2 shadow-inner">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2"><Layers className="w-3 h-3" /> Earth Coefficients</h3>
                  <div className="flex justify-between items-baseline border-b border-border pb-3">
                    <span className="text-[10px] font-black uppercase">Active Ka</span>
                    <span className="text-2xl font-mono font-black tracking-tighter text-sky-500">{results.Ka.toFixed(3)}</span>
                  </div>
                  <p className="text-[8px] text-muted-foreground uppercase font-black tracking-tighter mt-1 italic">Based on Rankine simplified for frictionless wall back</p>
                </div>
              </div>

              <div className="bg-foreground p-12 rounded-[3rem] text-background shadow-2xl flex flex-col md:flex-row items-center justify-between gap-12 group overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
                <div className="space-y-6 relative z-10 flex-grow">
                  <h3 className="text-[10px] font-black uppercase opacity-40 tracking-[0.3em]">Reinforcement Schedule</h3>
                  <div className="space-y-2">
                    <div className="text-5xl font-black tracking-tighter text-sky-400 group-hover:scale-105 transition-transform origin-left">{params.barSizeMain} @ {results.spacingMain} <span className="text-xl">mm</span></div>
                    <div className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                      <div className="w-8 h-1 bg-sky-500 rounded-full" /> Horizontal Main Tension
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-background/10 pt-6">
                    <div className="text-3xl font-black text-slate-400">{params.barSizeSec} @ {results.spacingSec} <span className="text-lg">mm</span></div>
                    <div className="text-[10px] font-black uppercase opacity-40 flex items-center gap-2">
                      <div className="w-8 h-1 bg-slate-600 rounded-full" /> Vertical Secondary Shrinkage
                    </div>
                  </div>
                </div>
                <div className="bg-background/5 p-8 rounded-[2rem] border border-background/10 text-center min-w-[220px] relative z-10 backdrop-blur">
                  <p className="text-[10px] font-black uppercase opacity-40 mb-3 tracking-widest">Effective Steel Area</p>
                  <p className="text-4xl font-black text-sky-400 tracking-tighter">{(BAR_SIZES[params.barSizeMain as keyof typeof BAR_SIZES].area * 1000 / results.spacingMain).toFixed(0)}</p>
                  <p className="text-[10px] font-black uppercase text-background mt-1 bg-sky-500 px-3 py-1 rounded-lg inline-block">mm²/m</p>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'help' && (
            <div className="bg-background border border-border rounded-[2.5rem] shadow-inner p-12 space-y-10 animate-in fade-in duration-500">
              <h2 className="text-3xl font-black text-foreground uppercase tracking-tighter italic flex items-center gap-4">
                <HelpCircle className="w-8 h-8 text-sky-500" /> System Manual
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <div className="bg-card border border-border p-6 rounded-2xl">
                    <h3 className="font-black text-[10px] uppercase text-sky-500 mb-2 tracking-widest">Calculation Basis</h3>
                    <p className="text-xs font-bold leading-relaxed text-muted-foreground uppercase">
                      Analysis is performed per meter height. Lateral loads are integrated numerically over the wall length. Root moment is calculated assuming a fixed cantilever connection to the abutment or pile cap.
                    </p>
                  </div>
                  <div className="bg-card border border-border p-6 rounded-2xl">
                    <h3 className="font-black text-[10px] uppercase text-amber-500 mb-2 tracking-widest">Compaction Pressure</h3>
                    <p className="text-xs font-bold leading-relaxed text-muted-foreground uppercase">
                      Applied as a uniform pressure from the surface to depth 'hc'. Represents the residual pressure from heavy equipment compaction during backfill.
                    </p>
                  </div>
                </div>
                
                <div className="bg-sky-500/5 border-2 border-dashed border-sky-500/20 p-8 rounded-[2.5rem] flex flex-col justify-center gap-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-sky-500 p-3 rounded-2xl shadow-lg"><FileText className="w-6 h-6 text-background" /></div>
                    <h4 className="text-lg font-black uppercase tracking-tighter">Instant Export</h4>
                  </div>
                  <p className="text-xs font-black text-muted-foreground uppercase leading-loose">
                    The "Generate Report" engine produces a standalone, high-fidelity HTML document. This report is formatted for A4 printing and includes:
                  </p>
                  <ul className="text-[10px] font-black uppercase text-foreground space-y-2 list-disc pl-5 opacity-70">
                    <li>Comprehensive Input Matrix</li>
                    <li>Factored Load Breakdown Table</li>
                    <li>Dimensioned Wingwall Elevation</li>
                    <li>Professional Rebar Schedule</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function WingInput({ label, unit, ...props }: any) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between px-1">
        <label className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">{label}</label>
        <span className="text-[8px] text-sky-500 font-black italic">{unit}</span>
      </div>
      <input 
        className="bg-background border-2 border-border rounded-xl p-3 text-xs font-bold text-foreground focus:border-sky-500 outline-none transition-all shadow-inner" 
        type="number"
        step="0.1"
        {...props} 
      />
    </div>
  );
}
