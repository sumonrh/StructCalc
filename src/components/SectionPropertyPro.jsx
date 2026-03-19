'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box, Maximize, Zap, Info, Layers, PenTool, Trash2,
  MousePointerSquareDashed, FileDown, AlertCircle, AlertTriangle,
  Undo2, CheckCircle
} from 'lucide-react';

/**
 * SECTION PROPERTY PRO
 * Engine: Green's Theorem & 2D FEM Saint-Venant Torsion & Warping Solver
 */

// --- DICTIONARY & METADATA FOR PARAMETERS ---
const PARAM_LABELS = {
  b: 'Overall Width (B)', d: 'Overall Depth (D)',
  tf: 'Flange Thick. (TF)', tw: 'Web Thick. (TW)',
  t: 'Thickness (T)', gap: 'Gap / Spacing',
  c: 'Chamfer (C)', holeR: 'Hole Radius (R)',
  b_inner: 'Inner Width (b_in)', d_inner: 'Inner Depth (d_in)'
};

const PARAM_META = {
  b: { min: 0.05, max: 2.0, step: 0.01 }, d: { min: 0.05, max: 2.0, step: 0.01 },
  tf: { min: 0.001, max: 0.5, step: 0.001 }, tw: { min: 0.001, max: 0.5, step: 0.001 },
  t: { min: 0.001, max: 0.5, step: 0.001 }, gap: { min: 0.0, max: 1.0, step: 0.005 },
  c: { min: 0.0, max: 0.5, step: 0.005 }, holeR: { min: 0.0, max: 1.0, step: 0.005 },
  b_inner: { min: 0.01, max: 1.9, step: 0.01 }, d_inner: { min: 0.01, max: 1.9, step: 0.01 }
};

// --- ROBUST GEOMETRY VALIDATION ALGORITHMS ---
const onSegment = (p, q, r) => (q[0] <= Math.max(p[0], r[0]) && q[0] >= Math.min(p[0], r[0]) && q[1] <= Math.max(p[1], r[1]) && q[1] >= Math.min(p[1], r[1]));
const orientation = (p, q, r) => {
  const val = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
  if (Math.abs(val) < 1e-10) return 0;
  return (val > 0) ? 1 : 2;
};
const segmentsIntersect = (p1, q1, p2, q2) => {
  const o1 = orientation(p1, q1, p2), o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1), o4 = orientation(p2, q2, q1);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
};

const polygonEdgesIntersect = (poly1, poly2) => {
  for (let i = 0; i < poly1.length; i++) {
    const p1 = poly1[i], q1 = poly1[(i + 1) % poly1.length];
    for (let j = 0; j < poly2.length; j++) {
      const p2 = poly2[j], q2 = poly2[(j + 1) % poly2.length];
      if (segmentsIntersect(p1, q1, p2, q2)) return true;
    }
  }
  return false;
};

const isPointOnSegment = (p, a, b, eps = 1e-7) => {
  const crossProduct = (p[1] - a[1]) * (b[0] - a[0]) - (p[0] - a[0]) * (b[1] - a[1]);
  if (Math.abs(crossProduct) > eps) return false;
  const dotProduct = (p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1]);
  if (dotProduct < 0) return false;
  const squaredLengthBA = (b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]);
  if (dotProduct > squaredLengthBA) return false;
  return true;
};

const isPointOnPolygonBoundary = (pt, poly) => {
  for (let i = 0; i < poly.length; i++) if (isPointOnSegment(pt, poly[i], poly[(i + 1) % poly.length])) return true;
  return false;
};

const isPointInPolygon = (pt, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

const isSimplePolygon = (pts) => {
  if (pts.length < 3) return false;
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i], q1 = pts[(i + 1) % pts.length];
    if (Math.hypot(p1[0] - q1[0], p1[1] - q1[1]) < 1e-5) return false;
    for (let j = i + 2; j < pts.length; j++) {
      if (i === 0 && j === pts.length - 1) continue;
      const p2 = pts[j], q2 = pts[(j + 1) % pts.length];
      if (segmentsIntersect(p1, q1, p2, q2)) return false;
    }
  }
  return true;
};

const isOuterValid = (newOuter, existingOuters) => {
  for (const out of existingOuters) {
    if (polygonEdgesIntersect(newOuter, out)) return false;
    for (const pt of newOuter) if (isPointInPolygon(pt, out) || isPointOnPolygonBoundary(pt, out)) return false;
    for (const pt of out) if (isPointInPolygon(pt, newOuter) || isPointOnPolygonBoundary(pt, newOuter)) return false;
  }
  return true;
};

const isHoleValid = (newHole, existingOuters, existingHoles) => {
  let insideAnOuter = false;
  for (const out of existingOuters) {
    if (polygonEdgesIntersect(newHole, out)) return false;
    let allInsideStrict = true;
    for (const pt of newHole) {
      if (!isPointInPolygon(pt, out) || isPointOnPolygonBoundary(pt, out)) { allInsideStrict = false; break; }
    }
    if (allInsideStrict) { insideAnOuter = true; break; }
  }
  if (!insideAnOuter) return false;
  for (const h of existingHoles) {
    if (polygonEdgesIntersect(newHole, h)) return false;
    for (const pt of newHole) if (isPointInPolygon(pt, h) || isPointOnPolygonBoundary(pt, h)) return false;
    for (const pt of h) if (isPointInPolygon(pt, newHole) || isPointOnPolygonBoundary(pt, newHole)) return false;
  }
  return true;
};

// --- MATHEMATICAL ENGINE (GREEN'S THEOREM) ---
const computeSinglePoly = (pts) => {
  let A = 0, Cx = 0, Cy = 0, Ix = 0, Iy = 0, Ixy = 0;
  const n = pts.length;
  if (n < 3) return { A: 0, Cx: 0, Cy: 0, Ixc: 0, Iyc: 0, Ixyc: 0 };

  let signedA = 0;
  for (let i = 0; i < n; i++) signedA += pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1];
  const isCW = signedA < 0;
  const ccwPts = isCW ? [...pts].reverse() : pts;

  for (let i = 0; i < n; i++) {
    const x1 = ccwPts[i][0], y1 = ccwPts[i][1], x2 = ccwPts[(i + 1) % n][0], y2 = ccwPts[(i + 1) % n][1];
    const a = x1 * y2 - x2 * y1;
    A += a; Cx += (x1 + x2) * a; Cy += (y1 + y2) * a;
    Ix += (y1 * y1 + y1 * y2 + y2 * y2) * a; Iy += (x1 * x1 + x1 * x2 + x2 * x2) * a;
    Ixy += a * (x1 * y2 + 2 * x1 * y1 + 2 * x2 * y2 + x2 * y1);
  }

  A /= 2;
  if (Math.abs(A) < 1e-12) return { A: 0, Cx: 0, Cy: 0, Ixc: 0, Iyc: 0, Ixyc: 0 };
  Cx /= (6 * A); Cy /= (6 * A); Ix /= 12; Iy /= 12; Ixy /= 24;

  const Ixc = Ix - A * Cy * Cy, Iyc = Iy - A * Cx * Cx, Ixyc = Ixy - A * Cx * Cy;
  return { A: Math.abs(A), Cx, Cy, Ixc, Iyc, Ixyc };
};

const computeComposite = (outers, holes, exactProps = null) => {
  if (exactProps) return exactProps;

  let totalA = 0, sumCxA = 0, sumCyA = 0;
  const outData = outers.map(computeSinglePoly);
  const holeData = holes.map(computeSinglePoly);

  outData.forEach(p => { totalA += p.A; sumCxA += p.Cx * p.A; sumCyA += p.Cy * p.A; });
  holeData.forEach(p => { totalA -= p.A; sumCxA -= p.Cx * p.A; sumCyA -= p.Cy * p.A; });

  if (totalA < 1e-12) return null;

  const globalCx = sumCxA / totalA;
  const globalCy = sumCyA / totalA;

  let globalIxc = 0, globalIyc = 0, globalIxyc = 0;
  outData.forEach(p => {
    globalIxc += p.Ixc + p.A * Math.pow(p.Cy - globalCy, 2);
    globalIyc += p.Iyc + p.A * Math.pow(p.Cx - globalCx, 2);
    globalIxyc += p.Ixyc + p.A * (p.Cx - globalCx) * (p.Cy - globalCy);
  });
  holeData.forEach(p => {
    globalIxc -= (p.Ixc + p.A * Math.pow(p.Cy - globalCy, 2));
    globalIyc -= (p.Iyc + p.A * Math.pow(p.Cx - globalCx, 2));
    globalIxyc -= (p.Ixyc + p.A * (p.Cx - globalCx) * (p.Cy - globalCy));
  });

  let yTop = 0, yBot = 0, xRight = 0, xLeft = 0;
  outers.forEach(poly => {
    poly.forEach(([x, y]) => {
      yTop = Math.max(yTop, y - globalCy); yBot = Math.max(yBot, globalCy - y);
      xRight = Math.max(xRight, x - globalCx); xLeft = Math.max(xLeft, globalCx - x);
    });
  });

  const avgI = (globalIxc + globalIyc) / 2;
  const diffI = (globalIxc - globalIyc) / 2;
  const R = Math.sqrt(diffI * diffI + globalIxyc * globalIxyc);

  let theta = 0;
  if (Math.abs(diffI) > 1e-12 || Math.abs(globalIxyc) > 1e-12) theta = Math.atan2(-globalIxyc, diffI) / 2;

  // Normalize Principal Angle to [-90, 90)
  let alphaDeg = theta * (180 / Math.PI);
  while (alphaDeg >= 90) alphaDeg -= 180;
  while (alphaDeg < -90) alphaDeg += 180;

  const safe = (val) => Math.max(0, val);

  return {
    A: totalA, Cx: globalCx, Cy: globalCy,
    Ix: globalIxc, Iy: globalIyc, Ixy: globalIxyc,
    Ip: globalIxc + globalIyc,
    I1: avgI + R, I2: avgI - R, alpha: alphaDeg,
    SxTop: yTop > 0 ? globalIxc / yTop : 0, SxBot: yBot > 0 ? globalIxc / yBot : 0,
    SyRight: xRight > 0 ? globalIyc / xRight : 0, SyLeft: xLeft > 0 ? globalIyc / xLeft : 0,
    rx: Math.sqrt(safe(globalIxc / totalA)), ry: Math.sqrt(safe(globalIyc / totalA))
  };
};

