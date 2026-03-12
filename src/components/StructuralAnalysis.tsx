'use client';

import { useState, useRef, MouseEvent, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
    Redo, Pointer, CircleDot, Trash2, Undo, AlertCircle, ZoomIn, ZoomOut, Move, 
    RotateCcw, Database, Box as BoxIcon, Paintbrush, TrendingUp, ArrowDownToLine, 
    MoveHorizontal, Plus, Keyboard, Ruler
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
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

// --- Custom Icons ---
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
    const [tooltipInfo, setTooltipInfo] = useState<{ memberId?: number, value: number, unit: string, dx?: number, dy?: number, length?: number } | null>(null);

    const [activeMaterialId, setActiveMaterialId] = useState(materials[0].id);
    const [activeSectionId, setActiveSectionId] = useState(sections[0].id);

    const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
    const propertyPopoverTriggerRef = useRef<HTMLButtonElement>(null);

    // New Section State
    const [newSecName, setNewSecName] = useState('');
    const [newSecType, setNewSecType] = useState<'rect' | 'circ'>('rect');
    const [newSecB, setNewSecB] = useState('0.3');
    const [newSecH, setNewSecH] = useState('0.5');
    const [newSecD, setNewSecD] = useState('0.4');

    // Manual Node State
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

    const undo = () => {
        if (historyIndex > 0) {
            setHistoryIndex(prev => prev - 1);
            setAnalysisResult(null);
            setActiveResultDiagram(null);
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(prev => prev + 1);
            setAnalysisResult(null);
            setActiveResultDiagram(null);
        }
    };

    useEffect(() => {
        const updateSize = () => {
            if (svgRef.current) {
                const rect = svgRef.current.getBoundingClientRect();
                setCanvasSize({ width: rect.width, height: rect.height });
            }
        };
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    const getNextId = <T extends { id: number }>(items: T[]): number => {
        return items.length > 0 ? Math.max(...items.map(item => item.id)) + 1 : 1;
    };

    const getNodeById = (id: number) => nodes.find(n => n.id === id) || analysisResult?.virtualNodes?.find(n => n.id === id);

    const getRawPoint = (e: MouseEvent<SVGSVGElement>): Point => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const rect = svgRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const originX = rect.width / 2;
        const originY = rect.height / 2;

        return {
            x: (x - (originX + pan.x)) / zoom,
            y: (y - (originY + pan.y)) / zoom
        };
    };

    const getSnapPoint = (point: Point): Point => {
        return {
            x: Math.round(point.x / SNAP_GRID_SIZE) * SNAP_GRID_SIZE,
            y: Math.round(point.y / SNAP_GRID_SIZE) * SNAP_GRID_SIZE
        };
    };

    const handleCanvasMouseDown = (e: MouseEvent<SVGSVGElement>) => {
        if (activeTool === 'pan') {
            setIsDraggingPan(true);
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        }
    };

    const handleCanvasMouseUp = () => {
        setIsDraggingPan(false);
        lastMousePos.current = null;
    };

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
                    const newMember: Member = {
                        id: getNextId(prev.members),
                        startNodeId: drawingStartNode,
                        endNodeId: targetId,
                        type: 'beam',
                        E: mat.E,
                        I: sec.I,
                        A: sec.A,
                        materialId: mat.id,
                        sectionId: sec.id
                    };
                    return { ...prev, nodes: nodesToKeep, members: [...prev.members, newMember] };
                });
                
                setDrawingStartNode(targetId);
                const nextStartPos = existingNode ? existingNode.pos : coords;
                setPreviewLine({ start: nextStartPos, end: nextStartPos });
            }
        }
    };

    const handleNodeClick = (nodeId: number, e: MouseEvent) => {
        e.stopPropagation();
        if (activeTool === 'pan') return;
        if (activeTool === 'draw-member') {
            handleCanvasClick(e as any);
            return;
        }

        if (activeTool === 'delete') {
            setState(prev => {
                const memberIdsToDelete = prev.members.filter(m => m.startNodeId === nodeId || m.endNodeId === nodeId).map(m => m.id);
                return {
                    ...prev,
                    nodes: prev.nodes.filter(n => n.id !== nodeId),
                    members: prev.members.filter(m => m.startNodeId !== nodeId && m.endNodeId !== nodeId),
                    supports: prev.supports.filter(s => s.nodeId !== nodeId),
                    loads: prev.loads.filter(l => l.nodeId === nodeId || (l.memberId && memberIdsToDelete.includes(l.memberId))),
                };
            });
            toast({ title: "Node Deleted", description: `Node ID ${nodeId} and all connected elements have been removed.` });
        }
    };

    const handleMemberClick = (memberId: number, e: MouseEvent) => {
        e.stopPropagation();
        if (activeTool === 'pan') return;
        
        if (activeTool === 'delete') {
            setState(prev => ({
                ...prev,
                members: prev.members.filter(m => m.id !== memberId),
                loads: prev.loads.filter(l => l.memberId !== memberId) 
            }));
            toast({ title: "Member Deleted", description: `Member ID ${memberId} has been removed.` });
        } else if (activeTool === 'assign') {
            const mat = materials.find(m => m.id === activeMaterialId)!;
            const sec = sections.find(s => s.id === activeSectionId)!;
            handleUpdateMemberProperties(memberId, mat.id, sec.id);
            toast({ title: "Properties Assigned", description: `Applied ${mat.name} and ${sec.name} to Member ${memberId}.` });
        }
    };

    const handleMemberContextMenu = (memberId: number, e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setEditingMemberId(memberId);
    };

    const handleUpdateMemberProperties = (memberId: number, matId: string, secId: string) => {
        const mat = materials.find(m => m.id === matId)!;
        const sec = sections.find(s => s.id === secId)!;
        setState(prev => ({
            ...prev,
            members: prev.members.map(m => m.id === memberId ? { 
                ...m, 
                materialId: matId, 
                sectionId: secId,
                E: mat.E,
                I: sec.I,
                A: sec.A
            } : m)
        }));
    };

    const handleAddSection = () => {
        if (!newSecName) {
            toast({ variant: 'destructive', title: "Validation Error", description: "Please enter a name for the section." });
            return;
        }
        let A = 0, I = 0, dims = {};
        const b = parseFloat(newSecB) || 0, h = parseFloat(newSecH) || 0, d = parseFloat(newSecD) || 0;
        if (newSecType === 'rect') {
            A = b * h;
            I = (b * Math.pow(h, 3)) / 12;
            dims = { b, h };
        } else {
            A = Math.PI * Math.pow(d / 2, 2);
            I = (Math.PI * Math.pow(d, 4)) / 64;
            dims = { d };
        }

        setState(prev => ({
            ...prev,
            sections: [...prev.sections, {
                id: `sec-${Date.now()}`,
                name: newSecName,
                type: newSecType,
                dims, A, I
            }]
        }));
        setNewSecName('');
        toast({ title: "Section Created", description: `Added ${newSecName} to your section library.` });
    };

    const handleManualNode = () => {
        const x = parseFloat(manualX) * PIXELS_PER_METER;
        const y = -parseFloat(manualY) * PIXELS_PER_METER;
        if (isNaN(x) || isNaN(y)) {
            toast({ variant: 'destructive', title: "Invalid Coordinates", description: "Please enter valid numeric values." });
            return;
        }
        setState(prev => ({ ...prev, nodes: [...prev.nodes, { id: getNextId(prev.nodes), pos: { x, y } }] }));
        toast({ title: "Node Inserted", description: `Node placed at (${manualX}m, ${manualY}m)` });
    };

    const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
        if (isDraggingPan && lastMousePos.current) {
            const dx = e.clientX - lastMousePos.current.x;
            const dy = e.clientY - lastMousePos.current.y;
            setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            return;
        }

        const raw = getRawPoint(e);
        const snap = getSnapPoint(raw);
        setCursorPos(raw);
        setCursorWorldPos({ x: raw.x / PIXELS_PER_METER, y: -raw.y / PIXELS_PER_METER });

        const nearNode = nodes.find(n => Math.hypot(n.pos.x - raw.x, n.pos.y - raw.y) < 10 / zoom);
        setHoveredNode(nearNode ? nearNode.id : null);

        if (activeTool === 'draw-member' && drawingStartNode !== null && previewLine) {
            setPreviewLine({ ...previewLine, end: snap });
            const dx = (snap.x - previewLine.start.x) / PIXELS_PER_METER;
            const dy = (snap.y - previewLine.start.y) / PIXELS_PER_METER;
            const length = Math.hypot(dx, dy);
            setTooltipInfo({ value: 0, unit: 'm', length });
        } else if (analysisResult) {
            let bestTooltip: any = null;
            let minDistance = 15 / zoom;

            if (activeResultDiagram === 'deflection') {
                const allVNodes = analysisResult.virtualNodes || [];
                allVNodes.forEach(vn => {
                    const dist = Math.hypot(raw.x - vn.pos.x, raw.y - vn.pos.y);
                    if (dist < minDistance) {
                        minDistance = dist;
                        const disp = analysisResult.displacements[vn.id];
                        bestTooltip = { memberId: vn.id, dx: disp[0] * 1000, dy: disp[1] * 1000, value: Math.hypot(disp[0], disp[1]) * 1000, unit: 'mm' };
                    }
                });
            } else if (activeResultDiagram === 'shear' || activeResultDiagram === 'moment') {
                members.forEach(m => {
                    const s = getNodeById(m.startNodeId)!;
                    const eN = getNodeById(m.endNodeId)!;
                    if (!s || !eN) return;
                    const Lpx = Math.hypot(eN.pos.x - s.pos.x, eN.pos.y - s.pos.y);
                    const ux = (eN.pos.x - s.pos.x) / Lpx;
                    const uy = (eN.pos.y - s.pos.y) / Lpx;
                    const dx = raw.x - s.pos.x;
                    const dy = raw.y - s.pos.y;
                    const t = (dx * ux + dy * uy);
                    if (t < 0 || t > Lpx) return;
                    const projX = s.pos.x + t * ux;
                    const projY = s.pos.y + t * uy;
                    const dist = Math.hypot(raw.x - projX, raw.y - projY);
                    if (dist < minDistance) {
                        minDistance = dist;
                        const segments = analysisResult.memberForces![m.id];
                        const t_meters = t / PIXELS_PER_METER;
                        let current_t = 0;
                        let foundVal = 0;
                        for (const seg of segments) {
                            const vS = analysisResult.virtualNodes?.find(vn => vn.id === seg.startNodeId) || getNodeById(seg.startNodeId)!;
                            const vE = analysisResult.virtualNodes?.find(vn => vn.id === seg.endNodeId) || getNodeById(seg.endNodeId)!;
                            const segL = Math.hypot(vE.pos.x - vS.pos.x, vE.pos.y - vS.pos.y) / PIXELS_PER_METER;
                            if (t_meters >= current_t - 1e-6 && t_meters <= current_t + segL + 1e-6) {
                                const frac = (t_meters - current_t) / segL;
                                if (activeResultDiagram === 'shear') foundVal = seg.shear1 + frac * (-seg.shear2 - seg.shear1);
                                else foundVal = -seg.moment1 + frac * (seg.moment2 - (-seg.moment1));
                                break;
                            }
                            current_t += segL;
                        }
                        bestTooltip = { memberId: m.id, value: foundVal / 1000, unit: activeResultDiagram === 'shear' ? 'kN' : 'kNm' };
                    }
                });
            }
            setTooltipInfo(bestTooltip);
        } else {
            setTooltipInfo(null);
        }
    };

    const handleMouseLeave = () => {
        setCursorPos(null);
        setCursorWorldPos(null);
        setTooltipInfo(null);
        setPreviewLine(null);
    };

    const handleCanvasContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setDrawingStartNode(null);
        setPreviewLine(null);
    };

    const handleAnalyze = () => {
        try {
            const res = analyzeStructure(currentState);
            setAnalysisResult(res);
            setActiveResultDiagram('reactions'); 
            toast({ title: "Analysis Complete", description: `Static equilibrium found.` });
        } catch (error: any) {
            setAnalysisResult(null);
            setActiveResultDiagram(null);
            toast({ variant: "destructive", title: "Analysis Failed", description: error.message });
        }
    };

    const renderSupport = (support: Support) => {
        const node = getNodeById(support.nodeId);
        if (!node) return null;
        const { x, y } = node.pos;
        const stroke = "#38bdf8"; const strokeWidth = 2 / zoom;
        const supportClassName = cn(activeTool === 'delete' ? 'cursor-pointer hover:stroke-red-400' : '');
        switch (support.type) {
            case 'pin': return <path key={`sup-${support.nodeId}`} d={`M ${x - 10/zoom} ${y + 15/zoom} L ${x} ${y} L ${x + 10/zoom} ${y + 15/zoom} Z M ${x - 15/zoom} ${y + 15/zoom} H ${x + 15/zoom}`} stroke={stroke} strokeWidth={strokeWidth} fill="none" className={supportClassName} onClick={(e: MouseEvent) => handleSupportClick(support.nodeId, e)} />;
            case 'fixed': return <path key={`sup-${support.nodeId}`} d={`M ${x - 15/zoom} ${y - 15/zoom} V ${y + 15/zoom} H ${x} M ${x - 15/zoom} ${y - 13/zoom} L ${x} ${y - 13/zoom} M ${x - 15/zoom} ${y - 7/zoom} L ${x} ${y - 7/zoom} M ${x - 15/zoom} ${y - 1/zoom} L ${x} ${y - 1/zoom} M ${x - 15/zoom} ${y + 5/zoom} L ${x} ${y + 5/zoom} M ${x - 15/zoom} ${y + 11/zoom} L ${x} ${y + 11/zoom}`} stroke={stroke} strokeWidth={strokeWidth} fill="none" className={supportClassName} onClick={(e: MouseEvent) => handleSupportClick(support.nodeId, e)} />;
            case 'roller': return <g key={`sup-${support.nodeId}`} onClick={(e) => handleSupportClick(support.nodeId, e)} className={supportClassName}><path d={`M ${x - 10/zoom} ${y + 10/zoom} L ${x} ${y} L ${x + 10/zoom} ${y + 10/zoom} Z`} stroke={stroke} strokeWidth={strokeWidth} fill="none" /><circle cx={x} cy={y + 15/zoom} r={4/zoom} stroke={stroke} strokeWidth={strokeWidth} fill="none" /><line x1={x - 15/zoom} y1={y + 20/zoom} x2={x + 15/zoom} y2={y + 20/zoom} stroke={stroke} strokeWidth={strokeWidth} /></g>;
        }
        return null;
    };

    const renderLoadGraphic = (load: Load) => {
        let x1, y1, x2, y2, angleRad = 0;
        if (load.nodeId) { const n = getNodeById(load.nodeId); if (!n) return null; x1 = n.pos.x; y1 = n.pos.y; x2 = x1; y2 = y1; } 
        else if (load.memberId) { const m = members.find(mi => mi.id === load.memberId); if (!m) return null; const sn = getNodeById(m.startNodeId), en = getNodeById(m.endNodeId); if (!sn || !en) return null; x1 = sn.pos.x; y1 = sn.pos.y; x2 = en.pos.x; y2 = en.pos.y; angleRad = Math.atan2(y2 - y1, x2 - x1); }
        else return null;
        
        const loadColor = "#fb923c";
        const strokeWidth = 1.5 / zoom;
        const textStyle = { fontSize: `${10/zoom}px`, textAnchor: "middle" as const, paintOrder: "stroke" as const, stroke: "#020617", strokeWidth: `${3/zoom}px` };
        const loadLen = 20 / zoom; const arrowSz = 4 / zoom;
        const grpProps = { onClick: (e: MouseEvent) => handleLoadClick(load.id, e), className: cn(activeTool === 'delete' ? 'cursor-pointer group/load' : '') };
        
        if (load.type === 'point') {
            let lx = x1 + (x2 - x1) * (load.position ?? 0), ly = y1 + (y2 - y1) * (load.position ?? 0);
            const isX = load.direction === 'x'; const sign = Math.sign(load.magnitude);
            const dx = isX ? sign : 0, dy = isX ? 0 : -sign;
            const ax = lx, ay = ly, sx = ax - dx * loadLen, sy = ay - dy * loadLen;
            const ang = Math.atan2(dy, dx), h1x = ax - Math.cos(ang - Math.PI/6) * arrowSz, h1y = ay - Math.sin(ang - Math.PI/6) * arrowSz, h2x = ax - Math.cos(ang + Math.PI/6) * arrowSz, h2y = ay - Math.sin(ang + Math.PI/6) * arrowSz;
            return <g key={`load-${load.id}`} {...grpProps}><line x1={sx} y1={sy} x2={ax} y2={ay} stroke={loadColor} strokeWidth={strokeWidth} className="group-hover/load:stroke-red-400" /><path d={`M ${h1x} ${h1y} L ${ax} ${ay} L ${h2x} ${h2y}`} fill="none" stroke={loadColor} strokeWidth={strokeWidth} className="group-hover/load:stroke-red-400" /><text x={sx - dx*10/zoom} y={sy - dy*10/zoom} {...textStyle} fill={loadColor} dominantBaseline="middle" className="font-black">{Math.abs(load.magnitude / 1000).toFixed(1)} kN</text></g>;
        }
        if (load.type === 'udl') {
            const nArr = 5; const arrs = []; const dir = -Math.sign(load.magnitude);
            const nAng = angleRad + Math.PI / 2; const ox = Math.cos(nAng), oy = Math.sin(nAng);
            for (let i = 0; i <= nArr; i++) { const p = i / nArr; let x = x1 + (x2 - x1) * p, y = y1 + (y2 - y1) * p, sx = x - dir * ox * loadLen, sy = y - dir * oy * loadLen; arrs.push(<line key={`udl-a-${i}`} x1={sx} y1={sy} x2={x} y2={y} stroke={loadColor} strokeWidth={strokeWidth} />); }
            let lsx = x1 - dir * ox * loadLen, lsy = y1 - dir * oy * loadLen, lex = x2 - dir * ox * loadLen, ley = y2 - dir * oy * loadLen;
            return <g key={`load-${load.id}`} {...grpProps}>{arrs}<line x1={lsx} y1={lsy} x2={lex} y2={ley} stroke={loadColor} strokeWidth={strokeWidth} className="group-hover/load:stroke-red-400" /><text x={(lsx + lex)/2} y={(lsy + ley)/2 - 10/zoom} {...textStyle} fill={loadColor} dominantBaseline="middle" transform={`rotate(${(angleRad * 180 / Math.PI)} ${(lsx+lex)/2} ${(lsy+ley)/2 - 10/zoom})`} className="font-black">{Math.abs(load.magnitude / 1000).toFixed(1)} kN/m</text></g>;
        }
        return null;
    };

    const renderShearForceDiagram = () => {
        if (!analysisResult || activeResultDiagram !== 'shear') return null;
        const allForces = Object.values(analysisResult.memberForces!).flat();
        const maxV = Math.max(...allForces.map(f => Math.max(Math.abs(f.shear1), Math.abs(f.shear2))));
        const scale = 50 / (maxV || 1);

        return (
            <g>
                {members.map(m => {
                    const segments = analysisResult.memberForces![m.id];
                    if (!segments) return null;
                    return (
                        <g key={`sfd-m-${m.id}`}>
                            {segments.map((seg, idx) => {
                                const sNode = getNodeById(seg.startNodeId)!;
                                const eNode = getNodeById(seg.endNodeId)!;
                                const angle = Math.atan2(eNode.pos.y - sNode.pos.y, eNode.pos.x - sNode.pos.x);
                                const perpAngle = angle + Math.PI / 2;
                                const ox = Math.cos(perpAngle), oy = Math.sin(perpAngle);
                                const p1x = sNode.pos.x + seg.shear1 * scale * ox, p1y = sNode.pos.y + seg.shear1 * scale * oy;
                                const p2x = eNode.pos.x + (-seg.shear2) * scale * ox, p2y = eNode.pos.y + (-seg.shear2) * scale * oy;
                                return <path key={`sfd-seg-${idx}`} d={`M ${sNode.pos.x} ${sNode.pos.y} L ${p1x} ${p1y} L ${p2x} ${p2y} L ${eNode.pos.x} ${eNode.pos.y} Z`} fill="rgba(56, 189, 248, 0.2)" stroke="#38bdf8" strokeWidth={1/zoom} />;
                            })}
                        </g>
                    );
                })}
                {/* Peak Label */}
                {(() => {
                    let best = { val: 0, x: 0, y: 0 };
                    allForces.forEach(f => {
                        const s = getNodeById(f.startNodeId)!, e = getNodeById(f.endNodeId)!;
                        const ang = Math.atan2(e.pos.y-s.pos.y, e.pos.x-s.pos.x) + Math.PI/2;
                        [[f.shear1, s], [-f.shear2, e]].forEach(([v, n]: any) => {
                            if (Math.abs(v) > Math.abs(best.val)) best = { val: v, x: n.pos.x + v*scale*Math.cos(ang), y: n.pos.y + v*scale*Math.sin(ang) };
                        });
                    });
                    if (Math.abs(best.val) < 1e-3) return null;
                    return <text x={best.x} y={best.y - 5/zoom} fill="#38bdf8" fontSize={`${10/zoom}px`} fontWeight="black" textAnchor="middle" paintOrder="stroke" stroke="#020617" strokeWidth={`${3/zoom}px`}>V_max: {(Math.abs(best.val)/1000).toFixed(1)}kN</text>;
                })()}
            </g>
        );
    };

    const renderMomentDiagram = () => {
        if (!analysisResult || activeResultDiagram !== 'moment') return null;
        const allForces = Object.values(analysisResult.memberForces!).flat();
        const maxM = Math.max(...allForces.map(f => Math.max(Math.abs(f.moment1), Math.abs(f.moment2))));
        const scale = 50 / (maxM || 1);

        return (
            <g>
                {members.map(m => {
                    const segments = analysisResult.memberForces![m.id];
                    if (!segments) return null;
                    return (
                        <g key={`bmd-m-${m.id}`}>
                            {segments.map((seg, idx) => {
                                const sNode = getNodeById(seg.startNodeId)!;
                                const eNode = getNodeById(seg.endNodeId)!;
                                const angle = Math.atan2(eNode.pos.y - sNode.pos.y, eNode.pos.x - sNode.pos.x);
                                const perpAngle = angle + Math.PI / 2;
                                const ox = Math.cos(perpAngle), oy = Math.sin(perpAngle);
                                const p1x = sNode.pos.x - seg.moment1 * scale * ox, p1y = sNode.pos.y - seg.moment1 * scale * oy;
                                const p2x = eNode.pos.x + seg.moment2 * scale * ox, p2y = eNode.pos.y + seg.moment2 * scale * oy;
                                return <path key={`bmd-seg-${idx}`} d={`M ${sNode.pos.x} ${sNode.pos.y} L ${p1x} ${p1y} L ${p2x} ${p2y} L ${eNode.pos.x} ${eNode.pos.y} Z`} fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" strokeWidth={1/zoom} />;
                            })}
                        </g>
                    );
                })}
                {/* Peak Label */}
                {(() => {
                    let best = { val: 0, x: 0, y: 0 };
                    allForces.forEach(f => {
                        const s = getNodeById(f.startNodeId)!, e = getNodeById(f.endNodeId)!;
                        const ang = Math.atan2(e.pos.y-s.pos.y, e.pos.x-s.pos.x) + Math.PI/2;
                        [[-f.moment1, s], [f.moment2, e]].forEach(([v, n]: any) => {
                            if (Math.abs(v) > Math.abs(best.val)) best = { val: v, x: n.pos.x + v*scale*Math.cos(ang), y: n.pos.y + v*scale*Math.sin(ang) };
                        });
                    });
                    if (Math.abs(best.val) < 1e-3) return null;
                    return <text x={best.x} y={best.y - 5/zoom} fill="#10b981" fontSize={`${10/zoom}px`} fontWeight="black" textAnchor="middle" paintOrder="stroke" stroke="#020617" strokeWidth={`${3/zoom}px`}>M_max: {(Math.abs(best.val)/1000).toFixed(1)}kNm</text>;
                })()}
            </g>
        );
    };

    const renderDeflectionDiagram = () => {
        if (!analysisResult || activeResultDiagram !== 'deflection') return null;
        const scale = 100; // Visualization scale
        let maxD = 0, peakNode: any = null;
        const elements = members.map(m => {
            const segments = analysisResult.memberForces![m.id];
            if (!segments) return null;
            return (
                <g key={`deflect-m-${m.id}`}>
                    {segments.map((seg, idx) => {
                        const sNode = getNodeById(seg.startNodeId)!;
                        const eNode = getNodeById(seg.endNodeId)!;
                        const [dx1, dy1] = analysisResult.displacements[sNode.id];
                        const [dx2, dy2] = analysisResult.displacements[eNode.id];
                        const x1 = sNode.pos.x + dx1 * PIXELS_PER_METER * scale, y1 = sNode.pos.y - dy1 * PIXELS_PER_METER * scale;
                        const x2 = eNode.pos.x + dx2 * PIXELS_PER_METER * scale, y2 = eNode.pos.y - dy2 * PIXELS_PER_METER * scale;
                        const d1 = Math.hypot(dx1, dy1);
                        if (d1 > maxD) { maxD = d1; peakNode = { x: x1, y: y1 }; }
                        return <line key={`deflect-seg-${idx}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#a855f7" strokeWidth={2/zoom} />;
                    })}
                </g>
            );
        });
        return (
            <g>
                {elements}
                {peakNode && <text x={peakNode.x} y={peakNode.y - 10/zoom} fill="#a855f7" fontSize={`${10/zoom}px`} fontWeight="black" textAnchor="middle" paintOrder="stroke" stroke="#020617" strokeWidth={`${3/zoom}px`}>δ_max: {(maxD*1000).toFixed(2)}mm</text>}
            </g>
        );
    };

    const renderCursorTooltip = () => {
        if (!cursorPos) return null;
        const isDrawing = activeTool === 'draw-member' && drawingStartNode !== null;
        const showCoord = ['draw-node', 'draw-member'].includes(activeTool);
        const showAnalysis = !!tooltipInfo;
        const showNode = hoveredNode !== null;
        
        if (!showCoord && !showAnalysis && !showNode) return null;
        
        return (
            <g transform={`translate(${cursorPos.x + 15/zoom}, ${cursorPos.y - 15/zoom})`} className="pointer-events-none select-none">
                <rect x="0" y={showAnalysis ? -40/zoom : -20/zoom} width={140/zoom} height={(showAnalysis || isDrawing ? 45 : 25)/zoom} rx={4/zoom} fill="rgba(2, 6, 23, 0.9)" stroke="#334155" strokeWidth={1/zoom} />
                {(showCoord || showNode) && cursorWorldPos && (
                    <text x={8/zoom} y={-6/zoom} fill="white" fontSize={`${10/zoom}px`} className="font-bold">
                        {showNode ? `Node ${hoveredNode}: ` : 'Pos: '}{cursorWorldPos.x.toFixed(2)}, {cursorWorldPos.y.toFixed(2)}m
                    </text>
                )}
                {showAnalysis && tooltipInfo && (
                    <text x={8/zoom} y={showCoord ? 14/zoom : -6/zoom} fill="#38bdf8" fontSize={`${10/zoom}px`} className="font-black">
                        {activeResultDiagram === 'deflection' 
                            ? `dx:${tooltipInfo.dx?.toFixed(2)} dy:${tooltipInfo.dy?.toFixed(2)}mm` 
                            : tooltipInfo.length 
                                ? `Length: ${tooltipInfo.length.toFixed(2)} m`
                                : `${activeResultDiagram === 'shear' ? 'V' : 'M'}: ${tooltipInfo.value.toFixed(2)} ${tooltipInfo.unit}`}
                    </text>
                )}
                {isDrawing && (
                    <text x={8/zoom} y={28/zoom} fill="#fb923c" fontSize={`${8/zoom}px`} className="font-black uppercase tracking-widest">Right-Click to Cancel</text>
                )}
            </g>
        );
    };

    const handleUpdateMaterial = (id: string, E: number) => {
        setState(prev => ({
            ...prev,
            materials: prev.materials.map(m => m.id === id ? { ...m, E: isNaN(E) ? 0 : E } : m),
            members: prev.members.map(m => m.materialId === id ? { ...m, E: isNaN(E) ? 0 : E } : m)
        }));
    };

    const handleUpdateSection = (id: string, dims: any) => {
        setState(prev => {
            const sec = prev.sections.find(s => s.id === id)!;
            let A = 0, I = 0;
            const b = parseFloat(dims.b) || 0, h = parseFloat(dims.h) || 0, d = parseFloat(dims.d) || 0;
            if (sec.type === 'rect') { A = b * h; I = b * Math.pow(h, 3) / 12; }
            else if (sec.type === 'circ') { A = Math.PI * Math.pow(d / 2, 2); I = Math.PI * Math.pow(d, 4) / 64; }
            return {
                ...prev,
                sections: prev.sections.map(s => s.id === id ? { ...s, dims, A, I } : s),
                members: prev.members.map(m => m.sectionId === id ? { ...m, A, I } : m)
            };
        });
    };

    const handleApplyPointLoad = (id: number, isNode: boolean, data: any) => {
        setState(prev => ({ ...prev, loads: [...prev.loads, { id: getNextId(prev.loads), ...(isNode ? { nodeId: id } : { memberId: id }), ...data }] }));
    };

    const handleApplyUDL = (mid: number, data: any) => {
        setState(prev => ({ ...prev, loads: [...prev.loads, { id: getNextId(prev.loads), memberId: mid, ...data }] }));
    };

    const handleLoadClick = (id: number, e: MouseEvent) => {
        e.stopPropagation();
        if (activeTool === 'delete') {
            setState(prev => ({ ...prev, loads: prev.loads.filter(l => l.id !== id) }));
        }
    };

    const handleSupportClick = (nodeId: number, e: MouseEvent) => {
        e.stopPropagation();
        if (activeTool === 'delete') {
            setState(prev => ({ ...prev, supports: prev.supports.filter(s => s.nodeId !== nodeId) }));
        }
    };

    const handleAddSupport = (nodeId: number, type: SupportType) => {
        setState(prev => {
            const idx = prev.supports.findIndex(s => s.nodeId === nodeId);
            if (idx > -1) { const ns = [...prev.supports]; ns[idx].type = type; return { ...prev, supports: ns }; }
            return { ...prev, supports: [...prev.supports, { nodeId, type }] };
        });
    };

    const currentEditingMember = members.find(m => m.id === editingMemberId);

    return (
        <section className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl space-y-10">
            {/* Member Right-Click Popup */}
            <Popover open={editingMemberId !== null} onOpenChange={(open) => !open && setEditingMemberId(null)}>
                <PopoverTrigger asChild><button ref={propertyPopoverTriggerRef} className="hidden" /></PopoverTrigger>
                <PopoverContent className="w-72 bg-slate-900 border-slate-800 text-white rounded-3xl p-6 shadow-2xl z-50">
                    {currentEditingMember && (
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-black text-white uppercase text-xs tracking-widest italic">Member {currentEditingMember.id} Properties</h4>
                                <p className="text-[9px] text-slate-500 uppercase font-bold mt-1">Select from project library.</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black text-slate-400">Material</Label>
                                <Select value={currentEditingMember.materialId} onValueChange={(v) => handleUpdateMemberProperties(currentEditingMember.id, v, currentEditingMember.sectionId!)}>
                                    <SelectTrigger className="bg-slate-950 border-slate-800 rounded-xl h-10 text-white"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                        {materials.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black text-slate-400">Section</Label>
                                <Select value={currentEditingMember.sectionId} onValueChange={(v) => handleUpdateMemberProperties(currentEditingMember.id, currentEditingMember.materialId!, v)}>
                                    <SelectTrigger className="bg-slate-950 border-slate-800 rounded-xl h-10 text-white"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                        {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                </PopoverContent>
            </Popover>

            {/* Header & Main Toolbar */}
            <div className="flex flex-col gap-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic flex items-center gap-4">
                            <span className="bg-sky-500 text-slate-950 px-3 py-1 rounded-xl text-sm font-black not-italic shadow-lg shadow-sky-500/20">FEA</span>
                            2D Static Analysis
                        </h2>
                    </div>
                    <div className="flex gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shadow-xl flex-wrap">
                        {/* Drawing & Edit Tools Icons */}
                        <Button variant={activeTool === 'select' ? 'secondary' : 'ghost'} size="icon" className={cn("rounded-xl transition-all", activeTool === 'select' ? "bg-sky-500 text-slate-950" : "text-white")} onClick={() => setActiveTool('select')} title="Select"><Pointer className="h-4 w-4" /></Button>
                        <Button variant={activeTool === 'pan' ? 'secondary' : 'ghost'} size="icon" className={cn("rounded-xl transition-all", activeTool === 'pan' ? "bg-sky-500 text-slate-950" : "text-white")} onClick={() => setActiveTool('pan')} title="Pan"><Move className="h-4 w-4" /></Button>
                        <Separator orientation="vertical" className="h-8 mx-1 bg-slate-800" />
                        
                        <Button variant={activeTool === 'draw-member' ? 'secondary' : 'ghost'} size="icon" className={cn("rounded-xl transition-all", activeTool === 'draw-member' ? "bg-sky-500 text-slate-950" : "text-white")} onClick={() => setActiveTool('draw-member')} title="Draw Member"><MemberDrawIcon /></Button>
                        <Button variant={activeTool === 'draw-node' ? 'secondary' : 'ghost'} size="icon" className={cn("rounded-xl transition-all", activeTool === 'draw-node' ? "bg-sky-500 text-slate-950" : "text-white")} onClick={() => setActiveTool('draw-node')} title="Draw Node"><CircleDot className="h-4 w-4" /></Button>
                        
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="rounded-xl text-white hover:text-sky-400" title="Manual Node Input"><Keyboard className="h-4 w-4" /></Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 bg-slate-900 border-slate-800 text-white rounded-3xl p-6 shadow-2xl">
                                <h4 className="font-black uppercase text-xs tracking-widest mb-4 border-b border-slate-800 pb-2">Insert Node</h4>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-slate-500">X (m)</Label><Input type="number" value={manualX} onChange={e => setManualX(e.target.value)} className="bg-slate-950 border-slate-800" /></div>
                                        <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-slate-500">Y (m)</Label><Input type="number" value={manualY} onChange={e => setManualY(e.target.value)} className="bg-slate-950 border-slate-800" /></div>
                                    </div>
                                    <Button onClick={handleManualNode} className="w-full bg-sky-500 text-slate-950 font-black uppercase tracking-widest rounded-xl hover:bg-sky-400">Insert</Button>
                                </div>
                            </PopoverContent>
                        </Popover>

                        <Separator orientation="vertical" className="h-8 mx-1 bg-slate-800" />
                        
                        <Button variant={activeTool === 'add-support' ? 'secondary' : 'ghost'} size="icon" className={cn("rounded-xl transition-all", activeTool === 'add-support' ? "bg-sky-500 text-slate-950" : "text-white")} onClick={() => setActiveTool('add-support')} title="Add Support"><SupportIcon /></Button>
                        <Button variant={activeTool === 'add-point-load' ? 'secondary' : 'ghost'} size="icon" className={cn("rounded-xl transition-all", activeTool === 'add-point-load' ? "bg-sky-500 text-slate-950" : "text-white")} onClick={() => setActiveTool('add-point-load')} title="Add Point Load"><ArrowDownToLine className="h-4 w-4" /></Button>
                        <Button variant={activeTool === 'add-udl' ? 'secondary' : 'ghost'} size="icon" className={cn("rounded-xl transition-all", activeTool === 'add-udl' ? "bg-sky-500 text-slate-950" : "text-white")} onClick={() => setActiveTool('add-udl')} title="Add UDL"><UDLIcon /></Button>
                        
                        <Separator orientation="vertical" className="h-8 mx-1 bg-slate-800" />
                        
                        <Button variant={activeTool === 'delete' ? 'secondary' : 'ghost'} size="icon" className={cn("rounded-xl transition-all", activeTool === 'delete' ? "bg-sky-500 text-slate-950" : "text-red-500")} onClick={() => setActiveTool('delete')} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                        
                        <Separator orientation="vertical" className="h-8 mx-1 bg-slate-800" />
                        
                        <Button variant="ghost" size="icon" className="text-white" onClick={() => setZoom(p => Math.min(p + 0.1, 5))} title="Zoom In"><ZoomIn className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-white" onClick={() => setZoom(p => Math.max(p - 0.1, 0.2))} title="Zoom Out"><ZoomOut className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-white" onClick={() => { setZoom(1); setPan({x:0,y:0}); }} title="Reset View"><RotateCcw className="h-4 w-4" /></Button>
                        
                        <Separator orientation="vertical" className="h-8 mx-1 bg-slate-800" />
                        
                        <Button variant="ghost" size="icon" className="text-white" onClick={undo} disabled={historyIndex === 0} title="Undo"><Undo className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-white" onClick={redo} disabled={historyIndex === history.length-1} title="Redo"><Redo className="h-4 w-4" /></Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Enhanced Sidebar */}
                <div className="lg:col-span-3 flex flex-col gap-8 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                    {/* Active Property Selectors */}
                    <div className="bg-slate-950/50 border border-slate-800 p-6 rounded-[2rem] space-y-6">
                        <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] px-1 italic">Active Assignment</h4>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[9px] uppercase font-black text-slate-500">Active Material</Label>
                                <Select value={activeMaterialId} onValueChange={setActiveMaterialId}>
                                    <SelectTrigger className="bg-slate-900 border-slate-800 rounded-xl h-10 text-white"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                        {materials.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[9px] uppercase font-black text-slate-500">Active Section</Label>
                                <Select value={activeSectionId} onValueChange={setActiveSectionId}>
                                    <SelectTrigger className="bg-slate-900 border-slate-800 rounded-xl h-10 text-white"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                        {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button variant={activeTool === 'assign' ? 'secondary' : 'ghost'} onClick={() => setActiveTool('assign')} className="w-full justify-center rounded-xl font-black text-[10px] uppercase tracking-widest transition-all bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500 hover:text-slate-950"><Paintbrush className="mr-2 h-3.5 w-3.5" /> Bulk Assign</Button>
                        </div>
                    </div>

                    {/* Material Library List */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-2">
                            <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Material Library</h4>
                        </div>
                        <div className="space-y-2">
                            {materials.map(m => (
                                <div key={m.id} className="group flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-2xl shadow-inner hover:border-sky-500/30 transition-all">
                                    <div>
                                        <p className="text-[10px] font-black text-white uppercase">{m.name}</p>
                                        <p className="text-[9px] text-slate-500 font-bold">E: {m.E/1e9} GPa</p>
                                    </div>
                                    <Popover>
                                        <PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-sky-400"><Plus className="h-3 w-3" /></Button></PopoverTrigger>
                                        <PopoverContent className="w-64 bg-slate-900 border-slate-800 p-4">
                                            <Label className="text-[10px] uppercase font-black text-slate-500 mb-2 block">Modulus E (GPa)</Label>
                                            <Input type="number" value={m.E/1e9} onChange={e => handleUpdateMaterial(m.id, parseFloat(e.target.value)*1e9)} className="bg-slate-950 border-slate-800 h-8 text-xs text-white" />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Section Library List */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-2">
                            <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Section Library</h4>
                            <Popover>
                                <PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 text-sky-500"><Plus className="h-4 w-4" /></Button></PopoverTrigger>
                                <PopoverContent className="w-72 bg-slate-900 border-slate-800 p-6 rounded-3xl shadow-2xl">
                                    <h5 className="text-[10px] font-black uppercase text-white mb-4 border-b border-slate-800 pb-2 italic">Define New Section</h5>
                                    <div className="space-y-4">
                                        <Input value={newSecName} onChange={e => setNewSecName(e.target.value)} placeholder="Section Name" className="h-9 text-[10px] bg-slate-950 border-slate-800" />
                                        <Select value={newSecType} onValueChange={(v:any) => setNewSecType(v)}>
                                            <SelectTrigger className="h-9 text-[10px] bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                                            <SelectContent className="bg-slate-900 border-slate-800"><SelectItem value="rect">Rectangular</SelectItem><SelectItem value="circ">Circular</SelectItem></SelectContent>
                                        </Select>
                                        <div className="grid grid-cols-2 gap-4">
                                            {newSecType === 'rect' ? <>
                                                <div className="space-y-1"><Label className="text-[9px] uppercase font-bold text-slate-500">B (m)</Label><Input type="number" value={newSecB} onChange={e => setNewSecB(e.target.value)} className="h-8 text-[10px] bg-slate-950 border-slate-800" /></div>
                                                <div className="space-y-1"><Label className="text-[9px] uppercase font-bold text-slate-500">H (m)</Label><Input type="number" value={newSecH} onChange={e => setNewSecH(e.target.value)} className="h-8 text-[10px] bg-slate-950 border-slate-800" /></div>
                                            </> : <div className="col-span-2 space-y-1"><Label className="text-[9px] uppercase font-bold text-slate-500">D (m)</Label><Input type="number" value={newSecD} onChange={e => setNewSecD(e.target.value)} className="h-8 text-[10px] bg-slate-950 border-slate-800" /></div>}
                                        </div>
                                        <Button onClick={handleAddSection} className="w-full bg-sky-500 text-slate-950 font-black uppercase tracking-widest text-[10px]">Create Section</Button>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            {sections.map(s => (
                                <div key={s.id} className="group flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-2xl shadow-inner hover:border-sky-500/30 transition-all">
                                    <div>
                                        <p className="text-[10px] font-black text-white uppercase">{s.name}</p>
                                        <p className="text-[9px] text-slate-500 font-bold">{s.type === 'rect' ? `${s.dims.b}x${s.dims.h}m` : `Ø${s.dims.d}m`}</p>
                                    </div>
                                    <Popover>
                                        <PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-sky-400"><Plus className="h-3 w-3" /></Button></PopoverTrigger>
                                        <PopoverContent className="w-64 bg-slate-900 border-slate-800 p-4">
                                            <div className="space-y-3">
                                                {s.type === 'rect' ? <>
                                                    <div className="space-y-1"><Label className="text-[9px] uppercase font-bold text-slate-500">B (m)</Label><Input type="number" value={s.dims.b} onChange={e => handleUpdateSection(s.id, {...s.dims, b: e.target.value})} className="h-8 text-[10px] bg-slate-950 border-slate-800" /></div>
                                                    <div className="space-y-1"><Label className="text-[9px] uppercase font-bold text-slate-500">H (m)</Label><Input type="number" value={s.dims.h} onChange={e => handleUpdateSection(s.id, {...s.dims, h: e.target.value})} className="h-8 text-[10px] bg-slate-950 border-slate-800" /></div>
                                                </> : <div className="space-y-1"><Label className="text-[9px] uppercase font-bold text-slate-500">D (m)</Label><Input type="number" value={s.dims.d} onChange={e => handleUpdateSection(s.id, {...s.dims, d: e.target.value})} className="h-8 text-[10px] bg-slate-950 border-slate-800" /></div>}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Button onClick={handleAnalyze} className="mt-4 bg-sky-500 text-slate-950 font-black py-6 rounded-2xl transition-all uppercase tracking-widest text-[10px] shadow-xl hover:bg-sky-400 shadow-sky-500/20 active:scale-95 shrink-0">Run Analysis</Button>
                </div>

                {/* Main Modeling Area */}
                <div className="lg:col-span-9 space-y-6">
                    <div className="w-full h-[550px] border-2 border-slate-800 rounded-[2.5rem] bg-slate-950 overflow-hidden relative shadow-2xl">
                        <svg ref={svgRef} width="100%" height="100%" className={cn(isDraggingPan ? 'cursor-grabbing' : 'cursor-crosshair')} onClick={handleCanvasClick} onMouseDown={handleCanvasMouseDown} onMouseUp={handleCanvasMouseUp} onMouseLeave={handleMouseLeave} onMouseMove={handleMouseMove} onContextMenu={handleCanvasContextMenu}>
                            <defs>
                                <pattern id="grid" width={SNAP_GRID_SIZE * zoom} height={SNAP_GRID_SIZE * zoom} patternUnits="userSpaceOnUse" x={pan.x + canvasSize.width / 2} y={pan.y + canvasSize.height / 2}>
                                    <path d={`M ${SNAP_GRID_SIZE * zoom} 0 L 0 0 0 ${SNAP_GRID_SIZE * zoom}`} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                                </pattern>
                            </defs>
                            <g transform={`translate(${canvasSize.width / 2 + pan.x}, ${canvasSize.height / 2 + pan.y}) scale(${zoom})`}>
                                <rect width="10000" height="10000" x="-5000" y="-5000" fill="url(#grid)" className="pointer-events-none" />
                                {members.map(m => {
                                    const s = getNodeById(m.startNodeId), e = getNodeById(m.endNodeId); if (!s || !e) return null;
                                    const el = <line key={m.id} x1={s.pos.x} y1={s.pos.y} x2={e.pos.x} y2={e.pos.y} stroke={activeTool === 'delete' ? "#ef4444" : "#38bdf8"} strokeWidth={4 / zoom} strokeLinecap="round" className="cursor-pointer transition-all hover:stroke-white" onClick={(ev) => handleMemberClick(m.id, ev)} onContextMenu={(ev) => handleMemberContextMenu(m.id, ev)} />;
                                    
                                    if (activeTool === 'add-point-load') return <PointLoadPopover key={`mp-${m.id}`} targetId={m.id} isNode={false} onAddLoad={handleApplyPointLoad} toast={toast}>{el}</PointLoadPopover>;
                                    if (activeTool === 'add-udl') return <UDLPopover key={`mu-${m.id}`} targetId={m.id} onAddLoad={handleApplyUDL} toast={toast}>{el}</UDLPopover>;
                                    
                                    return el;
                                })}
                                {previewLine && <line x1={previewLine.start.x} y1={previewLine.start.y} x2={previewLine.end.x} y2={previewLine.end.y} stroke="#38bdf8" strokeWidth={2 / zoom} strokeDasharray={`${5/zoom} ${5/zoom}`} className="pointer-events-none opacity-50" />}
                                {nodes.map(n => {
                                    const el = <circle key={n.id} cx={n.pos.x} cy={n.pos.y} r={(drawingStartNode === n.id ? 8 : 6) / zoom} fill={drawingStartNode === n.id ? "white" : "#0ea5e9"} className="cursor-pointer transition-all hover:fill-white shadow-xl" onClick={(ev) => handleNodeClick(n.id, ev)} />;
                                    if (activeTool === 'add-support') return <DropdownMenu key={`sd-${n.id}`}><DropdownMenuTrigger asChild>{el}</DropdownMenuTrigger><DropdownMenuContent className="bg-slate-900 border-slate-800 text-white"><DropdownMenuItem onClick={() => handleAddSupport(n.id, 'pin')}>Pin</DropdownMenuItem><DropdownMenuItem onClick={() => handleAddSupport(n.id, 'roller')}>Roller</DropdownMenuItem><DropdownMenuItem onClick={() => handleAddSupport(n.id, 'fixed')}>Fixed</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
                                    if (activeTool === 'add-point-load') return <PointLoadPopover key={`np-${n.id}`} targetId={n.id} isNode={true} onAddLoad={handleApplyPointLoad} toast={toast}>{el}</PointLoadPopover>;
                                    return el;
                                })}
                                {supports.map(s => renderSupport(s))}
                                {loads.map(l => renderLoadGraphic(l))}
                                {renderReactions(analysisResult, activeResultDiagram, getNodeById, zoom)}
                                {renderShearForceDiagram()}
                                {renderMomentDiagram()}
                                {renderDeflectionDiagram()}
                                {renderCursorTooltip()}
                            </g>
                            {renderScales(canvasSize, pan, zoom)}
                        </svg>
                    </div>
                    
                    {/* Analysis Results Toggle & Summary Dashboard */}
                    <div className="flex flex-col gap-6">
                        {analysisResult && (
                            <div className="flex bg-slate-950 p-1.5 rounded-2xl border-2 border-slate-800 shadow-2xl w-fit">
                                {['reactions', 'shear', 'moment', 'deflection'].map(t => (
                                    <button 
                                        key={t} 
                                        onClick={() => setActiveResultDiagram(t as any)} 
                                        className={cn("px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", activeResultDiagram === t ? "bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/20" : "text-slate-500 hover:text-slate-300")}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="flex-1 w-full">
                            <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4 px-1 italic">Structural Performance Dashboard</h4>
                            {renderResultSummary(analysisResult)}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

// --- Helper Popovers ---

const PointLoadPopover = ({ targetId, isNode, onAddLoad, toast, children }: any) => {
    const [direction, setDirection] = useState<LoadDirection>('y');
    const [magnitude, setMagnitude] = useState('-10'); // Default to downward load
    const [position, setPosition] = useState('0.5');

    const handleApply = () => {
        const mag = parseFloat(magnitude) * 1000;
        const pos = parseFloat(position);
        if (isNaN(mag)) { toast({ variant: 'destructive', title: "Invalid Input", description: "Magnitude must be a number." }); return; }
        if (!isNode && (isNaN(pos) || pos < 0 || pos > 1)) { toast({ variant: 'destructive', title: "Invalid Input", description: "Position must be between 0 and 1." }); return; }
        onAddLoad(targetId, isNode, { type: 'point', magnitude: mag, direction, ...(!isNode && { position: pos }) });
    };

    return (
        <Popover>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent className="w-64 space-y-4 bg-slate-900 border-slate-800 rounded-3xl p-6 shadow-2xl z-50 text-white">
                <div className="space-y-2"><h4 className="font-black uppercase text-xs tracking-widest italic">Add Point Load</h4><p className="text-[10px] text-slate-500 uppercase font-bold">Direction and Magnitude</p></div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-400">Direction</Label>
                    <Select value={direction} onValueChange={(v:any) => setDirection(v)}><SelectTrigger className="bg-slate-950 border-slate-800 rounded-xl h-10 text-white"><SelectValue /></SelectTrigger><SelectContent className="bg-slate-900 border-slate-800 text-white"><SelectItem value="x">X (Horizontal)</SelectItem><SelectItem value="y">Y (Vertical)</SelectItem></SelectContent></Select>
                </div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-400">Magnitude (kN)</Label><Input type="number" value={magnitude} onChange={e => setMagnitude(e.target.value)} placeholder="-10" className="h-10 text-xs bg-slate-950 border-slate-800 text-white" /></div>
                {!isNode && <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-400">Position Ratio (0-1)</Label><Input type="number" value={position} onChange={e => setPosition(e.target.value)} step="0.1" className="h-10 text-xs bg-slate-950 border-slate-800 text-white" /></div>}
                <Button onClick={handleApply} className="w-full bg-sky-500 text-slate-950 font-black uppercase tracking-widest rounded-xl hover:bg-sky-400">Apply Load</Button>
            </PopoverContent>
        </Popover>
    );
};

const UDLPopover = ({ targetId, onAddLoad, toast, children }: any) => {
    const [magnitude, setMagnitude] = useState('-5');

    const handleApply = () => {
        const mag = parseFloat(magnitude) * 1000;
        if (isNaN(mag)) {
            toast({ variant: 'destructive', title: "Invalid Input", description: "Magnitude must be a number." });
            return;
        }
        onAddLoad(targetId, { type: 'udl', magnitude: mag, direction: 'y' });
    };

    return (
        <Popover>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent className="w-64 bg-slate-900 border-slate-800 text-white rounded-3xl p-6 shadow-2xl z-50">
                <div className="space-y-4">
                    <div>
                        <h4 className="font-black uppercase text-xs tracking-widest italic">Add UDL</h4>
                        <p className="text-[10px] text-slate-500 uppercase font-bold mt-1">Uniform distributed load</p>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black text-slate-400">Magnitude (kN/m)</Label>
                        <Input 
                            type="number" 
                            value={magnitude} 
                            onChange={e => setMagnitude(e.target.value)} 
                            className="bg-slate-950 border-slate-800 h-10 text-xs text-white"
                        />
                    </div>
                    <Button onClick={handleApply} className="w-full bg-sky-500 text-slate-950 font-black uppercase tracking-widest rounded-xl hover:bg-sky-400">
                        Apply UDL
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
};

// --- Utility Renderers ---

function renderScales(canvasSize: any, pan: Point, zoom: number) {
    const { width, height } = canvasSize; const centerX = width / 2, centerY = height / 2;
    const originX = RULER_MARGIN, originY = height - RULER_MARGIN;
    const ticks = [];
    const xStart = Math.floor((-centerX - pan.x) / (PIXELS_PER_METER * zoom));
    const xEnd = Math.ceil((width - centerX - pan.x) / (PIXELS_PER_METER * zoom));
    for (let m = xStart; m <= xEnd; m++) {
        const xS = centerX + pan.x + (m * PIXELS_PER_METER * zoom);
        if (xS < originX) continue;
        const major = m % 5 === 0;
        ticks.push(<line key={`hx-${m}`} x1={xS} y1={originY} x2={xS} y2={originY + (major ? 10 : 5)} stroke="#334155" />);
        if (major) ticks.push(<text key={`ht-${m}`} x={xS} y={originY + 20} textAnchor="middle" fontSize="10" fill="#64748b" className="font-bold">{m}m</text>);
    }
    const yStart = Math.floor((centerY + pan.y - originY) / (PIXELS_PER_METER * zoom));
    const yEnd = Math.ceil((centerY + pan.y) / (PIXELS_PER_METER * zoom));
    for (let m = yStart; m <= yEnd; m++) {
        const yS = centerY + pan.y - (m * PIXELS_PER_METER * zoom);
        if (yS > originY || yS < 0) continue;
        const major = m % 5 === 0;
        ticks.push(<line key={`vy-${m}`} x1={originX} y1={yS} x2={originX - (major ? 10 : 5)} y2={yS} stroke="#334155" />);
        if (major) ticks.push(<text key={`vt-${m}`} x={originX - 12} y={yS + 4} textAnchor="end" fontSize="10" fill="#64748b" className="font-bold">{m}m</text>);
    }
    return <g className="pointer-events-none">{ticks}<line x1={originX} y1={originY} x2={width} y2={originY} stroke="#334155" /><line x1={originX} y1={0} x2={originX} y2={originY} stroke="#334155" /></g>;
}

function renderReactions(res: AnalysisResult | null, diag: string | null, getNode: any, zoom: number) {
    if (!res || diag !== 'reactions') return null;
    const g = []; const len = 30 / zoom; const sz = 5 / zoom;
    const rxColor = "#ef4444";
    const rxWidth = 2 / zoom;
    for (const id in res.reactions) {
        const n = getNode(parseInt(id)); if (!n) continue; const { x, y } = n.pos; const [fx, fy] = res.reactions[id];
        if (Math.abs(fx) > 1e-3) g.push(<g key={`rx-${id}`}><path d={`M ${x - Math.sign(fx)*len} ${y} L ${x} ${y}`} stroke={rxColor} strokeWidth={rxWidth} fill="none" /><path d={`M ${x} ${y} L ${x - Math.sign(fx)*sz} ${y-sz} L ${x - Math.sign(fx)*sz} ${y+sz} Z`} fill={rxColor} /><text x={x - Math.sign(fx)*len - 5/zoom} y={y-5/zoom} fill={rxColor} fontSize={`${10/zoom}px`} textAnchor="middle">{(fx/1000).toFixed(2)}kN</text></g>);
        if (Math.abs(fy) > 1e-3) g.push(<g key={`ry-${id}`}><path d={`M ${x} ${y + Math.sign(fy)*len} L ${x} ${y}`} stroke={rxColor} strokeWidth={rxWidth} fill="none" /><path d={`M ${x} ${y} L ${x-sz} ${y + Math.sign(fy)*sz} L ${x+sz} ${y + Math.sign(fy)*sz} Z`} fill={rxColor} /><text x={x+10/zoom} y={y + Math.sign(fy)*len} fill={rxColor} fontSize={`${10/zoom}px`} dominantBaseline="middle">{(fy/1000).toFixed(2)}kN</text></g>);
    }
    return <g>{g}</g>;
}

function renderResultSummary(res: AnalysisResult | null) {
    if (!res) return <div className="bg-slate-950/50 border border-slate-800 p-6 rounded-3xl flex items-center gap-4"><AlertCircle className="h-5 w-5 text-sky-500" /><div><h5 className="font-black text-white uppercase text-xs tracking-widest italic">Static Model Ready</h5><p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Connect nodes and apply boundary conditions to analyze.</p></div></div>;
    
    const allForces = Object.values(res.memberForces!).flat();
    const maxShear = allForces.length > 0 ? Math.max(...allForces.map(f => Math.max(Math.abs(f.shear1), Math.abs(f.shear2)))) / 1000 : 0;
    const maxMoment = allForces.length > 0 ? Math.max(...allForces.map(f => Math.max(Math.abs(f.moment1), Math.abs(f.moment2)))) / 1000 : 0;
    const maxDisp = Object.values(res.displacements).length > 0 ? Math.max(...Object.values(res.displacements).map(d => Math.hypot(d[0], d[1]))) * 1000 : 0;
    
    let maxReact = 0;
    Object.values(res.reactions).forEach(r => { maxReact = Math.max(maxReact, Math.abs(r[0]), Math.abs(r[1])); });
    maxReact /= 1000;

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-2">
            <SummaryCard icon={<TrendingUp className="w-4 h-4 text-sky-400" />} label="Peak Reaction" value={maxReact.toFixed(2)} unit="kN" />
            <SummaryCard icon={<ArrowDownToLine className="w-4 h-4 text-sky-400" />} label="Peak Shear (V)" value={maxShear.toFixed(2)} unit="kN" />
            <SummaryCard icon={<RotateCcw className="w-4 h-4 text-emerald-400" />} label="Peak Moment (M)" value={maxMoment.toFixed(2)} unit="kNm" />
            <SummaryCard icon={<MoveHorizontal className="w-4 h-4 text-purple-400" />} label="Peak Deflect (δ)" value={maxDisp.toFixed(2)} unit="mm" />
        </div>
    );
}

function SummaryCard({ icon, label, value, unit }: any) {
    return (
        <div className="bg-slate-950/50 border border-slate-800 p-5 rounded-2xl flex flex-col gap-2 shadow-inner">
            <div className="flex items-center gap-2">
                {icon}
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
            </div>
            <div className="text-xl font-mono font-black text-white tracking-tighter">
                {value} <span className="text-[10px] font-normal text-slate-600 ml-1">{unit}</span>
            </div>
        </div>
    );
}
