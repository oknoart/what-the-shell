import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { generateShell } from '../math/raupGeometry.js';

export function createShellViewer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
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

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envRT = pmrem.fromScene(room, 0.04);
  scene.environment = envRT.texture;
  pmrem.dispose();
  room.dispose?.();

  const key = new THREE.DirectionalLight(0xfff0dd, 4.2);
  key.position.set(5, 7, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -3;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.04;

  const fill = new THREE.DirectionalLight(0x9db6d8, 0.35);
  fill.position.set(-5, 1.5, -4);

  const rim = new THREE.DirectionalLight(0xaecbff, 1.8);
  rim.position.set(-4, 3, -6);

  const ambient = new THREE.AmbientLight(0xffffff, 0.08);
  scene.add(key, fill, rim, ambient);

  const material = new THREE.MeshPhysicalMaterial({
    color: 0xbfae92,
    roughness: 0.5,
    metalness: 0.0,
    clearcoat: 0.45,
    clearcoatRoughness: 0.3,
    iridescence: 0.5,
    iridescenceIOR: 1.32,
    iridescenceThicknessMinimum: 100,
    iridescenceThicknessMaximum: 520,
    sheen: 0.3,
    sheenColor: new THREE.Color(0xffd9e8),
    envMapIntensity: 0.4,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
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