// --- FINITE ELEMENT METHOD (FEM) SAINT-VENANT TORSION & WARPING SOLVER ---
const computeFEMTorsion = (outers, holes, Cx, Cy, A_exact, Ix_exact, Iy_exact, Ixy_exact) => {
  const warnings = [];
  const shift = (poly) => poly.map(p => [p[0] - Cx, p[1] - Cy]);
  const shiftedOuters = outers.map(shift);
  const shiftedHoles = holes.map(shift);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  shiftedOuters.forEach(poly => poly.forEach(p => {
    minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
    minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
  }));

  const spanX = maxX - minX, spanY = maxY - minY;
  const maxSpan = Math.max(spanX, spanY, 0.001);
  // Fixed adaptive minimum span logic
  const minSpan = Math.max(Math.min(spanX, spanY), 0.001);

  let resolution = Math.max(100, Math.ceil(maxSpan / (minSpan / 15)));
  resolution = Math.min(resolution, 220); // Cap to avoid main thread freezing

  const h = maxSpan / resolution;
  const cols = Math.ceil(spanX / h) + 2, rows = Math.ceil(spanY / h) + 2;
  const startX = minX - h, startY = minY - h;

  const isInside = (x, y) => {
    let inOuter = false;
    for (const out of shiftedOuters) {
      if (isPointInPolygon([x, y], out) || isPointOnPolygonBoundary([x, y], out)) {
        inOuter = true; break;
      }
    }
    if (!inOuter) return false;
    for (const hole of shiftedHoles) {
      if (isPointInPolygon([x, y], hole) || isPointOnPolygonBoundary([x, y], hole)) return false;
    }
    return true;
  };

  const activeNodes = new Map();
  let nodeCount = 0;
  const elements = [];

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const cx = startX + (c + 0.5) * h, cy = startY + (r + 0.5) * h;
      if (isInside(cx, cy)) {
        const getCompact = (R, C) => {
          const key = `${R},${C}`;
          if (!activeNodes.has(key)) activeNodes.set(key, { idx: nodeCount++, x: startX + C * h, y: startY + R * h });
          return activeNodes.get(key).idx;
        }
        const i00 = getCompact(r, c), i10 = getCompact(r, c + 1);
        const i01 = getCompact(r + 1, c), i11 = getCompact(r + 1, c + 1);
        elements.push([i00, i10, i11]);
        elements.push([i00, i11, i01]);
      }
    }
  }

  if (nodeCount < 3 || elements.length === 0) return { J: null, Cw: null, error: "Mesh generation failed." };

  const nodes = new Array(nodeCount);
  activeNodes.forEach(v => { nodes[v.idx] = [v.x, v.y]; });

  // Connected Components Search
  const adj = Array.from({ length: nodeCount }, () => []);
  for (const e of elements) {
    adj[e[0]].push(e[1], e[2]);
    adj[e[1]].push(e[0], e[2]);
    adj[e[2]].push(e[0], e[1]);
  }

  const visited = new Uint8Array(nodeCount);
  const components = [];
  for (let i = 0; i < nodeCount; i++) {
    if (!visited[i]) {
      const comp = [];
      const q = [i];
      visited[i] = 1;
      while (q.length) {
        const curr = q.pop();
        comp.push(curr);
        for (const nbr of adj[curr]) {
          if (!visited[nbr]) {
            visited[nbr] = 1;
            q.push(nbr);
          }
        }
      }
      components.push(comp);
    }
  }

  if (components.length > 1) {
    warnings.push(`${components.length} disconnected regions detected. Warping constant (Cw) requires a fully connected section.`);
  }

  const pinnedNodes = new Set(components.map(c => c[0]));
  const K = Array.from({ length: nodeCount }, () => new Map());
  const F = new Float64Array(nodeCount);
  const B_T_B_cache = [];
  const coeff_cache = [];

  for (let e = 0; e < elements.length; e++) {
    const [i1, i2, i3] = elements[e];
    const x1 = nodes[i1][0], y1 = nodes[i1][1], x2 = nodes[i2][0], y2 = nodes[i2][1], x3 = nodes[i3][0], y3 = nodes[i3][1];

    const Ae = 0.5 * Math.abs((x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1));
    if (Ae < 1e-12) { B_T_B_cache.push(null); coeff_cache.push(0); continue; }

    const b1 = y2 - y3, b2 = y3 - y1, b3 = y1 - y2;
    const c1 = x3 - x2, c2 = x1 - x3, c3 = x2 - x1;

    const BTB = [[b1 * b1 + c1 * c1, b1 * b2 + c1 * c2, b1 * b3 + c1 * c3], [b2 * b1 + c2 * c1, b2 * b2 + c2 * c2, b2 * b3 + c2 * c3], [b3 * b1 + c3 * c1, b3 * b2 + c3 * c2, b3 * b3 + c3 * c3]];
    B_T_B_cache.push(BTB);

    const coeff = 1 / (4 * Ae);
    coeff_cache.push(coeff);

    const cx_e = (x1 + x2 + x3) / 3, cy_e = (y1 + y2 + y3) / 3;
    const fe = [0.5 * (b1 * cy_e - c1 * cx_e), 0.5 * (b2 * cy_e - c2 * cx_e), 0.5 * (b3 * cy_e - c3 * cx_e)];

    for (let i = 0; i < 3; i++) {
      F[elements[e][i]] += fe[i];
      for (let j = 0; j < 3; j++) {
        const rIdx = elements[e][i], cIdx = elements[e][j];
        K[rIdx].set(cIdx, (K[rIdx].get(cIdx) || 0) + coeff * BTB[i][j]);
      }
    }
  }

  const row_ptr = new Int32Array(nodeCount + 1);
  const col_ind = [];
  const val_arr = [];
  let nnz = 0;
  for (let i = 0; i < nodeCount; i++) {
    row_ptr[i] = nnz;
    if (pinnedNodes.has(i)) {
      col_ind.push(i); val_arr.push(1.0);
      F[i] = 0; nnz++;
    } else {
      for (const [j, v] of K[i].entries()) {
        if (pinnedNodes.has(j)) continue;
        col_ind.push(j); val_arr.push(v); nnz++;
      }
    }
  }
  row_ptr[nodeCount] = nnz;
  const col_ind_arr = new Int32Array(col_ind);
  const val_arr_f64 = new Float64Array(val_arr);

  const w = new Float64Array(nodeCount);
  const r = new Float64Array(nodeCount);
  const p = new Float64Array(nodeCount);
  const Ap = new Float64Array(nodeCount);

  for (let i = 0; i < nodeCount; i++) r[i] = F[i];
  pinnedNodes.forEach(idx => r[idx] = 0);
  for (let i = 0; i < nodeCount; i++) p[i] = r[i];

  let rsold = 0;
  for (let i = 0; i < nodeCount; i++) rsold += r[i] * r[i];

  let iter = 0;
  let rsnew = rsold;
  const MAX_ITER = 2000;

  for (; iter < MAX_ITER; iter++) {
    for (let i = 0; i < nodeCount; i++) {
      let sum = 0;
      for (let k = row_ptr[i]; k < row_ptr[i + 1]; k++) sum += val_arr_f64[k] * p[col_ind_arr[k]];
      Ap[i] = sum;
    }

    let pAp = 0;
    for (let i = 0; i < nodeCount; i++) pAp += p[i] * Ap[i];

    const alpha = rsold / Math.max(pAp, 1e-16);
    for (let i = 0; i < nodeCount; i++) w[i] += alpha * p[i];
    for (let i = 0; i < nodeCount; i++) r[i] -= alpha * Ap[i];

    pinnedNodes.forEach(idx => r[idx] = 0);

    rsnew = 0;
    for (let i = 0; i < nodeCount; i++) rsnew += r[i] * r[i];
    if (Math.sqrt(rsnew) < 1e-8) break;

    const beta = rsnew / rsold;
    for (let i = 0; i < nodeCount; i++) p[i] = r[i] + beta * p[i];
    rsold = rsnew;
  }

  const converged = Math.sqrt(rsnew) < 1e-8;
  if (!converged) warnings.push("Solver did not fully converge. Results may be inaccurate.");

  // 6. Recovery of Torsion (J) and Warping Constant (Cw)
  let wKw = 0;
  let mesh_Ip = 0;
  let Q_w = 0, I_w = 0, I_xw = 0, I_yw = 0;

  for (let e = 0; e < elements.length; e++) {
    const BTB = B_T_B_cache[e];
    if (!BTB) continue;

    const [i1, i2, i3] = elements[e];
    const x1 = nodes[i1][0], y1 = nodes[i1][1];
    const x2 = nodes[i2][0], y2 = nodes[i2][1];
    const x3 = nodes[i3][0], y3 = nodes[i3][1];

    const w1 = w[i1], w2 = w[i2], w3 = w[i3];
    const we = [w1, w2, w3];
    const c = coeff_cache[e];

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) wKw += we[i] * BTB[i][j] * c * we[j];
    }

    const Ae = 0.5 * Math.abs((x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1));
    const Ixx = (Ae / 6) * (y1 * y1 + y2 * y2 + y3 * y3 + y1 * y2 + y2 * y3 + y3 * y1);
    const Iyy = (Ae / 6) * (x1 * x1 + x2 * x2 + x3 * x3 + x1 * x2 + x2 * x3 + x3 * x1);
    mesh_Ip += (Ixx + Iyy);

    // Integrals for Warping Properties
    const sum_x = x1 + x2 + x3;
    const sum_y = y1 + y2 + y3;
    const sum_w = w1 + w2 + w3;

    Q_w += Ae * (sum_w / 3);
    I_w += (Ae / 6) * (w1 * w1 + w2 * w2 + w3 * w3 + w1 * w2 + w2 * w3 + w3 * w1);
    I_xw += (Ae / 12) * (sum_x * sum_w + x1 * w1 + x2 * w2 + x3 * w3);
    I_yw += (Ae / 12) * (sum_y * sum_w + y1 * w1 + y2 * w2 + y3 * w3);
  }

  const mesh_J = Math.max(0, mesh_Ip - wKw);

  let Cw = null;
  // Cw is only valid if section is fully connected
  if (components.length === 1 && converged && A_exact > 0) {
    const D = Ix_exact * Iy_exact - Ixy_exact * Ixy_exact;
    let xs = 0, ys = 0;
    if (Math.abs(D) > 1e-12) {
      xs = (Ixy_exact * I_xw - Iy_exact * I_yw) / D;
      ys = (Ix_exact * I_xw - Ixy_exact * I_yw) / D;
    }
    Cw = I_w - (Q_w * Q_w / A_exact) - ys * I_xw + xs * I_yw;

    if (Cw < -1e-10) {
      warnings.push("Computed Cw is negative; mesh discretization may be inadequate for this geometry.");
    }
    Cw = Math.max(0, Cw);
  }

  return {
    J: mesh_J,
    Cw,
    converged,
    iterations: iter,
    residual: Math.sqrt(rsnew),
    nodeCount,
    elementCount: elements.length,
    components: components.length,
    warnings
  };
};

