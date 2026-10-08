import {
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  TubeGeometry,
  CatmullRomCurve3,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// Original, lightweight models built from shared geometry. No model downloads.
export function buildHeroWorld() {
  const world = new Group();
  const unitBox = new RoundedBoxGeometry(1, 1, 1, 2, 0.07);
  const sphere = new SphereGeometry(1, 20, 14);
  const white = new MeshPhysicalMaterial({
    color: 0xf4faff,
    roughness: 0.28,
    metalness: 0.12,
    clearcoat: 0.6,
  });
  const blue = new MeshPhysicalMaterial({
    color: 0x2762ef,
    roughness: 0.25,
    metalness: 0.16,
    clearcoat: 0.9,
  });
  const ice = new MeshPhysicalMaterial({
    color: 0x9bccff,
    roughness: 0.2,
    metalness: 0.15,
    clearcoat: 1,
  });
  const dark = new MeshStandardMaterial({
    color: 0x193c70,
    roughness: 0.4,
    metalness: 0.2,
  });
  const window = new MeshPhysicalMaterial({
    color: 0x75bcff,
    roughness: 0.13,
    metalness: 0.2,
    clearcoat: 1,
  });
  const led = new MeshBasicMaterial({ color: 0x77e5ff });
  const slate = new MeshStandardMaterial({ color: 0x4873ab, roughness: 0.5 });
  function box(parent, size, position, material = white) {
    const mesh = new Mesh(unitBox, material);
    mesh.scale.set(...size);
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  }
  function ball(parent, radius, position, material = white) {
    const mesh = new Mesh(sphere, material);
    mesh.scale.setScalar(radius);
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  }
  function textureMaterial(width, height, draw) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext("2d"), width, height);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return new MeshBasicMaterial({ map: texture });
  }
  function platform(parent, width, depth) {
    box(parent, [width, 0.17, depth], [0, -0.12, 0], ice);
    box(parent, [width - 0.07, 0.11, depth - 0.07], [0, -0.015, 0], white);
  }

  const server = new Group();
  platform(server, 1.66, 1.44);
  box(server, [1.1, 1.9, 0.9], [0, 1.04, 0], dark);
  box(server, [1.12, 0.12, 0.94], [0, 2.03, 0], blue);
  for (let row = 0; row < 5; row++) {
    const y = 0.35 + row * 0.34;
    box(server, [0.99, 0.28, 0.08], [0, y, 0.485], row === 4 ? blue : white);
    for (let slot = 0; slot < 4; slot++)
      box(server, [0.035, 0.12, 0.035], [-0.33 + slot * 0.08, y, 0.54], slate);
    ball(server, 0.024, [0.31, y, 0.54], led);
    ball(server, 0.016, [0.39, y, 0.54], ice);
  }
  box(server, [0.07, 1.7, 0.83], [0.58, 1.02, 0], blue);

  const shop = new Group();
  platform(shop, 2.2, 1.5);
  box(shop, [1.85, 1.35, 0.9], [0, 0.76, 0], white);
  box(shop, [1.76, 0.99, 0.04], [0, 0.64, 0.47], window);
  box(shop, [0.06, 1.01, 0.1], [0.18, 0.64, 0.51], white);
  box(shop, [0.06, 1.01, 0.1], [-0.72, 0.64, 0.51], white);
  box(shop, [0.66, 0.055, 0.1], [0.54, 0.15, 0.51], white);
  box(shop, [0.033, 0.16, 0.055], [0.3, 0.63, 0.54], dark);
  const sign = textureMaterial(512, 128, (ctx) => {
    ctx.fillStyle = "#245ff0";
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 57px Arial";
    ctx.textAlign = "center";
    ctx.fillText("YOUR STORE", 256, 85);
  });
  box(shop, [1.88, 0.28, 0.09], [0, 1.57, 0.48], blue);
  box(shop, [1.65, 0.22, 0.012], [0, 1.57, 0.533], sign);
  for (let stripe = 0; stripe < 8; stripe++) {
    const x = -0.875 + stripe * 0.25;
    const canopy = box(
      shop,
      [0.25, 0.095, 0.62],
      [x, 1.31, 0.65],
      stripe % 2 ? white : blue,
    );
    canopy.rotation.x = 0.16;
    box(shop, [0.25, 0.16, 0.1], [x, 1.22, 0.945], stripe % 2 ? white : blue);
  }
  for (let i = 0; i < 2; i++) {
    const parcel = box(
      shop,
      [0.34, 0.35 + i * 0.12, 0.3],
      [-0.9 + i * 0.32, 0.23 + i * 0.06, 0.77 + i * 0.12],
      i ? ice : blue,
    );
    parcel.rotation.y = -0.15 + i * 0.3;
    box(
      shop,
      [0.06, 0.35 + i * 0.12, 0.315],
      [-0.9 + i * 0.32, 0.23 + i * 0.06, 0.78 + i * 0.12],
      white,
    );
  }

  const pos = new Group();
  platform(pos, 2.1, 1.45);
  box(pos, [0.9, 0.13, 0.65], [-0.22, 0.13, 0], blue);
  const stand = box(pos, [0.18, 0.7, 0.17], [-0.22, 0.48, -0.1], slate);
  stand.rotation.x = -0.22;
  const display = new Group();
  display.position.set(-0.22, 1.12, -0.08);
  display.rotation.x = -0.13;
  pos.add(display);
  box(display, [1.5, 1.02, 0.14], [0, 0, 0], dark);
  const screen = textureMaterial(512, 320, (ctx) => {
    ctx.fillStyle = "#f2f7ff";
    ctx.fillRect(0, 0, 512, 320);
    ctx.fillStyle = "#215dea";
    ctx.fillRect(0, 0, 512, 55);
    ctx.fillStyle = "white";
    ctx.font = "600 22px Arial";
    ctx.fillText("tiwlo / point of sale", 22, 35);
    ["#c7ddff", "#dfeaff", "#afcfff", "#d8e6ff"].forEach((color, i) => {
      const x = 18 + (i % 2) * 132,
        y = 74 + Math.floor(i / 2) * 116;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 117, 83);
      ctx.fillStyle = "#7ca6e8";
      ctx.fillRect(x + 36, y + 16, 45, 51);
      ctx.fillStyle = "#425f8c";
      ctx.fillRect(x, y + 92, 75, 7);
    });
    ctx.fillStyle = "#dce7fa";
    ctx.fillRect(298, 73, 193, 176);
    ctx.fillStyle = "#436693";
    ctx.font = "600 18px Arial";
    ctx.fillText("Current sale", 312, 102);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = "#b6c9e9";
      ctx.fillRect(312, 122 + i * 32, 160 - i * 12, 9);
    }
    ctx.fillStyle = "#2461ef";
    ctx.fillRect(298, 262, 193, 39);
    ctx.fillStyle = "white";
    ctx.font = "17px Arial";
    ctx.fillText("Checkout", 352, 288);
  });
  box(display, [1.37, 0.87, 0.012], [0, 0.015, 0.079], screen);
  const terminal = box(pos, [0.32, 0.11, 0.51], [0.68, 0.19, 0.44], dark);
  terminal.rotation.x = 0.13;
  box(pos, [0.24, 0.02, 0.2], [0.68, 0.252, 0.38], ice);
  for (let i = 0; i < 6; i++)
    box(
      pos,
      [0.045, 0.02, 0.025],
      [0.61 + (i % 3) * 0.07, 0.254, 0.53 + Math.floor(i / 3) * 0.055],
      white,
    );
  box(pos, [0.43, 0.35, 0.38], [0.64, 0.26, -0.32], white);
  box(pos, [0.28, 0.02, 0.045], [0.64, 0.443, -0.3], dark);
  const receipt = box(pos, [0.24, 0.32, 0.014], [0.64, 0.55, -0.3], white);
  receipt.rotation.x = -0.3;

  const models = [server, pos, shop];
  const positions = [
    [-1.65, 0.05, -0.55],
    [-0.55, -1.13, 1.25],
    [1.55, -0.55, -0.32],
  ];
  models.forEach((model, index) => {
    model.position.set(...positions[index]);
    model.rotation.y = [0.36, 0.12, -0.32][index];
    model.userData.home = model.position.clone();
    model.userData.turn = model.rotation.y;
    world.add(model);
  });
  const halo = new Group();
  halo.position.set(0, -0.75, 0);
  for (let i = 0; i < 2; i++) {
    const ring = new Mesh(
      new TorusGeometry(2.8 + i * 0.34, 0.015, 6, 100),
      new MeshBasicMaterial({
        color: 0x8bbdff,
        transparent: true,
        opacity: 0.48 - i * 0.18,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    halo.add(ring);
  }
  world.add(halo);
  const route = new CatmullRomCurve3([
    new Vector3(-1.7, -0.12, -0.25),
    new Vector3(-1.6, -0.56, 1.3),
    new Vector3(0.2, -0.65, 1.5),
    new Vector3(1.9, -0.48, 0),
  ]);
  world.add(new Mesh(new TubeGeometry(route, 32, 0.018, 5, false), ice));
  const accents = new Group();
  [
    [-2.5, 1.85, -0.5],
    [2.7, 1.7, -0.7],
    [2.65, -0.6, 1.4],
  ].forEach((position, i) =>
    ball(accents, 0.09 + i * 0.025, position, i % 2 ? blue : ice),
  );
  world.add(accents);
  const liquidGeometry = new SphereGeometry(1, 40, 28);
  const vertices = liquidGeometry.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i),
      y = vertices.getY(i),
      z = vertices.getZ(i);
    const wave =
      1 + Math.sin(x * 3.5 + y * 2.5) * Math.cos(z * 4 - y * 2) * 0.18;
    vertices.setXYZ(i, x * wave, y * wave, z * wave);
  }
  liquidGeometry.computeVertexNormals();
  const morphGeometry = liquidGeometry.clone();
  const morphVertices = morphGeometry.attributes.position;
  for (let i = 0; i < morphVertices.count; i++) {
    const x = morphVertices.getX(i),
      y = morphVertices.getY(i),
      z = morphVertices.getZ(i);
    const swell = 1 + Math.sin(y * 4 + z * 3) * Math.cos(x * 3 - y) * 0.13;
    morphVertices.setXYZ(i, x * swell, y * swell, z * swell);
  }
  morphGeometry.computeVertexNormals();
  liquidGeometry.morphAttributes.position = [
    morphGeometry.attributes.position.clone(),
  ];
  liquidGeometry.morphAttributes.normal = [
    morphGeometry.attributes.normal.clone(),
  ];
  morphGeometry.dispose();
  const liquid = new Mesh(
    liquidGeometry,
    new MeshPhysicalMaterial({
      color: 0x80b8ff,
      metalness: 0.23,
      roughness: 0.14,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    }),
  );
  liquid.position.set(0, 0.85, -2.3);
  liquid.scale.set(2.6, 1.65, 0.55);
  liquid.rotation.z = -0.3;
  world.add(liquid);
  return { world, models, halo, accents, liquid };
}
