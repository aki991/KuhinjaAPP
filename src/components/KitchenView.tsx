import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Copy,
  Trash2,
  Save,
  MoreHorizontal,
  Ruler,
  Settings2,
  Sparkles,
  Undo2,
  Redo2,
  Search,
} from "lucide-react";
import {
  isFreestanding,
  libraryGroups,
  libraryTemplates,
  templates,
  newElement,
  uid,
  type Template,
} from "../core/catalog";
import {
  appendPlacement,
  displayProject,
  elementCodes,
  moveLayoutItem,
  newSpacer,
  packLayout,
  relocateItem,
  isBridge,
  isSpacer,
  laneOf,
  rowName,
  rowOf,
  sameLane,
  wallElements,
  wallUsage,
  span,
  spaceChange,
} from "../core/layout";
import type {
  KitchenElement,
  LayoutItem,
  LayoutLane,
  Offer,
  Product,
} from "../core/types";
import useKitchenFullscreen from "./useKitchenFullscreen";
import ElementStrip from "./elevation/ElementStrip";
import LibraryThumbnail from "./elevation/LibraryThumbnail";
import { elevationScene, freeUpperLength } from "../core/elevation";
import { kitchenPlan, islandFootprint } from "../core/top-view";
import ElevationViewport from "./elevation/ElevationViewport";
import TopViewport from "./elevation/TopViewport";
// three.js is loaded only when the 3D view is opened.
const Kitchen3DViewport = lazy(() => import("./elevation/Kitchen3DViewport"));
import WallSettingsEditor, {
  WallObjectEditor,
} from "./elevation/WallSettingsEditor";
import { Cabinet, Field, Modal, ModalPortalContext, number } from "./UI";
import ElementEditor from "./ElementEditor";
import SpacerEditor from "./SpacerEditor";
import PresetPicker from "./PresetPicker";
import { matchesLibrary } from "../core/library-search";
import useLayoutDrag from "./useLayoutDrag";
export default function KitchenView({
  offer,
  onChange,
  onSave,
  onPrice,
  products = [],
}: {
  products?: Product[];
  offer: Offer;
  onChange: (o: Offer) => void;
  onSave: () => Promise<void>;
  onPrice: () => void;
}) {
  const [library, setLibrary] = useState(false),
    [group, setGroup] = useState("Donji"),
    [inlineGroup, setInlineGroup] = useState("Donji"),
    [libraryQuery, setLibraryQuery] = useState(""),
    [editor, setEditor] = useState<LayoutItem | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [wallModal, setWallModal] = useState(false),
    [presetModal, setPresetModal] = useState(false),
    [clearModal, setClearModal] = useState(false),
    [wallEditId, setWallEditId] = useState("A"),
    [wallLength, setWallLength] = useState(3000),
    [projectModal, setProjectModal] = useState(false),
    [client, setClient] = useState(offer.client),
    [confirmMove, setConfirmMove] = useState(false),
    [objectEditId, setObjectEditId] = useState<string | null>(null),
    [addWall, setAddWall] = useState(false),
    [previewWall, setPreviewWall] = useState<string | null>(null),
    [dragNotice, setDragNotice] = useState("");
  const [elevationScale, setElevationScale] = useState(0.14),
    [visualSettings, setVisualSettings] = useState(false),
    [moveItem, setMoveItem] = useState<LayoutItem | null>(null),
    [moveWall, setMoveWall] = useState("A"),
    [moveRow, setMoveRow] = useState<LayoutLane>("base"),
    [moveIndex, setMoveIndex] = useState(1);
  const host = useRef<HTMLElement>(null),
    fullscreen = useKitchenFullscreen(host);
  const [focusRequest, setFocusRequest] = useState(0);
  const [view, setView] = useState<"front" | "top" | "3d">("front");
  useEffect(() => {
    if (!fullscreen.active) setEditor(null);
  }, [fullscreen.active]);
  const root = useRef<HTMLDivElement>(null),
    packed = useMemo(
      () => packLayout(offer.elements, offer.layout!, offer.elevation),
      [offer.elements, offer.layout, offer.elevation],
    ),
    layout = packed.layout;
  const roomWalls = layout.walls.filter((w) => w.id !== "island"),
    wall =
      roomWalls.find((w) => w.id === (previewWall || layout.activeWall)) ||
      roomWalls[0] ||
      layout.walls[0],
    elements = wallElements(packed.elements, wall.id, layout),
    usage = wallUsage(packed.elements, wall, layout),
    codes = elementCodes(offer.elements, layout);
  const bridges = elements.filter(isBridge),
    hasBridge = bridges.length > 0,
    bridgeFree = Math.max(
      0,
      wall.length - bridges.reduce((sum, item) => sum + span(item), 0),
    );
  const wallToEdit = layout.walls.find((w) => w.id === wallEditId);
  const requestedShape = client.layout,
    pendingSpace =
      projectModal && requestedShape !== offer.client.layout
        ? spaceChange(offer, requestedShape)
        : null,
    islandEditing = !!editor && editor.placement?.wall === "island";
  /** Island footprint/position for an element draft; pos: undefined = saved, null = automatic. */
  const islandPlan = (
    draft: KitchenElement,
    pos?: { x: number; y: number } | null,
  ) => {
    const elements = offer.elements.some((e) => e.id === draft.id)
      ? offer.elements.map((e) => (e.id === draft.id ? draft : e))
      : [...offer.elements, draft];
    const nextLayout = {
      ...layout,
      ...(pos === undefined ? {} : { islandPosition: pos ?? undefined }),
    };
    const result = kitchenPlan(
      { ...offer, elements, layout: nextLayout },
      "all",
    );
    const island = result.walls.find((w) => w.island);
    if (!island) return null;
    return {
      x: Math.round(island.x),
      y: Math.round(island.y),
      width: island.scene.length,
      depth: islandFootprint(island.scene).depth,
      warnings: result.warnings.filter((w) => w.startsWith("Ostrvo")),
    };
  };
  const change = (patch: Partial<Offer>) => {
    setDragNotice("");
    onChange({ ...offer, ...patch, updatedAt: new Date().toISOString() });
  };
  const chooseWall = (id: string) => {
    setDragNotice("");
    change({ layout: { ...layout, activeWall: id } });
  };
  const editWallLength = (id: string) => {
    const target = layout.walls.find((w) => w.id === id);
    if (!target) return;
    setWallEditId(id);
    setWallLength(target.length);
    setWallModal(true);
  };
  function saveItem(
    item: LayoutItem,
    prices?: Product[],
    extra?: { islandPosition: { x: number; y: number } | null },
  ) {
    const nextElements = isSpacer(item)
      ? offer.elements
      : offer.elements.some((e) => e.id === item.id)
        ? offer.elements.map((e) => (e.id === item.id ? item : e))
        : [...offer.elements, item];
    const nextLayout = isSpacer(item)
      ? {
          ...layout,
          spacers: layout.spacers!.some((s) => s.id === item.id)
            ? layout.spacers!.map((s) => (s.id === item.id ? item : s))
            : [...layout.spacers!, item],
        }
      : extra
        ? { ...layout, islandPosition: extra.islandPosition ?? undefined }
        : layout;
    const result = relocateItem(
      nextElements,
      nextLayout,
      item.id,
      item.placement!.wall,
      laneOf(item),
      item.placement!.order ?? Number.MAX_SAFE_INTEGER,
      offer.elevation,
    );
    // The first base cabinet on a wall brings one worktop for the whole run; it grows with the cabinets.
    let withTop = result?.elements;
    if (
      result &&
      !isSpacer(item) &&
      !offer.elements.some((e) => e.id === item.id) &&
      templates.find((t) => t.kind === item.kind)?.group === "Donji" &&
      !isFreestanding(item.kind) &&
      !result.elements.some(
        (e) => e.kind === "worktop" && e.placement?.wall === item.placement!.wall,
      )
    ) {
      const top = newElement("worktop", offer.selection);
      top.autoTopFor = item.placement!.wall;
      top.width = item.width * item.quantity;
      top.placement = appendPlacement(
        result.elements,
        top,
        item.placement!.wall,
        result.layout,
      );
      withTop = packLayout([...result.elements, top], result.layout, offer.elevation).elements;
    }
    if (result)
      change({
        ...result,
        ...(withTop ? { elements: withTop } : {}),
        ...(prices ? { prices } : {}),
        layout: {
          ...result.layout,
          activeWall:
            item.placement!.wall === "island" ? wall.id : item.placement!.wall,
        },
      });
    setSelected(item.id);
    setFocusRequest((n) => n + 1);
    setDragNotice("");
    if (item.placement?.wall === "island") setView("top");
    else if (!offer.elements.some((e) => e.id === item.id) && !isSpacer(item)) {
      setView("front");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }
  function addTemplate(t: Template, immediate: boolean) {
    const item = newElement(t.kind, offer.selection);
    const island = t.group === "Ostrvski";
    const target = island ? "island" : wall.id;
    const nextLayout =
      island && !layout.walls.some((w) => w.id === "island")
        ? {
            ...layout,
            walls: [
              ...layout.walls,
              { id: "island", name: "Ostrvo", length: 3000 },
            ],
          }
        : layout;
    item.placement = appendPlacement(offer.elements, item, target, nextLayout);
    if (immediate) {
      const result = relocateItem(
        [...offer.elements, item],
        nextLayout,
        item.id,
        target,
        laneOf(item),
        Number.MAX_SAFE_INTEGER,
        offer.elevation,
      );
      const active = island ? wall.id : target;
      if (result)
        change({ ...result, layout: { ...result.layout, activeWall: active } });
      setSelected(item.id);
      setView(island ? "top" : "front");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      if (nextLayout !== layout)
        change({
          layout: { ...nextLayout, activeWall: island ? wall.id : target },
        });
      setEditor(item);
      setLibrary(false);
    }
  }
  function addSpacerDirect() {
    const item = newSpacer(wall.id, "base");
    item.placement = appendPlacement(offer.elements, item, wall.id, layout);
    saveItem(item);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  // Undo / redo of the kitchen itself: elements, layout, materials and wall settings.
  type Snapshot = Pick<Offer, "elements" | "layout" | "selection" | "elevation">;
  const snap = (o: Offer): Snapshot => ({
    elements: o.elements,
    layout: o.layout,
    selection: o.selection,
    elevation: o.elevation,
  });
  const history = useRef({
    past: [] as Snapshot[],
    future: [] as Snapshot[],
    prev: snap(offer),
    skip: false,
  });
  const [, setHistoryTick] = useState(0);
  useEffect(() => {
    const h = history.current,
      now = snap(offer);
    if (
      h.prev.elements === now.elements &&
      h.prev.layout === now.layout &&
      h.prev.selection === now.selection &&
      h.prev.elevation === now.elevation
    )
      return;
    if (h.skip) h.skip = false;
    else if (JSON.stringify(h.prev) === JSON.stringify(now)) {
      // Saving or normalising rebuilds the objects without changing anything.
      h.prev = now;
      return;
    } else {
      h.past.push(h.prev);
      if (h.past.length > 100) h.past.shift();
      h.future = [];
    }
    h.prev = now;
    setHistoryTick((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer.elements, offer.layout, offer.selection, offer.elevation]);
  const travel = (direction: "undo" | "redo") => {
    const h = history.current,
      from = direction === "undo" ? h.past : h.future,
      to = direction === "undo" ? h.future : h.past,
      target = from.pop();
    if (!target) return;
    to.push(h.prev);
    h.skip = true;
    setSelected(null);
    setEditor(null);
    setDragNotice("");
    onChange({ ...offer, ...target, updatedAt: new Date().toISOString() });
    setHistoryTick((n) => n + 1);
  };
  const undo = () => travel("undo"),
    redo = () => travel("redo");
  const undoRef = useRef({ undo, redo });
  undoRef.current = { undo, redo };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]"))
        return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) undoRef.current.undo();
      else if (k === "y" || (k === "z" && e.shiftKey)) undoRef.current.redo();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const toolbarButtons = (
    <>
      <button
        className="text-btn clear-all"
        aria-label="Obriši sve elemente"
        disabled={!offer.elements.length}
        onClick={() => setClearModal(true)}
      >
        <Trash2 size={17} /> Obriši sve
      </button>
      <button
        className="icon-btn history-btn history-first"
        aria-label="Poništi poslednju izmenu"
        title="Poništi (Ctrl+Z)"
        disabled={!history.current.past.length}
        onClick={undo}
      >
        <Undo2 size={19} />
      </button>
      <button
        className="icon-btn history-btn"
        aria-label="Vrati poništenu izmenu"
        title="Vrati (Ctrl+Y)"
        disabled={!history.current.future.length}
        onClick={redo}
      >
        <Redo2 size={19} />
      </button>
    </>
  );
  const scale = elevationScale;
  const scene = useMemo(() => elevationScene(offer, wall.id), [offer, wall.id]);
  const upperFree = freeUpperLength(scene, packed.elements, layout);
  const { drag, canOpen } = useLayoutDrag({
    root,
    offer,
    scale,
    onHoverWall: setPreviewWall,
    onFinish: () => setPreviewWall(null),
    onInvalid: setDragNotice,
    onDrop: (id, target) => {
      const result = relocateItem(
        offer.elements,
        layout,
        id,
        target.wall,
        target.row,
        target.index,
        offer.elevation,
      );
      if (result) {
        change({
          ...result,
          layout: { ...result.layout, activeWall: target.wall },
        });
        setSelected(id);
        setDragNotice("");
      }
    },
  });
  function selectItem(e: LayoutItem) {
    setSelected(e.id);
    setFocusRequest((n) => n + 1);
    setEditor(e);
  }
  function duplicate(e: LayoutItem) {
    const copy = { ...structuredClone(e), id: uid() };
    copy.placement = appendPlacement(
      offer.elements,
      copy,
      e.placement?.wall || wall.id,
      layout,
    );
    saveItem(copy);
  }
  function removeItem(e: LayoutItem) {
    const rest = offer.elements.filter(
        (x) => x.id !== e.id && x.autoTopFor !== e.id,
      ),
      spacers = layout.spacers!.filter((x) => x.id !== e.id),
      islandLeft = [...rest, ...spacers].some(
        (x) => x.placement?.wall === "island",
      );
    change({
      elements: rest,
      layout: {
        ...layout,
        spacers,
        ...(islandLeft
          ? {}
          : {
              walls: layout.walls.filter((w) => w.id !== "island"),
              islandPosition: undefined,
            }),
      },
    });
    if (selected === e.id) setSelected(null);
  }
  function editorActions(item: LayoutItem) {
    const scope =
      item.placement?.wall === "island"
        ? wallElements(packed.elements, "island", layout)
        : elements;
    if (!scope.some((e) => e.id === item.id)) return null;
    const lane = scope.filter((e) => sameLane(item, e)),
      index = lane.findIndex((e) => e.id === item.id);
    const move = (direction: -1 | 1) => {
      const result = moveLayoutItem(
        offer.elements,
        layout,
        item.id,
        direction,
        offer.elevation,
      );
      if (result) {
        change(result);
        setEditor(null);
      }
    };
    return (
      <div className="element-editor-actions">
        <button
          type="button"
          hidden
          aria-label={`Pomeri ${codes.get(item.id)} levo`}
          disabled={index === 0 || laneOf(item) === "extra"}
          onClick={() => move(-1)}
        >
          <ArrowLeft size={18} />
          Levo
        </button>
        <button
          type="button"
          hidden
          aria-label={`Pomeri ${codes.get(item.id)} desno`}
          disabled={index === lane.length - 1 || laneOf(item) === "extra"}
          onClick={() => move(1)}
        >
          <ArrowRight size={18} />
          Desno
        </button>
        <button
          type="button"
          className="editor-duplicate"
          hidden={item.kind === "worktop"}
          onClick={() => {
            duplicate(item);
            setEditor(null);
          }}
        >
          <Copy size={18} />
          Dupliraj
        </button>
        <button
          type="button"
          hidden
          onClick={() => {
            setMoveItem(item);
            setMoveWall(item.placement!.wall);
            setMoveRow(laneOf(item));
            setMoveIndex((item.placement?.order || 0) + 1);
            setEditor(null);
          }}
        >
          <ArrowRight size={18} />
          Pomeri
        </button>
        <button
          type="button"
          className="editor-delete"
          aria-label={`Obriši ${codes.get(item.id)}`}
          onClick={() => {
            removeItem(item);
            setEditor(null);
          }}
        >
          <Trash2 size={18} />
          Obriši
        </button>
      </div>
    );
  }
  const moving = drag
    ? [...offer.elements, ...(layout.spacers || [])].find(
        (e) => e.id === drag.id,
      )
    : null;
  return (
    <ModalPortalContext.Provider
      value={fullscreen.active ? host.current : null}
    >
      <section
        ref={host}
        className={`kitchen-view ${fullscreen.active ? "kitchen-fullscreen" : ""} ${fullscreen.active && (editor || moveItem) ? "has-element-editor" : ""}`}
      >
        <div className="kitchen-worktop" ref={root}>
          <div className="project-heading">
            <h1>{displayProject(offer.client.project)}</h1>
            <button
              className="icon-btn"
              aria-label="Podaci o projektu"
              onClick={() => {
                setClient({ ...offer.client });
                setConfirmMove(false);
                setProjectModal(true);
              }}
            >
              <MoreHorizontal size={24} />
            </button>
            <button
              className="icon-btn save-project"
              aria-label="Sačuvaj projekat"
              onClick={() => void onSave()}
            >
              <Save size={22} />
            </button>
          </div>
          <div className="wall-tabs" aria-label="Zidovi">
            {roomWalls.map((w) => (
              <button
                key={w.id}
                data-wall-target={w.id}
                className={w.id === wall.id ? "active" : ""}
                aria-pressed={w.id === wall.id}
                onClick={() => {
                  if (canOpen()) chooseWall(w.id);
                }}
              >
                {w.name}
              </button>
            ))}
            <button
              className="add-wall"
              aria-label="Dodaj zid"
              onClick={() => setAddWall(true)}
            >
              <Plus size={19} />
            </button>
            <div
              className="kitchen-view-modes"
              role="group"
              aria-label="Pogled kuhinje"
            >
              {(
                [
                  ["front", "Spreda"],
                  ["top", "Odozgo"],
                  ["3d", "3D"],
                ] as const
              )
                .filter(([v]) => v !== view)
                .map(([v, label]) => (
                  <button key={v} onClick={() => setView(v)}>
                    {label}
                  </button>
                ))}
            </div>
          </div>
          <div
            className={`wall-measure ${usage.overrun ? "over-capacity" : ""}`}
          >
            <div className="wall-measure-left">
              <button
                className="wall-length"
                aria-label="Okviri i mere"
                onClick={() => setVisualSettings(true)}
              >
                <Settings2 size={20} />
                <strong>Okviri i mere</strong>
              </button>
              <button
                className="wall-length preset-open"
                onClick={() => setPresetModal(true)}
              >
                <Sparkles size={20} />
                <strong>Predlozi kuhinja</strong>
              </button>
            </div>
            <div className="wall-free-space">
              <span>Slobodno:</span>
              <span>
                Donji red <strong>{number(usage.freeBase / 10)} cm</strong>
              </span>
              <span>
                Viseći red <strong>{number(upperFree / 10)} cm</strong>
              </span>
              {hasBridge && (
                <span>
                  Most <strong>{number(bridgeFree / 10)} cm</strong>
                </span>
              )}
            </div>
          </div>
          {usage.overrun > 0 && (
            <div className="layout-warning" role="alert">
              Elementi prelaze zid za {number(usage.overrun / 10)} cm.
            </div>
          )}
          {dragNotice && (
            <div className="layout-warning" role="alert">
              {dragNotice}
            </div>
          )}
          {view === "3d" ? (
            <Suspense
              fallback={
                <p className="kitchen-3d-hint">Učitavanje 3D prikaza…</p>
              }
            >
              <Kitchen3DViewport
                offer={offer}
                fullscreen={fullscreen.active}
                onFullscreen={() => void fullscreen.enter()}
                onCloseFullscreen={() => void fullscreen.exit()}
                onSelect={(item) => selectItem(item)}
                toolbarExtra={toolbarButtons}
              />
            </Suspense>
          ) : view === "top" ? (
            <TopViewport
              offer={offer}
              scene={scene}
              selected={selected}
              onSelect={(item) => {
                if (
                  item.placement?.wall !== "island" &&
                  item.placement?.wall !== layout.activeWall
                )
                  change({
                    layout: { ...layout, activeWall: item.placement!.wall },
                  });
                selectItem(item);
              }}
              fullscreen={fullscreen.active}
              onFullscreen={() => void fullscreen.enter()}
              onCloseFullscreen={() => void fullscreen.exit()}
              onFront={() => setView("front")}
              walls={roomWalls}
              onChooseWall={chooseWall}
              onEditWall={editWallLength}
              toolbarExtra={toolbarButtons}
            />
          ) : (
            <ElevationViewport
              scene={scene}
              scale={scale}
              onScale={setElevationScale}
              selected={selected}
              drag={drag}
              onSelect={(e) => {
                if (canOpen()) selectItem(e);
              }}
              fullscreen={fullscreen.active}
              focusRequest={focusRequest}
              onFullscreen={() => void fullscreen.enter()}
              onCloseFullscreen={() => void fullscreen.exit()}
              walls={roomWalls}
              onChooseWall={chooseWall}
              onTopView={() => setView("top")}
              onObject={setObjectEditId}
              onEditWall={editWallLength}
              toolbarExtra={toolbarButtons}
            />
          )}
          <ElementStrip
            hidden={fullscreen.active}
            items={elements}
            scene={scene}
            selected={selected}
            onPick={selectItem}
          />
          {!fullscreen.active && (
            <div className="library-search" role="search">
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                value={libraryQuery}
                onChange={(e) => setLibraryQuery(e.target.value)}
                placeholder="Pretraži element ili belu tehniku"
                aria-label="Pretraži kuhinjske elemente i belu tehniku"
              />
            </div>
          )}
          {!fullscreen.active && (
            <section
              className="kitchen-inline-library"
              aria-label="Biblioteka elemenata"
            >
              <div
                className="library-filter"
                hidden={!!libraryQuery.trim()}
                role="group"
                aria-label="Tip elementa u biblioteci"
              >
                {["Donji", "Viseći", "Visoki", "Most", "Ostali"].map(
                  (category) => (
                    <button
                      key={category}
                      type="button"
                      aria-pressed={inlineGroup === category}
                      onClick={() => setInlineGroup(category)}
                    >
                      {category}
                    </button>
                  ),
                )}
              </div>
              <div>
                <div className="library-grid">
                  {libraryTemplates
                    .filter((t) =>
                      libraryQuery.trim()
                        ? matchesLibrary(t, libraryQuery)
                        : inlineGroup === "Ostali"
                          ? ["Ostrvski", "Dodaci"].includes(t.group)
                          : t.group === inlineGroup,
                    )
                    .map((t) => (
                      <button
                        key={t.kind}
                        type="button"
                        onClick={() => addTemplate(t, false)}
                        aria-label={`Dodaj ${t.name}`}
                      >
                        <LibraryThumbnail template={t} offer={offer} />
                        <strong>{t.name}</strong>
                      </button>
                    ))}
                  {libraryQuery.trim() &&
                    !libraryTemplates.some((t) =>
                      matchesLibrary(t, libraryQuery),
                    ) && (
                      <p className="library-empty">
                        Nema rezultata za „{libraryQuery.trim()}“.
                      </p>
                    )}
                  {!libraryQuery.trim() && inlineGroup === "Ostali" && (
                    <button
                      type="button"
                      onClick={addSpacerDirect}
                      aria-label="Dodaj namerni razmak"
                    >
                      <LibraryThumbnail offer={offer} />
                      <strong>Namerni razmak</strong>
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
        {!elements.length && (
          <div className="kitchen-empty">
            <Cabinet size={58} />
            <p>Dodajte prvi element na {wall.name.toLowerCase()}.</p>
          </div>
        )}
        {!!layout.migrationNotes?.length && (
          <details className="disclosure">
            <summary>Napomena pri prenosu rasporeda</summary>
            {layout.migrationNotes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </details>
        )}
        {library && (
          <Modal title="Dodaj element" wide onClose={() => setLibrary(false)}>
            <div className="library-groups">
              {libraryGroups.map((g) => (
                <button
                  key={g}
                  className={g === group ? "active" : ""}
                  onClick={() => setGroup(g)}
                >
                  {g}
                </button>
              ))}
            </div>
            <div className="library-grid">
              {libraryTemplates
                .filter((t) => t.group === group)
                .map((t) => (
                  <button key={t.kind} onClick={() => addTemplate(t, false)}>
                    <LibraryThumbnail template={t} offer={offer} />
                    <strong>{t.name}</strong>
                  </button>
                ))}
              {group !== "Visoki" &&
                group !== "Ostrvski" &&
                group !== "Most" && (
                  <button
                    onClick={() => {
                      const spacer = newSpacer(
                        wall.id,
                        group === "Viseći" ? "wall" : "base",
                      );
                      spacer.placement = appendPlacement(
                        offer.elements,
                        spacer,
                        wall.id,
                        layout,
                      );
                      setEditor(spacer);
                      setLibrary(false);
                    }}
                  >
                    <LibraryThumbnail offer={offer} />
                    <strong>Razmak</strong>
                  </button>
                )}
            </div>
          </Modal>
        )}
        {editor &&
          (isSpacer(editor) ? (
            <SpacerEditor
              offer={offer}
              actions={editorActions(editor)}
              spacer={editor}
              layout={layout}
              onClose={() => setEditor(null)}
              onSave={saveItem}
            />
          ) : (
            <ElementEditor
              offer={offer}
              actions={editorActions(editor)}
              element={editor}
              products={offer.prices}
              global={offer.selection}
              settings={offer.settings}
              walls={layout.walls}
              elements={offer.elements}
              layout={layout}
              islandPlan={islandEditing ? islandPlan : undefined}
              isNew={!offer.elements.some((e) => e.id === editor.id)}
              onClose={() => setEditor(null)}
              onSave={saveItem}
            />
          ))}
        {clearModal && (
          <Modal title="Obrisati sve elemente?" onClose={() => setClearModal(false)}>
            <p>
              Iz kuhinje će biti uklonjeni svi elementi ({offer.elements.length}{" "}
              kom). Prozori, vrata i mere zidova ostaju. Brisanje možete
              poništiti dugmetom za poništavanje.
            </p>
            <div className="editor-save">
              <button
                className="btn secondary full"
                onClick={() => setClearModal(false)}
              >
                Odustani
              </button>
              <button
                className="btn danger full"
                onClick={() => {
                  change({
                    elements: [],
                    layout: {
                      ...layout,
                      spacers: [],
                      walls: layout.walls.filter((w) => w.id !== "island"),
                      activeWall:
                        layout.activeWall === "island"
                          ? layout.walls[0].id
                          : layout.activeWall,
                      islandPosition: undefined,
                    },
                  });
                  setSelected(null);
                  setEditor(null);
                  setClearModal(false);
                }}
              >
                Da, obriši sve
              </button>
            </div>
          </Modal>
        )}
        {presetModal && (
          <PresetPicker
            offer={offer}
            products={products}
            onClose={() => setPresetModal(false)}
            onApply={(next) => {
              change({
                elements: next.elements,
                layout: next.layout,
                selection: next.selection,
                prices: next.prices,
              });
              setSelected(null);
              setEditor(null);
              setPresetModal(false);
              setView("front");
            }}
          />
        )}
        {visualSettings && (
          <WallSettingsEditor
            config={scene.config}
            wall={wall.id}
            wallLength={wall.length}
            shape={offer.client.layout}
            shapes={[
              ...new Set([
                "Prava kuhinja",
                "L kuhinja",
                "U kuhinja",
                offer.client.layout,
              ]),
            ]}
            affectedBy={(shape) => spaceChange(offer, shape).affected}
            onClose={() => setVisualSettings(false)}
            onSave={(elevation, length, shape) => {
              const space =
                  shape !== offer.client.layout
                    ? spaceChange(offer, shape)
                    : null,
                next = space?.offer ?? offer,
                gone = new Set(
                  layout.walls
                    .filter(
                      (w) => !next.layout!.walls.some((x) => x.id === w.id),
                    )
                    .map((w) => w.id),
                );
              change({
                ...(space?.offer || {}),
                client: { ...offer.client, layout: shape },
                elevation: {
                  ...elevation,
                  objects: elevation.objects.map((o) =>
                    gone.has(o.wall) ? { ...o, wall: "A" } : o,
                  ),
                },
                layout: {
                  ...next.layout!,
                  walls: next.layout!.walls.map((w) =>
                    w.id === wall.id ? { ...w, length } : w,
                  ),
                },
              });
            }}
          />
        )}
        {objectEditId && scene.objects.find((o) => o.id === objectEditId) && (
          <WallObjectEditor
            object={scene.objects.find((o) => o.id === objectEditId)!}
            wallLength={wall.length}
            wallHeight={scene.config.wallHeight}
            onClose={() => setObjectEditId(null)}
            onSave={(next) =>
              change({
                elevation: {
                  ...scene.config,
                  objects: scene.config.objects.map((o) =>
                    o.id === next.id ? next : o,
                  ),
                },
              })
            }
            onDelete={() =>
              change({
                elevation: {
                  ...scene.config,
                  objects: scene.config.objects.filter(
                    (o) => o.id !== objectEditId,
                  ),
                },
              })
            }
          />
        )}
        {moveItem && (
          <Modal
            title={`Pomeri ${codes.get(moveItem.id)}`}
            onClose={() => setMoveItem(null)}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const result = relocateItem(
                  offer.elements,
                  layout,
                  moveItem.id,
                  moveWall,
                  moveRow,
                  moveIndex - 1,
                  offer.elevation,
                );
                if (result) {
                  change({
                    ...result,
                    layout: { ...result.layout, activeWall: moveWall },
                  });
                  const target = result.layout.walls.find(
                    (w) => w.id === moveWall,
                  )!;
                  const over = wallUsage(
                    result.elements,
                    target,
                    result.layout,
                  ).overrun;
                  if (over)
                    setDragNotice(`Elementi prelaze zid za ${over} mm.`);
                  setMoveItem(null);
                }
              }}
            >
              <Field label="Zid / grupa">
                <select
                  value={moveWall}
                  onChange={(e) => setMoveWall(e.target.value)}
                >
                  {layout.walls.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </Field>
              {isSpacer(moveItem) && (
                <Field label="Red">
                  <select
                    value={moveRow}
                    onChange={(e) => setMoveRow(e.target.value as LayoutLane)}
                  >
                    <option value="base">Donji</option>
                    <option value="wall">Viseći</option>
                  </select>
                </Field>
              )}
              <Field label="Mesto u redu">
                <input
                  type="number"
                  inputMode="numeric"
                  required
                  min="1"
                  max="10000"
                  value={moveIndex}
                  onChange={(e) => setMoveIndex(Number(e.target.value))}
                />
              </Field>
              <button className="btn primary full" type="submit">
                Premesti
              </button>
            </form>
          </Modal>
        )}
        {wallModal && wallToEdit && (
          <Modal
            title={`Dužina · ${wallToEdit.name}`}
            onClose={() => setWallModal(false)}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                change({
                  layout: {
                    ...layout,
                    walls: layout.walls.map((w) =>
                      w.id === wallToEdit.id ? { ...w, length: wallLength } : w,
                    ),
                  },
                });
                setWallModal(false);
              }}
            >
              <Field label="Dužina zida (mm)">
                <input
                  className="large-number"
                  type="number"
                  inputMode="numeric"
                  min="100"
                  max="30000"
                  required
                  value={wallLength || ""}
                  onChange={(e) => setWallLength(Number(e.target.value))}
                />
              </Field>
              <button className="btn primary full">Sačuvaj</button>
            </form>
          </Modal>
        )}
        {addWall && (
          <Modal title="Dodaj zid" onClose={() => setAddWall(false)}>
            <div className="add-wall-options">
              {[
                { id: "A", name: "Zid A" },
                { id: "B", name: "Zid B" },
                { id: "C", name: "Zid C" },
              ]
                .filter((w) => !layout.walls.some((x) => x.id === w.id))
                .map((w) => (
                  <button
                    className="btn secondary full"
                    key={w.id}
                    onClick={() => {
                      const walls = [...layout.walls, { ...w, length: 3000 }],
                        count = walls.filter((x) => x.id !== "island").length;
                      change({
                        client: {
                          ...offer.client,
                          layout:
                            count >= 3
                              ? "U kuhinja"
                              : count === 2
                                ? "L kuhinja"
                                : "Prava kuhinja",
                        },
                        layout: { ...layout, walls, activeWall: w.id },
                      });
                      setAddWall(false);
                    }}
                  >
                    <Plus size={20} />
                    {w.name}
                  </button>
                ))}
              {roomWalls.length >= 3 && <p>Svi zidovi su dodati.</p>}
            </div>
          </Modal>
        )}
        {projectModal && (
          <Modal
            title="Podaci o projektu"
            onClose={() => setProjectModal(false)}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (pendingSpace?.affected && !confirmMove) return;
                change({ ...(pendingSpace?.offer || {}), client });
                setProjectModal(false);
              }}
            >
              <Field label="Naziv projekta">
                <input
                  required
                  value={client.project}
                  onChange={(e) =>
                    setClient({ ...client, project: e.target.value })
                  }
                />
              </Field>
              <Field label="Mušterija">
                <input
                  value={client.name}
                  onChange={(e) =>
                    setClient({ ...client, name: e.target.value })
                  }
                />
              </Field>
              <Field label="Telefon">
                <input
                  type="tel"
                  value={client.phone}
                  onChange={(e) =>
                    setClient({ ...client, phone: e.target.value })
                  }
                />
              </Field>
              <Field label="Lokacija">
                <input
                  value={client.location}
                  onChange={(e) =>
                    setClient({ ...client, location: e.target.value })
                  }
                />
              </Field>
              <Field label="Tip kuhinje">
                <select
                  value={client.layout}
                  onChange={(e) => {
                    setClient({ ...client, layout: e.target.value });
                    setConfirmMove(false);
                  }}
                >
                  {[
                    "Prava kuhinja",
                    "L kuhinja",
                    "U kuhinja",
                    "Sa ostrvom",
                    "Slobodan raspored",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              {!!pendingSpace?.affected && (
                <label className="layout-warning">
                  <input
                    type="checkbox"
                    checked={confirmMove}
                    onChange={(e) => setConfirmMove(e.target.checked)}
                  />{" "}
                  Premeštam {pendingSpace.affected} stavki sa uklonjenih zidova
                  na zid A; proveriću raspored i prepreke.
                </label>
              )}
              <button
                className="btn primary full"
                disabled={!!pendingSpace?.affected && !confirmMove}
              >
                Sačuvaj
              </button>
            </form>
          </Modal>
        )}
        {drag &&
          moving &&
          createPortal(
            <>
              <div
                className={`layout-drag-ghost ${drag.target && (!drag.target.compatible || drag.target.overrun) ? "invalid" : ""}`}
                data-testid="drag-ghost"
                style={{
                  left: drag.x + 14,
                  top: drag.y - 30,
                  width: Math.min(160, Math.max(90, drag.width)),
                }}
              >
                <span>{codes.get(moving.id)}</span>
                <strong>{number(span(moving) / 10)} cm</strong>
              </div>
              <div
                className={`drag-status ${drag.target && (!drag.target.compatible || drag.target.overrun) ? "invalid" : ""}`}
                role="status"
              >
                {!drag.target
                  ? "Zadržite iznad drugog zida ili otpustite u odgovarajućem redu."
                  : !drag.target.compatible
                    ? "Element nije kompatibilan sa ovim redom."
                    : drag.target.overrun
                      ? `Prelazi zid za ${number(drag.target.overrun / 10)} cm. Širine ostaju nepromenjene.`
                      : "Otpustite za postavljanje."}
              </div>
            </>,
            fullscreen.active && host.current ? host.current : document.body,
          )}
      </section>
    </ModalPortalContext.Provider>
  );
}
