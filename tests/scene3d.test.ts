import { expect, it } from "vitest";
import { createOffer } from "../src/core/db";
import { newElement } from "../src/core/catalog";
import { ensureLayout } from "../src/core/layout";
import * as THREE from "three";
import { buildScene, poseMover, createMoverStepper } from "../src/components/elevation/Kitchen3DViewport";

it("3D scena sa frižiderom, aspiratorom i dekorativnom napom se gradi", () => {
  const o = createOffer();
  o.elements = [
    newElement("fridge"),
    newElement("wall1"),
    newElement("reference038"),
    newElement("freeHood"),
  ];
  const { bounds } = buildScene(ensureLayout(o));
  expect(bounds.isEmpty()).toBe(false);
});

it("3D scena demo projekta ostaje u razumnim granicama (metri)", () => {
  const { bounds } = buildScene(ensureLayout(createOffer(true)));
  const size = bounds.getSize(new (bounds.min.constructor as any)());
  expect(Math.max(size.x, size.y, size.z)).toBeLessThan(10);
});

it("vrata i fioke se otvaraju u 3D, a bela tehnika ostaje zatvorena", () => {
  const o = createOffer();
  o.elements = [newElement("fridge")];
  expect(buildScene(ensureLayout(o)).movers).toHaveLength(0);
  const open = createOffer(true);
  const { movers } = buildScene(ensureLayout(open));
  expect(movers.length).toBeGreaterThan(0);
  const drawer = movers.find((m) => m.kind === "drawer");
  const door = movers.find((m) => m.kind === "door");
  if (drawer) {
    drawer.t = 1;
    poseMover(drawer);
    expect(drawer.pivot.position.z).toBeGreaterThan(drawer.home.z);
  }
  if (door) {
    door.t = 1;
    poseMover(door);
    expect(Math.abs(door.pivot.rotation.y)).toBeGreaterThan(1);
  }
});

it("vrata koja se otvaraju staju kada udare u drugi element", () => {
  const built = buildScene(ensureLayout(createOffer(true)));
  const door = built.movers.find((m) => m.kind === "door")!;
  // Prepreka tamo gde bi se otvorena vrata našla.
  door.t = 1;
  poseMover(door);
  door.pivot.updateMatrixWorld(true);
  const mesh = door.pivot.children.find((c) => c instanceof THREE.Mesh) as THREE.Mesh;
  const hit = new THREE.Box3().setFromObject(mesh);
  door.t = 0;
  poseMover(door);
  const size = hit.getSize(new THREE.Vector3()),
    center = hit.getCenter(new THREE.Vector3());
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, size.z),
    new THREE.MeshBasicMaterial(),
  );
  wall.position.copy(center);
  wall.userData.item = { other: true };
  built.root.add(wall);
  const step = createMoverStepper(built);
  door.target = 1;
  for (let i = 0; i < 200; i++) step();
  expect(door.t).toBeGreaterThan(0);
  expect(door.t).toBeLessThan(0.99);
  expect(door.target).toBe(door.t);
});

it("vrata bez prepreke se otvore do kraja", () => {
  const o = createOffer();
  o.elements = [newElement("base2")];
  const built = buildScene(ensureLayout(o));
  const step = createMoverStepper(built);
  for (const m of built.movers) m.target = 1;
  for (let i = 0; i < 200; i++) step();
  expect(built.movers.length).toBeGreaterThan(0);
  expect(built.movers.every((m) => m.t > 0.99)).toBe(true);
});

it("izvlačni za boce ima žičane korpe koje se izvlače sa frontom", () => {
  const o = createOffer();
  o.elements = [newElement("reference020")];
  const built = buildScene(ensureLayout(o));
  expect(built.movers).toHaveLength(1);
  const m = built.movers[0];
  expect(m.kind).toBe("drawer");
  // front, ručka i žice su na istom pokretnom delu
  expect(m.pivot.children.length).toBeGreaterThan(30);
  const step = createMoverStepper(built);
  m.target = 1;
  for (let i = 0; i < 100; i++) step();
  expect(m.t).toBeGreaterThan(0.99);
});

it("mašina za sudove u 3D ima komandnu traku i svetla, nije običan element", () => {
  const o = createOffer();
  o.elements = [newElement("dishwasherBuilt")];
  const plain = buildScene(ensureLayout(o));
  let count = 0;
  plain.root.traverse((m) => m instanceof THREE.Mesh && count++);
  // karkas (5) + vrata + traka + svetla + ručka/prorez + ventilacija + pod
  expect(count).toBeGreaterThan(14);
  expect(plain.movers).toHaveLength(0);
});

it("sudopera u 3D: radna ploča je isečena, ispod je čelična šolja i slavina", () => {
  const o = createOffer();
  o.elements = [newElement("sink")];
  const top = newElement("worktop", o.selection);
  top.autoTopFor = "A";
  o.elements.push(top);
  const built = buildScene(ensureLayout(o));
  let cylinders = 0;
  built.root.traverse((m) => {
    if (m instanceof THREE.Mesh && m.geometry instanceof THREE.CylinderGeometry) cylinders++;
  });
  // stub + izlivnik + vrh slavine
  expect(cylinders).toBe(3);
});

it("aspirator element ima jedna vrata čiji se smer može menjati i u 3D prati izbor", () => {
  for (const hinge of ["left", "right"] as const) {
    const o = createOffer();
    const hood = newElement("reference038");
    expect(hood.doors).toBe(1);
    hood.visual = { ...hood.visual, hinge };
    o.elements = [hood];
    const { movers } = buildScene(ensureLayout(o));
    expect(movers).toHaveLength(1);
    expect(movers[0].sign).toBe(hinge === "right" ? 1 : -1);
  }
});

it("vrata staju i kada udare u zid ili stub sobe, ne samo u drugi element", () => {
  const built = buildScene(ensureLayout(createOffer(true)));
  const door = built.movers.find((m) => m.kind === "door")!;
  door.t = 1;
  poseMover(door);
  door.pivot.updateMatrixWorld(true);
  const mesh = door.pivot.children.find((c) => c instanceof THREE.Mesh) as THREE.Mesh;
  const hit = new THREE.Box3().setFromObject(mesh);
  door.t = 0;
  poseMover(door);
  const size = hit.getSize(new THREE.Vector3()),
    center = hit.getCenter(new THREE.Vector3());
  // zid je tanka ploča bez elementa
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(size.x, 0.02), size.y, Math.max(size.z, 0.02)),
    new THREE.MeshBasicMaterial(),
  );
  wall.position.copy(center);
  wall.userData.obstacle = true;
  built.root.add(wall);
  const step = createMoverStepper(built);
  door.target = 1;
  for (let i = 0; i < 200; i++) step();
  expect(door.t).toBeLessThan(0.99);
});

it("visoki element sa dvoja vrata jedna iznad drugih: svaka vrata imaju svoj smer", () => {
  const o = createOffer();
  const pantry = newElement("tallPantry");
  pantry.visual = { ...pantry.visual, hinges: ["right", "right"] };
  o.elements = [pantry];
  const { movers } = buildScene(ensureLayout(o));
  expect(movers).toHaveLength(2);
  expect(movers.every((m) => m.sign === 1)).toBe(true);
  pantry.visual = { ...pantry.visual, hinges: ["left", "right"] };
  const again = buildScene(ensureLayout(o)).movers;
  // vrata se crtaju odozdo: donja (desno) pa gornja (levo)
  expect(again.map((m) => m.sign)).toEqual([1, -1]);
});
