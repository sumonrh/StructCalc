'use client';

import { useState } from 'react';
import { SquareArrowDown, AlertCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

const GRID_N = 40;

export function FootingStress() {
    const { toast } = useToast();
    const [loadP, setLoadP] = useState<string>('500'); 
    const [momentX, setMomentX] = useState<string>('50');
    const [momentY, setMomentY] = useState<string>('30');
    const [widthB, setWidthB] = useState<string>('2.0'); 
    const [lengthL, setLengthL] = useState<string>('3.0'); 
    
    const [results, setResults] = useState<any>(null);
    const [isCalculating, setIsAnalyzing] = useState(false);

    const handleCalculate = () => {
        const P = parseFloat(loadP);
        const Mx = parseFloat(momentX); // Moment about X (affects Y ecc)
        const My = parseFloat(momentY); // Moment about Y (affects X ecc)
        const B = parseFloat(widthB);  // X dimension
        const L = parseFloat(lengthL); // Y dimension

        if ([P, Mx, My, B, L].some(v => isNaN(v))) {
             toast({ variant: "destructive", title: "Input Error", description: "Check all numeric inputs." });
            return;
        }

        setIsAnalyzing(true);

        // Numerical integration solver for no-tension bearing equilibrium
        setTimeout(() => {
            try {
                const dx = B / GRID_N;
                const dy = L / GRID_N;
                
                // Initial plane equation parameters: stress = a + b*x + c*y
                let a = P / (B * L);
                let b = (My * 12) / (L * Math.pow(B, 3));
                let c = (Mx * 12) / (B * Math.pow(L, 3));

                // Iterative adjustment to satisfy equilibrium while enforcing max(0, stress)
                for(let iter=0; iter < 100; iter++) {
                    let curP = 0, curMx = 0, curMy = 0;
                    for(let i=0; i<GRID_N; i++) {
                        const x = -B/2 + (i+0.5)*dx;
                        for(let j=0; j<GRID_N; j++) {
                            const y = -L/2 + (j+0.5)*dy;
                            const stress = Math.max(0, a + b*x + c*y);
                            if (stress > 0) {
                                const force = stress * dx * dy;
                                curP += force;
                                curMy += force * x;
                                curMx += force * y;
                            }
                        }
                    }
                    
                    if (Math.abs(curP - P) < 0.001 * P && Math.abs(curMx - Mx) < 0.1 && Math.abs(curMy - My) < 0.1) break;
                    
                    // Adjust parameters
                    a *= (P / (curP || 1));
                    b *= (My / (curMy || 1e-6));
                    c *= (Mx / (curMx || 1e-6));
                }

                const stressGrid: number[][] = [];
                let maxStress = 0;
                let activeCount = 0;
                for(let i=0; i<GRID_N; i++) {
                    stressGrid[i] = [];
                    const x = -B/2 + (i+0.5)*dx;
                    for(let j=0; j<GRID_N; j++) {
                        const y = -L/2 + (j+0.5)*dy;
                        const s = Math.max(0, a + b*x + c*y);
                        stressGrid[i][j] = s;
                        if (s > maxStress) maxStress = s;
                        if (s > 0) activeCount++;
                    }
                }

                setResults({ 
                    maxStress, 
                    percentArea: (activeCount / (GRID_N * GRID_N)) * 100, 
                    stressGrid, B, L, Mx, My, P 
                });
                toast({ title: "Analysis Complete", description: "Bearing pressure equilibrium found." });
            } catch (err) { console.error(err); }
            setIsAnalyzing(false);
        }, 100);
    };

    return (
        <section className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 shadow-2xl space-y-8">
            <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
                <SquareArrowDown className="h-6 w-6 text-sky-500" />
                <h2 className="text-xl font-black text-white uppercase tracking-tighter">Biaxial Footing Stress</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-4 space-y-6">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-5 bg-slate-950/50 p-8 rounded-[2rem] border border-slate-800">
                        <div className="col-span-2">
                            <FootingInput label="Axial Load (P)" unit="kN" value={loadP} onChange={(e:any) => setLoadP(e.target.value)} />
                        </div>
                        <FootingInput label="Moment Mx" unit="kNm" value={momentX} onChange={(e:any) => setMomentX(e.target.value)} />
                        <FootingInput label="Moment My" unit="kNm" value={momentY} onChange={(e:any) => setMomentY(e.target.value)} />
                        <FootingInput label="Width (B)" unit="m" value={widthB} onChange={(e:any) => setWidthB(e.target.value)} />
                        <FootingInput label="Length (L)" unit="m" value={lengthL} onChange={(e:any) => setLengthL(e.target.value)} />
                    </div>
                    <button onClick={handleCalculate} disabled={isCalculating} className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-black py-5 rounded-3xl transition-all uppercase tracking-widest text-xs shadow-xl active:scale-95 disabled:opacity-50">
                        {isCalculating ? 'Computing Equilibrium...' : 'Calculate Bearing Stress'}
                    </button>
                </div>

                <div className="lg:col-span-8 flex flex-col gap-10">
                    {results ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                                <div className="space-y-6">
                                    <div className="flex justify-between items-baseline border-b border-slate-800 pb-4">
                                        <span className="text-slate-500 font-black uppercase text-[10px] tracking-widest">Max Pressure (σ_max)</span>
                                        <span className="text-4xl font-mono font-black text-sky-400 tracking-tighter">{results.maxStress.toFixed(1)} <span className="text-sm font-normal text-slate-600">kPa</span></span>
                                    </div>
                                    <div className="flex items-center gap-4 bg-slate-950/50 p-5 rounded-2xl border border-slate-800 shadow-inner">
                                        <div className="flex-1">
                                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-1">Effective Area</span>
                                            <span className="text-lg font-mono font-black text-slate-300">{results.percentArea.toFixed(1)}% <span className="text-[10px] text-slate-600">COMPRESSED</span></span>
                                        </div>
                                        <AlertCircle className={`h-6 w-6 ${results.percentArea < 99.9 ? 'text-amber-500' : 'text-emerald-500'}`} />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <StressProfile results={results} axis="X" />
                                        <StressProfile results={results} axis="Y" />
                                    </div>
                                </div>

                                <div className="bg-slate-950 p-6 rounded-[2.5rem] border-2 border-slate-800 shadow-inner flex flex-col items-center">
                                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4 w-full text-center">Footing Plan (Stress Map)</span>
                                    <div className="w-full aspect-square relative">
                                        <FootingPlan results={results} />
                                    </div>
                                    <div className="mt-6 flex gap-6 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-sky-500 opacity-90 rounded-sm"></div> Max Stress</div>
                                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-slate-800 rounded-sm"></div> No Contact</div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-grow bg-slate-950/30 border-2 border-dashed border-slate-800 rounded-[3rem] flex items-center justify-center text-slate-700 font-black uppercase tracking-[0.2em]">
                            Enter parameters to view stress distribution
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

function FootingPlan({ results }: { results: any }) {
    const { B, L, stressGrid, maxStress } = results;
    const padding = 20;
    const svgSize = 300;
    
    const scale = (svgSize - 2 * padding) / Math.max(B, L);
    const wPx = B * scale;
    const hPx = L * scale;
    const x0 = (svgSize - wPx) / 2;
    const y0 = (svgSize - hPx) / 2;

    const cells = [];
    const cellW = wPx / GRID_N;
    const cellH = hPx / GRID_N;

    for (let i = 0; i < GRID_N; i++) {
        for (let j = 0; j < GRID_N; j++) {
            const stress = stressGrid[i][j];
            if (stress > 0) {
                const opacity = 0.2 + 0.8 * (stress / maxStress);
                cells.push(
                    <rect 
                        key={`${i}-${j}`} 
                        x={x0 + i * cellW} 
                        y={y0 + (GRID_N - 1 - j) * cellH} 
                        width={cellW + 0.5} 
                        height={cellH + 0.5} 
                        fill="#0ea5e9" 
                        fillOpacity={opacity} 
                    />
                );
            }
        }
    }

    return (
        <svg viewBox={`0 0 ${svgSize} ${svgSize}`} className="w-full h-full">
            <rect x={x0} y={y0} width={wPx} height={hPx} fill="none" stroke="#1e293b" strokeWidth="2" rx="4" />
            {cells}
            <line x1={x0} y1={y0 + hPx/2} x2={x0 + wPx} y2={y0 + hPx/2} stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
            <line x1={x0 + wPx/2} y1={y0} x2={x0 + wPx/2} y2={y0 + hPx} stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
            <text x={x0 + wPx + 5} y={y0 + hPx/2} fill="#475569" fontSize="10" className="font-bold">X</text>
            <text x={x0 + wPx/2} y={y0 - 5} fill="#475569" fontSize="10" className="font-bold text-center" textAnchor="middle">Y</text>
        </svg>
    );
}

function StressProfile({ results, axis }: { results: any, axis: 'X' | 'Y' }) {
    const { stressGrid, maxStress } = results;
    const svgW = 150, svgH = 80;
    const padding = 10;
    
    const points = [];
    const n = GRID_N;
    for (let i = 0; i < n; i++) {
        let maxAtStation = 0;
        for (let j = 0; j < n; j++) {
            const s = axis === 'X' ? stressGrid[i][j] : stressGrid[j][i];
            if (s > maxAtStation) maxAtStation = s;
        }
        points.push(maxAtStation);
    }

    const xScale = (i: number) => padding + (i / (n-1)) * (svgW - 2*padding);
    const yScale = (s: number) => (svgH - padding) - (s / (maxStress || 1)) * (svgH - 2*padding);

    const pathData = `M ${xScale(0)},${yScale(0)} ` + 
                     points.map((s, i) => `L ${xScale(i)},${yScale(s)}`).join(' ') + 
                     ` L ${xScale(n-1)},${yScale(0)} Z`;

    return (
        <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
            <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block mb-2">Profile {axis}-Axis</span>
            <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full">
                <path d={pathData} fill="#0ea5e9" fillOpacity="0.2" stroke="#0ea5e9" strokeWidth="1.5" />
                <line x1={padding} y1={svgH - padding} x2={svgW - padding} y2={svgH - padding} stroke="#334155" strokeWidth="1" />
            </svg>
        </div>
    );
}

function FootingInput({ label, unit, ...props }: any) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex justify-between px-1">
                <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest">{label}</label>
                <span className="text-[8px] text-sky-500 font-bold">{unit}</span>
            </div>
            <input className="bg-slate-950 border-2 border-slate-800 rounded-2xl p-4 text-xs font-bold text-white focus:border-sky-500 outline-none transition-all shadow-inner" {...props} />
        </div>
    );
}
