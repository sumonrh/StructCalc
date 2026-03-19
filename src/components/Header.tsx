import { Calculator } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center px-6">
        <div className="flex items-center gap-3">
          <div className="bg-sky-500 p-1.5 rounded-xl shadow-lg shadow-sky-500/20">
            <Calculator className="h-6 w-6 text-slate-950" />
          </div>
          <span className="font-black text-2xl text-white tracking-tighter uppercase italic">StrucTCalc</span>
        </div>
      </div>
    </header>
  );
}