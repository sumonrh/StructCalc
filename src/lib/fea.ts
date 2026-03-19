import * as math from 'mathjs';
import type { StructureState, Node, Member, Support, Load, VirtualMember } from '@/components/StructuralAnalysis';
import { PIXELS_PER_METER } from '@/components/StructuralAnalysis';

// --- TYPE DEFINITIONS FOR FEA ---
export type DegreeOfFreedom = 'x' | 'y' | 'z'; 
export type NodalDOF = [number, DegreeOfFreedom];

export interface MemberEndForces {
    startNodeId: number;
    endNodeId: number;
    axial1: number;
    shear1: number;
    moment1: number;
    axial2: number;
    shear2: number;
    moment2: number;
}

export interface AnalysisResult {
    displacements: Record<number, [number, number, number]>; 
    reactions: Record<number, [number, number, number]>;     
    memberForces: Record<number, MemberEndForces[]>; 
    success: boolean;
    message: string;
    virtualNodes: Node[];
    virtualMembers: VirtualMember[];
}

const EPS = 1e-9; 

export function analyzeStructure(structure: StructureState): AnalysisResult {
    const { nodes, members, supports, loads } = structure;
    const SUBDIVISIONS = 20; // Increased for smoother diagrams

    if (nodes.length === 0 || members.length === 0) {
        throw new Error("Structure must have nodes and members to be analyzed.");
    }
    if (supports.length === 0) {
        throw new Error("Structure must have supports to be stable.");
    }

    let virtualNodes = [...nodes];
    let virtualMembers: VirtualMember[] = [];
    let nextVirtualNodeId = nodes.length > 0 ? Math.max(...nodes.map(n => n.id)) + 1 : 1;
    let nextVirtualMemberId = members.length > 0 ? Math.max(...members.map(m => m.id)) + 1 : 1;

    // Build model by subdividing members at points of interest (loads) and for diagram smoothness
    members.forEach(member => {
        const pointLoadsOnMember = loads.filter(l => l.memberId === member.id && l.type === 'point');
        const loadPositions = pointLoadsOnMember.map(l => l.position!).sort();
        const allDivisions = [0, ...loadPositions, 1].filter((v, i, a) => i === 0 || Math.abs(v - a[i - 1]) > EPS);

        let lastNode = nodes.find(n => n.id === member.startNodeId)!;
        let lastRatio = 0;

        for (let i = 1; i < allDivisions.length; i++) {
            const ratio = allDivisions[i];
            if (ratio - lastRatio <= EPS) continue;
            const startNode = nodes.find(n => n.id === member.startNodeId)!;
            const endNode = nodes.find(n => n.id === member.endNodeId)!;
            
            // Subdivide every segment between critical points for smoothness
            for (let j = 1; j <= SUBDIVISIONS; j++) {
                const subRatio = lastRatio + (ratio - lastRatio) * (j / SUBDIVISIONS);
                const x = startNode.pos.x + (endNode.pos.x - startNode.pos.x) * subRatio;
                const y = startNode.pos.y + (endNode.pos.y - startNode.pos.y) * subRatio;
                let currentNode = (Math.abs(subRatio - 1.0) < EPS) ? endNode : { id: nextVirtualNodeId++, pos: { x, y } };
                if (!(Math.abs(subRatio - 1.0) < EPS)) virtualNodes.push(currentNode);
                virtualMembers.push({ ...member, id: nextVirtualMemberId++, startNodeId: lastNode.id, endNodeId: currentNode.id, originalMemberId: member.id });
                lastNode = currentNode;
            }
            lastRatio = ratio;
        }
    });

    const nodeIds = virtualNodes.map(n => n.id);
    const nodeMap = new Map<number, number>(nodeIds.map((id, index) => [id, index]));
    const nodeById = new Map<number, Node>(virtualNodes.map(n => [n.id, n]));
    const totalDOFs = virtualNodes.length * 3;

    let K = math.zeros(totalDOFs, totalDOFs) as math.Matrix;
    let F = math.zeros(totalDOFs, 1) as math.Matrix;
    let allFEFs: Record<number, math.Matrix> = {};

    // Assemble Global Stiffness Matrix
    virtualMembers.forEach(member => {
        const startNode = nodeById.get(member.startNodeId)!;
        const endNode = nodeById.get(member.endNodeId)!;
        const [k_local, T] = getMemberStiffnessMatrix(member, startNode, endNode);
        const k_global = math.multiply(math.multiply(math.transpose(T), k_local), T) as math.Matrix;
        const si = nodeMap.get(startNode.id)!, ei = nodeMap.get(endNode.id)!;
        const dofs = [si*3, si*3+1, si*3+2, ei*3, ei*3+1, ei*3+2];
        for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) K.set([dofs[i], dofs[j]], K.get([dofs[i], dofs[j]]) + k_global.get([i, j]));
    });

    // Apply Loads
    loads.forEach(load => {
        if (load.nodeId) {
            const idx = nodeMap.get(load.nodeId);
            if (idx !== undefined) F.set([idx * 3 + (load.direction === 'x' ? 0 : 1), 0], F.get([idx * 3 + (load.direction === 'x' ? 0 : 1), 0]) + load.magnitude);
            return;
        }
        const orig = members.find(m => m.id === load.memberId);
        if (!orig) return;
        if (load.type === 'udl') {
            const segs = virtualMembers.filter(vm => vm.originalMemberId === orig.id);
            segs.forEach(seg => {
                const sn = nodeById.get(seg.startNodeId)!, en = nodeById.get(seg.endNodeId)!;
                const T_seg = getTransformationMatrix(sn, en);
                const fef_local = getUDLFixedEndForces(load, seg, nodeById);
                allFEFs[seg.id] = math.add(allFEFs[seg.id] || math.zeros(6, 1), fef_local) as math.Matrix;
                const si = nodeMap.get(seg.startNodeId)!, ei = nodeMap.get(seg.endNodeId)!;
                const dofs = [si*3, si*3+1, si*3+2, ei*3, ei*3+1, ei*3+2];
                const fef_global = math.multiply(math.transpose(T_seg), fef_local) as math.Matrix;
                for (let i = 0; i < 6; i++) F.set([dofs[i], 0], F.get([dofs[i], 0]) - fef_global.get([i, 0]));
            });
        } else if (load.type === 'point' && load.position !== undefined) {
            const sn = nodes.find(n => n.id === orig.startNodeId)!, en = nodes.find(n => n.id === orig.endNodeId)!;
            const lx = sn.pos.x + (en.pos.x - sn.pos.x) * load.position, ly = sn.pos.y + (en.pos.y - sn.pos.y) * load.position;
            const node = virtualNodes.find(n => Math.hypot(n.pos.x - lx, n.pos.y - ly) < 0.5);
            if (node) {
                const idx = nodeMap.get(node.id)!;
                F.set([idx * 3 + (load.direction === 'x' ? 0 : 1), 0], F.get([idx * 3 + (load.direction === 'x' ? 0 : 1), 0]) + load.magnitude);
            }
        }
    });

    // Solve Displacements
    const restrained: number[] = [];
    supports.forEach(s => {
        const idx = nodeMap.get(s.nodeId); if (idx === undefined) return;
        if (s.type === 'fixed') restrained.push(idx*3, idx*3+1, idx*3+2);
        else if (s.type === 'pin') restrained.push(idx*3, idx*3+1);
        else if (s.type === 'roller') restrained.push(idx*3+1);
    });

    const free = Array.from({ length: totalDOFs }, (_, i) => i).filter(d => !restrained.includes(d));
    if (free.length === 0 || free.length === totalDOFs) throw new Error("Unstable or fully restrained structure.");

    const Kff = math.matrix(free.map(r => free.map(c => K.get([r, c]))));
    const Ff = math.matrix(free.map(r => [F.get([r, 0])]));
    const Uf = math.lusolve(Kff, Ff) as math.Matrix;
    const U = math.zeros(totalDOFs, 1) as math.Matrix;
    free.forEach((d, i) => U.set([d, 0], Uf.get([i, 0])));

    const reactions: Record<number, [number, number, number]> = {};
    const KU = math.multiply(K, U) as math.Matrix;
    const R = math.subtract(KU, F) as math.Matrix;
    supports.forEach(s => { const idx = nodeMap.get(s.nodeId)!; reactions[s.nodeId] = [R.get([idx*3, 0]), R.get([idx*3+1, 0]), R.get([idx*3+2, 0])]; });

    const displacements: Record<number, [number, number, number]> = {};
    virtualNodes.forEach(n => { const idx = nodeMap.get(n.id)!; displacements[n.id] = [U.get([idx*3, 0]), U.get([idx*3+1, 0]), U.get([idx*3+2, 0])]; });

    const memberForces: AnalysisResult['memberForces'] = {};
    members.forEach(orig => {
        memberForces[orig.id] = [];
        const segs = virtualMembers.filter(vm => vm.originalMemberId === orig.id);
        segs.forEach(seg => {
            const sn = nodeById.get(seg.startNodeId)!, en = nodeById.get(seg.endNodeId)!;
            const [kl, T] = getMemberStiffnessMatrix(seg, sn, en);
            const si = nodeMap.get(sn.id)!, ei = nodeMap.get(en.id)!;
            const Ug = math.matrix([si*3, si*3+1, si*3+2, ei*3, ei*3+1, ei*3+2].map(i => [U.get([i, 0])]));
            const total = math.add(math.multiply(kl, math.multiply(T, Ug)), allFEFs[seg.id] || math.zeros(6, 1)) as math.Matrix;
            memberForces[orig.id].push({ startNodeId: seg.startNodeId, endNodeId: seg.endNodeId, axial1: total.get([0,0]), shear1: total.get([1,0]), moment1: total.get([2,0]), axial2: total.get([3,0]), shear2: total.get([4,0]), moment2: total.get([5,0]) });
        });
    });

    return { displacements, reactions, memberForces, success: true, message: 'OK', virtualNodes, virtualMembers };
}

