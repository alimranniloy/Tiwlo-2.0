import {
  AmbientLight,
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { buildHeroWorld } from "./heroModels";

export function createHeroScene(host, onContextLost) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 0.1, 40);
  camera.position.set(0, 2.65, 11.9);
  camera.lookAt(0, 0.25, 0);
  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setClearColor(new Color("#edf3ff"), 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio || 1,
      window.matchMedia("(max-width: 640px)").matches ? 1 : 1.5,
    ),
  );
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);
  scene.add(new AmbientLight(0xffffff, 1.8));
  const key = new DirectionalLight(0xffffff, 3.5);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new DirectionalLight(0xa9cfff, 2.5);
  rim.position.set(4, -1, 2);
  scene.add(rim);
  const { world, models, halo, accents, liquid } = buildHeroWorld();
  scene.add(world);
  let focus = -1;
  let scrollTarget = 0;
  let scrollProgress = 0;
  const stage = host.closest(".tl-hero-stage");
  const stageLayout = { top: 0, distance: 1 };
  function measureStage() {
    const bounds = (stage || host).getBoundingClientRect();
    stageLayout.top = bounds.top + window.scrollY;
    stageLayout.distance = Math.max(bounds.height - window.innerHeight, 380);
    updateScroll();
  }
  function updateScroll() {
    scrollTarget = Math.min(
      1,
      Math.max(0, (window.scrollY - stageLayout.top) / stageLayout.distance),
    );
  }
  measureStage();
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
    scrollProgress += (scrollTarget - scrollProgress) * 0.075;
    world.rotation.y +=
      (-0.08 + pointer.x * 0.1 + scrollProgress * 0.3 - world.rotation.y) *
      0.05;
    world.rotation.x += (pointer.y * 0.045 - world.rotation.x) * 0.05;
    models.forEach((model, index) => {
      const selected = focus < 0 || index === focus;
      const targetScale = selected ? (focus < 0 ? 1 : 1.1) : 0.88;
      model.scale.lerp(
        { x: targetScale, y: targetScale, z: targetScale },
        0.055,
      );
      const home = model.userData.home;
      model.position.y +=
        (home.y +
          Math.sin(time * 0.8 + index * 1.7) * 0.055 +
          scrollProgress * [0.25, 0.6, -0.12][index] +
          (focus === index ? 0.2 : 0) -
          model.position.y) *
        0.06;
      model.position.x +=
        (home.x * (1 + scrollProgress * 0.18) - model.position.x) * 0.06;
      model.position.z +=
        (home.z +
          (index === 1 ? scrollProgress * 0.35 : 0) -
          model.position.z) *
        0.06;
      model.rotation.y +=
        (model.userData.turn +
          scrollProgress * [0.55, -0.45, 0.45][index] +
          Math.sin(time * 0.4 + index) * 0.025 -
          model.rotation.y) *
        0.06;
    });
    halo.rotation.y = time * 0.025 + scrollProgress * 0.4;
    accents.position.y = Math.sin(time * 0.7) * 0.12;
    liquid.rotation.y = Math.sin(time * 0.22) * 0.13 + scrollProgress * 0.4;
    liquid.rotation.z = -0.3 + Math.sin(time * 0.25) * 0.07;
    liquid.scale.x = 2.6 + Math.sin(time * 0.45) * 0.08;
    liquid.morphTargetInfluences[0] = (Math.sin(time * 0.7) + 1) * 0.5;
    host.style.setProperty("--scene-scroll", scrollProgress.toFixed(3));
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
    camera.position.z = camera.aspect < 1 ? 13.5 : 11.9;
    measureStage();
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
  window.addEventListener("scroll", updateScroll, { passive: true });
  window.addEventListener("resize", measureStage, { passive: true });
  resume();
  return {
    setFocus(index) {
      focus = index;
    },
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
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", measureStage);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      const geometries = new Set();
      const materials = new Set();
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) materials.add(object.material);
      });
      geometries.forEach((geometry) => geometry.dispose());
      const textures = new Set();
      materials.forEach((material) => {
        if (material.map) textures.add(material.map);
        material.dispose();
      });
      textures.forEach((texture) => texture.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
