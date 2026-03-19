'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { RotateCcw, LayoutPanelTop, MousePointer2, MoveHorizontal, MoveVertical, DraftingCompass, Trash2, Undo } from 'lucide-react';
import { cn } from '@/lib/utils';

type Point = { x: number; y: number };

export function SectionPro() {
    const { toast } = useToast();
    const [mode, setActiveTab] = useState<'standard' | 'free'>('standard');
    const [shape, setShape] = useState('rectangle');
    const [dims, setDims] = useState<any>({ b: 300, h: 500, d: 400, tw: 10, tf: 15, bf: 200, hw: 400 });
    const [points, setPoints] = useState<Point[]>([]);
    const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
    const canvasRef = useRef<SVGSVGElement>(null);

    const GRID_SIZE = 25;
    const SNAP = 12.5;

    const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
        if (mode !== 'free') return;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = Math.round((e.clientX - rect.left - rect.width/2) / SNAP) * SNAP;
        const y = Math.round((e.clientY - rect.top - rect.height/2) / SNAP) * SNAP;
        setPoints([...points, { x, y }]);
    };

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (mode !== 'free') return;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = Math.round((e.clientX - rect.left - rect.width/2) / SNAP) * SNAP;
        const y = Math.round((e.clientY - rect.top - rect.height/2) / SNAP) * SNAP;
        setHoverPoint({ x, y });
    };

    const calculateProperties = () => {
        let A = 0, Ix = 0, Iy = 0, Ixy = 0, cx = 0, cy = 0;
        
        if (mode === 'standard') {
            const { b, h, d, tw, tf, bf, hw } = dims;
            switch(shape) {
                case 'rectangle': A = b * h; cx = b/2; cy = h/2; Ix = (b * h**3)/12; Iy = (h * b**3)/12; break;
                case 'circle': A = Math.PI * (d/2)**2; cx = 0; cy = 0; Ix = (Math.PI * d**4)/64; Iy = Ix; break;
                case 'i-beam': 
                    const A1 = bf * tf, A2 = tw * hw, A3 = bf * tf;
                    A = A1 + A2 + A3;
                    cy = (A1*(hw + 1.5*tf) + A2*(hw/2 + tf) + A3*(tf/2)) / A;
                    Ix = (bf*tf**3)/12 + A1*(hw + 1.5*tf - cy)**2 + (tw*hw**3)/12 + A2*(hw/2 + tf - cy)**2 + (bf*tf**3)/12 + A3*(tf/2 - cy)**2;
                    Iy = (tf*bf**3)/12 + (hw*tw**3)/12 + (tf*bf**3)/12;
                    break;
            }
        } else if (points.length > 2) {
            // Shoelace Algorithm for Area and Centroid
            for(let i=0; i<points.length; i++) {
                const p1 = points[i], p2 = points[(i+1)%points.length];
                const common = p1.x * p2.y - p2.x * p1.y;
                A += common;
                cx += (p1.x + p2.x) * common;
                cy += (p1.y + p2.y) * common;
            }
            A = A / 2; cx = cx / (6 * A); cy = cy / (6 * A);
            // Moments of Inertia
            for(let i=0; i<points.length; i++) {
                const p1 = { x: points[i].x - cx, y: points[i].y - cy };
                const p2 = { x: points[(i+1)%points.length].x - cx, y: points[(i+1)%points.length].y - cy };
                const common = p1.x * p2.y - p2.x * p1.y;
                Ix += (p1.y**2 + p1.y*p2.y + p2.y**2) * common;
                Iy += (p1.x**2 + p1.x*p2.x + p2.x**2) * common;
                Ixy += (p1.x*p2.y + 2*p1.x*p1.y + 2*p2.x*p2.y + p2.x*p1.y) * common;
            }
            Ix = Math.abs(Ix / 12); Iy = Math.abs(Iy / 12); Ixy = Math.abs(Ixy / 24);
            A = Math.abs(A);
        }

        const rx = Math.sqrt(Ix / (A || 1)), ry = Math.sqrt(Iy / (A || 1));
        const theta = 0.5 * Math.atan2(-2 * Ixy, Iy - Ix);
        const Iavg = (Ix + Iy) / 2, R = Math.sqrt(((Ix - Iy) / 2)**2 + Ixy**2);
        const Imax = Iavg + R, Imin = Iavg - R;

        return { A, Ix, Iy, Ixy, cx, cy, rx, ry, Imax, Imin, theta: theta * 180 / Math.PI };
    };

    const results = calculateProperties();

    return (
        <section className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl space-y-10">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                    <LayoutPanelTop className="h-8 w-8 text-sky-500" />
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Section Property Pro</h2>
                </div>
                <div className="flex bg-slate-950 p-1.5 rounded-2xl border-2 border-slate-800 shadow-xl">
                    <button onClick={() => setActiveTab('standard')} className={cn("px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all", mode === 'standard' ? "bg-sky-500 text-slate-950 shadow-lg" : "text-slate-500 hover:text-slate-300")}>Standard</button>
                    <button onClick={() => setActiveTab('free')} className={cn("px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all", mode === 'free' ? "bg-sky-500 text-slate-950 shadow-lg" : "text-slate-500 hover:text-slate-300")}>Free Draw</button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-4 space-y-8">
                    {mode === 'standard' ? (
                        <div className="bg-slate-950/50 border border-slate-800 p-8 rounded-[2rem] space-y-6 shadow-inner">
                            <h3 className="text-[10px] font-black text-sky-500 uppercase tracking-[0.2em] mb-4">Geometry Definition</h3>
                            <div className="space-y-4">
                                <Label className="text-[9px] uppercase font-black text-slate-500">Shape Library</Label>
                                <Select value={shape} onValueChange={setShape}>
                                    <SelectTrigger className="h-12 bg-slate-900 border-slate-800 text-white font-bold"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white font-bold">
                                        <SelectItem value="rectangle">Rectangle</SelectItem>
                                        <SelectItem value="circle">Circular</SelectItem>
                                        <SelectItem value="i-beam">I-Beam (Built-up)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {shape === 'rectangle' && <><PropInput label="Width (b)" value={dims.b} onChange={(v)=>setDims({...dims, b:v})} /><PropInput label="Height (h)" value={dims.h} onChange={(v)=>setDims({...dims, h:v})} /></>}
                                {shape === 'circle' && <div className="col-span-2"><PropInput label="Diameter (d)" value={dims.d} onChange={(v)=>setDims({...dims, d:v})} /></div>}
                                {shape === 'i-beam' && <><PropInput label="Flange bf" value={dims.bf} onChange={(v)=>setDims({...dims, bf:v})} /><PropInput label="Flange tf" value={dims.tf} onChange={(v)=>setDims({...dims, tf:v})} /><PropInput label="Web hw" value={dims.hw} onChange={(v)=>setDims({...dims, hw:v})} /><PropInput label="Web tw" value={dims.tw} onChange={(v)=>setDims({...dims, tw:v})} /></>}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-950/50 border border-slate-800 p-8 rounded-[2rem] space-y-6 shadow-inner">
                            <div className="flex justify-between items-center">
                                <h3 className="text-[10px] font-black text-sky-500 uppercase tracking-[0.2em]">Vertex List</h3>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-white" onClick={() => setPoints(points.slice(0,-1))}><Undo size={14}/></Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-400" onClick={() => setPoints([])}><Trash2 size={14}/></Button>
                                </div>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2 pr-2">
                                {points.map((p, i) => (
                                    <div key={i} className="flex justify-between bg-slate-900/50 p-3 rounded-xl border border-slate-800 text-[10px] font-mono text-slate-400">
                                        <span className="text-sky-500 font-black">V{i+1}</span>
                                        <span>X: {p.x.toFixed(1)}</span>
                                        <span>Y: {-p.y.toFixed(1)}</span>
                                    </div>
                                ))}
                                {points.length === 0 && <div className="text-center py-10 text-slate-700 text-[10px] font-black uppercase italic">Click canvas to add nodes</div>}
                            </div>
                            <div className="bg-sky-500/10 border border-sky-500/20 p-4 rounded-2xl flex gap-3">
                                <DraftingCompass className="w-4 h-4 text-sky-500 shrink-0" />
                                <p className="text-[9px] font-bold text-sky-400 leading-relaxed uppercase tracking-wider">Polygon auto-closes from last to first vertex. Points are snapped to 12.5mm grid.</p>
                            </div>
                        </div>
                    )}

                    <div className="bg-slate-950/50 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6 border-b border-slate-800 pb-4">Principal Results</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <ResultSmall label="Area (A)" value={results.A.toFixed(0)} unit="mm²" />
                            <ResultSmall label="Angle (θ)" value={results.theta.toFixed(1)} unit="deg" />
                            <ResultSmall label="I Max" value={results.Imax.toExponential(2)} unit="mm⁴" />
                            <ResultSmall label="I Min" value={results.Imin.toExponential(2)} unit="mm⁴" />
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-8 flex flex-col gap-8">
                    <div className="w-full h-[550px] bg-slate-950 border-2 border-slate-800 rounded-[3rem] shadow-inner relative overflow-hidden group">
                        <svg 
                            ref={canvasRef} 
                            width="100%" 
                            height="100%" 
                            className={cn(mode === 'free' ? "cursor-crosshair" : "cursor-default")}
                            onClick={handleCanvasClick}
                            onMouseMove={handleMouseMove}
                            onMouseLeave={() => setHoverPoint(null)}
                        >
                            <defs>
                                <pattern id="sec-grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse"><path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" /></pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#sec-grid)" />
                            
                            <g transform="translate(400, 275)">
                                {/* Axes */}
                                <line x1="-400" y1="0" x2="400" y2="0" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="5 5" />
                                <line x1="0" y1="-275" x2="0" y2="275" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="5 5" />
                                
                                {mode === 'standard' ? (
                                    <g fill="#0ea5e9" fillOpacity="0.2" stroke="#0ea5e9" strokeWidth="2">
                                        {shape === 'rectangle' && <rect x={-dims.b/2} y={-dims.h/2} width={dims.b} height={dims.h} rx="4" />}
                                        {shape === 'circle' && <circle cx="0" cy="0" r={dims.d/2} />}
                                        {shape === 'i-beam' && (
                                            <path d={`M ${-dims.bf/2} ${-dims.hw/2-dims.tf} H ${dims.bf/2} V ${-dims.hw/2} H ${dims.tw/2} V ${dims.hw/2} H ${dims.bf/2} V ${dims.hw/2+dims.tf} H ${-dims.bf/2} V ${dims.hw/2} H ${-dims.tw/2} V ${-dims.hw/2} H ${-dims.bf/2} Z`} />
                                        )}
                                    </g>
                                ) : (
                                    <g>
                                        <polygon points={points.map(p => `${p.x},${p.y}`).join(' ')} fill="#0ea5e9" fillOpacity="0.2" stroke="#0ea5e9" strokeWidth="2" />
                                        {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill="white" stroke="#0ea5e9" strokeWidth="2" />)}
                                        {hoverPoint && mode === 'free' && <circle cx={hoverPoint.x} cy={hoverPoint.y} r="3" fill="#38bdf8" opacity="0.5" />}
                                    </g>
                                )}

                                {/* Centroid Marker */}
                                {results.A > 0 && (
                                    <g transform={`translate(${mode==='standard'?0:results.cx}, ${mode==='standard'?0:results.cy})`}>
                                        <circle r="6" fill="#ef4444" fillOpacity="0.2" />
                                        <line x1="-10" y1="0" x2="10" y2="0" stroke="#ef4444" strokeWidth="1.5" />
                                        <line x1="0" y1="-10" x2="0" y2="10" stroke="#ef4444" strokeWidth="1.5" />
                                        <text x="12" y="-12" fill="#ef4444" fontSize="10" className="font-black italic uppercase">C.G.</text>
                                    </g>
                                )}
                            </g>
                        </svg>
                        
                        <div className="absolute top-8 left-8 flex gap-4">
                            <div className="bg-slate-900/90 backdrop-blur border border-slate-800 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
                                <MousePointer2 className="w-4 h-4 text-sky-500" />
                                <span className="text-[10px] font-black text-white uppercase tracking-widest">
                                    X: {((hoverPoint?.x || 0)).toFixed(1)} <span className="text-slate-600">|</span> Y: {(-(hoverPoint?.y || 0)).toFixed(1)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <StatCard label="Ix (Inertia)" value={results.Ix} unit="mm⁴" scientific />
                        <StatCard label="Iy (Inertia)" value={results.Iy} unit="mm⁴" scientific />
                        <StatCard label="rx (Gyr)" value={results.rx} unit="mm" fixed={1} />
                        <StatCard label="ry (Gyr)" value={results.ry} unit="mm" fixed={1} />
                    </div>
                </div>
            </div>
        </section>
    );
}

