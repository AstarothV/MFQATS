'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VIEWS } from './PhotoSet';
import type { Pin } from './ModelDefectsView';

// "Edit mode", like Blender's: the model as plain faces with an even square grid drawn over its surface, and the faces where the
// photo scans found a defect painted in the defect's colour. A defect is placed by casting a ray from the side its photo
// was taken from (front = +z, glTF's convention) onto the mesh, so it lands on the real surface; the position is
// approximate, because a photo also shows the background.

const SEVERITY_RGB: Record<string, [number, number, number]> = {
  critical: [0.94, 0.27, 0.27], high: [0.94, 0.27, 0.27], medium: [0.96, 0.62, 0.04], low: [0.13, 0.77, 0.37],
};
const RANK: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 3 };
const BASE_RGB: [number, number, number] = [0.62, 0.62, 0.66];
// direction each photo looks along, from outside the piece (VIEWS: Front, Left, Back, Right, Top, Bottom)
const SIDE_NORMAL = [[0, 0, 1], [-1, 0, 0], [0, 0, -1], [1, 0, 0], [0, 1, 0], [0, -1, 0]];
const GRID_CELLS = 24; // grid squares along the model's longest side

// An even square grid on the surface, drawn by the GPU: each point uses the two world axes its face is most
// square-on to, so the squares stay the same size however the model's triangles are cut.
function gridMaterial(cell: number) {
  return new THREE.ShaderMaterial({
    uniforms: { cell: { value: cell }, color: { value: new THREE.Color(0x15151c) } },
    vertexShader: `
      varying vec3 vPos; varying vec3 vNormal;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vPos = world.xyz; vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      uniform float cell; uniform vec3 color;
      varying vec3 vPos; varying vec3 vNormal;
      void main() {
        vec3 n = abs(normalize(vNormal));
        vec2 uv = (n.x > n.y && n.x > n.z) ? vPos.yz : (n.y > n.z ? vPos.xz : vPos.xy);
        vec2 g = uv / cell;
        vec2 d = abs(fract(g - 0.5) - 0.5) / max(fwidth(g), vec2(1e-5));
        float a = 1.0 - min(min(d.x, d.y), 1.0);
        if (a < 0.05) discard;
        gl_FragColor = vec4(color, a * 0.75);
      }`,
    transparent: true,
    depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, // just in front of the faces
  });
}

function sidePoint({ slot, u, v }: Pin, lo: THREE.Vector3, hi: THREE.Vector3): THREE.Vector3 {
  const at = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));
  const down = at(hi.y, lo.y, v);
  const p = [
    [at(lo.x, hi.x, u), down, hi.z], [lo.x, down, at(lo.z, hi.z, u)], [at(hi.x, lo.x, u), down, lo.z],
    [hi.x, down, at(hi.z, lo.z, u)], [at(lo.x, hi.x, u), hi.y, at(lo.z, hi.z, v)], [at(lo.x, hi.x, u), lo.y, at(hi.z, lo.z, v)],
  ][slot];
  return new THREE.Vector3(p[0], p[1], p[2]);
}