const SHAPE_DEFS = {
  'IShape': { name: 'I-Section', inputs: ['b', 'd', 'tf', 'tw'], supportsWarping: true },
  'TShape': { name: 'T-Section', inputs: ['b', 'd', 'tf', 'tw'], supportsWarping: true },
  'CShape': { name: 'C-Channel', inputs: ['b', 'd', 'tf', 'tw'], supportsWarping: true },
  'LShape': { name: 'L-Angle', inputs: ['b', 'd', 't'], supportsWarping: true },
  'RectHollow': { name: 'Rectangular Hollow', inputs: ['b', 'd', 'b_inner', 'd_inner'], supportsWarping: false },
  'OpenBox': { name: 'Open Top Box', inputs: ['b', 'd', 'tf', 'tw'], supportsWarping: true },
  'SolidCircle': { name: 'Solid Circle', inputs: ['d'], supportsWarping: false },
  'Pipe': { name: 'Pipe', inputs: ['d', 't'], supportsWarping: false },
  'DoubleAngle': { name: 'Double Angle', inputs: ['b', 'd', 't', 'gap'], supportsWarping: false },
  'DoubleChannel': { name: 'Double Channel', inputs: ['b', 'd', 'tf', 'tw', 'gap'], supportsWarping: false },
  'OctagonHole': { name: 'Octagon w/ Hole', inputs: ['b', 'd', 'c', 'holeR'], supportsWarping: false }
};

const validateParams = (type, p) => {
  const relevant = SHAPE_DEFS[type].inputs;
  for (const key of relevant) {
    if (['gap', 'c', 'holeR'].includes(key)) {
      if (p[key] !== undefined && p[key] < 0) return `Parameter ${PARAM_LABELS[key] || key} cannot be negative.`;
    } else {
      if (p[key] !== undefined && p[key] <= 0) return `Parameter ${PARAM_LABELS[key] || key} must be strictly > 0.`;
    }
  }

  switch (type) {
    case 'IShape':
    case 'CShape':
    case 'DoubleChannel':
      if (p.tf * 2 >= p.d) return "Flange thickness exceeds total depth.";
      if (p.tw >= p.b) return "Web thickness exceeds total width.";
      break;
    case 'TShape':
      if (p.tf >= p.d) return "Flange thickness exceeds total depth.";
      if (p.tw >= p.b) return "Web thickness exceeds total width.";
      break;
    case 'LShape':
    case 'DoubleAngle':
      if (p.t >= p.d || p.t >= p.b) return "Thickness exceeds leg length.";
      break;
    case 'RectHollow':
      if (p.b_inner >= p.b) return "Inner width must be less than outer width.";
      if (p.d_inner >= p.d) return "Inner depth must be less than outer depth.";
      break;
    case 'OpenBox':
      if (p.tf >= p.d) return "Bottom flange exceeds total depth.";
      if (p.tw * 2 >= p.b) return "Webs exceed total width.";
      break;
    case 'Pipe':
      if (p.t >= p.d / 2) return "Wall thickness must be less than radius.";
      break;
    case 'OctagonHole':
      if (p.c >= p.b / 2 || p.c >= p.d / 2) return "Chamfer too large for dimensions.";
      if (p.holeR >= p.b / 2 || p.holeR >= p.d / 2) return "Hole exceeds boundary.";
      break;
  }
  return null;
};

// --- PARAMETRIC SHAPE GENERATORS ---
const generateCircle = (r, n = 72) => {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    pts.push([Math.cos(ang) * r, Math.sin(ang) * r]);
  }
  return pts;
};

const Generators = {
  'IShape': (p) => {
    const Iy = (2 * p.tf * Math.pow(p.b, 3) + Math.max(0, p.d - 2 * p.tf) * Math.pow(p.tw, 3)) / 12;
    return {
      outers: [[
        [-p.b / 2, p.d / 2], [p.b / 2, p.d / 2], [p.b / 2, p.d / 2 - p.tf], [p.tw / 2, p.d / 2 - p.tf],
        [p.tw / 2, -p.d / 2 + p.tf], [p.b / 2, -p.d / 2 + p.tf], [p.b / 2, -p.d / 2], [-p.b / 2, -p.d / 2],
        [-p.b / 2, -p.d / 2 + p.tf], [-p.tw / 2, -p.d / 2 + p.tf], [-p.tw / 2, p.d / 2 - p.tf], [-p.b / 2, p.d / 2 - p.tf]
      ]], holes: [],
      torsionJ: (2 / 3) * p.b * Math.pow(p.tf, 3) + (1 / 3) * Math.max(0, p.d - 2 * p.tf) * Math.pow(p.tw, 3),
      exactCw: Iy * Math.pow(p.d - p.tf, 2) / 4
    }
  },
  'TShape': (p) => ({
    outers: [[
      [-p.b / 2, p.d / 2], [p.b / 2, p.d / 2], [p.b / 2, p.d / 2 - p.tf], [p.tw / 2, p.d / 2 - p.tf],
      [p.tw / 2, -p.d / 2], [-p.tw / 2, -p.d / 2], [-p.tw / 2, p.d / 2 - p.tf], [-p.b / 2, p.d / 2 - p.tf]
    ]], holes: [],
    torsionJ: (1 / 3) * p.b * Math.pow(p.tf, 3) + (1 / 3) * Math.max(0, p.d - p.tf) * Math.pow(p.tw, 3)
  }),
  'CShape': (p) => ({
    outers: [[
      [-p.b / 2, p.d / 2], [p.b / 2, p.d / 2], [p.b / 2, p.d / 2 - p.tf], [-p.b / 2 + p.tw, p.d / 2 - p.tf],
      [-p.b / 2 + p.tw, -p.d / 2 + p.tf], [p.b / 2, -p.d / 2 + p.tf], [p.b / 2, -p.d / 2], [-p.b / 2, -p.d / 2]
    ]], holes: [],
    torsionJ: (2 / 3) * p.b * Math.pow(p.tf, 3) + (1 / 3) * Math.max(0, p.d - 2 * p.tf) * Math.pow(p.tw, 3)
  }),
  'LShape': (p) => ({
    outers: [[
      [-p.b / 2, p.d / 2], [-p.b / 2 + p.t, p.d / 2], [-p.b / 2 + p.t, -p.d / 2 + p.t],
      [p.b / 2, -p.d / 2 + p.t], [p.b / 2, -p.d / 2], [-p.b / 2, -p.d / 2]
    ]], holes: [],
    torsionJ: (1 / 3) * p.b * Math.pow(p.t, 3) + (1 / 3) * Math.max(0, p.d - p.t) * Math.pow(p.t, 3)
  }),
  'RectHollow': (p) => {
    const tw = (p.b - p.b_inner) / 2;
    const tf = (p.d - p.d_inner) / 2;
    const Am = (p.b - tw) * (p.d - tf);
    const integral = 2 * (p.d - tf) / tw + 2 * (p.b - tw) / tf;
    return {
      outers: [[[-p.b / 2, p.d / 2], [p.b / 2, p.d / 2], [p.b / 2, -p.d / 2], [-p.b / 2, -p.d / 2]]],
      holes: [[[-p.b_inner / 2, p.d_inner / 2], [p.b_inner / 2, p.d_inner / 2], [p.b_inner / 2, -p.d_inner / 2], [-p.b_inner / 2, -p.d_inner / 2]]],
      torsionJ: (4 * Am * Am) / integral,
      exactCw: null
    };
  },
  'OpenBox': (p) => ({
    outers: [[
      [-p.b / 2, p.d / 2], [-p.b / 2 + p.tw, p.d / 2], [-p.b / 2 + p.tw, -p.d / 2 + p.tf],
      [p.b / 2 - p.tw, -p.d / 2 + p.tf], [p.b / 2 - p.tw, p.d / 2], [p.b / 2, p.d / 2],
      [p.b / 2, -p.d / 2], [-p.b / 2, -p.d / 2]
    ]], holes: [],
    torsionJ: (1 / 3) * p.b * Math.pow(p.tf, 3) + (2 / 3) * Math.max(0, p.d - p.tf) * Math.pow(p.tw, 3)
  }),
  'DoubleAngle': (p) => ({
    outers: [
      [[-p.gap / 2, p.d / 2], [-p.gap / 2 - p.t, p.d / 2], [-p.gap / 2 - p.t, -p.d / 2 + p.t], [-p.gap / 2 - p.b, -p.d / 2 + p.t], [-p.gap / 2 - p.b, -p.d / 2], [-p.gap / 2, -p.d / 2]],
      [[p.gap / 2, p.d / 2], [p.gap / 2, -p.d / 2], [p.gap / 2 + p.b, -p.d / 2], [p.gap / 2 + p.b, -p.d / 2 + p.t], [p.gap / 2 + p.t, -p.d / 2 + p.t], [p.gap / 2 + p.t, p.d / 2]]
    ], holes: [],
    torsionJ: 2 * ((1 / 3) * p.b * Math.pow(p.t, 3) + (1 / 3) * Math.max(0, p.d - p.t) * Math.pow(p.t, 3))
  }),
  'DoubleChannel': (p) => ({
    outers: [
      [[-p.gap / 2, p.d / 2], [-p.gap / 2 - p.b, p.d / 2], [-p.gap / 2 - p.b, p.d / 2 - p.tf], [-p.gap / 2 - p.tw, p.d / 2 - p.tf], [-p.gap / 2 - p.tw, -p.d / 2 + p.tf], [-p.gap / 2 - p.b, -p.d / 2 + p.tf], [-p.gap / 2 - p.b, -p.d / 2], [-p.gap / 2, -p.d / 2]],
      [[p.gap / 2, p.d / 2], [p.gap / 2, -p.d / 2], [p.gap / 2 + p.b, -p.d / 2], [p.gap / 2 + p.b, -p.d / 2 + p.tf], [p.gap / 2 + p.tw, -p.d / 2 + p.tf], [p.gap / 2 + p.tw, p.d / 2 - p.tf], [p.gap / 2 + p.b, p.d / 2 - p.tf], [p.gap / 2 + p.b, p.d / 2]]
    ], holes: [],
    torsionJ: 2 * ((2 / 3) * p.b * Math.pow(p.tf, 3) + (1 / 3) * Math.max(0, p.d - 2 * p.tf) * Math.pow(p.tw, 3))
  }),
  'SolidCircle': (p) => {
    const r = p.d / 2;
    const I = (Math.PI * Math.pow(r, 4)) / 4;
    return {
      outers: [generateCircle(r)], holes: [],
      exactProps: {
        A: Math.PI * r * r, Cx: 0, Cy: 0, Ix: I, Iy: I, Ixy: 0, Ip: I * 2, J: I * 2, Cw: null,
        I1: I, I2: I, alpha: 0, SxTop: I / r, SxBot: I / r, SyRight: I / r, SyLeft: I / r,
        rx: r / 2, ry: r / 2
      }
    }
  },
  'Pipe': (p) => {
    const ro = p.d / 2; const ri = ro - p.t;
    const A = Math.PI * (ro * ro - ri * ri);
    const I = (Math.PI * (Math.pow(ro, 4) - Math.pow(ri, 4))) / 4;
    return {
      outers: [generateCircle(ro)], holes: [generateCircle(ri)],
      exactProps: {
        A, Cx: 0, Cy: 0, Ix: I, Iy: I, Ixy: 0, Ip: I * 2, J: I * 2, Cw: null,
        I1: I, I2: I, alpha: 0, SxTop: I / ro, SxBot: I / ro, SyRight: I / ro, SyLeft: I / ro,
        rx: Math.sqrt(Math.max(0, I / A)), ry: Math.sqrt(Math.max(0, I / A))
      }
    };
  },
  'OctagonHole': (p) => ({
    outers: [[
      [-p.b / 2 + p.c, p.d / 2], [p.b / 2 - p.c, p.d / 2], [p.b / 2, p.d / 2 - p.c], [p.b / 2, -p.d / 2 + p.c],
      [p.b / 2 - p.c, -p.d / 2], [-p.b / 2 + p.c, -p.d / 2], [-p.b / 2, -p.d / 2 + p.c], [-p.b / 2, p.d / 2 - p.c]
    ]],
    holes: p.holeR > 0 ? [generateCircle(p.holeR)] : [],
    torsionJ: null,
    exactCw: null
  })
};