function PropInput({ label, value, onChange }: any) {
    return (
        <div className="space-y-2">
            <Label className="text-[9px] uppercase font-black text-slate-500 px-1">{label}</Label>
            <Input 
                type="number" 
                value={value} 
                onChange={(e)=>onChange(parseFloat(e.target.value)||0)}
                className="h-10 bg-slate-900 border-slate-800 text-xs text-white font-bold focus:border-sky-500 shadow-inner" 
            />
        </div>
    );
}

function ResultSmall({ label, value, unit }: any) {
    return (
        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800/80 flex flex-col gap-1 shadow-inner">
            <span className="text-[8px] text-slate-600 uppercase font-black tracking-widest">{label}</span>
            <span className="text-sm font-mono font-black text-slate-200">{value} <span className="text-[9px] text-slate-600 font-normal uppercase tracking-tighter">{unit}</span></span>
        </div>
    );
}

function StatCard({ label, value, unit, scientific, fixed }: any) {
    const displayValue = scientific ? value.toExponential(2) : value.toLocaleString(undefined, { maximumFractionDigits: fixed !== undefined ? fixed : 0 });
    return (
        <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800/80 shadow-xl group hover:border-sky-500/30 transition-all">
            <p className="text-[9px] text-slate-600 uppercase font-black tracking-widest mb-3">{label}</p>
            <div className="flex items-baseline gap-2">
                <span className="font-mono font-black text-lg text-slate-100 tracking-tighter">{displayValue}</span>
                <span className="text-[9px] text-slate-700 font-black uppercase">{unit}</span>
            </div>
        </div>
    );
}
