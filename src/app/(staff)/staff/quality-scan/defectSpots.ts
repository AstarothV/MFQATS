import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Pin } from './ModelDefectsView';

// Where a defect sits on the 3D model, shared by edit mode and the pins. A ray is cast from the side its photo was taken
// from (front = +z, glTF's convention) onto the mesh, so it lands on the real surface; the position is approximate,
// because a photo also shows the background.

// the way each side faces, out of the piece (VIEWS: Front, Left, Back, Right, Top, Bottom)
const SIDE_NORMAL = [[0, 0, 1], [-1, 0, 0], [0, 0, -1], [1, 0, 0], [0, 1, 0], [0, -1, 0]];

/** Every mesh as plain triangles in world space, so each face can be coloured by itself. */
export function bakeMeshes(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    const g = ((o as THREE.Mesh).geometry as THREE.BufferGeometry).toNonIndexed();
    g.applyMatrix4(o.matrixWorld);
    g.computeVertexNormals();
    meshes.push(new THREE.Mesh(g));
  });
  return meshes;
}

function sidePoint({ slot, u, v }: Pin, lo: THREE.Vector3, hi: THREE.Vector3) {
  const at = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));
  const down = at(hi.y, lo.y, v);
  const p = [
    [at(lo.x, hi.x, u), down, hi.z], [lo.x, down, at(lo.z, hi.z, u)], [at(hi.x, lo.x, u), down, lo.z],
    [hi.x, down, at(hi.z, lo.z, u)], [at(lo.x, hi.x, u), hi.y, at(lo.z, hi.z, v)], [at(lo.x, hi.x, u), lo.y, at(hi.z, lo.z, v)],
  ][slot];
  return new THREE.Vector3(p[0], p[1], p[2]);
}

// where a ray slips through a gap (between legs, under a seat), the part of the mesh nearest to the spot
function nearestOnMesh(meshes: THREE.Mesh[], q: THREE.Vector3) {
  let best = Infinity; const point = new THREE.Vector3(); let mesh = 0, face = 0;
  meshes.forEach((m, mi) => {
    const pos = m.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const d = (pos.getX(i) - q.x) ** 2 + (pos.getY(i) - q.y) ** 2 + (pos.getZ(i) - q.z) ** 2;
      if (d < best) { best = d; point.set(pos.getX(i), pos.getY(i), pos.getZ(i)); mesh = mi; face = Math.floor(i / 3); }
    }
  });
  return { point, mesh, face };
}

/** The point on the model where a defect sits, the way that surface faces, and the face it landed on. */
export function findSpot(pin: Pin, meshes: THREE.Mesh[], box: THREE.Box3) {
  const side = new THREE.Vector3(...(SIDE_NORMAL[pin.slot] as [number, number, number]));
  const onSide = sidePoint(pin, box.min, box.max);
  const from = onSide.clone().addScaledVector(side, box.getSize(new THREE.Vector3()).length() * 0.5);
  const hit = new THREE.Raycaster(from, side.clone().negate()).intersectObjects(meshes, false)[0];
  if (hit) return { point: hit.point, normal: hit.face!.normal.clone(), mesh: meshes.indexOf(hit.object as THREE.Mesh), face: hit.faceIndex ?? -1 };
  return { ...nearestOnMesh(meshes, onSide), normal: side };
}

/** Each pin's place on the model, as <model-viewer> hotspot values. */
export async function pinSpots(modelUrl: string, pins: Pin[]) {
  const meshes = bakeMeshes((await new GLTFLoader().loadAsync(modelUrl)).scene);
  const box = new THREE.Box3();
  meshes.forEach((m) => box.expandByObject(m));
  const spots = pins.map((pin) => {
    const { point, normal } = findSpot(pin, meshes, box);
    return { position: `${point.x}m ${point.y}m ${point.z}m`, normal: `${normal.x} ${normal.y} ${normal.z}` };
  });
  meshes.forEach((m) => m.geometry.dispose());
  return spots;
}
