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
