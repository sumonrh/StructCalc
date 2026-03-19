'use client';

import { useState, useRef, MouseEvent, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
    Redo, Pointer, CircleDot, Trash2, Undo, ZoomIn, ZoomOut, Move, 
    RotateCcw, Paintbrush, TrendingUp, ArrowDownToLine, 
    MoveHorizontal, Plus, Keyboard, Info, Settings2, Play,
    PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { type AnalysisResult, analyzeStructure } from '@/lib/fea';

// --- Type Definitions ---
export type Point = { x: number; y: number };
export type Node = { id: number; pos: Point };
export type Member = { id: number; startNodeId: number; endNodeId: number; type: 'beam' | 'column'; E: number; I: number; A: number; materialId?: string; sectionId?: string; };
export type SupportType = 'pin' | 'fixed' | 'roller';
export type Support = { nodeId: number; type: SupportType };
export type LoadType = 'point' | 'udl';
export type LoadDirection = 'x' | 'y';
export type Load = { id: number; memberId?: number; nodeId?: number; type: LoadType; magnitude: number; direction: LoadDirection; position?: number }; 
type Tool = 'select' | 'draw-node' | 'draw-member' | 'add-support' | 'add-point-load' | 'add-udl' | 'delete' | 'pan' | 'assign';

export type MaterialDef = { id: string; name: string; E: number; };
export type SectionDef = { id: string; name: string; type: 'rect' | 'circ'; dims: any; A: number; I: number; };

export type StructureState = {
    nodes: Node[];
    members: Member[];
    supports: Support[];
    loads: Load[];
    materials: MaterialDef[];
    sections: SectionDef[];
}

export type VirtualMember = Member & {
    originalMemberId: number;
}

type AnalysisResultType = 'reactions' | 'shear' | 'moment' | 'deflection';

const SNAP_GRID_SIZE = 20; 
export const PIXELS_PER_METER = SNAP_GRID_SIZE;
const RULER_MARGIN = SNAP_GRID_SIZE * 2;

// --- Custom Engineering Icons ---
const UDLIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12h18" />
        <path d="M5 8v4M9 8v4M13 8v4M17 8v4M21 8v4" />
        <path d="M4 9l1-1 1 1M8 9l1-1 1 1M12 9l1-1 1 1M16 9l1-1 1 1M20 9l1-1 1 1" />
    </svg>
);

const SupportIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4L6 16h12z" />
        <path d="M4 20h16" />
    </svg>
);

const MemberDrawIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="4" cy="20" r="2" fill="currentColor" />
        <circle cx="20" cy="4" r="2" fill="currentColor" />
        <line x1="5.5" y1="18.5" x2="18.5" y2="5.5" />
    </svg>
);

const initialMaterials: MaterialDef[] = [
    { id: 'mat-steel', name: 'Structural Steel', E: 200e9 },
    { id: 'mat-conc', name: 'Concrete C30', E: 30e9 },
];

const initialSections: SectionDef[] = [
    { id: 'sec-rect', name: '300x500 Rect', type: 'rect', dims: { b: 0.3, h: 0.5 }, A: 0.15, I: 0.3 * Math.pow(0.5, 3) / 12 },
    { id: 'sec-circ', name: '400mm Circular', type: 'circ', dims: { d: 0.4 }, A: Math.PI * 0.2 * 0.2, I: Math.PI * Math.pow(0.4, 4) / 64 },
];

const initialStructureState: StructureState = {
    nodes: [
        { id: 1, pos: { x: -100, y: 0 } },
        { id: 2, pos: { x: 100, y: 0 } },
    ],
    members: [
        { id: 1, startNodeId: 1, endNodeId: 2, type: 'beam', E: 200e9, I: 8.33e-5, A: 0.01, materialId: 'mat-steel', sectionId: 'sec-rect' },
    ],
    supports: [
        { nodeId: 1, type: 'pin' },
        { nodeId: 2, type: 'roller' }
    ],
    loads: [],
    materials: initialMaterials,
    sections: initialSections,
};

