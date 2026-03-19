'use client';

import { useState } from 'react';
import { MoveVertical, Calculator } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

const beamCases = [
  { value: 'ss_udl', label: 'Simply Supported, Uniform Load (UDL)' },
];

export function BeamDeflection() {
    const { toast } = useToast();
    const [length, setLength] = useState<string>('6.0'); // L (m)
    const [modulus, setModulus] = useState<string>('200000'); // E (MPa)
    const [inertia, setInertia] = useState<string>('0.000050'); // I (m^4)
    const [load, setLoad] = useState<string>('10'); // w (kN/m)
    const [beamCase, setBeamCase] = useState<string>(beamCases[0].value);
    const [maxDeflection, setMaxDeflection] = useState<number | null>(null);

    const handleCalculate = () => {
        const L = parseFloat(length);
        const E = parseFloat(modulus); // MPa
        const I = parseFloat(inertia); // m^4
        const w = parseFloat(load); // kN/m

        if (isNaN(L) || isNaN(E) || isNaN(I) || isNaN(w)) {
             toast({ variant: "destructive", title: "Input Error", description: "All fields must be valid numbers." });
            return;
        }
         if (L <= 0 || E <= 0 || I <= 0) {
             toast({ variant: "destructive", title: "Input Error", description: "L, E, I must be positive." });
            return;
        }

        try {
            let deflection = 0;
            // E is in MPa = 10^6 N/m^2. w is in kN/m = 10^3 N/m.
            // Consistency: kN, m
            // E_kNm2 = E * 1000
            const E_kNm2 = E * 1000;

            switch (beamCase) {
                case 'ss_udl':
                    // δ_max = (5 * w * L^4) / (384 * E * I)
                    deflection = (5 * w * Math.pow(L, 4)) / (384 * E_kNm2 * I);
                    break;
                default:
                    throw new Error("Case not implemented.");
            }

            setMaxDeflection(deflection);
            toast({ title: "Success", description: "Maximum deflection calculated." });
        } catch (err: any) {
             toast({ variant: "destructive", title: "Calculation Error", description: err.message });
        }
    };

    return (
        <section className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 shadow-2xl space-y-8">
            <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
                <MoveVertical className="h-6 w-6 text-sky-500" />
                <h2 className="text-xl font-black text-white uppercase tracking-tighter">Beam Deflection</h2>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                <div className="col-span-2 space-y-2">
                    <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest px-1">Case</label>
                    <select 
                        value={beamCase} 
                        onChange={(e) => setBeamCase(e.target.value)}
                        className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-4 text-xs font-bold text-white focus:border-sky-500 outline-none transition-all shadow-inner"
                    >
                        {beamCases.map(bc => (
                            <option key={bc.value} value={bc.value} className="bg-slate-900">{bc.label}</option>
                        ))}
                    </select>
                </div>
                <DeflectionInput label="Length (L)" unit="m" value={length} onChange={(e) => setLength(e.target.value)} />
                <DeflectionInput label="Load (w)" unit="kN/m" value={load} onChange={(e) => setLoad(e.target.value)} />
                <DeflectionInput label="Modulus (E)" unit="MPa" value={modulus} onChange={(e) => setModulus(e.target.value)} />
                <DeflectionInput label="Inertia (I)" unit="m⁴" value={inertia} onChange={(e) => setInertia(e.target.value)} />
            </div>

            <button onClick={handleCalculate} className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-black py-4 rounded-2xl transition-all uppercase tracking-widest text-xs shadow-xl">
                Calculate Deflection
            </button>

            {maxDeflection !== null && (
                <div className="pt-6 border-t border-slate-800">
                    <div className="flex justify-between items-baseline">
                        <span className="text-slate-500 font-black uppercase text-[10px] tracking-widest">Max Deflection (δ)</span>
                        <span className="text-3xl font-mono font-black text-sky-400 tracking-tighter">{(maxDeflection * 1000).toFixed(2)} <span className="text-sm font-normal text-slate-600">mm</span></span>
                    </div>
                    <p className="text-[9px] text-slate-600 uppercase font-bold mt-2 text-right">Result shown in mm for readability</p>
                </div>
            )}
        </section>
    );
}

function DeflectionInput({ label, unit, ...props }: any) {
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
