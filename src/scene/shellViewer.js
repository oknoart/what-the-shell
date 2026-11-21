import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { generateShell } from '../math/raupGeometry.js';

/**
 * Sets up the Three.js scene and exposes an API for updating the shell.
 *
 * @param {HTMLElement} container element that hosts the canvas
 */
export function createShellViewer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0e13);

  const camera = new THREE.PerspectiveCamera(
    42,
    container.clientWidth / container.clientHeight,
    0.01,
    100,
  );
  camera.position.set(2.1, 1.7, 2.5);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.4;
  controls.minDistance = 1.2;
  controls.maxDistance = 12;
  controls.target.set(0, 0, 0);

  // Environment map gives MeshPhysicalMaterial its reflections/sheen.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envRT = pmrem.fromScene(room, 0.04);
  scene.environment = envRT.texture;
  pmrem.dispose();
  room.dispose?.();

  // Studio lighting: warm key, cool fill, soft ambient.
  const key = new THREE.DirectionalLight(0xfff1e0, 2.6);
  key.position.set(4, 6, 5);
  const fill = new THREE.DirectionalLight(0xbfd4ff, 1.1);
  fill.position.set(-5, 2, -4);
  const ambient = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(key, fill, ambient);

  const material = new THREE.MeshPhysicalMaterial({
    color: 0xf3e9d8,
    roughness: 0.34,
    metalness: 0.0,
    clearcoat: 0.65,
    clearcoatRoughness: 0.22,
    iridescence: 0.7,
    iridescenceIOR: 1.32,
    iridescenceThicknessRange: [100, 520],
    sheen: 0.45,
    sheenColor: new THREE.Color(0xffd9e8),
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  scene.add(mesh);

  let pendingParams = null;
  let scheduled = false;

  function applyGeometry(params) {
    const { positions, normals, indices } = generateShell(params);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeBoundingSphere();

    const previous = mesh.geometry;
    mesh.geometry = geometry;
    if (previous) previous.dispose();
  }

  /** Coalesce rapid slider updates into one rebuild per animation frame. */
  function update(params) {
    pendingParams = params;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyGeometry(pendingParams);
    });
  }

  function setWireframe(enabled) {
    material.wireframe = enabled;
  }

  function setAutoRotate(enabled) {
    controls.autoRotate = enabled;
  }

  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(container);

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  return { update, setWireframe, setAutoRotate };
}
