'use client';

import { useState } from 'react';
import { Columns } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

const REBAR_SIZES = [
    { label: '10M', dia: 0.0113 },
    { label: '15M', dia: 0.0160 },
    { label: '20M', dia: 0.0195 },
    { label: '25M', dia: 0.0252 },
    { label: '30M', dia: 0.0299 },
    { label: '35M', dia: 0.0357 },
    { label: '45M', dia: 0.0437 },
    { label: '55M', dia: 0.0564 },
];

interface CalculationDetails {
    alpha1: number;
    beta1: number;
    d: number;
    a: number;
    c: number;
    c_d_ratio: number;
    As_total: number;
}

export function RCSectionDesign() {
    const { toast } = useToast();
    const [width, setWidth] = useState<string>('0.3');
    const [height, setHeight] = useState<string>('0.5');
    
    const [botRebarCount, setBotRebarCount] = useState<string>('4');
    const [botRebarSizeIdx, setBotRebarSizeIdx] = useState<number>(3); // 25M
    
    const [topRebarCount, setTopRebarCount] = useState<string>('2');
    const [topRebarSizeIdx, setTopRebarSizeIdx] = useState<number>(1); // 15M
    
    const [stirrupSizeIdx, setStirrupSizeIdx] = useState<number>(0); // 10M
    const [clearCover, setClearCover] = useState<string>('0.04');
    
    const [concreteStrength, setConcreteStrength] = useState<string>('30');
    const [steelStrength, setSteelStrength] = useState<string>('400');
    
    const [momentCapacity, setMomentCapacity] = useState<number | null>(null);
    const [calculationDetails, setCalculationDetails] = useState<CalculationDetails | null>(null);

    const handleCalculate = () => {
        const b = parseFloat(width);
        const h = parseFloat(height);
        const countBot = parseInt(botRebarCount) || 0;
        const countTop = parseInt(topRebarCount) || 0;
        const cover = parseFloat(clearCover);
        const fc = parseFloat(concreteStrength);
        const fy = parseFloat(steelStrength);

        const diaBot = REBAR_SIZES[botRebarSizeIdx].dia;
        const diaTop = REBAR_SIZES[topRebarSizeIdx].dia;
        const diaStirrup = REBAR_SIZES[stirrupSizeIdx].dia;

        if (isNaN(b) || isNaN(h) || isNaN(fc) || isNaN(fy)) {
            toast({ variant: "destructive", title: "Input Error", description: "Please fill all required fields." });
            return;
        }

        try {
            const As_bot = countBot * Math.PI * Math.pow(diaBot / 2, 2);
            const As_top = countTop * Math.PI * Math.pow(diaTop / 2, 2);
            
            const phi_c = 0.75;
            const phi_s = 0.90;
            const alpha1 = Math.max(0.67, 0.85 - 0.0015 * fc);
            const beta1 = Math.max(0.67, 0.97 - 0.0025 * fc);
            
            const d = h - cover - diaStirrup - (diaBot / 2); 
            
            // Equilibrium: alpha1 * phi_c * fc * b * (beta1 * c) = As_bot * phi_s * fy
            const c = (As_bot * phi_s * fy) / (alpha1 * phi_c * fc * b * beta1);
            const a = beta1 * c;
            
            const Mr_MNm = As_bot * phi_s * fy * (d - a / 2);
            const Mr_kNm = Mr_MNm * 1000;

            setMomentCapacity(Mr_kNm);
            setCalculationDetails({ alpha1, beta1, d, a, c, c_d_ratio: c / d, As_total: As_bot + As_top });
            toast({ title: "Success", description: "RC Beam Section analysis complete." });
        } catch (err: any) {
             toast({ variant: "destructive", title: "Error", description: err.message });
        }
    };

    return (
        <section className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 shadow-2xl space-y-8">
            <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
                <Columns className="h-6 w-6 text-sky-500" />
                <h2 className="text-xl font-black text-white uppercase tracking-tighter">RC Beam Section (CSA S6-19)</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-7 space-y-6">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                        <RCInput label="Width (b)" unit="m" value={width} onChange={(e: any) => setWidth(e.target.value)} />
                        <RCInput label="Height (h)" unit="m" value={height} onChange={(e: any) => setHeight(e.target.value)} />
                        
                        <div className="col-span-2 grid grid-cols-2 gap-6 bg-slate-950/50 p-6 rounded-3xl border border-slate-800">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-sky-500 uppercase tracking-widest block">Bottom Reinforcement</label>
                                <RCInput label="No. Bars" unit="qty" value={botRebarCount} onChange={(e: any) => setBotRebarCount(e.target.value)} />
                                <div className="space-y-2">
                                    <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Rebar Size</label>
                                    <select 
                                        value={botRebarSizeIdx} 
                                        onChange={(e) => setBotRebarSizeIdx(parseInt(e.target.value))}
                                        className="w-full bg-slate-950 border-2 border-slate-800 rounded-xl p-3 text-xs font-bold text-white focus:border-sky-500 outline-none"
                                    >
                                        {REBAR_SIZES.map((size, idx) => (
                                            <option key={size.label} value={idx}>{size.label} ({ (size.dia * 1000).toFixed(1) }mm)</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest block">Top Reinforcement</label>
                                <RCInput label="No. Bars" unit="qty" value={topRebarCount} onChange={(e: any) => setTopRebarCount(e.target.value)} />
                                <div className="space-y-2">
                                    <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Rebar Size</label>
                                    <select 
                                        value={topRebarSizeIdx} 
                                        onChange={(e) => setTopRebarSizeIdx(parseInt(e.target.value))}
                                        className="w-full bg-slate-950 border-2 border-slate-800 rounded-xl p-3 text-xs font-bold text-white focus:border-sky-500 outline-none"
                                    >
                                        {REBAR_SIZES.map((size, idx) => (
                                            <option key={size.label} value={idx}>{size.label} ({ (size.dia * 1000).toFixed(1) }mm)</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest px-1">Stirrup Size</label>
                            <select 
                                value={stirrupSizeIdx} 
                                onChange={(e) => setStirrupSizeIdx(parseInt(e.target.value))}
                                className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-4 text-xs font-bold text-white focus:border-sky-500 outline-none shadow-inner"
                            >
                                {REBAR_SIZES.slice(0, 3).map((size, idx) => (
                                    <option key={size.label} value={idx}>{size.label} ({ (size.dia * 1000).toFixed(1) }mm)</option>
                                ))}
                            </select>
                        </div>
                        <RCInput label="Cover" unit="m" value={clearCover} onChange={(e: any) => setClearCover(e.target.value)} />
                        
                        <RCInput label="f'c" unit="MPa" value={concreteStrength} onChange={(e: any) => setConcreteStrength(e.target.value)} />
                        <RCInput label="fy" unit="MPa" value={steelStrength} onChange={(e: any) => setSteelStrength(e.target.value)} />
                    </div>

                    <button onClick={handleCalculate} className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-black py-5 rounded-3xl transition-all uppercase tracking-widest text-xs shadow-xl active:scale-95">
                        Run Capacity Check
                    </button>
                </div>

                <div className="lg:col-span-5 flex flex-col gap-8">
                    <div className="w-full aspect-[4/5] bg-slate-950 rounded-[3rem] border-4 border-slate-800 flex items-center justify-center p-8 shadow-inner overflow-hidden">
                        <BeamDiagram 
                            width={parseFloat(width) || 0.3} 
                            height={parseFloat(height) || 0.5} 
                            cover={parseFloat(clearCover) || 0.04} 
                            diaBot={REBAR_SIZES[botRebarSizeIdx].dia} 
                            nBot={parseInt(botRebarCount) || 0}
                            diaTop={REBAR_SIZES[topRebarSizeIdx].dia}
                            nTop={parseInt(topRebarCount) || 0}
                            diaStirrup={REBAR_SIZES[stirrupSizeIdx].dia}
                        />
                    </div>
                    {momentCapacity !== null && calculationDetails && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex justify-between items-baseline border-b border-slate-800 pb-4">
                                <span className="text-slate-500 font-black uppercase text-[10px] tracking-widest">Factored Moment (Mr)</span>
                                <span className="text-4xl font-mono font-black text-sky-400 tracking-tighter">{momentCapacity.toFixed(1)} <span className="text-sm font-normal text-slate-600">kN-m</span></span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <ResultSmall label="Eff. Depth (d)" value={calculationDetails.d.toFixed(3)} unit="m" />
                                <ResultSmall label="c/d ratio" value={calculationDetails.c_d_ratio.toFixed(2)} unit="" />
                                <ResultSmall label="As Total" value={(calculationDetails.As_total * 1e6).toFixed(0)} unit="mm²" />
                                <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 flex items-center justify-center">
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${calculationDetails.c_d_ratio < 0.5 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                        {calculationDetails.c_d_ratio < 0.5 ? 'Ductile Section' : 'Limited Ductility'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

function BeamDiagram({ width, height, cover, diaBot, nBot, diaTop, nTop, diaStirrup }: any) {
    const canvasWidth = 300;
    const canvasHeight = 400;
    const padding = 40;
    
    const scale = Math.min((canvasWidth - padding * 2) / width, (canvasHeight - padding * 2) / height);
    
    const wPx = width * scale;
    const hPx = height * scale;
    const cPx = cover * scale;
    const sPx = diaStirrup * scale;
    
    const x0 = (canvasWidth - wPx) / 2;
    const y0 = (canvasHeight - hPx) / 2;

    const renderBars = (n: number, dia: number, yFromEdge: number, color: string) => {
        const bars = [];
        const rPx = (dia * scale) / 2;
        const availableWidth = wPx - 2 * cPx - 2 * sPx - 2 * rPx;
        for (let i = 0; i < n; i++) {
            const spacing = n > 1 ? availableWidth / (n - 1) : 0;
            const cx = x0 + cPx + sPx + rPx + (n > 1 ? i * spacing : availableWidth / 2);
            bars.push(<circle key={`bar-${color}-${i}`} cx={cx} cy={yFromEdge} r={Math.max(2, rPx)} fill={color} />);
        }
        return bars;
    };

    return (
        <svg viewBox={`0 0 ${canvasWidth} ${canvasHeight}`} className="w-full h-full drop-shadow-2xl">
            <rect x={x0} y={y0} width={wPx} height={hPx} fill="#0f172a" stroke="#334155" strokeWidth="2" rx="4" />
            <rect 
                x={x0 + cPx} 
                y={y0 + cPx} 
                width={Math.max(0, wPx - 2 * cPx)} 
                height={Math.max(0, hPx - 2 * cPx)} 
                fill="none" 
                stroke="#64748b" 
                strokeWidth={Math.max(1.5, sPx)} 
                rx="8"
            />
            {renderBars(nBot, diaBot, y0 + hPx - cPx - sPx - (diaBot * scale) / 2, "#38bdf8")}
            {renderBars(nTop, diaTop, y0 + cPx + sPx + (diaTop * scale) / 2, "#f59e0b")}
            <text x={x0 + wPx / 2} y={y0 - 10} textAnchor="middle" fill="#475569" fontSize="10" fontWeight="900" className="uppercase tracking-widest">{width}m x {height}m Beam</text>
        </svg>
    );
}

function RCInput({ label, unit, ...props }: any) {
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

function ResultSmall({ label, value, unit }: any) {
    return (
        <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 flex justify-between items-center">
            <span className="text-[9px] text-slate-600 uppercase font-black">{label}</span>
            <span className="text-xs font-mono font-black text-slate-300">{value} <span className="text-[8px] text-slate-600">{unit}</span></span>
        </div>
    );
}