const formatNum = (val) => {
  if (typeof val === 'string') return val;
  if (val === undefined || val === null || isNaN(val)) return "---";
  const absVal = Math.abs(val);
  if (absVal < 1e-15) return "0.0000";
  return (absVal >= 1e-3 && absVal < 10000) ? val.toFixed(5) : val.toExponential(4);
};

const ResultRow = ({ label, value, unit, highlight, warning }) => (
  <div className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${highlight ? 'bg-sky-950 border-sky-800 text-sky-200' : 'bg-slate-800 border-slate-700 hover:bg-slate-750'}`}>
    <span className={`text-xs flex items-center gap-1 ${highlight ? 'font-bold text-sky-300' : 'font-medium text-slate-400'}`}>
      {label}
      {warning && <AlertTriangle size={12} className="text-amber-500" title={warning} />}
    </span>
    <div className="text-right">
      <span className={`text-sm font-mono font-bold ${highlight ? 'text-sky-400' : 'text-slate-200'}`}>
        {value !== undefined && value !== null ? value : "---"}
      </span>
      <span className="text-[10px] text-slate-500 ml-1 font-sans">{unit}</span>
    </div>
  </div>
);

export function SectionPropertyPro() {
  const [activeMode, setActiveMode] = useState('parametric');
  const [sectionType, setSectionType] = useState('IShape');
  const [fdCircleR, setFdCircleR] = useState(0.05);

  const [rawParams, setRawParams] = useState({
    b: 0.20, d: 0.30, tf: 0.015, tw: 0.010, t: 0.015, c: 0.02, holeR: 0.05, gap: 0.05,
    b_inner: 0.15, d_inner: 0.25
  });

  const [fdOuters, setFdOuters] = useState([]);
  const [fdHoles, setFdHoles] = useState([]);
  const [fdCurrent, setFdCurrent] = useState([]);
  const [fdTarget, setFdTarget] = useState('outer');
  const [mousePos, setMousePos] = useState(null);
  const [fdError, setFdError] = useState("");

  const [torsionData, setTorsionData] = useState(null);
  const [isSolvingTorsion, setIsSolvingTorsion] = useState(false);

  // Zoom / Pan
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState([0, 0]);
  const [isPanMode, setIsPanMode] = useState(false);
  const panStartRef = useRef(null);
  const canvasTransformRef = useRef({ scale: 1, cx: 0, cy: 0 });

  // Node dragging
  const [dragInfo, setDragInfo] = useState(null); // {type:'outer'|'hole', pi, ni}
  const [hoveredNode, setHoveredNode] = useState(null);

  // Circle tool
  const [drawTool, setDrawTool] = useState('polygon'); // 'polygon' | 'circle' | 'rect'
  const [toolState, setToolState] = useState(null); // tool-specific intermediate state

  const canvasRef = useRef(null);

  const params = useMemo(() => {
    return Object.fromEntries(Object.entries(rawParams).map(([k, v]) => [k, Number(v) || 0]));
  }, [rawParams]);

  const geometry = useMemo(() => {
    if (activeMode === 'parametric') {
      const vErr = validateParams(sectionType, params);
      if (vErr) return { error: vErr, outers: [], holes: [] };
      return { ...Generators[sectionType](params), error: null };
    }
    return { outers: fdOuters, holes: fdHoles, error: null, exactProps: null, torsionJ: null, exactCw: null };
  }, [activeMode, sectionType, params, fdOuters, fdHoles]);

  const results = useMemo(() => {
    if (geometry.error) return null;
    return computeComposite(geometry.outers, geometry.holes, geometry.exactProps);
  }, [geometry]);

  useEffect(() => {
    if (!results) {
      setTorsionData(null);
      return;
    }
    if (activeMode === 'parametric') {
      const isWarpingSupported = SHAPE_DEFS[sectionType].supportsWarping;
      if (!isWarpingSupported) {
        setTorsionData({ J: geometry.exactProps?.J ?? geometry.torsionJ ?? null, Cw: null });
        setIsSolvingTorsion(false);
      } else if (geometry.exactCw !== undefined && geometry.exactCw !== null) {
        setTorsionData({ J: geometry.torsionJ, Cw: geometry.exactCw });
        setIsSolvingTorsion(false);
      } else {
        setIsSolvingTorsion(true);
        setTorsionData(null);
        const timer = setTimeout(() => {
          const tData = computeFEMTorsion(geometry.outers, geometry.holes, results.Cx, results.Cy, results.A, results.Ix, results.Iy, results.Ixy);
          if (geometry.torsionJ !== undefined && geometry.torsionJ !== null) tData.J = geometry.torsionJ;
          setTorsionData(tData);
          setIsSolvingTorsion(false);
        }, 50);
        return () => clearTimeout(timer);
      }
    } else {
      setIsSolvingTorsion(true);
      setTorsionData(null);
      const timer = setTimeout(() => {
        const tData = computeFEMTorsion(geometry.outers, geometry.holes, results.Cx, results.Cy, results.A, results.Ix, results.Iy, results.Ixy);
        setTorsionData(tData);
        setIsSolvingTorsion(false);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [results, activeMode, geometry, sectionType]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    
    // Tokyo Night Background
    ctx.fillStyle = '#1a1b26';
    ctx.fillRect(0, 0, W, H);

    let minX = -0.5, maxX = 0.5, minY = -0.5, maxY = 0.5;
    if (activeMode === 'parametric' && !geometry.error) {
      geometry.outers.forEach(poly => poly.forEach(pt => {
        minX = Math.min(minX, pt[0]); maxX = Math.max(maxX, pt[0]);
        minY = Math.min(minY, pt[1]); maxY = Math.max(maxY, pt[1]);
      }));
    } else if (activeMode === 'freedraw') {
      minX = -1; maxX = 1; minY = -1; maxY = 1;
    }

    const maxDim = Math.max(maxX - minX, maxY - minY, 0.1);
    const baseScale = (Math.min(W, H) * 0.8) / maxDim;
    const effectiveScale = baseScale * zoom;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    canvasTransformRef.current = { scale: effectiveScale, cx, cy };

    const toX = (x) => W / 2 + (x - cx) * effectiveScale + panOffset[0];
    const toY = (y) => H / 2 - (y - cy) * effectiveScale + panOffset[1];

    // --- Full-canvas adaptive grid (shown in both modes) ---
    {
      // Compute visible world bounds from canvas edges
      const worldXMin = cx + (-W / 2 - panOffset[0]) / effectiveScale;
      const worldXMax = cx + ( W / 2 - panOffset[0]) / effectiveScale;
      const worldYMax = cy + ( H / 2 + panOffset[1]) / effectiveScale; // screen top → world max Y
      const worldYMin = cy - ( H / 2 - panOffset[1]) / effectiveScale; // screen bot → world min Y

      // Adaptive spacing: target ~50px between lines
      const rawSpacing = 50 / effectiveScale;
      const mag = Math.pow(10, Math.floor(Math.log10(Math.max(rawSpacing, 1e-10))));
      const norm = rawSpacing / mag;
      const gridStep = norm < 1.5 ? mag : norm < 3.5 ? 2 * mag : norm < 7.5 ? 5 * mag : 10 * mag;

      const xStart = Math.floor(worldXMin / gridStep) * gridStep;
      const yStart = Math.floor(worldYMin / gridStep) * gridStep;

      // Minor grid lines
      ctx.strokeStyle = 'rgba(103, 114, 148, 0.15)'; // Tokyo Night subtle blue-gray
      ctx.lineWidth = 0.5;
      ctx.setLineDash([]);
      for (let x = xStart; x <= worldXMax + gridStep; x += gridStep) {
        const px = toX(x);
        ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
      }
      for (let y = yStart; y <= worldYMax + gridStep; y += gridStep) {
        const py = toY(y);
        ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke();
      }

      // Axes
      ctx.strokeStyle = 'rgba(103, 114, 148, 0.4)'; // Slightly more prominent than grid
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(toX(0), 0); ctx.lineTo(toX(0), H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, toY(0)); ctx.lineTo(W, toY(0)); ctx.stroke();
    }

    ctx.globalCompositeOperation = 'source-over';
    geometry.outers.forEach(poly => {
      if (poly.length < 3) return;
      ctx.beginPath();
      poly.forEach((pt, i) => i === 0 ? ctx.moveTo(toX(pt[0]), toY(pt[1])) : ctx.lineTo(toX(pt[0]), toY(pt[1])));
      ctx.closePath();
      ctx.fillStyle = 'rgba(37, 99, 235, 0.15)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#2563eb';
      ctx.stroke();
    });

    ctx.globalCompositeOperation = 'destination-out';
    geometry.holes.forEach(poly => {
      if (poly.length < 3) return;
      ctx.beginPath();
      poly.forEach((pt, i) => i === 0 ? ctx.moveTo(toX(pt[0]), toY(pt[1])) : ctx.lineTo(toX(pt[0]), toY(pt[1])));
      ctx.closePath();
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.fill();
    });

    ctx.globalCompositeOperation = 'source-over';
    geometry.holes.forEach(poly => {
      if (poly.length < 3) return;
      ctx.beginPath();
      poly.forEach((pt, i) => i === 0 ? ctx.moveTo(toX(pt[0]), toY(pt[1])) : ctx.lineTo(toX(pt[0]), toY(pt[1])));
      ctx.closePath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#dc2626';
      ctx.stroke();
    });

    if (results && results.A > 0) {
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.arc(toX(results.Cx), toY(results.Cy), 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(22, 163, 74, 0.4)';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1;
      const angleRad = results.alpha * (Math.PI / 180);
      const axL = maxDim * 0.4;
      ctx.beginPath();
      ctx.moveTo(toX(results.Cx - axL * Math.cos(angleRad)), toY(results.Cy - axL * Math.sin(angleRad)));
      ctx.lineTo(toX(results.Cx + axL * Math.cos(angleRad)), toY(results.Cy + axL * Math.sin(angleRad)));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(toX(results.Cx - axL * Math.cos(angleRad + Math.PI / 2)), toY(results.Cy - axL * Math.sin(angleRad + Math.PI / 2)));
      ctx.lineTo(toX(results.Cx + axL * Math.cos(angleRad + Math.PI / 2)), toY(results.Cy + axL * Math.sin(angleRad + Math.PI / 2)));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw draggable nodes for committed polygons
    if (activeMode === 'freedraw') {
      const drawNodes = (polys, baseColor) => {
        polys.forEach((poly, pi) => {
          poly.forEach((pt, ni) => {
            const isHov = hoveredNode && hoveredNode.type === baseColor && hoveredNode.pi === pi && hoveredNode.ni === ni;
            const isDrag = dragInfo && dragInfo.type === baseColor && dragInfo.pi === pi && dragInfo.ni === ni;
            const color = baseColor === 'outer' ? '#2563eb' : '#dc2626';
            ctx.beginPath();
            ctx.arc(toX(pt[0]), toY(pt[1]), isDrag ? 7 : isHov ? 6 : 4, 0, Math.PI * 2);
            ctx.fillStyle = isDrag ? '#f59e0b' : isHov ? '#ffffff' : color;
            ctx.fill();
            ctx.strokeStyle = isDrag ? '#d97706' : color;
            ctx.lineWidth = isDrag ? 2.5 : isHov ? 2.5 : 1;
            ctx.stroke();
          });
        });
      };
      drawNodes(fdOuters, 'outer');
      drawNodes(fdHoles, 'hole');
    }

    if (activeMode === 'freedraw' && fdCurrent.length > 0) {
      ctx.strokeStyle = fdTarget === 'outer' ? '#3b82f6' : '#ef4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(toX(fdCurrent[0][0]), toY(fdCurrent[0][1]));
      for (let i = 1; i < fdCurrent.length; i++) ctx.lineTo(toX(fdCurrent[i][0]), toY(fdCurrent[i][1]));
      if (mousePos) ctx.lineTo(toX(mousePos[0]), toY(mousePos[1]));
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = ctx.strokeStyle;
      fdCurrent.forEach(pt => {
        ctx.beginPath(); ctx.arc(toX(pt[0]), toY(pt[1]), 4, 0, Math.PI * 2); ctx.fill();
      });
    }

    // Live tool preview for circle / rect
    if (activeMode === 'freedraw' && mousePos && toolState) {
      const color = fdTarget === 'outer' ? '#3b82f6' : '#ef4444';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      if (drawTool === 'circle') {
        const r = Math.hypot(mousePos[0] - toolState.center[0], mousePos[1] - toolState.center[1]);
        const rPx = Math.max(1, r * effectiveScale);
        ctx.beginPath();
        ctx.arc(toX(toolState.center[0]), toY(toolState.center[1]), rPx, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(toX(toolState.center[0]), toY(toolState.center[1]), 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color + '88';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(toX(toolState.center[0]), toY(toolState.center[1]));
        ctx.lineTo(toX(mousePos[0]), toY(mousePos[1]));
        ctx.stroke();
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`R = ${r.toFixed(4)}m`, toX(mousePos[0]) + 10, toY(mousePos[1]) - 8);
      } else if (drawTool === 'rect') {
        const rx1 = Math.min(toX(toolState.corner1[0]), toX(mousePos[0]));
        const ry1 = Math.min(toY(toolState.corner1[1]), toY(mousePos[1]));
        const rw = Math.abs(toX(mousePos[0]) - toX(toolState.corner1[0]));
        const rh = Math.abs(toY(mousePos[1]) - toY(toolState.corner1[1]));
        ctx.strokeRect(rx1, ry1, rw, rh);
        ctx.setLineDash([]);
        ctx.fillStyle = color + '18';
        ctx.fillRect(rx1, ry1, rw, rh);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(toX(toolState.corner1[0]), toY(toolState.corner1[1]), 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 11px monospace';
        const wDim = Math.abs(mousePos[0] - toolState.corner1[0]);
        const hDim = Math.abs(mousePos[1] - toolState.corner1[1]);
        ctx.fillText(`${wDim.toFixed(4)} × ${hDim.toFixed(4)}m`, toX(mousePos[0]) + 10, toY(mousePos[1]) - 8);
      }
    }

    if (activeMode === 'freedraw' && mousePos) {
      ctx.font = 'bold 12px monospace';
      let text = `(${mousePos[0].toFixed(2)}, ${mousePos[1].toFixed(2)})`;
      if (fdCurrent.length > 0) {
        const lastPt = fdCurrent[fdCurrent.length - 1];
        const len = Math.hypot(mousePos[0] - lastPt[0], mousePos[1] - lastPt[1]);
        text += ` | L: ${len.toFixed(2)}m`;
      }
      const textWidth = ctx.measureText(text).width;
      let px = toX(mousePos[0]) + 15;
      let py = toY(mousePos[1]) - 15;
      if (px + textWidth + 10 > W) px = toX(mousePos[0]) - textWidth - 15;
      if (py < 20) py = toY(mousePos[1]) + 25;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(px - 4, py - 14, textWidth + 8, 20);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.strokeRect(px - 4, py - 14, textWidth + 8, 20);
      ctx.fillStyle = '#0f172a';
      ctx.fillText(text, px, py - 2);
    }
  }, [geometry, results, activeMode, fdCurrent, mousePos, fdTarget, zoom, panOffset, hoveredNode, dragInfo, fdOuters, fdHoles, toolState, drawTool]);

  const getRawPxPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    const W = canvas.width, H = canvas.height;
    return [(e.clientX - rect.left) / rect.width * W, (e.clientY - rect.top) / rect.height * H];
  };

  const worldToPx = (wx, wy) => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0];
    const W = canvas.width, H = canvas.height;
    const { scale, cx, cy } = canvasTransformRef.current;
    return [W / 2 + (wx - cx) * scale + panOffset[0], H / 2 - (wy - cy) * scale + panOffset[1]];
  };

  const getCanvasMousePos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0];
    const [px, py] = getRawPxPos(e);
    const W = canvas.width, H = canvas.height;
    const { scale, cx, cy } = canvasTransformRef.current;
    let wx = (px - W / 2 - panOffset[0]) / scale + cx;
    let wy = -((py - H / 2 - panOffset[1]) / scale) + cy;
    let snappedX = Math.round(wx * 20) / 20;
    let snappedY = Math.round(wy * 20) / 20;
    if (activeMode === 'freedraw' && fdCurrent.length > 0) {
      const lastPt = fdCurrent[fdCurrent.length - 1];
      const dx = Math.abs(snappedX - lastPt[0]);
      const dy = Math.abs(snappedY - lastPt[1]);
      if (dy < 0.08 && dx > 0.02) snappedY = lastPt[1];
      else if (dx < 0.08 && dy > 0.02) snappedX = lastPt[0];
    }
    return [snappedX, snappedY];
  };

  const findHitNode = (pxPos) => {
    const HIT = 10;
    for (let pi = 0; pi < fdOuters.length; pi++)
      for (let ni = 0; ni < fdOuters[pi].length; ni++) {
        const [nx, ny] = worldToPx(fdOuters[pi][ni][0], fdOuters[pi][ni][1]);
        if (Math.hypot(pxPos[0] - nx, pxPos[1] - ny) < HIT) return { type: 'outer', pi, ni };
      }
    for (let pi = 0; pi < fdHoles.length; pi++)
      for (let ni = 0; ni < fdHoles[pi].length; ni++) {
        const [nx, ny] = worldToPx(fdHoles[pi][ni][0], fdHoles[pi][ni][1]);
        if (Math.hypot(pxPos[0] - nx, pxPos[1] - ny) < HIT) return { type: 'hole', pi, ni };
      }
    return null;
  };

  const commitShape = (pts) => {
    if (fdTarget === 'outer') {
      if (!isOuterValid(pts, fdOuters)) { setFdError("Shape overlaps or touches an existing boundary."); return; }
      setFdOuters(prev => [...prev, pts]);
    } else {
      if (!isHoleValid(pts, fdOuters, fdHoles)) { setFdError("Hole must be strictly inside an outer boundary."); return; }
      setFdHoles(prev => [...prev, pts]);
    }
    setFdError("");
  };

  const handlePointerDown = (e) => {
    if (e.button === 1) {
      panStartRef.current = { x: e.clientX, y: e.clientY, pan: [...panOffset] };
      e.preventDefault(); return;
    }
    if (e.button !== 0) return;
    if (isPanMode) {
      panStartRef.current = { x: e.clientX, y: e.clientY, pan: [...panOffset] }; return;
    }
    if (activeMode === 'freedraw') {
      const hit = findHitNode(getRawPxPos(e));
      if (hit) { setDragInfo(hit); return; }
      const pos = getCanvasMousePos(e);
      setFdError("");
      if (drawTool === 'circle') {
        if (!toolState) {
          setToolState({ center: pos });
        } else {
          const r = Math.hypot(pos[0] - toolState.center[0], pos[1] - toolState.center[1]);
          if (r < 0.001) { setFdError("Circle radius too small."); setToolState(null); return; }
          commitShape(generateCircle(r, 48).map(([x, y]) => [x + toolState.center[0], y + toolState.center[1]]));
          setToolState(null);
        }
      } else if (drawTool === 'rect') {
        if (!toolState) {
          setToolState({ corner1: pos });
        } else {
          const c1 = toolState.corner1;
          if (Math.abs(pos[0]-c1[0]) < 0.001 || Math.abs(pos[1]-c1[1]) < 0.001) {
            setFdError("Rectangle is too small."); setToolState(null); return;
          }
          commitShape([[c1[0],c1[1]], [pos[0],c1[1]], [pos[0],pos[1]], [c1[0],pos[1]]]);
          setToolState(null);
        }
      } else {
        setFdCurrent(prev => [...prev, pos]);
      }
    }
  };

  const handlePointerMove = (e) => {
    if (panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPanOffset([panStartRef.current.pan[0] + dx, panStartRef.current.pan[1] + dy]);
      return;
    }
    if (dragInfo) {
      const newPos = getCanvasMousePos(e);
      if (dragInfo.type === 'outer')
        setFdOuters(prev => prev.map((poly, pi) =>
          pi === dragInfo.pi ? poly.map((pt, ni) => ni === dragInfo.ni ? newPos : pt) : poly));
      else
        setFdHoles(prev => prev.map((poly, pi) =>
          pi === dragInfo.pi ? poly.map((pt, ni) => ni === dragInfo.ni ? newPos : pt) : poly));
      return;
    }
    if (activeMode !== 'freedraw') return;
    setHoveredNode(findHitNode(getRawPxPos(e)) || null);
    setMousePos(getCanvasMousePos(e));
  };

  const handlePointerUp = () => { panStartRef.current = null; setDragInfo(null); };

  const handleWheel = (e) => {
    e.preventDefault();
    setZoom(z => Math.max(0.1, Math.min(20, z * (e.deltaY < 0 ? 1.15 : 1 / 1.15))));
  };

  const closePolygon = (e) => {
    e.preventDefault();
    if (activeMode !== 'freedraw') return;
    if (drawTool !== 'polygon') { setToolState(null); return; }
    if (fdCurrent.length < 3) return;
    commitPolygon();
  };

  const commitPolygon = () => {
    if (fdCurrent.length < 3) return;
    if (!isSimplePolygon(fdCurrent)) {
      setFdError("Polygon intersects itself or has zero-length edges. Shape discarded.");
      setFdCurrent([]); return;
    }
    if (fdTarget === 'outer') {
      if (!isOuterValid(fdCurrent, fdOuters)) {
        setFdError("Outer boundaries cannot overlap, touch boundaries, or intersect each other.");
        setFdCurrent([]); return;
      }
      setFdOuters(prev => [...prev, fdCurrent]);
    } else {
      if (!isHoleValid(fdCurrent, fdOuters, fdHoles)) {
        setFdError("Holes must be entirely strictly inside an outer boundary and cannot touch or overlap each other.");
        setFdCurrent([]); return;
      }
      setFdHoles(prev => [...prev, fdCurrent]);
    }
    setFdCurrent([]); setMousePos(null);
  };

  const handleAddCircle = () => {
    const center = mousePos || [0, 0];
    const r = Math.max(0.005, fdCircleR);
    const circle = generateCircle(r, 48).map(([x, y]) => [x + center[0], y + center[1]]);
    if (fdTarget === 'outer') {
      if (!isOuterValid(circle, fdOuters)) { setFdError("Circle overlaps or touches an existing boundary."); return; }
      setFdOuters(prev => [...prev, circle]);
    } else {
      if (!isHoleValid(circle, fdOuters, fdHoles)) { setFdError("Circle hole must be strictly inside an outer boundary."); return; }
      setFdHoles(prev => [...prev, circle]);
    }
    setFdError("");
  };

  const handleParamInput = (key, val) => {
    setRawParams(p => ({ ...p, [key]: val }));
  };

  const handlePrintReport = () => {
    if (!canvasRef.current || !results || isSolvingTorsion) return;
    const imgData = canvasRef.current.toDataURL('image/png');

    const inputsHtml = activeMode === 'parametric'
      ? SHAPE_DEFS[sectionType].inputs.map(k => `<p><strong>${PARAM_LABELS[k] || k}:</strong> ${params[k]} m</p>`).join('')
      : '';

    const jReportValue = torsionData?.J == null ? "N/A" : formatNum(torsionData.J);
    const cwReportValue = torsionData?.Cw == null ? "N/A" : formatNum(torsionData.Cw);

    const reportHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Section Property Pro Report</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #0f172a; max-width: 800px; margin: auto; }
          h1 { border-bottom: 4px solid #0f172a; padding-bottom: 10px; text-transform: uppercase; letter-spacing: 2px; font-size: 24px;}
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 40px; }
          img { max-width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; background: #fafafa; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 40px; font-size: 13px;}
          th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
          th { background: #f8fafc; text-transform: uppercase; font-size: 11px; color: #64748b; letter-spacing: 1px;}
          .text-right { text-align: right; }
          .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: bold; }
          .page-break { page-break-before: always; }
          .box { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; font-family: monospace; margin-bottom: 20px; font-size: 13px;}
        </style>
      </head>
      <body>
        <h1>Section Property Pro Report</h1>
        <p style="color: #64748b; font-weight: bold; font-size: 14px; margin-top: -10px; margin-bottom: 40px;">Generated by Section Property Pro</p>

        <div class="grid">
          <div>
            <h2 style="font-size: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Geometry Definition</h2>
            <p><strong>Method:</strong> ${activeMode === 'parametric' ? SHAPE_DEFS[sectionType].name : 'Custom Free Draw'}</p>
            ${inputsHtml}
          </div>
          <div style="text-align: center;">
            <img src="${imgData}" alt="Section Preview" />
          </div>
        </div>

        <h2 style="font-size: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Calculated Properties</h2>
        <table>
          <tr><th>Property</th><th>Symbol</th><th class="text-right">Value</th><th>Unit</th></tr>
          <tr><td>Area</td><td><i>A</i></td><td class="text-right mono">${formatNum(results?.A)}</td><td>m²</td></tr>
          <tr><td>Centroid X</td><td><i>Cx</i></td><td class="text-right mono">${formatNum(results?.Cx)}</td><td>m</td></tr>
          <tr><td>Centroid Y</td><td><i>Cy</i></td><td class="text-right mono">${formatNum(results?.Cy)}</td><td>m</td></tr>
          <tr><td>Moment of Inertia (X)</td><td><i>Ix</i></td><td class="text-right mono">${formatNum(results?.Ix)}</td><td>m⁴</td></tr>
          <tr><td>Moment of Inertia (Y)</td><td><i>Iy</i></td><td class="text-right mono">${formatNum(results?.Iy)}</td><td>m⁴</td></tr>
          <tr><td>Product of Inertia</td><td><i>Ixy</i></td><td class="text-right mono">${formatNum(results?.Ixy)}</td><td>m⁴</td></tr>
          <tr><td>Polar Area Moment</td><td><i>Ip</i></td><td class="text-right mono">${formatNum(results?.Ip)}</td><td>m⁴</td></tr>
          <tr><td>Torsional Constant*</td><td><i>J</i></td><td class="text-right mono">${jReportValue}</td><td>${torsionData?.J == null ? "" : "m⁴"}</td></tr>
          <tr><td>Warping Constant*</td><td><i>Cw</i></td><td class="text-right mono">${cwReportValue}</td><td>${torsionData?.Cw == null ? "" : "m⁶"}</td></tr>
          <tr><td>Principal Axis 1</td><td><i>I1</i></td><td class="text-right mono">${formatNum(results?.I1)}</td><td>m⁴</td></tr>
          <tr><td>Principal Axis 2</td><td><i>I2</i></td><td class="text-right mono">${formatNum(results?.I2)}</td><td>m⁴</td></tr>
          <tr><td>Principal Angle**</td><td><i>&alpha;</i></td><td class="text-right mono">${formatNum(results?.alpha)}</td><td>deg</td></tr>
          <tr><td>Section Modulus (Top)</td><td><i>Sx,top</i></td><td class="text-right mono">${formatNum(results?.SxTop)}</td><td>m³</td></tr>
          <tr><td>Section Modulus (Bottom)</td><td><i>Sx,bot</i></td><td class="text-right mono">${formatNum(results?.SxBot)}</td><td>m³</td></tr>
          <tr><td>Section Modulus (Right)</td><td><i>Sy,right</i></td><td class="text-right mono">${formatNum(results?.SyRight)}</td><td>m³</td></tr>
          <tr><td>Section Modulus (Left)</td><td><i>Sy,left</i></td><td class="text-right mono">${formatNum(results?.SyLeft)}</td><td>m³</td></tr>
          <tr><td>Radius of Gyration (X)</td><td><i>rx</i></td><td class="text-right mono">${formatNum(results?.rx)}</td><td>m</td></tr>
          <tr><td>Radius of Gyration (Y)</td><td><i>ry</i></td><td class="text-right mono">${formatNum(results?.ry)}</td><td>m</td></tr>
        </table>
        <p style="font-size: 11px; color: #64748b;">* Torsional constant (J) & Warping Constant (Cw) use thin-walled approximations where appropriate. In free-draw and specific library types, they are numerically estimated using a discretized 2D Saint-Venant warping model. Closed circular sections are treated as explicitly warping-free.</p>
        <p style="font-size: 11px; color: #64748b;">** Principal angle &alpha; is measured from the global x-axis to the major principal axis (I1), positive counterclockwise.</p>

        <div class="page-break"></div>
        <h2 style="font-size: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Mathematical Formulations</h2>
        <p style="font-size: 13px; line-height: 1.6;">Polygonal section properties are computed exactly using Green's Theorem boundary integration. Curved boundaries are approximated by high-density polygons for visualization, but standard circular shapes (Solid Circle & Pipe) use exact analytical formulas for reporting.</p>
        <div class="box">
          A = 1/2 * Σ(x_i * y_{i+1} - x_{i+1} * y_i)<br/>
          C_x = 1/(6A) * Σ(x_i + x_{i+1}) * (x_i * y_{i+1} - x_{i+1} * y_i)<br/>
          I_x = 1/12 * Σ(y_i² + y_i*y_{i+1} + y_{i+1}²) * (x_i * y_{i+1} - x_{i+1} * y_i)<br/>
          I_xy = 1/24 * Σ(x_i * y_{i+1} - x_{i+1} * y_i) * (x_i * y_{i+1} + 2 x_i y_i + 2 x_{i+1} y_{i+1} + x_{i+1} y_i)<br/>
          ∇²ω = 0 (Solved via FEM for J)<br/>
          Γ = I_ω - (Q_ω² / A) - y_s I_xω + x_s I_yω
        </div>
        
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;

    const blob = new Blob([reportHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'SectionProp_Report.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-950 text-slate-100 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">

        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900 p-6 md:p-8 rounded-[2.5rem] border-2 border-slate-800">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3 text-white">
              <div className="bg-sky-500 p-2 rounded-xl text-slate-950 shadow-lg">
                <Zap size={24} fill="currentColor" />
              </div>
              Section Property Pro
            </h1>
            <p className="text-slate-400 font-medium text-sm">Interactive Section Geometry Evaluator</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handlePrintReport}
              disabled={!results || isSolvingTorsion}
              className="flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-slate-950 px-8 py-3 rounded-2xl font-bold transition-all shadow-lg active:scale-95"
            >
              <FileDown size={18} /> Download Report
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <aside className="lg:col-span-4 space-y-6">

            <div className="bg-slate-800 p-1.5 rounded-2xl flex font-bold text-sm shadow-inner">
              <button
                onClick={() => setActiveMode('parametric')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${activeMode === 'parametric' ? 'bg-sky-500 shadow-sm text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <Layers size={16} /> Library
              </button>
              <button
                onClick={() => setActiveMode('freedraw')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${activeMode === 'freedraw' ? 'bg-sky-500 shadow-sm text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <PenTool size={16} /> Free Draw
              </button>
            </div>

            {activeMode === 'parametric' ? (
              <div className="bg-slate-900 p-6 rounded-3xl border-2 border-slate-800 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 flex items-center gap-2">
                    <Box size={14} /> Section Type
                  </label>
                  <select
                    value={sectionType}
                    onChange={e => setSectionType(e.target.value)}
                    className="w-full bg-slate-950 border-2 border-slate-700 text-white font-bold p-3 rounded-xl appearance-none cursor-pointer outline-sky-500"
                  >
                    {Object.keys(SHAPE_DEFS).map(key => (
                      <option key={key} value={key}>{SHAPE_DEFS[key].name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-5 pt-4 border-t border-slate-800">
                  {SHAPE_DEFS[sectionType].inputs.map(key => {
                    const meta = PARAM_META[key] || { min: 0.01, max: 2, step: 0.01 };
                    return (
                      <div key={key} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-slate-400 tracking-wide uppercase">
                            {PARAM_LABELS[key] || key.toUpperCase()}
                          </label>
                          <div className="flex items-center gap-1 bg-slate-800 rounded p-1">
                            <input
                              type="number" step={meta.step} value={rawParams[key]}
                              onChange={e => handleParamInput(key, e.target.value)}
                              className="w-16 bg-transparent border-none text-right font-mono text-xs font-bold text-sky-400 focus:outline-none"
                            />
                            <span className="text-xs text-slate-400 font-medium mr-1">m</span>
                          </div>
                        </div>
                        <input
                          type="range" min={meta.min} max={meta.max} step={meta.step}
                          value={params[key]}
                          onChange={e => handleParamInput(key, e.target.value)}
                          className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 p-6 rounded-3xl border-2 border-slate-800 space-y-6">
                <div className="bg-sky-950 border border-sky-800 p-4 rounded-2xl">
                  <h3 className="text-sm font-bold text-sky-300 flex items-center gap-2 mb-2"><MousePointerSquareDashed size={16} /> Drawing Guide</h3>
                  <ul className="text-xs text-sky-200 space-y-1 list-disc pl-4">
                    <li>Tap / Click canvas to place points.</li>
                    <li>Move near axis lines to <strong>Ortho-Snap</strong>.</li>
                    <li>Use buttons below to finish or undo.</li>
                    <li><strong>Notice:</strong> Polygons must not self-intersect, overlap, or touch edges.</li>
                  </ul>
                </div>

                <div className="space-y-3 pt-2">
                  <button
                    onClick={() => setFdTarget('outer')}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all font-bold ${fdTarget === 'outer' ? 'border-sky-500 bg-sky-950 text-sky-300' : 'border-slate-700 hover:border-slate-600 text-slate-400'}`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 ${fdTarget === 'outer' ? 'border-sky-500 bg-sky-400' : 'border-slate-600'}`}></div>
                    Draw Boundary
                  </button>
                  <button
                    onClick={() => setFdTarget('hole')}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all font-bold ${fdTarget === 'hole' ? 'border-red-500 bg-red-950 text-red-300' : 'border-slate-700 hover:border-slate-600 text-slate-400'}`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 ${fdTarget === 'hole' ? 'border-red-500 bg-red-400' : 'border-slate-600'}`}></div>
                    Draw Hole / Cutout
                  </button>
                </div>

                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Draw Tool</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      id="tool-polygon-btn"
                      onClick={() => { setDrawTool('polygon'); setToolState(null); setFdCurrent([]); }}
                      className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 text-xs font-bold transition-all ${drawTool === 'polygon' ? 'border-sky-500 bg-sky-950 text-sky-300' : 'border-slate-700 hover:border-slate-600 text-slate-500'}`}
                    >
                      <PenTool size={16} /> Polygon
                    </button>
                    <button
                      id="tool-circle-btn"
                      onClick={() => { setDrawTool('circle'); setToolState(null); setFdCurrent([]); }}
                      className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 text-xs font-bold transition-all ${drawTool === 'circle' ? 'border-violet-500 bg-violet-950 text-violet-300' : 'border-slate-700 hover:border-slate-600 text-slate-500'}`}
                    >
                      <span className="text-base leading-none">◯</span> Circle
                    </button>
                    <button
                      id="tool-rect-btn"
                      onClick={() => { setDrawTool('rect'); setToolState(null); setFdCurrent([]); }}
                      className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 text-xs font-bold transition-all ${drawTool === 'rect' ? 'border-amber-500 bg-amber-950 text-amber-300' : 'border-slate-700 hover:border-slate-600 text-slate-500'}`}
                    >
                      <Box size={16} /> Rect
                    </button>
                  </div>
                  {drawTool === 'polygon' && !toolState && (
                    <p className="text-[10px] text-slate-400 leading-relaxed">Click canvas to place vertices. Right-click or press Finish to close shape.</p>
                  )}
                  {drawTool === 'circle' && (
                    <p className={`text-[10px] leading-relaxed font-medium ${toolState ? 'text-violet-600' : 'text-slate-400'}`}>
                      {toolState ? '● Center set — move cursor to grow radius, click to confirm.' : 'Click canvas to place circle center.'}
                    </p>
                  )}
                  {drawTool === 'rect' && (
                    <p className={`text-[10px] leading-relaxed font-medium ${toolState ? 'text-amber-600' : 'text-slate-400'}`}>
                      {toolState ? '■ Corner set — move cursor to size rectangle, click to confirm.' : 'Click canvas to place first corner.'}
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-800 grid grid-cols-2 gap-2">
                  {drawTool === 'polygon' && (
                    <>
                    <button
                      onClick={commitPolygon}
                      disabled={fdCurrent.length < 3}
                      className="flex items-center justify-center gap-2 p-3 rounded-xl bg-green-900 hover:bg-green-800 disabled:bg-slate-800 disabled:text-slate-600 text-green-300 font-bold transition-colors"
                    >
                      <CheckCircle size={16} /> Finish Shape
                    </button>
                    <button
                      onClick={() => setFdCurrent(prev => prev.slice(0, -1))}
                      disabled={fdCurrent.length === 0}
                      className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:text-slate-600 text-slate-300 font-bold transition-colors"
                    >
                      <Undo2 size={16} /> Undo Point
                    </button>
                    </>
                  )}
                  {(drawTool === 'circle' || drawTool === 'rect') && toolState && (
                    <button
                      onClick={() => setToolState(null)}
                      className="col-span-2 flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors"
                    >
                      <Undo2 size={16} /> Cancel
                    </button>
                  )}
                  <button
                    onClick={() => { setFdOuters([]); setFdHoles([]); setFdCurrent([]); setFdError(""); setTorsionData(null); }}
                    className="col-span-2 flex items-center justify-center gap-2 p-3 rounded-xl bg-red-950 hover:bg-red-900 text-red-400 font-bold transition-colors"
                  >
                    <Trash2 size={16} /> Clear Entire Canvas
                  </button>
                </div>
              </div>
            )}
          </aside>

          <main className="lg:col-span-8 space-y-6">
            <div className="bg-slate-900 rounded-3xl border-2 border-slate-800 overflow-hidden flex flex-col min-h-[450px]">
              <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap gap-y-2 justify-between items-center">
                <span className="text-sm font-bold flex items-center gap-2 text-slate-300"><Maximize size={16} /> Interactive Canvas</span>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex gap-3 text-xs font-bold text-slate-500">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-sky-500"></div> Solid</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Void</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> Centroid</span>
                  </div>
                  <div className="flex gap-1 pl-3 border-l border-slate-800">
                    <button id="zoom-in-btn" onClick={() => setZoom(z => Math.min(20, z * 1.25))} title="Zoom In" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-300 font-black text-lg">+</button>
                    <button id="zoom-out-btn" onClick={() => setZoom(z => Math.max(0.1, z / 1.25))} title="Zoom Out" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-300 font-black text-lg">−</button>
                    <button id="zoom-reset-btn" onClick={() => { setZoom(1); setPanOffset([0, 0]); }} title="Reset View" className="px-2 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 font-bold text-xs">Reset</button>
                    <button id="pan-mode-btn" onClick={() => setIsPanMode(p => !p)} title="Pan Mode" className={`px-2 h-8 flex items-center justify-center rounded-lg font-bold text-xs transition-colors ${isPanMode ? 'bg-sky-900 text-sky-200 ring-1 ring-sky-600' : 'hover:bg-slate-800 text-slate-400'}`}>Pan</button>
                    <span className="text-xs text-slate-500 self-center font-mono pl-1">{Math.round(zoom * 100)}%</span>
                  </div>
                </div>
              </div>
              <div
                className={`flex-1 flex items-center justify-center bg-[#1a1b26] relative ${isPanMode ? 'cursor-grab' : activeMode === 'freedraw' ? (hoveredNode ? 'cursor-move' : 'cursor-crosshair') : ''}`}
                style={{ touchAction: 'none' }}
                onPointerMove={handlePointerMove}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onContextMenu={closePolygon}
                onPointerLeave={() => { setMousePos(null); setHoveredNode(null); }}
                onWheel={handleWheel}
              >
                <canvas ref={canvasRef} width={800} height={600} className="w-full h-auto max-w-full" />
              </div>
            </div>

            {geometry.error && (
              <div className="bg-red-950 border border-red-800 text-red-300 p-6 rounded-3xl flex items-center gap-4">
                <AlertCircle size={24} />
                <div>
                  <p className="font-bold">Invalid Geometry Parameter</p>
                  <p className="text-sm">{geometry.error}</p>
                </div>
              </div>
            )}

            {activeMode === 'freedraw' && fdError && (
              <div className="bg-red-950 border border-red-800 text-red-300 p-6 rounded-3xl flex items-center gap-4">
                <AlertCircle size={24} />
                <div>
                  <p className="font-bold">Drawing Error</p>
                  <p className="text-sm">{fdError}</p>
                </div>
              </div>
            )}

            {!results && !geometry.error && !fdError && (
              <div className="bg-amber-950 border border-amber-800 text-amber-300 p-6 rounded-3xl flex items-center gap-4">
                <Info size={24} />
                <div>
                  <p className="font-bold">No Valid Geometry Detected</p>
                  <p className="text-sm">Draw a closed polygon or ensure parameters yield non-zero area.</p>
                </div>
              </div>
            )}

            {results && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                <section className="bg-slate-900 p-5 rounded-3xl border-2 border-slate-800 space-y-2">
                  <h3 className="text-[10px] font-black uppercase text-sky-400 tracking-widest mb-3 flex items-center gap-2">
                    <Box size={12} /> Basic Geometry
                  </h3>
                  <ResultRow label="Total Area (A)" value={formatNum(results.A)} unit="m²" highlight />
                  <ResultRow label="Centroid (Cx)" value={formatNum(results.Cx)} unit="m" />
                  <ResultRow label="Centroid (Cy)" value={formatNum(results.Cy)} unit="m" />
                  <ResultRow label="Radius Gyr. (rx)" value={formatNum(results.rx)} unit="m" />
                  <ResultRow label="Radius Gyr. (ry)" value={formatNum(results.ry)} unit="m" />
                </section>

                <section className="bg-slate-900 p-5 rounded-3xl border-2 border-slate-800 space-y-2">
                  <h3 className="text-[10px] font-black uppercase text-sky-400 tracking-widest mb-3 flex items-center gap-2">
                    <Zap size={12} /> Inertial Properties
                  </h3>
                  <ResultRow label="Inertia (Ix)" value={formatNum(results.Ix)} unit="m⁴" highlight />
                  <ResultRow label="Inertia (Iy)" value={formatNum(results.Iy)} unit="m⁴" highlight />
                  <ResultRow label="Product Inert. (Ixy)" value={formatNum(results.Ixy)} unit="m⁴" />
                  <ResultRow label="Polar Area Mom. (Ip)" value={formatNum(results.Ip)} unit="m⁴" />
                  <ResultRow
                    label="Torsion Const. (J*)"
                    value={isSolvingTorsion ? "Solving..." : (torsionData?.J == null ? "N/A" : formatNum(torsionData.J))}
                    unit={(isSolvingTorsion || torsionData?.J == null) ? "" : "m⁴"}
                    highlight
                    warning={torsionData?.warnings?.length > 0 ? torsionData.warnings.join(' | ') : null}
                  />
                  <ResultRow
                    label="Warping Const. (Cw*)"
                    value={isSolvingTorsion ? "Solving..." : (torsionData?.Cw == null ? "N/A" : formatNum(torsionData.Cw))}
                    unit={(isSolvingTorsion || torsionData?.Cw == null) ? "" : "m⁶"}
                    warning={torsionData?.warnings?.length > 0 ? torsionData.warnings.join(' | ') : null}
                  />
                  <ResultRow label="Principal (I1)" value={formatNum(results.I1)} unit="m⁴" />
                  <ResultRow label="Principal (I2)" value={formatNum(results.I2)} unit="m⁴" />
                  <ResultRow label="Princ. Angle (α**)" value={formatNum(results.alpha)} unit="°" />
                  <div className="text-[10px] text-slate-400 mt-2 leading-tight space-y-1">
                    <p>* Torsion (J) & Warping (Cw) analytically approximated for library. For free-draw, solved via FEM warping solver. Disconnected shapes yield N/A.</p>
                    <p>** Principal angle α is measured from global x-axis to major principal axis (I1), positive counterclockwise.</p>
                  </div>
                </section>

                <section className="bg-slate-900 p-5 rounded-3xl border-2 border-slate-800 space-y-2 lg:col-span-1 md:col-span-2">
                  <h3 className="text-[10px] font-black uppercase text-sky-400 tracking-widest mb-3 flex items-center gap-2">
                    <Layers size={12} /> Section Moduli (Elastic)
                  </h3>
                  <div className="grid grid-cols-1 gap-2">
                    <ResultRow label="Sx (Top)" value={formatNum(results.SxTop)} unit="m³" />
                    <ResultRow label="Sx (Bottom)" value={formatNum(results.SxBot)} unit="m³" />
                    <ResultRow label="Sy (Right)" value={formatNum(results.SyRight)} unit="m³" />
                    <ResultRow label="Sy (Left)" value={formatNum(results.SyLeft)} unit="m³" />
                  </div>

                  {/* DIAGNOSTICS FOR FREE DRAW */}
                  {activeMode === 'freedraw' && torsionData && (
                    <div className="mt-4 p-3 bg-slate-800 border border-slate-700 rounded-xl">
                      <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wide">FEM Diagnostics</p>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-slate-300">
                        <div className="flex justify-between"><span>Nodes:</span> <span className="font-mono">{torsionData.nodeCount}</span></div>
                        <div className="flex justify-between"><span>Elements:</span> <span className="font-mono">{torsionData.elementCount}</span></div>
                        <div className="flex justify-between"><span>Components:</span> <span className="font-mono">{torsionData.components}</span></div>
                        <div className="flex justify-between"><span>Converged:</span> <span className="font-mono">{torsionData.converged ? 'Yes' : 'No'}</span></div>
                        <div className="flex justify-between"><span>Iterations:</span> <span className="font-mono">{torsionData.iterations}</span></div>
                        <div className="flex justify-between"><span>Residual:</span> <span className="font-mono">{torsionData.residual?.toExponential(2)}</span></div>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}