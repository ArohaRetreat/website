import * as T from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { terrainHeight, seeded } from "./farm-route.mjs";

// Authored geometry, not a photographic survey. All distances belong to this scene.
export function createFarmWorld() {
  let crownMesh;
  const crownPose = new T.Object3D();
  const rand = seeded(193),
    scene = new T.Scene(),
    world = new T.Group();
  scene.add(world);
  scene.background = new T.Color("#adbfaf");
  scene.fog = new T.FogExp2("#adbfaf", 0.011);
  const materials = {},
    batches = new Map(),
    moving = [],
    palms = [];
  function mat(key, color, extra = {}) {
    return (materials[key] = new T.MeshStandardMaterial({
      color,
      roughness: 0.85,
      ...extra,
    }));
  }
  const stone = mat("stone", "#777c68"),
    edge = mat("edge", "#b4ad91"),
    wood = mat("wood", "#70563e"),
    darkWood = mat("darkWood", "#3f3d2b"),
    cream = mat("cream", "#d8cfb0"),
    roof = mat("roof", "#98472f"),
    roof2 = mat("roof2", "#ab5539"),
    glass = mat("glass", "#493c25", { roughness: 0.16, metalness: 0.25 }),
    linen = mat("linen", "#e2d3ac"),
    groundMat = mat("ground", "#526143", { vertexColors: true }),
    pathMat = mat("path", "#b6a384"),
    grassMat = mat("grass", "#839052", {
      side: T.DoubleSide,
      vertexColors: true,
    }),
    leafMat = mat("leaf", "#596d39", { side: T.DoubleSide }),
    black = mat("black", "#242c21"),
    brass = mat("brass", "#be9860", { metalness: 0.5, roughness: 0.35 }),
    glow = mat("glow", "#b5a474", {
      emissive: "#ffba54",
      emissiveIntensity: 0.1,
    }),
    animal = mat("animal", "#bcb49e");
  const hemi = new T.HemisphereLight("#e4e8d3", "#393c28", 2.1);
  scene.add(hemi);
  const sun = new T.DirectionalLight("#ffdfac", 3.6);
  sun.position.set(-28, 40, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  Object.assign(sun.shadow.camera, {
    left: -48,
    right: 48,
    top: 48,
    bottom: -48,
    near: 1,
    far: 120,
  });
  sun.shadow.normalBias = 0.045;
  sun.shadow.bias = -0.0003;
  sun.target.position.set(0, 0, -14);
  scene.add(sun, sun.target);
  const moon = new T.DirectionalLight("#8daecb", 0);
  moon.position.set(20, 35, -40);
  scene.add(moon);
  function addGeo(geo, matrix, material) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(matrix);
    if (!batches.has(material)) batches.set(material, []);
    batches.get(material).push(g);
  }
  const dummy = new T.Object3D();
  function geometry(
    geo,
    material,
    pos = [0, 0, 0],
    scale = [1, 1, 1],
    rot = [0, 0, 0],
  ) {
    dummy.position.set(...pos);
    dummy.scale.set(...scale);
    dummy.rotation.set(...rot);
    dummy.updateMatrix();
    addGeo(geo, dummy.matrix, material);
  }
  const boxGeo = new T.BoxGeometry(1, 1, 1),
    sphereGeo = new T.IcosahedronGeometry(1, 2);
  const tileGeo = new T.BufferGeometry(),
    tileV = [],
    tileI = [];
  for (const x of [-0.23, 0.23])
    for (let j = 0; j <= 8; j++) {
      const a = (j / 8) * Math.PI;
      tileV.push(x, Math.sin(a) * 0.09, Math.cos(a) * 0.235);
    }
  for (let j = 0; j < 8; j++) tileI.push(j, j + 9, j + 1, j + 1, j + 9, j + 10);
  tileGeo.setAttribute("position", new T.Float32BufferAttribute(tileV, 3));
  tileGeo.setIndex(tileI);
  tileGeo.computeVertexNormals();
  const tileUV = [];
  for (let i = 0; i < 18; i++) tileUV.push((i % 9) / 8, Math.floor(i / 9));
  tileGeo.setAttribute("uv", new T.Float32BufferAttribute(tileUV, 2));
  const rockGeo = new T.IcosahedronGeometry(1, 2);
  const rp = rockGeo.attributes.position;
  for (let i = 0; i < rp.count; i++) {
    const x = rp.getX(i),
      y = rp.getY(i),
      z = rp.getZ(i),
      r = 1 + 0.11 * Math.sin(x * 11 + y * 6) * Math.cos(z * 8 - y * 4);
    rp.setXYZ(i, x * r, y * r, z * r);
  }
  const rn = rockGeo.attributes.normal;
  for (let i = 0; i < rp.count; i++) {
    const x = rp.getX(i),
      y = rp.getY(i),
      z = rp.getZ(i),
      r = Math.hypot(x, y, z);
    rn.setXYZ(i, x / r, y / r, z / r);
  }
  rn.needsUpdate = true;
  function box(m, pos, size, rot = [0, 0, 0]) {
    geometry(boxGeo, m, pos, size, rot);
  }
  function sphere(m, pos, size) {
    geometry(sphereGeo, m, pos, size, [rand(), rand(), rand()]);
  }
  function beam(a, b, r, m = wood) {
    const v1 = new T.Vector3(...a),
      v2 = new T.Vector3(...b);
    const g = new T.CylinderGeometry(r, r * 1.1, v1.distanceTo(v2), 7);
    const q = new T.Quaternion().setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      v2.sub(v1).normalize(),
    );
    const o = new T.Object3D();
    o.position
      .copy(v1)
      .add(new T.Vector3(...b))
      .multiplyScalar(0.5);
    o.quaternion.copy(q);
    o.updateMatrix();
    addGeo(g, o.matrix, m);
    g.dispose();
  }
  // Textured materials use a tiny deterministic grain, not remote texture requests.
  const grain = new Uint8Array(128 * 128 * 4);
  for (let i = 0; i < 128 * 128; i++) {
    const n = 210 + Math.floor(rand() * 45);
    grain.set([n, n, n, 255], i * 4);
  }
  const tex = new T.DataTexture(grain, 128, 128);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(9, 9);
  tex.needsUpdate = true;
  tex.colorSpace = T.SRGBColorSpace;
  for (const m of [stone, cream, roof, roof2, wood, pathMat]) {
    m.map = tex;
    m.bumpMap = tex;
    m.bumpScale = m === stone ? 0.065 : 0.015;
  }
  const terrain = new T.PlaneGeometry(210, 210, 110, 110);
  terrain.rotateX(-Math.PI / 2);
  const tp = terrain.attributes.position,
    cols = [];
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i),
      z = tp.getZ(i);
    tp.setY(i, terrainHeight(x, z));
    const c = new T.Color().setHSL(
      0.21 + rand() * 0.02,
      0.18 + rand() * 0.1,
      0.25 + rand() * 0.1,
    );
    cols.push(0.82 + rand() * 0.16, 0.82 + rand() * 0.16, 0.82 + rand() * 0.16);
  }
  terrain.setAttribute("color", new T.Float32BufferAttribute(cols, 3));
  terrain.computeVertexNormals();
  const land = new T.Mesh(terrain, groundMat);
  land.receiveShadow = true;
  world.add(land);
  // Broad stone path snakes through one continuous world.
  const roadPoints = [
    [0, 43],
    [0, 18],
    [-1, 8],
    [2, -2],
    [1, -13],
    [-3, -24],
    [0, -35],
    [4, -45],
    [0, -60],
  ].map(([x, z]) => new T.Vector3(x, 0.06, z));
  const roadCurve = new T.CatmullRomCurve3(roadPoints),
    rv = [],
    ri = [],
    ru = [];
  for (let i = 0; i <= 220; i++) {
    const t = i / 220,
      p = roadCurve.getPoint(t),
      tan = roadCurve.getTangent(t),
      width = 1.65;
    for (const sign of [-1, 1]) {
      const x = p.x + tan.z * width * sign,
        z = p.z - tan.x * width * sign;
      rv.push(x, Math.max(0.04, terrainHeight(x, z) + 0.035), z);
      ru.push((sign + 1) / 2, t * 30);
    }
    if (i < 220) {
      const j = i * 2;
      ri.push(j, j + 2, j + 1, j + 1, j + 2, j + 3);
    }
  }
  const roadGeo = new T.BufferGeometry();
  roadGeo.setAttribute("position", new T.Float32BufferAttribute(rv, 3));
  roadGeo.setAttribute("uv", new T.Float32BufferAttribute(ru, 2));
  roadGeo.setIndex(ri);
  roadGeo.computeVertexNormals();
  const road = new T.Mesh(roadGeo, pathMat);
  road.receiveShadow = true;
  world.add(road);
  function rock(x, z, size = 1, m = stone) {
    geometry(
      rockGeo,
      m,
      [x, terrainHeight(x, z) + size * 0.22, z],
      [size * (0.7 + rand() * 0.5), size * 0.5, size * (0.6 + rand() * 0.6)],
      [rand(), rand(), rand()],
    );
  }
  for (let i = 0; i < 125; i++) {
    const t = rand(),
      p = roadCurve.getPoint(t),
      tan = roadCurve.getTangent(t),
      side = rand() > 0.5 ? 1 : -1;
    rock(
      p.x + tan.z * (2 + rand() * 0.6) * side,
      p.z - tan.x * (2 + rand() * 0.6) * side,
      0.15 + rand() * 0.25,
    );
  }
  // Low enclosing stone walls, with an actual hinged entrance.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 16; i++)
      for (let j = 0; j < 3; j++)
        box(
          stone,
          [side * (4.3 + i * 0.67), 0.24 + j * 0.42, 18],
          [0.63, 0.39, 0.65],
        );
    box(edge, [side * 4, 2.1, 18], [0.95, 4.2, 0.95]);
    box(edge, [side * 4, 4.24, 18], [1.15, 0.15, 1.15]);
    box(brass, [side * 4, 2.45, 18.51], [0.13, 0.42, 0.06]);
  }
  box(darkWood, [0, 4.2, 18], [8.8, 0.2, 0.3]);
  box(darkWood, [0, 4.12, 18.18], [3.35, 0.85, 0.12]);
  const gates = [];
  for (const side of [-1, 1]) {
    const hinge = new T.Group();
    hinge.position.set(side * 3.55, 0.15, 18);
    const length = 3.52;
    const m = new T.Mesh(new T.BoxGeometry(length, 0.16, 0.16), darkWood);
    m.position.set((-side * length) / 2, 2.85, 0);
    hinge.add(m);
    for (let i = 0; i < 15; i++) {
      const slat = new T.Mesh(new T.BoxGeometry(0.13, 2.65, 0.12), wood);
      slat.position.set(-side * (0.12 + i * 0.235), 1.45, 0);
      slat.castShadow = true;
      hinge.add(slat);
    }
    for (const y of [0.4, 2.55]) {
      const rail = new T.Mesh(new T.BoxGeometry(length, 0.13, 0.17), darkWood);
      rail.position.set((-side * length) / 2, y, 0);
      hinge.add(rail);
    }
    world.add(hinge);
    gates.push(hinge);
  }
  // A-frame cottages. Individually tiled roofs and a warm, recessed doorway.
  const cottages = [];
  function cottage(x, z, angle = 0, scale = 1) {
    const local = [];
    const start = new Map([...batches].map(([m, a]) => [m, a.length]));
    box(stone, [0, 0.25, 0], [5.5, 0.5, 7.4]);
    box(wood, [0, 0.56, 0.55], [5.8, 0.22, 8.3]);
    for (let i = 0; i < 24; i++)
      box(darkWood, [-2.75 + i * 0.24, 0.68, 1.6], [0.025, 0.02, 6.2]);
    // The gable is a solid triangle; roof sides are pitched planes.
    const shape = new T.Shape()
      .moveTo(-2.5, 0.7)
      .lineTo(2.5, 0.7)
      .lineTo(0, 6.2)
      .closePath();
    const gable = new T.ShapeGeometry(shape);
    geometry(gable, cream, [0, 0, 2.8]);
    geometry(gable, cream, [0, 0, -2.8], [1, 1, 1], [0, Math.PI, 0]);
    gable.dispose();
    box(cream, [-2.3, 1.05, 0], [0.18, 0.7, 5.6]);
    box(cream, [2.3, 1.05, 0], [0.18, 0.7, 5.6]);
    const slope = Math.atan2(5.8, 2.9),
      span = Math.hypot(5.8, 2.9);
    for (const side of [-1, 1]) {
      box(
        roof,
        [side * 1.45, 3.28, 0],
        [span, 0.12, 6.5],
        [0, 0, -side * slope],
      );
      for (let row = 0; row < 15; row++)
        for (let col = 0; col < 15; col++) {
          const q = (row + 0.5) / 15;
          geometry(
            tileGeo,
            (row + col) % 4 ? roof : roof2,
            [side * 2.9 * q, 6.21 - 5.8 * q, 0.01 - 3.18 + col * 0.45],
            [1, 1, 1],
            [0, 0, -side * slope],
          );
        }
      beam([0, 6.25, -3.3], [0, 6.25, 3.3], 0.09, roof2);
      beam([side * 2.95, 0.38, 3.2], [0, 6.27, 3.2], 0.08, darkWood);
    }
    box(glass, [0, 1.96, 2.82], [1.45, 2.55, 0.06]);
    box(glow, [0, 1.94, 2.78], [1.35, 2.45, 0.04]);
    for (const xx of [-0.79, 0.79, 0])
      box(wood, [xx, 1.96, 2.9], [0.08, 2.65, 0.16]);
    for (const yy of [0.67, 3.25]) box(wood, [0, yy, 2.9], [1.66, 0.1, 0.16]);
    box(linen, [0.56, 2, 2.95], [0.21, 2.35, 0.03]);
    box(brass, [0.16, 1.8, 3.01], [0.04, 0.21, 0.04]);
    for (const xx of [-1.7, 1.7]) {
      box(glass, [xx, 1.85, 2.86], [0.65, 1.2, 0.05]);
      box(wood, [xx, 1.85, 2.9], [0.08, 1.25, 0.09]);
      box(glow, [xx, 2.9, 2.98], [0.16, 0.25, 0.1]);
    }
    for (let i = 0; i < 3; i++)
      box(
        edge,
        [0, 0.14 + i * 0.15, 5.15 - i * 0.34],
        [2, 0.28 + i * 0.3, 0.38],
      );
    for (const xx of [-1.8, 1.8]) {
      for (const a of [-1, 1])
        for (const b of [-1, 1])
          box(wood, [xx + a * 0.3, 0.98, 3.8 + b * 0.3], [0.06, 0.6, 0.06]);
      box(wood, [xx, 1.22, 3.8], [0.75, 0.08, 0.75]);
      box(linen, [xx, 1.3, 3.8], [0.65, 0.1, 0.65]);
      box(wood, [xx, 1.65, 3.48], [0.76, 0.74, 0.06], [0.1, 0, 0]);
    }
    // Transform only the geometry just authored for this building.
    const trans = new T.Matrix4().compose(
      new T.Vector3(x, 0, z),
      new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), angle),
      new T.Vector3(scale, scale, scale),
    );
    for (const [m, a] of batches) {
      for (let k = start.get(m) || 0; k < a.length; k++)
        a[k].applyMatrix4(trans);
    }
    cottages.push({ x, z, angle, scale });
  }
  cottage(9, -12, -0.14, 1);
  cottage(16, -24, -0.4, 0.9);
  cottage(-14, -19, 0.3, 0.85);
  // Palm frond geometry has curved rachis and 64 individual narrow leaflets.
  function makeFrond() {
    const v = [],
      idx = [],
      color = [];
    function tri(a, b, c, shade) {
      const i = v.length / 3;
      v.push(...a, ...b, ...c);
      idx.push(i, i + 1, i + 2);
      for (let j = 0; j < 3; j++) color.push(shade * 0.7, shade, shade * 0.49);
    }
    const len = 4.8;
    for (let k = 0; k < 32; k++) {
      const t = (k + 1) / 34,
        x = t * len,
        y = Math.sin(t * Math.PI) * 0.6 - t * t * 1.3,
        w = Math.sin(t * Math.PI) ** 0.65 * (0.75 - 0.25 * t);
      for (const side of [-1, 1]) {
        const a = [x - 0.09, y, 0],
          b = [x + 0.23, y - 0.22, w * side],
          c = [x + 0.4, y - 0.32, w * 0.82 * side];
        tri(a, b, c, 0.5 + rand() * 0.3);
        tri(a, c, [x + 0.06, y - 0.06, 0], 0.55 + rand() * 0.3);
      }
      tri(
        [x - 0.09, y, 0.022],
        [x + 0.15, y - 0.04, 0.022],
        [x + 0.08, y, -0.022],
        0.6,
      );
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(v, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(color, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  const frondGeo = makeFrond();
  leafMat.vertexColors = true;
  leafMat.color.set("#a4ba72");
  const frondMatrices = [];
  function palm(x, z, h = 9) {
    const y = terrainHeight(x, z),
      bend = 0.35 + rand() * 0.6,
      points = [];
    for (let i = 0; i <= 9; i++)
      points.push(
        new T.Vector3(
          x + bend * (i / 9) ** 2,
          y + (h * i) / 9,
          z + 0.2 * Math.sin((i / 9) * Math.PI),
        ),
      );
    const curve = new T.CatmullRomCurve3(points);
    geometry(new T.TubeGeometry(curve, 10, 0.16, 6, false), wood);
    const top = points[9];
    for (let i = 0; i < 11; i++) {
      const o = new T.Object3D();
      o.position.copy(top);
      o.rotation.set(
        0,
        (i / 11) * Math.PI * 2 + rand() * 0.2,
        -0.25 + rand() * 0.32,
      );
      o.scale.setScalar(0.7 + rand() * 0.3);
      o.updateMatrix();
      frondMatrices.push(o.matrix.clone());
    }
    for (let i = 0; i < 3; i++)
      sphere(
        darkWood,
        [
          top.x + Math.cos(i * 2) * 0.2,
          top.y - 0.1,
          top.z + Math.sin(i * 2) * 0.2,
        ],
        [0.17, 0.22, 0.17],
      );
    palms.push([top.x, top.z, top.y]);
  }
  // A deliberately composed opening canopy and a grove deeper in the farm.
  for (const [x, z, h] of [
    [-6, 23, 10],
    [7, 22, 12],
    [-11, 14, 11],
    [10, 12, 10],
    [-17, 5, 11],
    [-4, -3, 10],
    [16, -4, 11],
    [5, -21, 12],
    [-10, -27, 10],
    [-17, -34, 11],
    [6, -36, 10],
    [15, -38, 11],
    [-5, -48, 10],
  ])
    palm(x, z, h);
  for (let i = 0; i < 58; i++) {
    const x = (rand() - 0.5) * 75,
      z = rand() * 100 - 68;
    if (
      Math.abs(x) < 6 ||
      Math.hypot(x + 10, z - 1) < 10 ||
      cottages.some((c) => Math.hypot(x - c.x, z - c.z) < 8)
    )
      continue;
    palm(x, z, 8 + rand() * 6);
  }
  const leaves = new T.InstancedMesh(frondGeo, leafMat, frondMatrices.length);
  frondMatrices.forEach((m, i) => leaves.setMatrixAt(i, m));
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  world.add(leaves);
  // A small stone pond with continuous animated water, surrounded by reeds.
  for (let i = 0; i < 65; i++) {
    const a = (i / 65) * Math.PI * 2;
    rock(-10 + Math.cos(a) * 6.4, 1 + Math.sin(a) * 4.1, 0.35 + rand() * 0.45);
  }
  const waterShader = {
    ...Reflector.ReflectorShader,
    uniforms: T.UniformsUtils.clone(Reflector.ReflectorShader.uniforms),
  };
  waterShader.uniforms.time = { value: 0 };
  waterShader.fragmentShader =
    "uniform float time;\n" +
    waterShader.fragmentShader.replace(
      "texture2DProj( tDiffuse, vUv )",
      "texture2DProj( tDiffuse, vUv + vec4(sin(vUv.y*21.+time*.5)*.002,cos(vUv.x*18.+time*.4)*.002,0.,0.) )",
    );
  const water = new Reflector(new T.CircleGeometry(1, 64), {
    textureWidth: 512,
    textureHeight: 512,
    color: 0x839c87,
    clipBias: 0.004,
    shader: waterShader,
    multisample: 0,
  });
  water.rotation.x = -Math.PI / 2;
  water.scale.set(6.1, 3.8, 1);
  water.position.set(-10, -0.24, 1);
  world.add(water);

  // A jetty and simple timber bench give the pond a human scale.
  for (let i = 0; i < 18; i++)
    box(wood, [-4.5 - i * 0.19, 0.1, 1], [0.16, 0.12, 1.5]);
  box(wood, [-4.3, 0.72, 2.6], [2, 0.13, 0.6]);
  for (const xx of [-5.1, -3.5])
    box(darkWood, [xx, 0.34, 2.6], [0.1, 0.7, 0.5]);
  // Open meditation pavilion and yoga mats, beneath the boulder hills.
  box(stone, [-8, 0.22, -32], [8, 0.45, 7]);
  for (let i = 0; i < 34; i++)
    box(wood, [-11.8 + i * 0.23, 0.5, -32], [0.21, 0.12, 6.9]);
  for (const xx of [-11.5, -4.5])
    for (const zz of [-35, -29]) box(wood, [xx, 2.25, zz], [0.2, 3.6, 0.2]);
  box(darkWood, [-8, 4.14, -32], [8.8, 0.25, 7.8]);
  box(roof, [-8, 4.4, -32], [9, 0.3, 8]);
  for (let i = 0; i < 4; i++)
    box(linen, [-10.5 + i * 1.6, 0.61, -31.5], [0.85, 0.025, 1.9]);
  for (const [x, z, s] of [
    [-18, -40, 6],
    [-13, -46, 8],
    [-24, -49, 10],
    [-3, -52, 7],
    [15, -58, 10],
    [25, -55, 8],
    [-29, -25, 6],
  ]) {
    rock(x, z, s);
    rock(x + s * 0.4, z + 2, s * 0.6);
  }
  // A coconut grove around the working-farm cart; real animals are shown in photographs.
  for (let k = 0; k < 12; k++)
    palm(12 + (k % 4) * 5, -40 - Math.floor(k / 4) * 6, 6.5 + rand() * 2);
  // A bullock cart with spoke wheels, beside the orchard.
  box(wood, [9, 0.86, -44], [1.7, 0.13, 2.8]);
  for (const xx of [8.15, 9.85]) {
    box(wood, [xx, 1.3, -44], [0.08, 0.75, 2.8]);
    const ring = new T.TorusGeometry(0.63, 0.055, 6, 20);
    geometry(ring, darkWood, [xx, 0.67, -43.5], [1, 1, 1], [0, Math.PI / 2, 0]);
    for (let j = 0; j < 10; j++) {
      const a = (j / 10) * Math.PI * 2;
      beam(
        [xx, 0.67, -43.5],
        [xx, 0.67 + Math.cos(a) * 0.6, -43.5 + Math.sin(a) * 0.6],
        0.023,
      );
    }
    ring.dispose();
    beam([xx, 0.8, -42.7], [xx, 0.6, -40.2], 0.055);
  }
  // Instanced ground vegetation: actual blades casting no expensive small shadows.
  const blade = new T.BufferGeometry();
  blade.setAttribute(
    "position",
    new T.Float32BufferAttribute(
      [
        -0.009, 0, 0, 0.009, 0, 0, 0.004, 0.18, 0.028, -0.005, 0.14, 0.016, 0,
        0.32, 0.065,
      ],
      3,
    ),
  );
  blade.setIndex([0, 1, 2, 0, 2, 3, 3, 2, 4]);
  blade.setAttribute(
    "color",
    new T.Float32BufferAttribute(Array(15).fill(1), 3),
  );
  blade.computeVertexNormals();
  grassMat.color.set("#d2dba2");
  grassMat.roughness = 1;
  const instances = [];
  for (let i = 0; i < 12500; i++) {
    const x = (rand() - 0.5) * 90,
      z = rand() * 110 - 68;
    const p = roadCurve.getPoint(Math.max(0, Math.min(1, (43 - z) / 103)));
    if (
      Math.abs(x - p.x) < 2.1 ||
      Math.hypot((x + 10) / 1.5, z - 1) < 4.5 ||
      cottages.some((c) => Math.hypot(x - c.x, z - c.z) < 5) ||
      Math.hypot(x + 8, z + 32) < 6
    )
      continue;
    dummy.position.set(x, terrainHeight(x, z), z);
    dummy.rotation.set(0, rand() * 6.28, 0);
    dummy.scale.setScalar(0.25 + rand() * 0.65);
    dummy.updateMatrix();
    instances.push(dummy.matrix.clone());
  }
  const grasses = new T.InstancedMesh(blade, grassMat, instances.length);
  instances.forEach((m, i) => {
    grasses.setMatrixAt(i, m);
    grasses.setColorAt(
      i,
      new T.Color().setHSL(0.18 + rand() * 0.08, 0.3, 0.35 + rand() * 0.2),
    );
  });
  world.add(grasses);
  // Merge the authored static architecture by material, keeping draw calls bounded.
  for (const [m, geos] of batches) {
    const merged = mergeGeometries(geos, false);
    if (!merged) throw new Error("FARM_GEOMETRY_MERGE");
    const mesh = new T.Mesh(merged, m);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    world.add(mesh);
    geos.forEach((g) => g.dispose());
  }
  const timeUniform = { value: 0 };
  leafMat.onBeforeCompile = (shader) => {
    shader.uniforms.farmTime = timeUniform;
    shader.vertexShader = "uniform float farmTime;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>\nfloat weight=clamp(position.x/4.8,0.,1.);transformed.y+=sin(farmTime*.8+position.x*.5)*weight*.07;transformed.z+=sin(farmTime*.6+position.x*.7)*weight*.06;`,
    );
  };
  // Golden dust/birds are geometry within the world, never DOM confetti.
  const birdGeo = new T.BufferGeometry(),
    bv = [];
  for (let i = 0; i < 12; i++) bv.push(-0.15, 0, 0, 0, 0.06, 0, 0.15, 0, 0);
  birdGeo.setAttribute("position", new T.Float32BufferAttribute(bv, 3));
  const birds = new T.LineSegments(
    birdGeo,
    new T.LineBasicMaterial({
      color: "#354337",
      transparent: true,
      opacity: 0.6,
    }),
  );
  birds.position.set(0, 17, -20);
  world.add(birds);
  const motes = new T.BufferGeometry(),
    mv = [];
  for (let i = 0; i < 75; i++)
    mv.push((rand() - 0.5) * 45, 1 + rand() * 6, rand() * 80 - 48);
  motes.setAttribute("position", new T.Float32BufferAttribute(mv, 3));
  const dust = new T.Points(
    motes,
    new T.PointsMaterial({
      color: "#f7db91",
      size: 0.045,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
  );
  world.add(dust);
  const landmarks = {
    gate: new T.Vector3(0, 2.5, 18),
    pond: new T.Vector3(-7.5, 0.6, 2),
    cottage: new T.Vector3(8.4, 1.8, -8.7),
    meditation: new T.Vector3(-8, 2.1, -29),
    farm: new T.Vector3(9, 1.8, -43),
  };
  let disposed = false,
    night = 0;
  function setLight(value) {
    night = value;
    if (crownMesh) crownMesh.material.color.setScalar(1 - value * 0.58);
    const day = new T.Color("#adbfaf"),
      dark = new T.Color("#1b3032");
    scene.background.copy(day).lerp(dark, value);
    scene.fog.color.copy(scene.background);
    hemi.intensity = 2.1 - value * 1.2;
    sun.intensity = 3.6 - value * 2.7;
    sun.color.set(value > 0.5 ? "#e6ac73" : "#ffdfac");
    moon.intensity = value * 0.85;
    glow.emissiveIntensity = 0.1 + value * 3;
    water.material.uniforms.color.value.set(value > 0.5 ? 0x56677b : 0x839c87);
    glass.emissive.set("#ffbd65");
    glass.emissiveIntensity = value * 0.8;
    dust.material.opacity = 0.3 + value * 0.45;
    return night;
  }
  function update(t, gate, cameraQuaternion) {
    if (crownMesh && cameraQuaternion) {
      palms.forEach(([x, z, y], i) => {
        crownPose.position.set(x, y, z);
        crownPose.quaternion.copy(cameraQuaternion);
        crownPose.rotateZ(Math.sin(t * 0.7 + i * 1.7) * 0.008);
        const size = 0.85 + (i % 7) * 0.045;
        crownPose.scale.set(10 * size, 6.666 * size, 1);
        crownPose.updateMatrix();
        crownMesh.setMatrixAt(i, crownPose.matrix);
      });
      crownMesh.instanceMatrix.needsUpdate = true;
    }
    timeUniform.value = t;
    water.material.uniforms.time.value = t;
    gates[0].rotation.y = gate * Math.PI * 0.49;
    gates[1].rotation.y = -gate * Math.PI * 0.49;
    birds.position.x = Math.sin(t * 0.06) * 25;
    birds.position.z = -25 + Math.cos(t * 0.06) * 18;
    birds.rotation.y = t * 0.06;
    dust.rotation.y = Math.sin(t * 0.03) * 0.025;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    const gs = new Set(),
      ms = new Set();
    scene.traverse((o) => {
      if (o.geometry) gs.add(o.geometry);
      if (o.material)
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          ms.add(m);
    });
    gs.forEach((g) => g.dispose());
    water.getRenderTarget().dispose();
    ms.forEach((m) => {
      if (m.map && m.map !== tex) m.map.dispose();
      m.dispose();
    });
    tex.dispose();
    boxGeo.dispose();
    sphereGeo.dispose();
    tileGeo.dispose();
    rockGeo.dispose();
  }
  function groundTexture(texture) {
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.repeat.set(45, 45);
    texture.colorSpace = T.SRGBColorSpace;
    groundMat.map = texture;
    groundMat.color.set("#b3c199");
    groundMat.needsUpdate = true;
  }
  function crownTexture(texture) {
    texture.colorSpace = T.SRGBColorSpace;
    const material = new T.MeshBasicMaterial({
      map: texture,
      alphaTest: 0.13,
      alphaToCoverage: true,
      side: T.DoubleSide,
      color: "#eef3da",
    });
    const geometry = new T.PlaneGeometry(1, 1);
    geometry.translate(-0.02, 0.04, 0);
    crownMesh = new T.InstancedMesh(geometry, material, palms.length);
    crownMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    crownMesh.frustumCulled = false;
    world.add(crownMesh);
    leaves.visible = false;
  }
  setLight(0);
  return {
    crownTexture,
    groundTexture,
    scene,
    world,
    gates,
    landmarks,
    update,
    setLight,
    dispose,
    stats: {
      palms: palms.length,
      fronds: frondMatrices.length,
      grass: instances.length,
      cottages: cottages.length,
    },
    sun,
  };
}
