// Traffic: road graph, stoplight cycle, signal poles stay off the asphalt, new + widened roads keep clear of plots/buildings.
// usage: node tests/world/traffic.test.mjs
import assert from 'node:assert/strict';
import { buildGraph, poleSpot, lightAt } from '../../js/world/traffic.js';
import { roadD, POLE_R, NEW_ROADS, ALL_ROADS } from '../../js/world/layout.js';
import { obstacles, clearance } from '../../tools/road-clear.mjs';
const G = buildGraph();
assert.ok(G.nodes.length > 200 && G.edges.length > 600, 'graph has the road network');
const sig = G.nodes.filter((n) => n.signal); assert.ok(sig.length > 150, 'many signalised junctions');
for (const e of G.edges) { assert.ok(e.a.out.includes(e), 'edge listed on its start node'); assert.ok(e.len > 0); }
// the two axes never both green; every axis gets green, yellow and red each cycle
for (let t = 0; t < 26.4; t += 0.1) { const a = lightAt(0, t), b = lightAt(1, t); assert.ok(!(a !== 'r' && b !== 'r'), 'conflicting green/yellow at t=' + t.toFixed(1)); }
for (const ax of [0, 1]) { const seen = new Set(); for (let t = 0; t < 26.4; t += 0.1) seen.add(lightAt(ax, t)); assert.deepEqual([...seen].sort(), ['g', 'r', 'y']); }
// poles: on the sidewalk corner, never in any road
let poles = 0; for (const e of G.edges) { if (!e.b.signal) continue; const q = poleSpot(e); if (!q) continue; const p = Array.isArray(q) ? { x: q[0], z: q[1] } : q; poles++; assert.ok(roadD(p.x, p.z) >= POLE_R - 1e-6, `pole in road at ${p.x.toFixed(1)},${p.z.toFixed(1)} (${roadD(p.x, p.z).toFixed(2)})`); }
assert.ok(poles > 300, 'poles placed: ' + poles);
// new roads + widened boulevards/highways do not cut plots, the theater, Kemy Kustoms, the hall, the station, estates or the mansion yard
const obs = obstacles(); const ids = new Set([...NEW_ROADS.map((r) => r.id), 'pc', 'pd', 'S1650', 'S2150', 'S2650', 'S3150', 'SB', 'SE', 'SM', 'SN', 'SW', 'W2', 'W3', 'W4', 'W5']);
for (const r of ALL_ROADS()) if (ids.has(r.id)) { const c = clearance(r, obs); assert.ok(c.d > 0, `${r.id} cuts ${c.who} (${c.d})`); }
console.log('traffic ok:', G.nodes.length, 'nodes', G.edges.length, 'edges', sig.length, 'signals', poles, 'poles');