export function StructuralAnalysis() {
    const { toast } = useToast();
    const [history, setHistory] = useState<StructureState[]>([initialStructureState]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const currentState = history[historyIndex];
    const { nodes, members, supports, loads, materials, sections } = currentState;

    const [activeTool, setActiveTool] = useState<Tool>('select');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [activeResultDiagram, setActiveResultDiagram] = useState<AnalysisResultType | null>(null);

    const [drawingStartNode, setDrawingStartNode] = useState<number | null>(null);
    const [previewLine, setPreviewLine] = useState<{ start: Point, end: Point } | null>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 800, height: 500 });
    
    const [zoom, setZoom] = useState(1.0);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDraggingPan, setIsDraggingPan] = useState(false);
    const lastMousePos = useRef<Point | null>(null);

    const [cursorPos, setCursorPos] = useState<Point | null>(null);
    const [cursorWorldPos, setCursorWorldPos] = useState<{x: number, y: number} | null>(null);
    const [hoveredNode, setHoveredNode] = useState<number | null>(null);
    const [tooltipInfo, setTooltipInfo] = useState<{ value: number, unit: string, dx?: number, dy?: number, length?: number } | null>(null);

    const [activeMaterialId, setActiveMaterialId] = useState(materials[0].id);
    const [activeSectionId, setActiveSectionId] = useState(sections[0].id);

    const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
    const propertyPopoverTriggerRef = useRef<HTMLButtonElement>(null);

    const [newSecName, setNewSecName] = useState('');
    const [newSecType, setNewSecType] = useState<'rect' | 'circ'>('rect');
    const [newSecB, setNewSecB] = useState('0.3');
    const [newSecH, setNewSecH] = useState('0.5');
    const [newSecD, setNewSecD] = useState('0.4');

    const [manualX, setManualX] = useState('0.0');
    const [manualY, setManualY] = useState('0.0');

    const svgRef = useRef<SVGSVGElement>(null);

    const setState = (updater: (prevState: StructureState) => StructureState) => {
        const newState = updater(history[historyIndex]);
        const newHistory = [...history.slice(0, historyIndex + 1), newState];
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setAnalysisResult(null);
        setActiveResultDiagram(null);
    };

    const undo = () => { if (historyIndex > 0) setHistoryIndex(prev => prev - 1); };
    const redo = () => { if (historyIndex < history.length - 1) setHistoryIndex(prev => prev + 1); };

    useEffect(() => {
        const updateSize = () => { if (svgRef.current) { const rect = svgRef.current.getBoundingClientRect(); setCanvasSize({ width: rect.width, height: rect.height }); } };
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    const getNextId = <T extends { id: number }>(items: T[]): number => items.length > 0 ? Math.max(...items.map(item => item.id)) + 1 : 1;
    const getNodeById = (id: number) => nodes.find(n => n.id === id) || analysisResult?.virtualNodes?.find(n => n.id === id);

    const getRawPoint = (e: MouseEvent<SVGSVGElement>): Point => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const rect = svgRef.current.getBoundingClientRect();
        const originX = rect.width / 2 + pan.x;
        const originY = rect.height / 2 + pan.y;
        return { x: (e.clientX - rect.left - originX) / zoom, y: (e.clientY - rect.top - originY) / zoom };
    };

    const getSnapPoint = (point: Point): Point => ({ x: Math.round(point.x / SNAP_GRID_SIZE) * SNAP_GRID_SIZE, y: Math.round(point.y / SNAP_GRID_SIZE) * SNAP_GRID_SIZE });

    const handleCanvasMouseDown = (e: MouseEvent<SVGSVGElement>) => {
        if (activeTool === 'pan' || (activeTool === 'select' && e.button === 1)) {
            setIsDraggingPan(true);
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        }
    };

    const handleCanvasMouseUp = () => { setIsDraggingPan(false); lastMousePos.current = null; };

    const handleCanvasClick = (e: MouseEvent<SVGSVGElement>) => {
        if (activeTool === 'pan' || isDraggingPan) return;
        const raw = getRawPoint(e);
        const coords = getSnapPoint(raw);

        if (activeTool === 'draw-node') {
            setState(prev => ({ ...prev, nodes: [...prev.nodes, { id: getNextId(prev.nodes), pos: coords }] }));
        } else if (activeTool === 'draw-member') {
            const existingNode = nodes.find(n => Math.hypot(n.pos.x - raw.x, n.pos.y - raw.y) < 10 / zoom);
            const mat = materials.find(m => m.id === activeMaterialId)!;
            const sec = sections.find(s => s.id === activeSectionId)!;

            if (drawingStartNode === null) {
                if (existingNode) {
                    setDrawingStartNode(existingNode.id);
                    setPreviewLine({ start: existingNode.pos, end: existingNode.pos });
                } else {
                    const newId = getNextId(nodes);
                    setState(prev => ({ ...prev, nodes: [...prev.nodes, { id: newId, pos: coords }] }));
                    setDrawingStartNode(newId);
                    setPreviewLine({ start: coords, end: coords });
                }
            } else {
                const targetId = existingNode ? existingNode.id : getNextId(nodes);
                if (targetId === drawingStartNode) return;
                setState(prev => {
                    const nodesToKeep = existingNode ? prev.nodes : [...prev.nodes, { id: targetId, pos: coords }];
                    return { ...prev, nodes: nodesToKeep, members: [...prev.members, { id: getNextId(prev.members), startNodeId: drawingStartNode, endNodeId: targetId, type: 'beam', E: mat.E, I: sec.I, A: sec.A, materialId: mat.id, sectionId: sec.id }] };
                });
                setDrawingStartNode(targetId);
                setPreviewLine({ start: existingNode ? existingNode.pos : coords, end: existingNode ? existingNode.pos : coords });
            }
        }
    };

    const handleNodeClick = (nodeId: number, e: MouseEvent) => {
        e.stopPropagation();
        if (activeTool === 'pan') return;
        if (activeTool === 'draw-member') { handleCanvasClick(e as any); return; }
        if (activeTool === 'delete') {
            setState(prev => {
                const mIds = prev.members.filter(m => m.startNodeId === nodeId || m.endNodeId === nodeId).map(m => m.id);
                return { ...prev, nodes: prev.nodes.filter(n => n.id !== nodeId), members: prev.members.filter(m => !mIds.includes(m.id)), supports: prev.supports.filter(s => s.nodeId !== nodeId), loads: prev.loads.filter(l => l.nodeId !== nodeId && (!l.memberId || !mIds.includes(l.memberId))) };
            });
        }
    };

    const handleMemberClick = (memberId: number, e: MouseEvent) => {
        e.stopPropagation();
        if (activeTool === 'delete') {
            setState(prev => ({ ...prev, members: prev.members.filter(m => m.id !== memberId), loads: prev.loads.filter(l => l.memberId !== memberId) }));
        } else if (activeTool === 'assign') {
            handleUpdateMemberProperties(memberId, activeMaterialId, activeSectionId);
        }
    };

    const handleUpdateMemberProperties = (memberId: number, matId: string, secId: string) => {
        const mat = materials.find(m => m.id === matId)!;
        const sec = sections.find(s => s.id === secId)!;
        setState(prev => ({ ...prev, members: prev.members.map(m => m.id === memberId ? { ...m, materialId: matId, sectionId: secId, E: mat.E, I: sec.I, A: sec.A } : m) }));
    };

    const handleUpdateMaterial = (id: string, E: number) => {
        if (isNaN(E)) return;
        setState(prev => ({ ...prev, materials: prev.materials.map(m => m.id === id ? { ...m, E } : m), members: prev.members.map(mem => mem.materialId === id ? { ...mem, E } : mem) }));
    };

    const handleUpdateSection = (id: string, dims: any) => {
        setState(prev => {
            const sec = prev.sections.find(s => s.id === id);
            if (!sec) return prev;
            let A = 0, I = 0;
            const b = parseFloat(dims.b) || 0, h = parseFloat(dims.h) || 0, d = parseFloat(dims.d) || 0;
            if (sec.type === 'rect') { A = b * h; I = (b * Math.pow(h, 3)) / 12; }
            else { A = Math.PI * Math.pow(d / 2, 2); I = (Math.PI * Math.pow(d, 4)) / 64; }
            return { 
                ...prev, 
                sections: prev.sections.map(s => s.id === id ? { ...s, dims, A, I } : s),
                members: prev.members.map(mem => mem.sectionId === id ? { ...mem, A, I } : mem)
            };
        });
    };

    const handleAddSection = () => {
        if (!newSecName) return;
        let A = 0, I = 0, dims = {};
        const b = parseFloat(newSecB) || 0, h = parseFloat(newSecH) || 0, d = parseFloat(newSecD) || 0;
        if (newSecType === 'rect') { A = b * h; I = (b * Math.pow(h, 3)) / 12; dims = { b, h }; }
        else { A = Math.PI * Math.pow(d / 2, 2); I = (Math.PI * Math.pow(d, 4)) / 64; dims = { d }; }
        setState(prev => ({ ...prev, sections: [...prev.sections, { id: `sec-${Date.now()}`, name: newSecName, type: newSecType, dims, A, I }] }));
        setNewSecName('');
    };

    const handleManualNode = () => {
        const x = parseFloat(manualX) * PIXELS_PER_METER, y = -parseFloat(manualY) * PIXELS_PER_METER;
        if (isNaN(x) || isNaN(y)) return;
        setState(prev => ({ ...prev, nodes: [...prev.nodes, { id: getNextId(prev.nodes), pos: { x, y } }] }));
    };

    const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
        if (isDraggingPan && lastMousePos.current) {
            setPan(prev => ({ x: prev.x + (e.clientX - lastMousePos.current!.x), y: prev.y + (e.clientY - lastMousePos.current!.y) }));
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            return;
        }
        const raw = getRawPoint(e);
        const snap = getSnapPoint(raw);
        setCursorPos(raw);
        setCursorWorldPos({ x: raw.x / PIXELS_PER_METER, y: -raw.y / PIXELS_PER_METER });
        setHoveredNode(nodes.find(n => Math.hypot(n.pos.x - raw.x, n.pos.y - raw.y) < 10 / zoom)?.id || null);

        if (activeTool === 'draw-member' && drawingStartNode !== null && previewLine) {
            setPreviewLine({ ...previewLine, end: snap });
            const dist = Math.hypot((snap.x - previewLine.start.x) / PIXELS_PER_METER, (snap.y - previewLine.start.y) / PIXELS_PER_METER);
            setTooltipInfo({ value: 0, unit: 'm', length: dist });
        } else if (analysisResult) {
            let best: any = null; let minD = 15 / zoom;
            if (activeResultDiagram === 'deflection') {
                analysisResult.virtualNodes.forEach(vn => {
                    const d = Math.hypot(raw.x - vn.pos.x, raw.y - vn.pos.y);
                    if (d < minD) { minD = d; const dp = analysisResult.displacements[vn.id]; best = { dx: dp[0]*1000, dy: dp[1]*1000, value: Math.hypot(dp[0], dp[1])*1000, unit: 'mm' }; }
                });
            } else if (['shear', 'moment'].includes(activeResultDiagram || '')) {
                members.forEach(m => {
                    const sn = getNodeById(m.startNodeId)!, en = getNodeById(m.endNodeId)!;
                    const Lp = Math.hypot(en.pos.x - sn.pos.x, en.pos.y - sn.pos.y);
                    const ux = (en.pos.x - sn.pos.x)/Lp, uy = (en.pos.y - sn.pos.y)/Lp;
                    const t = (raw.x - sn.pos.x)*ux + (raw.y - sn.pos.y)*uy;
                    if (t < 0 || t > Lp) return;
                    const d = Math.hypot(raw.x - (sn.pos.x+t*ux), raw.y - (sn.pos.y+t*uy));
                    if (d < minD) {
                        minD = d; const segs = analysisResult.memberForces![m.id]; const tm = t / PIXELS_PER_METER;
                        let ct = 0; let fv = 0;
                        for(const seg of segs) {
                            const vS = getNodeById(seg.startNodeId)!, vE = getNodeById(seg.endNodeId)!;
                            const sL = Math.hypot(vE.pos.x-vS.pos.x, vE.pos.y-vS.pos.y)/PIXELS_PER_METER;
                            if (tm >= ct-1e-6 && tm <= ct+sL+1e-6) {
                                const fr = (tm - ct)/sL;
                                fv = activeResultDiagram === 'shear' ? seg.shear1 + fr*(-seg.shear2 - seg.shear1) : -seg.moment1 + fr*(seg.moment2 - (-seg.moment1));
                                break;
                            }
                            ct += sL;
                        }
                        best = { value: fv/1000, unit: activeResultDiagram === 'shear' ? 'kN' : 'kNm' };
                    }
                });
            }
            setTooltipInfo(best);
        } else { setTooltipInfo(null); }
    };

    const handleMouseLeave = () => { setCursorPos(null); setCursorWorldPos(null); setTooltipInfo(null); setPreviewLine(null); };
    const handleCanvasContextMenu = (e: React.MouseEvent) => { e.preventDefault(); setDrawingStartNode(null); setPreviewLine(null); };

    const handleAnalyze = () => {
        try { const res = analyzeStructure(currentState); setAnalysisResult(res); setActiveResultDiagram('reactions'); } 
        catch (e: any) { toast({ variant: "destructive", title: "Analysis Failed", description: e.message }); }
    };

    const renderSupport = (support: Support) => {
        const node = getNodeById(support.nodeId); if (!node) return null;
        const { x, y } = node.pos; const sw = 2/zoom; const sCls = cn(activeTool === 'delete' ? 'cursor-pointer hover:stroke-red-400' : '');
        switch (support.type) {
            case 'pin': return <path key={`sup-${support.nodeId}`} d={`M ${x - 10/zoom} ${y + 15/zoom} L ${x} ${y} L ${x + 10/zoom} ${y + 15/zoom} Z M ${x - 15/zoom} ${y + 15/zoom} H ${x + 15/zoom}`} stroke="#38bdf8" strokeWidth={sw} fill="none" className={sCls} onClick={(e) => handleSupportClick(support.nodeId, e)} />;
            case 'fixed': return <path key={`sup-${support.nodeId}`} d={`M ${x-15/zoom} ${y-15/zoom} V ${y+15/zoom} H ${x}`} stroke="#38bdf8" strokeWidth={sw} fill="none" className={sCls} onClick={(e) => handleSupportClick(support.nodeId, e)} />;
            case 'roller': return <g key={`sup-${support.nodeId}`} onClick={(e) => handleSupportClick(support.nodeId, e)} className={sCls}><path d={`M ${x-10/zoom} ${y+10/zoom} L ${x} ${y} L ${x+10/zoom} ${y+10/zoom} Z`} stroke="#38bdf8" strokeWidth={sw} fill="none" /><circle cx={x} cy={y+15/zoom} r={4/zoom} stroke="#38bdf8" strokeWidth={sw} fill="none" /></g>;
        }
        return null;
    };

    const renderLoadGraphic = (load: Load) => {
        let x1, y1, x2, y2, ang = 0;
        if (load.nodeId) { const n = getNodeById(load.nodeId); if (!n) return null; x1=n.pos.x; y1=n.pos.y; x2=x1; y2=y1; } 
        else if (load.memberId) { const m = members.find(mi => mi.id === load.memberId); if (!m) return null; const sn=getNodeById(m.startNodeId), en=getNodeById(m.endNodeId); if(!sn||!en) return null; x1=sn.pos.x; y1=sn.pos.y; x2=en.pos.x; y2=en.pos.y; ang = Math.atan2(y2-y1, x2-x1); }
        else return null;
        const lc = "#fb923c"; const sw = 1.5/zoom; 
        const txS = { fontSize: `${10/zoom}px`, textAnchor: "middle" as const, paintOrder: "stroke" as const, stroke: "#020617", strokeWidth: `${3/zoom}px` };
        const gP = { onClick: (e: MouseEvent) => handleLoadClick(load.id, e), className: cn(activeTool === 'delete' ? 'cursor-pointer group/load' : '') };
        
        if (load.type === 'point') {
            let lx = x1+(x2-x1)*(load.position??0), ly = y1+(y2-y1)*(load.position??0);
            const dx = load.direction==='x'?Math.sign(load.magnitude):0, dy = load.direction==='x'?0:-Math.sign(load.magnitude);
            const ax=lx, ay=ly, sx=ax-dx*20/zoom, sy=ay-dy*20/zoom;
            return <g key={`load-${load.id}`} {...gP}><line x1={sx} y1={sy} x2={ax} y2={ay} stroke={lc} strokeWidth={sw} /><text x={sx-dx*10/zoom} y={sy-dy*10/zoom} {...txS} fill={lc} className="font-black">{Math.abs(load.magnitude/1000).toFixed(1)}kN</text></g>;
        }
        if (load.type === 'udl') {
            const nA = 5; const ox = Math.cos(ang+Math.PI/2), oy = Math.sin(ang+Math.PI/2); const dir = -Math.sign(load.magnitude);
            const arrs = []; for(let i=0; i<=nA; i++) { const p = i/nA; let x = x1+(x2-x1)*p, y = y1+(y2-y1)*p; arrs.push(<line key={i} x1={x-dir*ox*20/zoom} y1={y-dir*oy*20/zoom} x2={x} y2={y} stroke={lc} strokeWidth={sw} />); }
            return <g key={`load-${load.id}`} {...gP}>{arrs}<line x1={x1-dir*ox*20/zoom} y1={y1-dir*oy*20/zoom} x2={x2-dir*ox*20/zoom} y2={y2-dir*ox*20/zoom} stroke={lc} strokeWidth={sw} /><text x={(x1+x2)/2} y={(y1+y2)/2-dir*ox*25/zoom} {...txS} fill={lc} className="font-black">{Math.abs(load.magnitude/1000).toFixed(1)}kN/m</text></g>;
        }
        return null;
    };

    const handleApplyPointLoad = (id: number, isNode: boolean, data: any) => setState(prev => ({ ...prev, loads: [...prev.loads, { id: getNextId(prev.loads), ...(isNode ? { nodeId: id } : { memberId: id }), ...data }] }));
    const handleApplyUDL = (mid: number, data: any) => setState(prev => ({ ...prev, loads: [...prev.loads, { id: getNextId(prev.loads), memberId: mid, ...data }] }));
    const handleLoadClick = (id: number, e: MouseEvent) => { if (activeTool === 'delete') setState(prev => ({ ...prev, loads: prev.loads.filter(l => l.id !== id) })); };
    const handleSupportClick = (nodeId: number, e: MouseEvent) => { if (activeTool === 'delete') setState(prev => ({ ...prev, supports: prev.supports.filter(s => s.nodeId !== nodeId) })); };
    const handleAddSupport = (nodeId: number, type: SupportType) => setState(prev => {
        const idx = prev.supports.findIndex(s => s.nodeId === nodeId);
        if (idx > -1) { const ns = [...prev.supports]; ns[idx].type = type; return { ...prev, supports: ns }; }
        return { ...prev, supports: [...prev.supports, { nodeId, type }] };
    });

    const renderResultSummary = (res: AnalysisResult | null) => {
        if (!res) return null;
        const allF = Object.values(res.memberForces!).flat();
        const maxV = allF.length ? Math.max(...allF.map(f => Math.max(Math.abs(f.shear1), Math.abs(f.shear2)))) / 1000 : 0;
        const maxM = allF.length ? Math.max(...allF.map(f => Math.max(Math.abs(f.moment1), Math.abs(f.moment2)))) / 1000 : 0;
        const maxD = Object.values(res.displacements).length ? Math.max(...Object.values(res.displacements).map(d => Math.hypot(d[0], d[1]))) * 1000 : 0;
        let maxR = 0; Object.values(res.reactions).forEach(r => maxR = Math.max(maxR, Math.abs(r[0]), Math.abs(r[1])));
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard icon={<TrendingUp className="w-4 h-4 text-sky-400" />} label="Peak Reaction" value={(maxR/1000).toFixed(2)} unit="kN" />
                <SummaryCard icon={<ArrowDownToLine className="w-4 h-4 text-sky-400" />} label="Peak Shear" value={maxV.toFixed(2)} unit="kN" />
                <SummaryCard icon={<RotateCcw className="w-4 h-4 text-emerald-400" />} label="Peak Moment" value={maxM.toFixed(2)} unit="kNm" />
                <SummaryCard icon={<MoveHorizontal className="w-4 h-4 text-purple-400" />} label="Peak Deflect" value={maxD.toFixed(2)} unit="mm" />
            </div>
        );
    };

    return (
        <section className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl space-y-10">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">2D Static Analysis</h2>
                <div className="flex gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shadow-xl flex-wrap">
                    {/* Navigation Group */}
                    <div className="flex items-center gap-1">
                        <Button variant={activeTool === 'select' ? 'secondary' : 'ghost'} size="icon" className={cn("rounded-xl", activeTool === 'select' ? "bg-sky-500 text-slate-950" : "text-white")} onClick={() => setActiveTool('select')} title="Select"><Pointer className="h-4 w-4" /></Button>
                        <Button variant={activeTool === 'pan' ? 'secondary' : 'ghost'} size="icon" className={cn("rounded-xl", activeTool === 'pan' ? "bg-sky-500 text-slate-950" : "text-white")} onClick={() => setActiveTool('pan')} title="Pan"><Move className="h-4 w-4" /></Button>
                        <Separator orientation="vertical" className="h-6 mx-1 bg-slate-800" />
                        <Button variant="ghost" size="icon" className="text-white" onClick={() => setZoom(p => Math.min(p + 0.1, 5))} title="Zoom In"><ZoomIn className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-white" onClick={() => setZoom(p => Math.max(p - 0.1, 0.2))} title="Zoom Out"><ZoomOut className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-white" onClick={() => { setZoom(1); setPan({x:0,y:0}); }} title="Reset View"><RotateCcw className="h-4 w-4" /></Button>
                    </div>
                    
                    <Separator orientation="vertical" className="h-8 mx-1 bg-slate-800" />
                    
                    {/* Modeling Tools */}
                    <Button variant={activeTool === 'draw-member' ? 'secondary' : 'ghost'} size="icon" className={cn("rounded-xl", activeTool === 'draw-member' ? "bg-sky-500 text-slate-950" : "text-white")} onClick={() => setActiveTool('draw-member')} title="Draw Member"><MemberDrawIcon /></Button>
                    <Button variant={activeTool === 'draw-node' ? 'secondary' : 'ghost'} size="icon" className={cn("rounded-xl", activeTool === 'draw-node' ? "bg-sky-500 text-slate-950" : "text-white")} onClick={() => setActiveTool('draw-node')} title="Draw Node"><CircleDot className="h-4 w-4" /></Button>
                    <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="rounded-xl text-white" title="Manual Node"><Keyboard className="h-4 w-4" /></Button></PopoverTrigger>
                        <PopoverContent className="w-64 bg-slate-900 border-slate-800 p-6 text-white rounded-3xl shadow-2xl">
                            <h4 className="font-black text-xs uppercase mb-4 italic">Insert Node</h4>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-slate-500">X (m)</Label><Input type="number" value={manualX} onChange={e => setManualX(e.target.value)} className="bg-slate-950 border-slate-800 h-8" /></div>
                                <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-slate-500">Y (m)</Label><Input type="number" value={manualY} onChange={e => setManualY(e.target.value)} className="bg-slate-950 border-slate-800 h-8" /></div>
                            </div>
                            <Button onClick={handleManualNode} className="w-full bg-sky-500 text-slate-950 font-black uppercase text-[10px]">Insert</Button>
                        </PopoverContent>
                    </Popover>

                    <Separator orientation="vertical" className="h-8 mx-1 bg-slate-800" />
                    
                    <Button variant={activeTool === 'add-support' ? 'secondary' : 'ghost'} size="icon" className={cn("rounded-xl", activeTool === 'add-support' ? "bg-sky-500 text-slate-950" : "text-white")} onClick={() => setActiveTool('add-support')} title="Add Support"><SupportIcon /></Button>
                    
                    <Separator orientation="vertical" className="h-8 mx-1 bg-slate-800" />
                    
                    <Button variant={activeTool === 'delete' ? 'secondary' : 'ghost'} size="icon" className={cn("rounded-xl", activeTool === 'delete' ? "bg-sky-500 text-slate-950" : "text-red-500")} onClick={() => setActiveTool('delete')} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                    
                    <Separator orientation="vertical" className="h-8 mx-1 bg-slate-800" />
                    
                    {/* Analysis Toggle Group */}
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="text-sky-500 hover:bg-sky-500/10" onClick={handleAnalyze} title="Run Analysis"><Play className="h-5 w-5 fill-current" /></Button>
                        <Separator orientation="vertical" className="h-6 mx-1 bg-slate-800" />
                        <Button variant="ghost" size="icon" className="text-white" onClick={undo} disabled={historyIndex===0}><Undo className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-white" onClick={redo} disabled={historyIndex===history.length-1}><Redo className="h-4 w-4" /></Button>
                    </div>
                </div>
            </div>

            <div className="flex gap-10">
                {/* Collapsible Sidebar */}
                <div className={cn("flex flex-col gap-8 transition-all duration-300 ease-in-out relative shrink-0", isSidebarOpen ? "w-72" : "w-12 overflow-hidden")}>
                    {/* Toggle Button */}
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute -right-2 top-0 z-10 h-6 w-6 rounded-full bg-slate-800 border border-slate-700 text-sky-500 hover:text-white" 
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    >
                        {isSidebarOpen ? <PanelLeftClose size={12} /> : <PanelLeftOpen size={12} />}
                    </Button>

                    {isSidebarOpen && (
                        <div className="space-y-8 h-[600px] overflow-y-auto custom-scrollbar pr-2 animate-in fade-in slide-in-from-left-4 duration-300">
                            <div className="bg-slate-950/50 border border-slate-800 p-6 rounded-[2rem] space-y-6">
                                <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">Modeling Controls</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <Button variant={activeTool === 'add-point-load' ? 'secondary' : 'ghost'} onClick={() => setActiveTool('add-point-load')} className={cn("rounded-xl h-12 text-[9px] font-black uppercase tracking-wider", activeTool==='add-point-load'?'bg-sky-500 text-slate-950':'bg-slate-900 border-slate-800 text-white hover:bg-slate-800')}><ArrowDownToLine className="mr-2 h-3 w-3" /> Point Load</Button>
                                    <Button variant={activeTool === 'add-udl' ? 'secondary' : 'ghost'} onClick={() => setActiveTool('add-udl')} className={cn("rounded-xl h-12 text-[9px] font-black uppercase tracking-wider", activeTool==='add-udl'?'bg-sky-500 text-slate-950':'bg-slate-900 border-slate-800 text-white hover:bg-slate-800')}><UDLIcon /> UDL</Button>
                                </div>
                                <div className="h-px bg-slate-800" />
                                <div className="space-y-4">
                                    <div className="space-y-1"><Label className="text-[9px] uppercase font-black text-slate-500">Active Material</Label>
                                        <Select value={activeMaterialId} onValueChange={setActiveMaterialId}><SelectTrigger className="h-9 bg-slate-900 border-slate-800 text-xs text-white"><SelectValue /></SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-800 text-white">{materials.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select>
                                    </div>
                                    <div className="space-y-1"><Label className="text-[9px] uppercase font-black text-slate-500">Active Section</Label>
                                        <Select value={activeSectionId} onValueChange={setActiveSectionId}><SelectTrigger className="h-9 bg-slate-900 border-slate-800 text-xs text-white"><SelectValue /></SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-800 text-white">{sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
                                    </div>
                                    <Button variant={activeTool === 'assign' ? 'secondary' : 'ghost'} onClick={() => setActiveTool('assign')} className="w-full h-9 rounded-xl font-black text-[10px] uppercase bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500 hover:text-slate-950"><Paintbrush className="mr-2 h-3 w-3" /> Bulk Assign</Button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">Materials</h4>
                                <div className="space-y-2">
                                    {materials.map(m => (
                                        <div key={m.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex justify-between items-center group hover:border-sky-500/30">
                                            <div className="flex items-center gap-3">
                                                <div className="w-1 h-8 bg-sky-500 rounded-full" />
                                                <div><p className="text-[10px] font-black text-white uppercase">{m.name}</p><p className="text-[9px] text-slate-500 font-bold">E: {m.E/1e9} GPa</p></div>
                                            </div>
                                            <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-slate-700 hover:text-sky-400"><Settings2 size={12} /></Button></PopoverTrigger>
                                                <PopoverContent className="bg-slate-900 border-slate-800 p-4"><Label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Modulus E (GPa)</Label>
                                                <Input type="number" value={isNaN(m.E) ? '' : m.E/1e9} onChange={e => handleUpdateMaterial(m.id, parseFloat(e.target.value)*1e9)} className="bg-slate-950 border-slate-800 text-xs h-8 text-white" /></PopoverContent></Popover>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center px-2">
                                    <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Sections</h4>
                                    <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 text-sky-500"><Plus size={14} /></Button></PopoverTrigger>
                                        <PopoverContent className="w-72 bg-slate-900 border-slate-800 p-6 rounded-3xl text-white shadow-2xl">
                                            <h5 className="text-[10px] font-black uppercase mb-4 border-b border-slate-800 pb-2">New Section</h5>
                                            <div className="space-y-4">
                                                <Input value={newSecName} onChange={e => setNewSecName(e.target.value)} placeholder="Name" className="h-8 bg-slate-950 border-slate-800 text-xs text-white" />
                                                <Select value={newSecType} onValueChange={(v:any) => setNewSecType(v)}><SelectTrigger className="h-8 bg-slate-950 border-slate-800 text-xs text-white"><SelectValue /></SelectTrigger>
                                                <SelectContent className="bg-slate-900 border-slate-800 text-white"><SelectItem value="rect">Rectangular</SelectItem><SelectItem value="circ">Circular</SelectItem></SelectContent></Select>
                                                <div className="grid grid-cols-2 gap-4">
                                                    {newSecType === 'rect' ? <>
                                                        <div className="space-y-1"><Label className="text-[9px] uppercase font-bold text-slate-500">B (m)</Label><Input type="number" value={newSecB} onChange={e => setNewSecB(e.target.value)} className="h-8 bg-slate-950 border-slate-800 text-xs text-white" /></div>
                                                        <div className="space-y-1"><Label className="text-[9px] uppercase font-bold text-slate-500">H (m)</Label><Input type="number" value={newSecH} onChange={e => setNewSecH(e.target.value)} className="h-8 bg-slate-950 border-slate-800 text-xs text-white" /></div>
                                                    </> : <div className="col-span-2 space-y-1"><Label className="text-[9px] uppercase font-bold text-slate-500">D (m)</Label><Input type="number" value={newSecD} onChange={e => setNewSecD(e.target.value)} className="h-8 bg-slate-950 border-slate-800 text-xs text-white" /></div>}
                                                </div>
                                                <Button onClick={handleAddSection} className="w-full bg-sky-500 text-slate-950 font-black uppercase text-[10px]">Create Section</Button>
                                            </div>
                                        </PopoverContent></Popover>
                                </div>
                                <div className="space-y-2">
                                    {sections.map(s => (
                                        <div key={s.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex justify-between items-center group hover:border-sky-500/30">
                                            <div className="flex items-center gap-3">
                                                <div className="w-1 h-8 bg-emerald-500 rounded-full" />
                                                <div><p className="text-[10px] font-black text-white uppercase">{s.name}</p><p className="text-[9px] text-slate-500 font-bold">{s.type === 'rect' ? `${s.dims.b}x${s.dims.h}m` : `Ø${s.dims.d}m`}</p></div>
                                            </div>
                                            <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-slate-700 hover:text-sky-400"><Settings2 size={12} /></Button></PopoverTrigger>
                                                <PopoverContent className="bg-slate-900 border-slate-800 p-4"><div className="space-y-3">
                                                    {s.type === 'rect' ? <>
                                                        <div className="space-y-1"><Label className="text-[9px] font-bold text-slate-500">B (m)</Label><Input type="number" value={s.dims.b} onChange={e => handleUpdateSection(s.id, {...s.dims, b: e.target.value})} className="h-8 bg-slate-950 border-slate-800 text-xs text-white" /></div>
                                                        <div className="space-y-1"><Label className="text-[9px] font-bold text-slate-500">H (m)</Label><Input type="number" value={s.dims.h} onChange={e => handleUpdateSection(s.id, {...s.dims, h: e.target.value})} className="h-8 bg-slate-950 border-slate-800 text-xs text-white" /></div>
                                                    </> : <div className="space-y-1"><Label className="text-[9px] font-bold text-slate-500">D (m)</Label><Input type="number" value={s.dims.d} onChange={e => handleUpdateSection(s.id, {...s.dims, d: e.target.value})} className="h-8 bg-slate-950 border-slate-800 text-xs text-white" /></div>}
                                                </div></PopoverContent></Popover>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Modeling Canvas */}
                <div className="flex-1 space-y-6">
                    <div className="w-full h-[550px] border-2 border-slate-800 rounded-[2.5rem] bg-slate-950 overflow-hidden relative shadow-2xl">
                        <svg ref={svgRef} width="100%" height="100%" className={cn(isDraggingPan ? 'cursor-grabbing' : 'cursor-crosshair')} onClick={handleCanvasClick} onMouseDown={handleCanvasMouseDown} onMouseUp={handleCanvasMouseUp} onMouseLeave={handleMouseLeave} onMouseMove={handleMouseMove} onContextMenu={handleCanvasContextMenu}>
                            <defs><pattern id="grid" width={SNAP_GRID_SIZE*zoom} height={SNAP_GRID_SIZE*zoom} patternUnits="userSpaceOnUse" x={pan.x+canvasSize.width/2} y={pan.y+canvasSize.height/2}><path d={`M ${SNAP_GRID_SIZE*zoom} 0 L 0 0 0 ${SNAP_GRID_SIZE*zoom}`} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" /></pattern></defs>
                            <g transform={`translate(${canvasSize.width/2+pan.x}, ${canvasSize.height/2+pan.y}) scale(${zoom})`}>
                                <rect width="10000" height="10000" x="-5000" y="-5000" fill="url(#grid)" className="pointer-events-none" />
                                {members.map(m => {
                                    const s=getNodeById(m.startNodeId), e=getNodeById(m.endNodeId); if(!s||!e) return null;
                                    const el=<line key={m.id} x1={s.pos.x} y1={s.pos.y} x2={e.pos.x} y2={e.pos.y} stroke={activeTool==='delete'?"#ef4444":"#38bdf8"} strokeWidth={4/zoom} strokeLinecap="round" className="cursor-pointer transition-all hover:stroke-white" onClick={(ev)=>handleMemberClick(m.id, ev)} onContextMenu={(ev)=> { ev.preventDefault(); setEditingMemberId(m.id); }} />;
                                    if(activeTool==='add-point-load') return <PointLoadPopover key={`mp-${m.id}`} targetId={m.id} isNode={false} onAddLoad={handleApplyPointLoad}>{el}</PointLoadPopover>;
                                    if(activeTool==='add-udl') return <UDLPopover key={`mu-${m.id}`} targetId={m.id} onAddLoad={handleApplyUDL}>{el}</UDLPopover>;
                                    return el;
                                })}
                                {previewLine && <line x1={previewLine.start.x} y1={previewLine.start.y} x2={previewLine.end.x} y2={previewLine.end.y} stroke="#38bdf8" strokeWidth={2/zoom} strokeDasharray={`${5/zoom} ${5/zoom}`} className="opacity-50 pointer-events-none" />}
                                {nodes.map(n => {
                                    const el=<circle key={n.id} cx={n.pos.x} cy={n.pos.y} r={(drawingStartNode===n.id?8:6)/zoom} fill={drawingStartNode===n.id?"white":"#0ea5e9"} className="cursor-pointer transition-all hover:fill-white" onClick={(ev)=>handleNodeClick(n.id, ev)} />;
                                    if(activeTool==='add-support') return <DropdownMenu key={n.id}><DropdownMenuTrigger asChild>{el}</DropdownMenuTrigger><DropdownMenuContent className="bg-slate-900 border-slate-800 text-white"><DropdownMenuItem onClick={()=>handleAddSupport(n.id, 'pin')}>Pin</DropdownMenuItem><DropdownMenuItem onClick={()=>handleAddSupport(n.id, 'roller')}>Roller</DropdownMenuItem><DropdownMenuItem onClick={()=>handleAddSupport(n.id, 'fixed')}>Fixed</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
                                    if(activeTool==='add-point-load') return <PointLoadPopover key={`np-${n.id}`} targetId={n.id} isNode={true} onAddLoad={handleApplyPointLoad}>{el}</PointLoadPopover>;
                                    return el;
                                })}
                                {supports.map(s => renderSupport(s))}
                                {loads.map(l => renderLoadGraphic(l))}
                                {analysisResult && activeResultDiagram==='reactions' && renderReactions(analysisResult, getNodeById, zoom)}
                                {analysisResult && activeResultDiagram==='shear' && renderForceDiagram(analysisResult, 'shear', nodes, members, getNodeById, zoom)}
                                {analysisResult && activeResultDiagram==='moment' && renderForceDiagram(analysisResult, 'moment', nodes, members, getNodeById, zoom)}
                                {analysisResult && activeResultDiagram==='deflection' && renderDeflection(analysisResult, members, getNodeById, zoom)}
                                {renderCursorTooltip(cursorPos, cursorWorldPos, tooltipInfo, zoom, activeTool, drawingStartNode, activeResultDiagram)}
                            </g>
                            {renderScales(canvasSize, pan, zoom)}
                        </svg>
                    </div>
                    
                    <div className="space-y-6">
                        {analysisResult && (
                            <div className="flex bg-slate-950 p-1.5 rounded-2xl border-2 border-slate-800 shadow-2xl w-fit">
                                {['reactions', 'shear', 'moment', 'deflection'].map(t => (
                                    <button key={t} onClick={() => setActiveResultDiagram(t as any)} className={cn("px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", activeResultDiagram === t ? "bg-sky-500 text-slate-950" : "text-slate-500 hover:text-slate-300")}>{t}</button>
                                ))}
                            </div>
                        )}
                        {renderResultSummary(analysisResult)}
                    </div>
                </div>
            </div>

            <Popover open={editingMemberId !== null} onOpenChange={(o) => !o && setEditingMemberId(null)}>
                <PopoverTrigger asChild><button ref={propertyPopoverTriggerRef} className="hidden" /></PopoverTrigger>
                <PopoverContent className="w-72 bg-slate-900 border-slate-800 text-white rounded-3xl p-6 shadow-2xl z-50">
                    {editingMemberId && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-2">
                                <Info className="w-4 h-4 text-sky-500" />
                                <h4 className="font-black text-xs uppercase italic">Member {editingMemberId} Properties</h4>
                            </div>
                            <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-400">Material</Label>
                                <Select value={members.find(m=>m.id===editingMemberId)?.materialId} onValueChange={(v)=>handleUpdateMemberProperties(editingMemberId, v, members.find(m=>m.id===editingMemberId)!.sectionId!)}>
                                    <SelectTrigger className="bg-slate-950 border-slate-800 h-10 text-white"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white">{materials.map(m=><SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select>
                            </div>
                            <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-400">Section</Label>
                                <Select value={members.find(m=>m.id===editingMemberId)?.sectionId} onValueChange={(v)=>handleUpdateMemberProperties(editingMemberId, members.find(m=>m.id===editingMemberId)!.materialId!, v)}>
                                    <SelectTrigger className="bg-slate-950 border-slate-800 h-10 text-white"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white">{sections.map(s=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
                            </div>
                        </div>
                    )}
                </PopoverContent>
            </Popover>
        </section>
    );
}

// --- Internal Visual Components ---

function renderForceDiagram(res: AnalysisResult, type: 'shear' | 'moment', nodes: Node[], members: Member[], getNode: any, zoom: number) {
    const allF = Object.values(res.memberForces!).flat();
    const maxVal = Math.max(...allF.map(f => type === 'shear' ? Math.max(Math.abs(f.shear1), Math.abs(f.shear2)) : Math.max(Math.abs(f.moment1), Math.abs(f.moment2))));
    const scale = 50 / (maxVal || 1); const color = type === 'shear' ? "#38bdf8" : "#10b981";
    let peak = { v: 0, x: 0, y: 0 };

    const diag = members.map(m => {
        const segs = res.memberForces![m.id]; if(!segs) return null;
        return <g key={m.id}>{segs.map((seg, i) => {
            const s = getNode(seg.startNodeId)!, e = getNode(seg.endNodeId)!;
            const ang = Math.atan2(e.pos.y-s.pos.y, e.pos.x-s.pos.x); const ox = Math.cos(ang+Math.PI/2), oy = Math.sin(ang+Math.PI/2);
            const v1 = type==='shear'?seg.shear1:-seg.moment1, v2 = type==='shear'?-seg.shear2:seg.moment2;
            if(Math.abs(v1)>Math.abs(peak.v)) peak={v:v1, x:s.pos.x+v1*scale*ox, y:s.pos.y+v1*scale*oy};
            if(Math.abs(v2)>Math.abs(peak.v)) peak={v:v2, x:e.pos.x+v2*scale*ox, y:e.pos.y+v2*scale*oy};
            return <path key={i} d={`M ${s.pos.x} ${s.pos.y} L ${s.pos.x+v1*scale*ox} ${s.pos.y+v1*scale*oy} L ${e.pos.x+v2*scale*ox} ${e.pos.y+v2*scale*oy} L ${e.pos.x} ${e.pos.y} Z`} fill={color} fillOpacity="0.2" stroke={color} strokeWidth={1/zoom} />;
        })}</g>;
    });
    return <g>{diag}{Math.abs(peak.v)>1e-3 && <text x={peak.x} y={peak.y-5/zoom} fill={color} fontSize={`${10/zoom}px`} fontWeight="black" textAnchor="middle" paintOrder="stroke" stroke="#020617" strokeWidth={`${3/zoom}px`}>{type.toUpperCase()} Max: {(Math.abs(peak.v)/1000).toFixed(1)}{type==='shear'?'kN':'kNm'}</text>}</g>;
}

function renderDeflection(res: AnalysisResult, members: Member[], getNode: any, zoom: number) {
    const scale = 100; let maxD = 0; let peak = { x: 0, y: 0 };
    const diag = members.map(m => {
        const segs = res.memberForces![m.id]; if(!segs) return null;
        return <g key={m.id}>{segs.map((seg, i) => {
            const s = getNode(seg.startNodeId)!, e = getNode(seg.endNodeId)!;
            const [dx1, dy1] = res.displacements[s.id], [dx2, dy2] = res.displacements[e.id];
            const p1 = { x: s.pos.x + dx1*PIXELS_PER_METER*scale, y: s.pos.y - dy1*PIXELS_PER_METER*scale };
            const p2 = { x: e.pos.x + dx2*PIXELS_PER_METER*scale, y: e.pos.y - dy2*PIXELS_PER_METER*scale };
            const d1 = Math.hypot(dx1, dy1); if(d1>maxD){ maxD=d1; peak=p1; }
            return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#a855f7" strokeWidth={2/zoom} />;
        })}</g>;
    });
    return <g>{diag}{maxD>1e-6 && <text x={peak.x} y={peak.y-10/zoom} fill="#a855f7" fontSize={`${10/zoom}px`} fontWeight="black" textAnchor="middle" paintOrder="stroke" stroke="#020617" strokeWidth={`${3/zoom}px`}>δ Max: {(maxD*1000).toFixed(2)}mm</text>}</g>;
}

function renderReactions(res: AnalysisResult, getNode: any, zoom: number) {
    const rx = []; const rc = "#ef4444"; const sw = 2/zoom;
    for(const id in res.reactions) {
        const n = getNode(parseInt(id)); if(!n) continue; const [fx, fy] = res.reactions[id];
        if(Math.abs(fx)>1e-3) rx.push(<g key={`x-${id}`}><line x1={n.pos.x-Math.sign(fx)*30/zoom} y1={n.pos.y} x2={n.pos.x} y2={n.pos.y} stroke={rc} strokeWidth={sw} /><text x={n.pos.x-Math.sign(fx)*35/zoom} y={n.pos.y-5/zoom} fill={rc} fontSize={`${10/zoom}px`} textAnchor="middle">{(fx/1000).toFixed(2)}kN</text></g>);
        if(Math.abs(fy)>1e-3) rx.push(<g key={`y-${id}`}><line x1={n.pos.x} y1={n.pos.y+Math.sign(fy)*30/zoom} x2={n.pos.x} y2={n.pos.y} stroke={rc} strokeWidth={sw} /><text x={n.pos.x+10/zoom} y={n.pos.y+Math.sign(fy)*25/zoom} fill={rc} fontSize={`${10/zoom}px`} dominantBaseline="middle">{(fy/1000).toFixed(2)}kN</text></g>);
    }
    return <g>{rx}</g>;
}

function renderCursorTooltip(pos: Point|null, wPos: any, info: any, zoom: number, tool: Tool, startNode: number|null, diag: any) {
    if(!pos || !wPos) return null;
    const isDrawing = tool==='draw-member' && startNode!==null;
    
    const lines = [];
    lines.push({ text: `X: ${wPos.x.toFixed(2)}m Y: ${wPos.y.toFixed(2)}m`, color: 'white', bold: true });
    
    if (info && !isDrawing) {
        if (diag === 'deflection') {
            lines.push({ text: `dx:${info.dx?.toFixed(2)} dy:${info.dy?.toFixed(2)}mm`, color: '#38bdf8', bold: true });
        } else if (diag) {
            lines.push({ text: `${diag==='shear'?'V':'M'}: ${info.value.toFixed(2)}${info.unit}`, color: '#38bdf8', bold: true });
        }
    }
    
    if (isDrawing && info?.length) {
        lines.push({ text: `Length: ${info.length.toFixed(2)}m`, color: '#fb923c', bold: true });
    }
    
    if (isDrawing) {
        lines.push({ text: `Right-Click to Exit`, color: '#fb923c', bold: true, small: true, upper: true });
    }

    const lineHeight = 18 / zoom;
    const h = (lines.length * lineHeight + 12 / zoom);
    
    return (
        <g transform={`translate(${pos.x + 15/zoom}, ${pos.y - 15/zoom})`} className="pointer-events-none select-none">
            <rect y={-22/zoom} width={140/zoom} height={h} rx={4/zoom} fill="rgba(2, 6, 23, 0.9)" stroke="#334155" strokeWidth={1/zoom} />
            {lines.map((l, i) => (
                <text 
                    key={i} 
                    x={8/zoom} 
                    y={(-6/zoom) + (i * lineHeight)} 
                    fill={l.color} 
                    fontSize={`${(l.small ? 8 : 10)/zoom}px`} 
                    className={cn(l.bold ? "font-bold" : "", l.upper ? "uppercase tracking-widest opacity-60" : "")}
                >
                    {l.text}
                </text>
            ))}
        </g>
    );
}

function renderScales(size: any, pan: Point, zoom: number) {
    const { width, height } = size; const cx = width/2, cy = height/2; const rx = RULER_MARGIN, ry = height-RULER_MARGIN;
    const tk = []; const xS = Math.floor((-cx-pan.x)/(PIXELS_PER_METER*zoom)), xE = Math.ceil((width-cx-pan.x)/(PIXELS_PER_METER*zoom));
    for(let m=xS; m<=xE; m++){
        const px = cx+pan.x+m*PIXELS_PER_METER*zoom; if(px<rx) continue;
        const mj = m%5===0; tk.push(<line key={`x-${m}`} x1={px} y1={ry} x2={px} y2={ry+(mj?10:5)} stroke="#334155" />);
        if(mj) tk.push(<text key={`tx-${m}`} x={px} y={ry+20} textAnchor="middle" fontSize="10" fill="#64748b" className="font-bold">{m}m</text>);
    }
    const yS = Math.floor((cy+pan.y-ry)/(PIXELS_PER_METER*zoom)), yE = Math.ceil((cy+pan.y)/(PIXELS_PER_METER*zoom));
    for(let m=yS; m<=yE; m++){
        const py = cy+pan.y-m*PIXELS_PER_METER*zoom; if(py>ry||py<0) continue;
        const mj = m%5===0; tk.push(<line key={`y-${m}`} x1={rx} y1={py} x2={rx-(mj?10:5)} y2={py} stroke="#334155" />);
        if(mj) tk.push(<text key={`ty-${m}`} x={rx-12} y={py+4} textAnchor="end" fontSize="10" fill="#64748b" className="font-bold">{m}m</text>);
    }
    return <g className="pointer-events-none">{tk}<line x1={rx} y1={ry} x2={width} y2={ry} stroke="#334155" /><line x1={rx} y1={0} x2={rx} y2={ry} stroke="#334155" /></g>;
}

function SummaryCard({ icon, label, value, unit }: any) {
    return (
        <div className="bg-slate-950/50 border border-slate-800 p-5 rounded-2xl flex flex-col gap-2 shadow-inner">
            <div className="flex items-center gap-2">{icon}<span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</span></div>
            <div className="text-xl font-mono font-black text-white tracking-tighter">{value} <span className="text-[10px] font-normal text-slate-600 ml-1">{unit}</span></div>
        </div>
    );
}

const PointLoadPopover = ({ targetId, isNode, onAddLoad, children }: any) => {
    const [dir, setDir] = useState<LoadDirection>('y'); const [mag, setMag] = useState('-10'); const [pos, setPos] = useState('0.5');
    const apply = () => {
        const m = parseFloat(mag)*1000, p = parseFloat(pos);
        if(isNaN(m)) return; if(!isNode && (isNaN(p)||p<0||p>1)) return;
        onAddLoad(targetId, isNode, { type: 'point', magnitude: m, direction: dir, ...(!isNode && { position: p }) });
    };
    return (
        <Popover><PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent className="w-64 bg-slate-900 border-slate-800 p-6 rounded-3xl text-white shadow-2xl space-y-4">
                <h4 className="font-black uppercase text-xs italic">Apply Load</h4>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-500">Direction</Label>
                    <Select value={dir} onValueChange={(v:any)=>setDir(v)}><SelectTrigger className="bg-slate-950 border-slate-800 h-9 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white"><SelectItem value="x">X Axis</SelectItem><SelectItem value="y">Y Axis</SelectItem></SelectContent></Select>
                </div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-500">Magnitude (kN)</Label><Input type="number" value={mag} onChange={e=>setMag(e.target.value)} className="bg-slate-950 border-slate-800 h-9 text-white" /></div>
                {!isNode && <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-500">Position (0-1)</Label><Input type="number" value={pos} onChange={e=>setPos(e.target.value)} step="0.1" className="bg-slate-950 border-slate-800 h-9 text-white" /></div>}
                <Button onClick={apply} className="w-full bg-sky-500 text-slate-950 font-black uppercase text-[10px]">Apply</Button>
            </PopoverContent>
        </Popover>
    );
};

const UDLPopover = ({ targetId, onAddLoad, children }: any) => {
    const [mag, setMag] = useState('-5');
    const apply = () => { const m = parseFloat(mag)*1000; if(!isNaN(m)) onAddLoad(targetId, { type: 'udl', magnitude: m, direction: 'y' }); };
    return (
        <Popover><PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent className="w-64 bg-slate-900 border-slate-800 p-6 rounded-3xl text-white shadow-2xl space-y-4">
                <h4 className="font-black uppercase text-xs italic">Apply UDL</h4>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-500">Magnitude (kN/m)</Label><Input type="number" value={mag} onChange={e=>setMag(e.target.value)} className="bg-slate-950 border-slate-800 h-9 text-white" /></div>
                <Button onClick={apply} className="w-full bg-sky-500 text-slate-950 font-black uppercase text-[10px]">Apply</Button>
            </PopoverContent>
        </Popover>
    );
};
