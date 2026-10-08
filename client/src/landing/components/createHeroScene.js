import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  TorusGeometry,
  TorusKnotGeometry,
  WebGLRenderer,
} from "three";

export function createHeroScene(host, onContextLost) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 0.1, 40);
  camera.position.set(0, 0.1, 8.8);
  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setClearColor(new Color("#edf3ff"), 0);
  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio || 1,
      window.matchMedia("(max-width: 640px)").matches ? 1 : 1.5,
    ),
  );
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);
  scene.add(new AmbientLight(0xffffff, 2.4));
  const key = new DirectionalLight(0xffffff, 4.5);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new DirectionalLight(0x6d92ff, 4);
  rim.position.set(4, -1, 2);
  scene.add(rim);
  const sculpture = new Group();
  sculpture.rotation.set(0.35, -0.3, -0.3);
  scene.add(sculpture);
  const blue = new MeshPhysicalMaterial({
    color: 0x3266ed,
    metalness: 0.28,
    roughness: 0.24,
    clearcoat: 1,
    clearcoatRoughness: 0.22,
  });
  const pearl = new MeshPhysicalMaterial({
    color: 0xe4ecff,
    metalness: 0.25,
    roughness: 0.24,
    clearcoat: 0.8,
  });
  const mint = new MeshStandardMaterial({
    color: 0xbce7bf,
    metalness: 0.15,
    roughness: 0.32,
  });
  const core = new Mesh(new TorusKnotGeometry(0.87, 0.31, 120, 20, 2, 3), blue);
  sculpture.add(core);
  sculpture.add(new Mesh(new IcosahedronGeometry(0.48, 2), pearl));
  const orbits = new Group();
  sculpture.add(orbits);
  for (let i = 0; i < 3; i++) {
    const orbit = new Mesh(
      new TorusGeometry(1.78 + i * 0.19, i === 0 ? 0.026 : 0.012, 6, 100),
      pearl,
    );
    orbit.rotation.set(0.6 + i * 0.7, i * 0.55, i * 0.25);
    orbits.add(orbit);
  }
  const satelliteGeometry = new SphereGeometry(0.15, 20, 12);
  for (let i = 0; i < 5; i++) {
    const satellite = new Mesh(satelliteGeometry, i % 2 ? mint : blue);
    const angle = (i * Math.PI * 2) / 5;
    satellite.position.set(
      Math.cos(angle) * 2,
      Math.sin(angle) * 1.4,
      Math.sin(angle * 2) * 0.7,
    );
    if (i === 0) satellite.scale.setScalar(1.65);
    sculpture.add(satellite);
  }
  let frame = 0;
  let disposed = false;
  let paused = false;
  let visible = true;
  let previous = 0;
  let time = 0;
  const pointer = { x: 0, y: 0 };
  function render() {
    renderer.render(scene, camera);
  }
  function animate(now) {
    if (disposed || paused || !visible || document.hidden) {
      frame = 0;
      previous = 0;
      return;
    }
    frame = requestAnimationFrame(animate);
    if (now - previous < 1000 / 30) return;
    time += previous ? Math.min((now - previous) / 1000, 0.1) : 0;
    previous = now;
    core.rotation.y = time * 0.12;
    core.rotation.z = time * 0.06;
    sculpture.rotation.y +=
      (-0.3 + pointer.x * 0.18 - sculpture.rotation.y) * 0.045;
    sculpture.rotation.x +=
      (0.35 + pointer.y * 0.12 - sculpture.rotation.x) * 0.045;
    sculpture.position.y = Math.sin(time * 0.7) * 0.08;
    orbits.rotation.y = time * 0.06;
    render();
  }
  function resume() {
    if (!frame && !disposed && !paused && visible && !document.hidden)
      frame = requestAnimationFrame(animate);
  }
  const observer = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      resume();
    },
    { threshold: 0.05 },
  );
  observer.observe(host);
  const resize = new ResizeObserver(() => {
    if (disposed) return;
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  });
  resize.observe(host);
  const move = (event) => {
    if (event.pointerType !== "mouse") return;
    const bounds = host.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
  };
  const reset = () => {
    pointer.x = 0;
    pointer.y = 0;
  };
  const lost = (event) => {
    event.preventDefault();
    paused = true;
    onContextLost();
  };
  host.addEventListener("pointermove", move, { passive: true });
  host.addEventListener("pointerleave", reset);
  renderer.domElement.addEventListener("webglcontextlost", lost);
  document.addEventListener("visibilitychange", resume);
  resume();
  return {
    setPaused(value) {
      paused = value;
      resume();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", reset);
      document.removeEventListener("visibilitychange", resume);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      const geometries = new Set();
      const materials = new Set();
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) materials.add(object.material);
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