function getMemberStiffnessMatrix(member: Member, startNode: Node, endNode: Node): [math.Matrix, math.Matrix] {
    const L = Math.hypot(endNode.pos.x - startNode.pos.x, endNode.pos.y - startNode.pos.y) / PIXELS_PER_METER;
    if (L <= EPS) return [math.zeros(6,6) as math.Matrix, math.identity(6) as math.Matrix];
    const { E, I, A } = member;
    const EAL = E*A/L, EIL = E*I/L, EIL2 = E*I/(L*L), EIL3 = E*I/(L*L*L);
    const kl = math.matrix([[EAL,0,0,-EAL,0,0],[0,12*EIL3,6*EIL2,0,-12*EIL3,6*EIL2],[0,6*EIL2,4*EIL,0,-6*EIL2,2*EIL],[-EAL,0,0,EAL,0,0],[0,-12*EIL3,-6*EIL2,0,12*EIL3,-6*EIL2],[0,6*EIL2,2*EIL,0,-6*EIL2,4*EIL]]);
    return [kl, getTransformationMatrix(startNode, endNode)];
}

function getTransformationMatrix(sn: Node, en: Node): math.Matrix {
    const dx = en.pos.x - sn.pos.x, dy = en.pos.y - sn.pos.y, L = Math.hypot(dx, dy);
    if (L <= EPS) return math.identity(6) as math.Matrix;
    const c = dx/L, s = dy/L;
    return math.matrix([[c,s,0,0,0,0],[-s,c,0,0,0,0],[0,0,1,0,0,0],[0,0,0,c,s,0],[0,0,0,-s,c,0],[0,0,0,0,0,1]]);
}

function getUDLFixedEndForces(load: Load, member: Member, nodeById: Map<number, Node>): math.Matrix {
    const sn = nodeById.get(member.startNodeId)!, en = nodeById.get(member.endNodeId)!;
    const L = Math.hypot(en.pos.x - sn.pos.x, en.pos.y - sn.pos.y) / PIXELS_PER_METER;
    if (L <= EPS) return math.zeros(6, 1) as math.Matrix;
    const w = load.magnitude, V = -w*L/2, M = -w*L*L/12;
    const fef = math.zeros(6, 1) as math.Matrix;
    fef.set([1,0], V); fef.set([2,0], M); fef.set([4,0], V); fef.set([5,0], -M);
    return fef;
}
