'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, Calculator, Scale } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

const kFactors = [
  { value: '2.0', label: 'Fixed-Free' },
  { value: '1.0', label: 'Pinned-Pinned' },
  { value: '0.7', label: 'Fixed-Pinned' },
  { value: '0.5', label: 'Fixed-Fixed' },
];

export function BucklingCalculation() {
    const { toast } = useToast();
    const [length, setLength] = useState<string>('5.0');
    const [modulus, setModulus] = useState<string>('200000'); // MPa
    const [inertia, setInertia] = useState<string>('0.00000833'); // m^4
    const [kFactor, setKFactor] = useState<string>(kFactors[1].value); 
    const [criticalLoad, setCriticalLoad] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleCalculate = () => {
        setError(null);
        setCriticalLoad(null);

        const L = parseFloat(length);
        const E = parseFloat(modulus); // in MPa (MN/m^2)
        const I = parseFloat(inertia); // in m^4
        const K = parseFloat(kFactor);

        if (isNaN(L) || isNaN(E) || isNaN(I) || isNaN(K)) {
            setError('Please enter valid numbers for all inputs.');
            toast({ variant: "destructive", title: "Input Error", description: "All fields must be valid numbers." });
            return;
        }
        if (L <= 0 || E <= 0 || I <= 0) {
            setError('Length, Modulus of Elasticity, and Moment of Inertia must be positive.');
             toast({ variant: "destructive", title: "Input Error", description: "Inputs must be positive values." });
            return;
        }

        // Euler's Critical Buckling Load: Pcr = (π² * E * I) / (K * L)²
        // E (MN/m^2) * I (m^4) / L^2 (m^2) = MN
        const Pcr_MN = (Math.pow(Math.PI, 2) * E * I) / Math.pow(K * L, 2);
        // Convert MN to kN
        const Pcr_kN = Pcr_MN * 1000;

        setCriticalLoad(Pcr_kN);
        toast({
            title: "Calculation Successful",
            description: `Critical buckling load calculated.`,
        });
    };

    return (
        <section className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 shadow-2xl space-y-8">
            <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
                <ShieldAlert className="h-6 w-6 text-sky-500" />
                <h2 className="text-xl font-black text-white uppercase tracking-tighter">Column Buckling (Euler)</h2>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                <BuckleInput label="Length (L)" unit="m" value={length} onChange={(e) => setLength(e.target.value)} />
                <BuckleInput label="Modulus (E)" unit="MPa" value={modulus} onChange={(e) => setModulus(e.target.value)} />
                <div className="col-span-2">
                    <BuckleInput label="Moment of Inertia (I)" unit="m⁴" value={inertia} onChange={(e) => setInertia(e.target.value)} />
                </div>
                <div className="col-span-2 space-y-2">
                    <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest px-1">End Condition (K)</label>
                    <select 
                        value={kFactor} 
                        onChange={(e) => setKFactor(e.target.value)}
                        className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-4 text-xs font-bold text-white focus:border-sky-500 outline-none transition-all shadow-inner"
                    >
                        {kFactors.map(factor => (
                            <SelectItem key={factor.value} value={factor.value}>{factor.label} (K = {factor.value})</SelectItem>
                        ))}
                    </select>
                </div>
            </div>

            <button onClick={handleCalculate} className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-black py-4 rounded-2xl transition-all uppercase tracking-widest text-xs shadow-xl">
                Calculate Pcr
            </button>

            {criticalLoad !== null && (
                <div className="pt-6 border-t border-slate-800">
                    <div className="flex justify-between items-baseline">
                        <span className="text-slate-500 font-black uppercase text-[10px] tracking-widest">Critical Load (Pcr)</span>
                        <span className="text-3xl font-mono font-black text-sky-400 tracking-tighter">{criticalLoad.toFixed(1)} <span className="text-sm font-normal text-slate-600">kN</span></span>
                    </div>
                </div>
            )}
        </section>
    );
}

function BuckleInput({ label, unit, ...props }: any) {
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

function SelectItem({ children, ...props }: any) {
    return <option className="bg-slate-900 text-white" {...props}>{children}</option>;
}
