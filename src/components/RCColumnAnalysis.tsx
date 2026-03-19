'use client';

import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { Calculator, Activity, Settings, TrendingUp, Info, RotateCw, Box, Circle, ChevronRight, ChevronLeft, Download, Maximize2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// --- MATH & ENGINEERING LOGIC ---

const parkSteel = (strain: number, fy: number, Es = 200000, fsu = 648, esu = 0.14) => {
  const ey = fy / Es;
  const esh = 0.015;
  const r = esu - esh;
  const m = ((fsu / fy) * Math.pow(30 * r + 1, 2) - 60 * r - 1) / (15 * Math.pow(r, 2));
  const absStrain = Math.abs(strain);
  const sign = Math.sign(strain);
  let stress = 0;
  if (absStrain <= ey) stress = Es * absStrain;
  else if (absStrain <= esh) stress = fy;
  else if (absStrain <= esu) stress = fy * ((m * (absStrain - esh) + 2) / (60 * (absStrain - esh) + 2) + (absStrain - esh) * (60 - m) / (2 * Math.pow(30 * r + 1, 2)));
  else stress = fsu;
  return stress * sign;
};

const manderUnconfined = (strain: number, fc: number, eco = 0.002059, Ec_in: number | null = null, esp = 0.005) => {
  if (strain >= 0) return 0;
  const absStrain = Math.abs(strain);
  const Ec = Ec_in || 5000 * Math.sqrt(fc);
  const r = Ec / (Ec - fc / eco);
  const x = absStrain / eco;
  if (absStrain <= 2 * eco) return -1 * (fc * x * r) / (r - 1 + Math.pow(x, r));
  else if (absStrain <= esp) return -1 * ((2 * fc * r) * (esp - absStrain)) / ((r - 1 + Math.pow(2, r)) * (esp - 2 * eco));
  return 0;
};

const manderConfined = (strain: number, fc: number, fcc: number, ecc: number, Ec: number, ecu: number) => {
  if (strain >= 0) return 0;
  const absStrain = Math.abs(strain);
  const r = Ec / (Ec - fcc / ecc);
  const x = absStrain / ecc;
  if (absStrain <= ecu) return -1 * (fcc * x * r) / (r - 1 + Math.pow(x, r));
  return 0;
};

const integrate = (func: (x: number) => number, start: number, end: number, steps: number) => {
  const dx = (end - start) / steps;
  let area = 0;
  for (let i = 0; i < steps; i++) {
    const x1 = start + i * dx;
    const x2 = start + (i + 1) * dx;
    const y1 = Math.abs(func(x1));
    const y2 = Math.abs(func(x2));
    area += 0.5 * (y1 + y2) * dx;
  }
  return area;
};

const calculateUltimateStrain = (sectionType: string, inputs: any, properties: any) => {
  const { fc, fy, dbt, s } = inputs;
  const { ps, fLp } = properties;
  const Ec = 5000 * Math.sqrt(fc);
  const fcc = fc * (2.254 * Math.sqrt(Math.max(0, 1 + 7.94 * fLp / fc)) - 2 * fLp / fc - 1.254);
  const eco = 0.002059;
  const ecc = eco * (1 + 5 * (fcc / fc - 1));
  const confinedStressFunc = (str: number) => manderConfined(-str, fc, fcc, ecc, Ec, 1.0);
  const steelStressFunc = (str: number) => parkSteel(str, 480);
  let ecu_min = 0.01, ecu_max = 0.15, final_ecu = 0.03, final_energies = {};
  for (let iter = 0; iter < 50; iter++) {
    const ecu_trial = (ecu_min + ecu_max) / 2;
    const Ush = 110 * ps;
    const Ucc = integrate(confinedStressFunc, 0, ecu_trial, 100);
    const Usl = integrate(steelStressFunc, 0, ecu_trial, 100) * properties.pcc;
    const Uco = 0.017 * Math.sqrt(fc);
    const balance = Ush - (Ucc + Usl - Uco);
    final_energies = { Ush, Ucc, Usl, Uco, Balance: balance };
    if (Math.abs(balance) < 1e-6) { final_ecu = ecu_trial; break; }
    else if (balance > 0) ecu_min = ecu_trial;
    else ecu_max = ecu_trial;
    final_ecu = ecu_trial;
  }
  return { ecu: final_ecu, fcc, ecc, energies: final_energies, fLp, Ke: properties.Ke };
};

const analyzeSection = (sectionType: string, inputs: any, calcParams: any, axis = 'strong') => {
  const { D, B, H, cover, n_bars, nx, ny, db, dbt, fc, fy } = inputs;
  const { ecu, fcc, ecc } = calcParams;
  const Ec = 5000 * Math.sqrt(fc);
  const points = 50;
  const max_curv = 0.00015;
  const curvatures: number[] = [], moments: number[] = [], strainsSteel: number[] = [], strainsConcrete: number[] = [];
  let depth_total: number, width_total: number, bar_coords: number[] = [];
  if (sectionType === 'circular') {
    depth_total = D; width_total = D;
    const r_core = (D / 2) - cover - dbt / 2;
    const r_rebar = r_core - dbt / 2 - db / 2;
    const angleStep = (2 * Math.PI) / n_bars;
    for (let i = 0; i < n_bars; i++) bar_coords.push(-r_rebar * Math.sin(i * angleStep));
  } else {
    const isStrong = axis === 'strong';
    depth_total = isStrong ? H : B; width_total = isStrong ? B : H;
    const x_lim = (B - 2 * cover - dbt - db) / 2;
    const y_lim = (H - 2 * cover - dbt - db) / 2;
    if (nx > 1) {
      const dx = (2 * x_lim) / (nx - 1);
      for (let i = 0; i < nx; i++) {
        const x = -x_lim + i * dx;
        bar_coords.push(isStrong ? y_lim : x);
        bar_coords.push(isStrong ? -y_lim : x);
      }
    }
    if (ny > 2) {
      const dy = (2 * y_lim) / (ny - 1);
      for (let j = 1; j < ny - 1; j++) {
        const y = -y_lim + j * dy;
        bar_coords.push(isStrong ? y : -x_lim);
        bar_coords.push(isStrong ? y : x_lim);
      }
    }
  }
  const num_layers = 50;
  const dy_layer = depth_total / num_layers;
  for (let i = 0; i <= points; i++) {
    const curv = (max_curv / points) * i;
    let c_min = 0.0, c_max = depth_total * 1.5, c = depth_total / 2, converged = false;
    let M_total = 0, max_t_strain = 0, max_c_strain = 0;
    for (let iter = 0; iter < 50; iter++) {
      let F_total = 0, M_internal = 0, current_max_t = 0;
      for (let y_coord_center of bar_coords) {
        const y_from_top = (depth_total / 2) - y_coord_center;
        const strain_tensile = curv * (y_from_top - c);
        if (strain_tensile > current_max_t) current_max_t = strain_tensile;
        const force = parkSteel(strain_tensile, fy) * (Math.PI * Math.pow(db / 2, 2));
        F_total += force; M_internal += -1 * force * y_coord_center;
      }
      const top_strain = curv * (0 - c);
      const bot_strain = curv * (depth_total - c);
      const current_max_c = Math.abs(Math.min(top_strain, bot_strain, 0));
      for (let j = 0; j < num_layers; j++) {
        const y_layer = (j + 0.5) * dy_layer;
        const strain = curv * (y_layer - c);
        if (strain < 0) {
          let width_layer = 0, core_width_layer = 0;
          if (sectionType === 'circular') {
            const dist_center = Math.abs(y_layer - depth_total / 2);
            width_layer = 2 * Math.sqrt(Math.max(0, Math.pow(depth_total / 2, 2) - Math.pow(dist_center, 2)));
            const r_core = (D / 2) - cover - dbt / 2;
            if (dist_center < r_core) core_width_layer = 2 * Math.sqrt(Math.max(0, Math.pow(r_core, 2) - Math.pow(dist_center, 2)));
          } else {
            width_layer = width_total;
            const dist_from_top_core = cover + dbt / 2;
            const dist_from_bot_core = depth_total - (cover + dbt / 2);
            if (y_layer >= dist_from_top_core && y_layer <= dist_from_bot_core) core_width_layer = width_total - 2 * cover - dbt;
          }
          const area_core = core_width_layer * dy_layer;
          const area_cover = (width_layer * dy_layer) - area_core;
          const y_coord = (depth_total / 2) - y_layer;
          if (area_core > 0) {
            const force = manderConfined(strain, fc, fcc, ecc, Ec, ecu) * area_core;
            F_total += force; M_internal += -1 * force * y_coord;
          }
          if (area_cover > 0) {
            const force = manderUnconfined(strain, fc) * area_cover;
            F_total += force; M_internal += -1 * force * y_coord;
          }
        }
      }
      if (Math.abs(F_total) < 0.001 * (fc * width_total * depth_total)) {
        converged = true; M_total = M_internal; max_t_strain = current_max_t; max_c_strain = current_max_c; break;
      }
      if (F_total > 0) { c_min = c; c = (c + c_max) / 2; if (c_min === c) c += 0.1; }
      else { c_max = c; c = (c + c_min) / 2; }
    }
    if (converged || i === 0) {
      curvatures.push(curv * 1000); moments.push(M_total / 1e6);
      strainsSteel.push(max_t_strain * 100); strainsConcrete.push(max_c_strain * 100);
    }
  }
  return { curvatures, moments, strainsSteel, strainsConcrete };
};

// --- UI COMPONENTS ---

const CrossSectionVisualizer = ({ sectionType, inputs, isPrintMode }: any) => {
  const { D, B, H, cover, n_bars, nx, ny, db, dbt } = inputs;
  const size = isPrintMode ? 220 : 280;
  const center = size / 2;
  const padding = 40;
  const maxDim = sectionType === 'circular' ? (D || 100) : Math.max((B || 100), (H || 100));
  const scale = (size - 2 * padding) / maxDim;
  const toPx = (val: number) => val * scale;
  const colorConcrete = isPrintMode ? "#f1f5f9" : "#1e293b";
  const colorConfined = isPrintMode ? "#cbd5e1" : "#334155";
  const colorSteel = isPrintMode ? "#1e293b" : "#sky-500";
  const colorStirrup = "#64748b";
  const colorAxis = "#ef4444";
  let shapes = [], rebars = [], dims = [];
  if (sectionType === 'circular') {
    const R = D / 2, R_conf = R - cover, R_bars = R - cover - dbt - db / 2;
    shapes.push(<circle cx={center} cy={center} r={Math.max(0, toPx(R))} fill={colorConcrete} stroke="#475569" strokeWidth="1" key="conc_out" />);
    if (R_conf > 0) shapes.push(<circle cx={center} cy={center} r={Math.max(0, toPx(R_conf))} fill={colorConfined} stroke={colorStirrup} strokeWidth="1" strokeDasharray="3 2" key="conc_in" />);
    const angleStep = (2 * Math.PI) / (n_bars || 1);
    for (let i = 0; i < n_bars; i++) {
      const theta = i * angleStep - Math.PI / 2;
      rebars.push(<circle cx={center + toPx(R_bars) * Math.cos(theta)} cy={center + toPx(R_bars) * Math.sin(theta)} r={Math.max(1.5, toPx(db / 2))} fill={isPrintMode ? "#1e293b" : "#0ea5e9"} key={`bar_${i}`} />);
    }
    const dimY = center + toPx(R) + 20;
    dims.push(<g key="dim_D"><line x1={center - toPx(R)} y1={dimY} x2={center + toPx(R)} y2={dimY} stroke="#64748b" strokeWidth="1" /><text x={center} y={dimY + 12} textAnchor="middle" fontSize="10" fill={isPrintMode ? "#475569" : "#cbd5e1"} fontWeight="600">D = {D}</text></g>);
  } else {
    const W_px = toPx(B), H_px = toPx(H);
    shapes.push(<rect x={center - W_px / 2} y={center - H_px / 2} width={Math.max(0, W_px)} height={Math.max(0, H_px)} fill={colorConcrete} stroke="#475569" strokeWidth="1" key="conc_out" />);
    const W_conf = B - 2 * cover, H_conf = H - 2 * cover;
    if (W_conf > 0 && H_conf > 0) shapes.push(<rect x={center - toPx(W_conf / 2)} y={center - toPx(H_conf / 2)} width={Math.max(0, toPx(W_conf))} height={Math.max(0, toPx(H_conf))} fill={colorConfined} stroke={colorStirrup} strokeWidth="1" strokeDasharray="3 2" key="conc_in" />);
    const x_lim = (B - 2 * cover - dbt - db) / 2, y_lim = (H - 2 * cover - dbt - db) / 2;
    if (nx > 1) {
      const dx = (2 * x_lim) / (nx - 1);
      for (let i = 0; i < nx; i++) {
        const x = -x_lim + i * dx;
        rebars.push(<circle cx={center + toPx(x)} cy={center - toPx(y_lim)} r={Math.max(1.5, toPx(db / 2))} fill={isPrintMode ? "#1e293b" : "#0ea5e9"} key={`t_${i}`} />);
        rebars.push(<circle cx={center + toPx(x)} cy={center + toPx(y_lim)} r={Math.max(1.5, toPx(db / 2))} fill={isPrintMode ? "#1e293b" : "#0ea5e9"} key={`b_${i}`} />);
      }
    }
    if (ny > 2) {
      const dy = (2 * y_lim) / (ny - 1);
      for (let j = 1; j < ny - 1; j++) {
        const y = -y_lim + j * dy;
        rebars.push(<circle cx={center - toPx(x_lim)} cy={center + toPx(y)} r={Math.max(1.5, toPx(db / 2))} fill={isPrintMode ? "#1e293b" : "#0ea5e9"} key={`l_${j}`} />);
        rebars.push(<circle cx={center + toPx(x_lim)} cy={center + toPx(y)} r={Math.max(1.5, toPx(db / 2))} fill={isPrintMode ? "#1e293b" : "#0ea5e9"} key={`r_${j}`} />);
      }
    }
    const dimY = center + H_px / 2 + 20;
    dims.push(<g key="dim_B"><line x1={center - W_px / 2} y1={dimY} x2={center + W_px / 2} y2={dimY} stroke="#64748b" strokeWidth="1" /><text x={center} y={dimY + 12} textAnchor="middle" fontSize="10" fill={isPrintMode ? "#475569" : "#cbd5e1"} fontWeight="600">B = {B}</text></g>);
    const dimX = center + W_px / 2 + 20;
    dims.push(<g key="dim_H"><line x1={dimX} y1={center - H_px / 2} x2={dimX} y2={center + H_px / 2} stroke="#64748b" strokeWidth="1" /><text x={dimX + 4} y={center} textAnchor="middle" fontSize="10" fill={isPrintMode ? "#475569" : "#cbd5e1"} fontWeight="600" transform={`rotate(90, ${dimX + 4}, ${center})`}>H = {H}</text></g>);
  }
  return (
    <div className={`flex flex-col items-center justify-center rounded-3xl border border-slate-800 w-full ${isPrintMode ? 'bg-white p-2 border-none' : 'bg-slate-900 p-6 h-full'}`}>
      {!isPrintMode && <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 w-full text-left">Section Preview</h4>}
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="auto" className="max-w-[280px] max-h-[280px] overflow-visible">
        {shapes}
        <line x1={center} y1={padding - 10} x2={center} y2={size - padding + 10} stroke={colorAxis} strokeWidth="1" strokeDasharray="6 3" />
        <line x1={padding - 10} y1={center} x2={size - padding + 10} y2={center} stroke={colorAxis} strokeWidth="1" strokeDasharray="6 3" />
        {rebars}
        {dims}
      </svg>
    </div>
  );
};

const InteractiveLineChart = ({ data, xKey, yKey, color = "#0ea5e9", colors, labels, xLabel, yLabel, title, className, fixedWidth, fixedHeight }: any) => {
  const [hoverData, setHoverData] = useState<any>(null);
  const [dims, setDims] = useState({ width: fixedWidth || 0, height: fixedHeight || 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (fixedWidth && fixedHeight) { setDims({ width: fixedWidth, height: fixedHeight }); return; }
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) setDims({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [fixedWidth, fixedHeight]);
  const hasData = data && data.length > 0;
  const { width, height } = dims;
  const padding = 65;
  let paths: any[] = [], yMax = 100, yMin = 0, yKeys = [], lineColors = colors || [color, "#10b981", "#f59e0b", "#8b5cf6"], xScale: any, yScale: any, xTicks: number[] = [], yTicks: number[] = [];
  const formatTick = (val: number) => {
    if (val === 0) return "0";
    if (Math.abs(val) >= 100) return val.toFixed(0);
    if (Math.abs(val) >= 1) return val.toFixed(1);
    return val.toFixed(3);
  };
  if (hasData) {
    yKeys = Array.isArray(yKey) ? yKey : [yKey];
    const xMax = Math.max(...data.map((d: any) => d[xKey]));
    const xMin = Math.min(...data.map((d: any) => d[xKey]));
    const allYValues = data.flatMap((d: any) => yKeys.map(k => d[k]));
    yMax = allYValues.length > 0 ? Math.max(...allYValues) : 100;
    yMin = allYValues.length > 0 ? Math.min(0, ...allYValues) : 0;
    const yRange = yMax - yMin, xRange = xMax - xMin;
    xScale = (val: number) => xRange === 0 ? padding : ((val - xMin) / xRange) * (width - 2 * padding) + padding;
    yScale = (val: number) => yRange === 0 ? height - padding : height - padding - ((val - yMin) / yRange) * (height - 2 * padding);
    paths = yKeys.map((key, i) => ({
      key, points: data.map((d: any) => `${xScale(d[xKey])},${yScale(d[key])}`).join(' '), color: lineColors[i % lineColors.length]
    }));
    const numTicks = 5;
    xTicks = Array.from({ length: numTicks }, (_, i) => xMin + (i * xRange / (numTicks - 1)));
    yTicks = Array.from({ length: numTicks }, (_, i) => yMin + (i * yRange / (numTicks - 1)));
  }
  const handleMouseMove = (e: any) => {
    if (!hasData || !containerRef.current || fixedWidth) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const xMax = Math.max(...data.map((d: any) => d[xKey])), xMin = Math.min(...data.map((d: any) => d[xKey]));
    const xValEstimate = ((x - padding) / (width - 2 * padding)) * (xMax - xMin) + xMin;
    setHoverData(data.reduce((prev: any, curr: any) => Math.abs(curr[xKey] - xValEstimate) < Math.abs(prev[xKey] - xValEstimate) ? curr : prev));
  };
  return (
    <div className={`w-full h-full flex flex-col ${className || ''}`} style={fixedWidth ? { width: fixedWidth, height: fixedHeight } : {}}>
      <div className="flex flex-col items-center mb-2 px-2 shrink-0">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">{title}</h4>
        {hasData && yKeys.length > 1 && labels && (
          <div className="flex gap-4 text-[10px] mt-1">
            {yKeys.map((key, i) => (
              <div key={key} className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: lineColors[i % lineColors.length] }}></div><span className="text-slate-400 font-bold">{labels[i]}</span></div>
            ))}
          </div>
        )}
      </div>
      <div className={`relative flex-grow w-full ${fixedWidth ? '' : 'min-h-[250px]'}`} ref={containerRef} onMouseMove={handleMouseMove} onMouseLeave={() => setHoverData(null)}>
        {width > 0 && hasData ? (
          <svg width={width} height={height} className="absolute top-0 left-0 w-full h-full overflow-visible">
            {yTicks.map((val, i) => (
              <g key={`y-${i}`}><line x1={padding} y1={yScale(val)} x2={width - padding} y2={yScale(val)} stroke="#1e293b" strokeWidth="1" /><text x={padding - 10} y={yScale(val) + 3} textAnchor="end" fontSize="9" fill="#475569" fontWeight="bold">{formatTick(val)}</text></g>
            ))}
            {xTicks.map((val, i) => (
              <g key={`x-${i}`}><line x1={xScale(val)} y1={padding} x2={xScale(val)} y2={height - padding} stroke="#1e293b" strokeWidth="1" /><text x={xScale(val)} y={height - padding + 16} textAnchor="middle" fontSize="9" fill="#475569" fontWeight="bold">{formatTick(val)}</text></g>
            ))}
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#334155" strokeWidth="2" />
            <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#334155" strokeWidth="2" />
            {paths.map(p => <polyline key={p.key} points={p.points} fill="none" stroke={p.color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />)}
            
            <text x={width / 2} y={height - 5} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="black" className="uppercase tracking-widest">{xLabel}</text>
            <text x={12} y={height / 2} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="black" transform={`rotate(-90, 12, ${height / 2})`} className="uppercase tracking-widest">{yLabel}</text>

            {hoverData && !fixedWidth && (
              <g><line x1={xScale(hoverData[xKey])} y1={padding} x2={xScale(hoverData[xKey])} y2={height - padding} stroke="#0ea5e9" strokeWidth="1" strokeDasharray="4 4" />
                {yKeys.map((key, i) => <circle key={key} cx={xScale(hoverData[xKey])} cy={yScale(hoverData[key])} r="4" fill="#0ea5e9" />)}
              </g>
            )}
          </svg>
        ) : <div className="absolute inset-0 flex items-center justify-center text-slate-700 font-black uppercase text-xs">Computing Diagram...</div>}
      </div>
    </div>
  );
};

const InputField = ({ label, value, onChange, unit, tooltip }: any) => (
  <div className="flex flex-col gap-2">
    <div className="flex justify-between px-1">
      <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest">{label}</label>
      <span className="text-[8px] text-sky-500 font-bold">{unit}</span>
    </div>
    <input
      type="number"
      value={isNaN(value) ? '' : value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="bg-slate-950 border-2 border-slate-800 rounded-2xl p-4 text-xs font-bold text-white focus:border-sky-500 outline-none transition-all shadow-inner w-full"
    />
  </div>
);

export function RCColumnAnalysis() {
  const { toast } = useToast();
  const [sectionType, setSectionType] = useState('circular');
  const [showReport, setShowReport] = useState(false);
  const [inputs, setInputs] = useState({
    cover: 70, L: 1400, fc: 37.5, fy: 480, db: 35.7, dbt: 20, s: 65, D: 1219, n_bars: 25, B: 1000, H: 1000, nx: 5, ny: 5, n_legsX: 4, n_legsY: 4
  });
  const [results, setResults] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('summary');

  useEffect(() => {
    try {
      let confinementProps: any = {};
      if (sectionType === 'circular') {
        const { D, cover, n_bars, db, dbt, s } = inputs;
        const ds = D - 2 * cover, Asc = Math.PI * Math.pow(dbt / 2, 2), ps = (4 * Asc) / (ds * s);
        const r_core = (D / 2) - cover - dbt / 2, pcc = (n_bars * Math.PI * Math.pow(db / 2, 2)) / (Math.PI * Math.pow(r_core, 2));
        const Ke = (0.25 * Math.PI * ds * (ds - (s - dbt) / 2)) / (0.25 * Math.PI * Math.pow(ds, 2) * (1 - pcc));
        confinementProps = { pcc, ps, ds, Ke, fLp: Ke * ps * inputs.fy / 2 };
      } else {
        const { B, H, cover, dbt, s, nx, ny, db, n_legsX, n_legsY } = inputs;
        const bc = B - 2 * cover - dbt, dc = H - 2 * cover - dbt, Ac = bc * dc;
        const pcc = ((2 * nx + 2 * (ny - 2)) * Math.PI * Math.pow(db / 2, 2)) / Ac;
        const rho_x = (n_legsX * Math.PI * Math.pow(dbt / 2, 2)) / (s * dc), rho_y = (n_legsY * Math.PI * Math.pow(dbt / 2, 2)) / (s * bc);
        const s_prime = s - dbt, wx = bc / (n_legsX - 1), wy = dc / (n_legsY - 1);
        const Ke = ((1 - ((n_legsX - 1) * Math.pow(wx, 2) + (n_legsY - 1) * Math.pow(wy, 2)) / (6 * bc * dc)) * (1 - s_prime / (2 * bc)) * (1 - s_prime / (2 * dc))) / (1 - pcc);
        confinementProps = { pcc, ps: rho_x + rho_y, Ke, fLp: (Ke * rho_x * inputs.fy + Ke * rho_y * inputs.fy) / 2 };
      }
      const ultStrainCalc = calculateUltimateStrain(sectionType, inputs, confinementProps);
      const mcStrong = analyzeSection(sectionType, inputs, ultStrainCalc, 'strong');
      const mcWeak = sectionType === 'rectangular' ? analyzeSection(sectionType, inputs, ultStrainCalc, 'weak') : null;
      const Lp_mm = Math.max(0.08 * inputs.L + 0.022 * inputs.fy * inputs.db, 0.044 * inputs.fy * inputs.db);
      const calcRotations = (mc: any) => {
        const phi_y = (mc.curvatures[mc.strainsSteel.findIndex((s: number) => s / 100 >= inputs.fy / 200000)] || mc.curvatures[mc.curvatures.length - 1]) / 1000;
        return mc.curvatures.map((phi_m: number) => {
          const phi_mm = phi_m / 1000;
          return phi_mm <= phi_y ? (phi_mm * inputs.L) / 3 : (phi_y * inputs.L) / 3 + (phi_mm - phi_y) * Lp_mm;
        });
      };
      const ssData = Array.from({ length: 101 }, (_, i) => {
        const es = 0.0014 * i, ec = 0.0005 * i;
        return { concStrain: ec, confinedStress: -1 * manderConfined(-ec, inputs.fc, ultStrainCalc.fcc, ultStrainCalc.ecc, 5000 * Math.sqrt(inputs.fc), 1.0), unconfinedStress: -1 * manderUnconfined(-ec, inputs.fc), strain: es, steelStress: parkSteel(es, inputs.fy) };
      });
      setResults({ confinement: { ...ultStrainCalc, ...confinementProps }, mcStrong: { ...mcStrong, rotations: calcRotations(mcStrong) }, mcWeak: mcWeak ? { ...mcWeak, rotations: calcRotations(mcWeak) } : null, Lp_mm, ssData });
    } catch (err) { console.error(err); }
  }, [inputs, sectionType]);

  const mergedMomentData = useMemo(() => {
    if (!results) return [];
    return results.mcStrong.curvatures.map((c: any, i: number) => ({
      curvature: c, rotation: results.mcStrong.rotations[i], moment: results.mcStrong.moments[i], momentWeak: results.mcWeak?.moments[i] || 0,
      strainSteel: results.mcStrong.strainsSteel[i], strainConc: results.mcStrong.strainsConcrete[i]
    }));
  }, [results]);

  if (showReport && results) return (
    <div className="bg-white text-black p-10 font-sans min-h-screen">
      <button onClick={() => setShowReport(false)} className="print:hidden mb-8 bg-slate-900 text-white px-6 py-2 rounded-xl font-black uppercase text-xs">Back</button>
      <h1 className="text-3xl font-black border-b-4 border-black pb-4 mb-8 uppercase tracking-widest">RC Column Analysis Report</h1>
      <div className="grid grid-cols-2 gap-10 mb-10">
        <div className="space-y-4">
          <h2 className="text-xl font-black border-b border-slate-200 pb-1 uppercase tracking-tighter">Properties</h2>
          <div className="grid grid-cols-2 gap-4 text-sm font-bold">
            <span>fc: {inputs.fc} MPa</span><span>fy: {inputs.fy} MPa</span>
            <span>f'cc: {results.confinement.fcc.toFixed(1)} MPa</span><span>ecu: {(results.confinement.ecu * 100).toFixed(2)}%</span>
          </div>
        </div>
        <div className="flex items-center justify-center border-2 border-slate-100 p-4 rounded-3xl"><CrossSectionVisualizer sectionType={sectionType} inputs={inputs} isPrintMode={true} /></div>
      </div>
      <div className="h-80 w-full mb-10"><InteractiveLineChart data={mergedMomentData} xKey="curvature" yKey="moment" title="Moment vs Curvature" fixedHeight={300} fixedWidth={700} xLabel="Curvature (1/km)" yLabel="Moment (kN-m)" /></div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between bg-slate-900/50 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
        <div className="flex items-center gap-4">
          <Activity className="h-8 w-8 text-sky-500" />
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">RC Column Moment Curvature Analysis</h2>
        </div>
        <div className="flex bg-slate-950 p-1.5 rounded-2xl border-2 border-slate-800">
          <button onClick={() => setSectionType('circular')} className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${sectionType === 'circular' ? 'bg-sky-500 text-slate-950' : 'text-slate-500 hover:text-slate-300'}`}>Circular</button>
          <button onClick={() => setSectionType('rectangular')} className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${sectionType === 'rectangular' ? 'bg-sky-500 text-slate-950' : 'text-slate-500 hover:text-slate-300'}`}>Rectangular</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 space-y-8">
          <section className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl space-y-8 sticky top-8">
            <h3 className="text-xs font-black text-sky-500 uppercase tracking-[0.2em] border-b border-slate-800 pb-4">Parameters</h3>
            <div className="grid grid-cols-1 gap-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {sectionType === 'circular' ? <InputField label="Diameter" value={inputs.D} onChange={(v: number) => setInputs({ ...inputs, D: v })} unit="mm" /> : <>
                <InputField label="Width (B)" value={inputs.B} onChange={(v: number) => setInputs({ ...inputs, B: v })} unit="mm" />
                <InputField label="Depth (H)" value={inputs.H} onChange={(v: number) => setInputs({ ...inputs, H: v })} unit="mm" /></>}
              <InputField label="Length (L)" value={inputs.L} onChange={(v: number) => setInputs({ ...inputs, L: v })} unit="mm" />
              <InputField label="Cover" value={inputs.cover} onChange={(v: number) => setInputs({ ...inputs, cover: v })} unit="mm" />
              <div className="h-px bg-slate-800 my-2" />
              {sectionType === 'circular' ? <InputField label="No. Bars" value={inputs.n_bars} onChange={(v: number) => setInputs({ ...inputs, n_bars: v })} unit="qty" /> : <>
                <InputField label="Bars nx" value={inputs.nx} onChange={(v: number) => setInputs({ ...inputs, nx: v })} unit="qty" />
                <InputField label="Bars ny" value={inputs.ny} onChange={(v: number) => setInputs({ ...inputs, ny: v })} unit="qty" /></>}
              <InputField label="Bar Dia (db)" value={inputs.db} onChange={(v: number) => setInputs({ ...inputs, db: v })} unit="mm" />
              <div className="h-px bg-slate-800 my-2" />
              <InputField label="Stirrup Dia" value={inputs.dbt} onChange={(v: number) => setInputs({ ...inputs, dbt: v })} unit="mm" />
              <InputField label="Spacing (s)" value={inputs.s} onChange={(v: number) => setInputs({ ...inputs, s: v })} unit="mm" />
              <div className="h-px bg-slate-800 my-2" />
              <InputField label="f'c" value={inputs.fc} onChange={(v: number) => setInputs({ ...inputs, fc: v })} unit="MPa" />
              <InputField label="fy" value={inputs.fy} onChange={(v: number) => setInputs({ ...inputs, fy: v })} unit="MPa" />
            </div>
          </section>
        </div>

        <div className="lg:col-span-8 space-y-8">
          <div className="flex gap-2 bg-slate-900 p-1.5 rounded-2xl border-2 border-slate-800 w-fit">
            {['summary', 'mc', 'mr', 'materials'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-sky-500 text-slate-950 shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}>{t}</button>
            ))}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl min-h-[600px] relative">
            {results ? <>
              {activeTab === 'summary' && <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800 shadow-inner">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Confined Strength</span>
                    <div className="text-4xl font-mono font-black text-sky-400 tracking-tighter mt-2">{results.confinement.fcc.toFixed(1)} <span className="text-sm font-normal text-slate-600">MPa</span></div>
                  </div>
                  <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800 shadow-inner">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Ultimate Strain Capacity</span>
                    <div className="text-4xl font-mono font-black text-sky-400 tracking-tighter mt-2">{(results.confinement.ecu * 100).toFixed(2)} <span className="text-sm font-normal text-slate-600">%</span></div>
                  </div>
                  <button onClick={() => setShowReport(true)} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-black py-5 rounded-2xl transition-all uppercase tracking-widest text-[10px] shadow-xl flex items-center justify-center gap-3"><FileText size={16} /> Generate Analysis Report</button>
                </div>
                <div className="h-full flex flex-col gap-6">
                  <CrossSectionVisualizer sectionType={sectionType} inputs={inputs} />
                  <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800 shadow-inner flex-grow">
                    <InteractiveLineChart data={mergedMomentData} xKey="curvature" yKey="moment" title="Quick MC Curve" color="#0ea5e9" xLabel="Curv (1/km)" yLabel="Moment (kN-m)" />
                  </div>
                </div>
              </div>}
              {activeTab === 'mc' && <div className="h-[500px] w-full"><InteractiveLineChart data={mergedMomentData} xKey="curvature" yKey="moment" title="Moment vs Curvature" xLabel="Curvature (1/km)" yLabel="Moment (kN-m)" /></div>}
              {activeTab === 'mr' && <div className="h-[500px] w-full"><InteractiveLineChart data={mergedMomentData} xKey="rotation" yKey="moment" title="Moment vs Rotation" color="#8b5cf6" xLabel="Rotation (rad)" yLabel="Moment (kN-m)" /></div>}
              {activeTab === 'materials' && <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="h-96 w-full"><InteractiveLineChart data={results.ssData} xKey="concStrain" yKey={["confinedStress", "unconfinedStress"]} colors={["#0ea5e9", "#10b981"]} labels={["Confined", "Unconfined"]} title="Concrete Stress-Strain" xLabel="Strain" yLabel="Stress (MPa)" /></div>
                <div className="h-96 w-full"><InteractiveLineChart data={results.ssData} xKey="strain" yKey="steelStress" title="Steel Stress-Strain" color="#6366f1" xLabel="Strain" yLabel="Stress (MPa)" /></div>
              </div>}
            </> : <div className="flex items-center justify-center h-full text-slate-700 font-black uppercase tracking-widest">Waiting for valid inputs...</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