export default function EditModeView({ modelUrl, pins }: { modelUrl: string; pins: Pin[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState<{ n: number; label: string; side: string; severity: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  // the page builds a new pins array on every render: rebuild the scene only when the defects themselves change
  const pinsKey = JSON.stringify(pins);
  const pinsRef = useRef(pins);
  pinsRef.current = pins;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let frame = 0;
    let disposed = false;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b0b0f');
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x303040, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(2, 4, 3);
    scene.add(sun);

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    new GLTFLoader().load(modelUrl, (gltf) => {
      if (disposed) return;
      gltf.scene.updateMatrixWorld(true);
      // every mesh as plain triangles in world space, so each face can get its own colour
      const meshes: THREE.Mesh[] = [];
      gltf.scene.traverse((o) => {
        if (!(o as THREE.Mesh).isMesh) return;
        const g = ((o as THREE.Mesh).geometry as THREE.BufferGeometry).toNonIndexed();
        g.applyMatrix4(o.matrixWorld);
        g.computeVertexNormals();
        const colors = new Float32Array(g.attributes.position.count * 3);
        for (let i = 0; i < colors.length; i += 3) colors.set(BASE_RGB, i);
        g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true,
          polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
        meshes.push(mesh);
        scene.add(mesh);
      });
      if (!meshes.length) { setError('This model has no surfaces to show.'); return; }

      const box = new THREE.Box3();
      meshes.forEach((m) => box.expandByObject(m));
      const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
      const diag = size.length();
      const grid3d = gridMaterial(Math.max(size.x, size.y, size.z) / GRID_CELLS);
      meshes.forEach((m) => scene.add(new THREE.Mesh(m.geometry, grid3d)));
      const grid = new THREE.GridHelper(diag * 2, 20, 0x3a3a48, 0x24242e);
      grid.position.set(center.x, box.min.y, center.z);
      scene.add(grid);
      camera.position.copy(center).add(new THREE.Vector3(diag * 0.8, diag * 0.6, diag * 1.25));
      controls.target.copy(center);
      controls.update();

      // paint each defect onto the faces around the spot where its ray meets the mesh
      const ray = new THREE.Raycaster();
      // where a ray slips through a gap (between legs, under a seat), use the part of the mesh nearest to the spot
      const nearestOnMesh = (q: THREE.Vector3) => {
        let best = Infinity; const point = new THREE.Vector3(); let mesh = 0, face = 0;
        meshes.forEach((m, mi) => {
          const pos = m.geometry.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < pos.count; i++) {
            const d = (pos.getX(i) - q.x) ** 2 + (pos.getY(i) - q.y) ** 2 + (pos.getZ(i) - q.z) ** 2;
            if (d < best) { best = d; point.set(pos.getX(i), pos.getY(i), pos.getZ(i)); mesh = mi; face = Math.floor(i / 3); }
          }
        });
        return { point, mesh, face };
      };
      const rank = meshes.map((m) => new Uint8Array(m.geometry.attributes.position.count / 3));
      const result: typeof placed = [];
      pinsRef.current.forEach((pin, i) => {
        const n = new THREE.Vector3(...(SIDE_NORMAL[pin.slot] as [number, number, number]));
        const onSide = sidePoint(pin, box.min, box.max);
        ray.set(onSide.clone().addScaledVector(n, diag * 0.5), n.clone().negate());
        const hit = ray.intersectObjects(meshes, false)[0];
        const near = hit ? { point: hit.point, mesh: meshes.indexOf(hit.object as THREE.Mesh), face: hit.faceIndex ?? -1 } : nearestOnMesh(onSide);
        const spot = near.point;
        const span = Math.max(pin.w ?? 0, pin.h ?? 0) * Math.max(size.x, size.y, size.z);
        const radius = Math.min(diag * 0.15, Math.max(diag * 0.035, span / 2));
        const rgb = SEVERITY_RGB[pin.severity] ?? SEVERITY_RGB.high, r = RANK[pin.severity] ?? 3;
        meshes.forEach((m, mi) => {
          const pos = m.geometry.attributes.position as THREE.BufferAttribute, col = m.geometry.attributes.color as THREE.BufferAttribute;
          for (let t = 0; t < pos.count / 3; t++) {
            const cx = (pos.getX(t * 3) + pos.getX(t * 3 + 1) + pos.getX(t * 3 + 2)) / 3;
            const cy = (pos.getY(t * 3) + pos.getY(t * 3 + 1) + pos.getY(t * 3 + 2)) / 3;
            const cz = (pos.getZ(t * 3) + pos.getZ(t * 3 + 1) + pos.getZ(t * 3 + 2)) / 3;
            const landed = mi === near.mesh && t === near.face; // the face the defect landed on, however large it is
            if ((!landed && (cx - spot.x) ** 2 + (cy - spot.y) ** 2 + (cz - spot.z) ** 2 > radius * radius) || rank[mi][t] > r) continue;
            rank[mi][t] = r; // a worse defect is never painted over by a milder one
            for (let k = 0; k < 3; k++) col.setXYZ(t * 3 + k, rgb[0], rgb[1], rgb[2]);
          }
          col.needsUpdate = true;
        });
        result.push({ n: i + 1, label: pin.label, side: VIEWS[pin.slot], severity: pin.severity });
      });
      setPlaced(result);
    }, undefined, () => !disposed && setError('The model could not be opened in edit mode.'));

    const tick = () => { controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(tick); };
    tick();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        const any = o as THREE.Mesh;
        any.geometry?.dispose?.();
        (Array.isArray(any.material) ? any.material : [any.material]).forEach((m) => m?.dispose?.());
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [modelUrl, pinsKey]);

  const dot = (s: string) => ({ high: 'bg-[#EF4444]', critical: 'bg-[#EF4444]', medium: 'bg-[#F59E0B]', low: 'bg-[#22C55E]' }[s] ?? 'bg-[#EF4444]');
  return (
    <div className="absolute inset-0">
      <div ref={hostRef} className="h-full w-full" aria-label="3D model in edit mode: its surface grid, with the faces where defects were found painted" role="img" />
      <div className="pointer-events-none absolute right-3 top-16 max-h-[70%] w-56 overflow-y-auto rounded-xl bg-black/70 p-3 text-xs text-white">
        <p className="mb-2 font-semibold uppercase tracking-wider text-white/70">Defects on the model</p>
        {error ? <p>{error}</p> : placed.length === 0 ? (
          <p className="text-white/70">None painted. Scan the sides in Detect Defects to place them.</p>
        ) : (
          <ul className="space-y-1.5">
            {placed.map((d) => (
              <li key={d.n} className="flex items-start gap-2">
                <span className={`mt-0.5 h-3 w-3 shrink-0 rounded-sm ${dot(d.severity)}`} />
                <span><span className="font-semibold capitalize">{d.label}</span> · {d.side}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 border-t border-white/15 pt-2 text-white/60">Red fails the piece, amber needs checking, green is natural wood.</p>
      </div>
    </div>
  );
}
