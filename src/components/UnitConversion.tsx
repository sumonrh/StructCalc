'use client';

import { useState, useEffect, ChangeEvent, useMemo } from 'react';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ruler, Weight, Square, Sigma } from 'lucide-react'; 

type UnitCategory = 'length' | 'force' | 'area' | 'stress';
type Unit = string; 

interface ConversionFactor {
  [key: Unit]: number;
}

const conversionFactors: Record<UnitCategory, ConversionFactor> = {
  length: {
    m: 1,
    km: 1000,
    cm: 0.01,
    mm: 0.001,
    ft: 0.3048,
    in: 0.0254,
    yd: 0.9144,
    mi: 1609.34,
  },
  force: {
    N: 1,
    kN: 1000,
    MN: 1000000,
    lbf: 4.44822,
    kip: 4448.22, 
  },
  area: {
    'm²': 1,
    'km²': 1000000,
    'cm²': 0.0001,
    'mm²': 0.000001,
    'ft²': 0.092903,
    'in²': 0.00064516,
    'yd²': 0.836127,
    acre: 4046.86,
  },
  stress: {
    Pa: 1, 
    kPa: 1000,
    MPa: 1000000,
    GPa: 1000000000,
    psi: 6894.76, 
    ksi: 6894760, 
    'N/mm²': 1000000, 
  },
};

const unitsByCategory: Record<UnitCategory, Unit[]> = {
  length: ['m', 'km', 'cm', 'mm', 'ft', 'in', 'yd', 'mi'],
  force: ['N', 'kN', 'MN', 'lbf', 'kip'],
  area: ['m²', 'km²', 'cm²', 'mm²', 'ft²', 'in²', 'yd²', 'acre'],
  stress: ['Pa', 'kPa', 'MPa', 'GPa', 'psi', 'ksi', 'N/mm²'],
};

export function UnitConversion() {
  const [category, setCategory] = useState<UnitCategory>('length');
  const [fromUnit, setFromUnit] = useState<Unit>(unitsByCategory['length'][0]);
  const [toUnit, setToUnit] = useState<Unit>(unitsByCategory['length'][1]);
  const [inputValue, setInputValue] = useState<string>('1');
  const [outputValue, setOutputValue] = useState<string>('');

  const currentUnits = useMemo(() => unitsByCategory[category], [category]);

  const handleCategoryChange = (newCategory: string) => {
    const cat = newCategory as UnitCategory;
    setCategory(cat);
    const newUnits = unitsByCategory[cat];
    setFromUnit(newUnits[0]);
    setToUnit(newUnits[1] || newUnits[0]);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  useEffect(() => {
    const value = parseFloat(inputValue);
    if (!isNaN(value)) {
      const factors = conversionFactors[category];
      const valueInBaseUnit = value * (factors[fromUnit] || 1);
      const convertedValue = valueInBaseUnit / (factors[toUnit] || 1);
      setOutputValue(Number(convertedValue.toPrecision(6)).toString());
    } else {
      setOutputValue('');
    }
  }, [inputValue, fromUnit, toUnit, category]);


  const getIcon = (cat: UnitCategory) => {
    switch (cat) {
      case 'length': return <Ruler className="h-6 w-6 text-sky-500" />;
      case 'force': return <Weight className="h-6 w-6 text-sky-500" />;
      case 'area': return <Square className="h-6 w-6 text-sky-500" />;
      case 'stress': return <Sigma className="h-6 w-6 text-sky-500" />;
      default: return <Ruler className="h-6 w-6 text-sky-500" />;
    }
  }

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 shadow-2xl space-y-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
        {getIcon(category)}
        <h2 className="text-xl font-black text-white uppercase tracking-tighter">Unit Converter</h2>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label className="text-[9px] text-slate-500 uppercase font-black tracking-widest px-1">Category</Label>
          <Select onValueChange={handleCategoryChange} value={category}>
            <SelectTrigger className="bg-slate-950 border-2 border-slate-800 rounded-2xl p-6 text-xs font-bold text-white focus:border-sky-500 outline-none transition-all shadow-inner">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-white shadow-2xl">
              <SelectItem value="length">Length</SelectItem>
              <SelectItem value="force">Force</SelectItem>
              <SelectItem value="area">Area</SelectItem>
              <SelectItem value="stress">Stress / Pressure</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
          <div className="space-y-3">
            <Label className="text-[9px] text-slate-500 uppercase font-black tracking-widest px-1">From</Label>
            <div className="flex gap-2">
              <input
                type="number"
                value={inputValue}
                onChange={handleInputChange}
                className="bg-slate-950 border-2 border-slate-800 rounded-2xl p-6 text-sm font-bold text-white focus:border-sky-500 outline-none transition-all shadow-inner flex-grow w-full"
              />
              <Select value={fromUnit} onValueChange={(v) => setFromUnit(v)}>
                <SelectTrigger className="w-[100px] bg-slate-950 border-2 border-slate-800 rounded-2xl text-xs font-bold text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white shadow-2xl">
                  {currentUnits.map((unit) => (
                    <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-[9px] text-slate-500 uppercase font-black tracking-widest px-1">To</Label>
            <div className="flex gap-2">
              <input
                type="text"
                value={outputValue}
                readOnly
                className="bg-slate-950 border-2 border-slate-800 rounded-2xl p-6 text-sm font-bold text-sky-400 focus:border-sky-500 outline-none transition-all shadow-inner flex-grow cursor-default w-full"
              />
              <Select value={toUnit} onValueChange={(v) => setToUnit(v)}>
                <SelectTrigger className="w-[100px] bg-slate-950 border-2 border-slate-800 rounded-2xl text-xs font-bold text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white shadow-2xl">
                  {currentUnits.map((unit) => (
                    <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        
        <div className="pt-6 border-t border-slate-800">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center">
                {inputValue || 0} {fromUnit} = <span className="text-sky-400">{outputValue || 0} {toUnit}</span>
            </p>
        </div>
      </div>
    </section>
  );
}
