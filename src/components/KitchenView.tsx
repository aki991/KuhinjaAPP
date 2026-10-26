import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Pencil,
  Copy,
  Trash2,
  Save,
  MoreHorizontal,
  Ruler,
} from "lucide-react";
import { newElement, templates, uid } from "../core/catalog";
import {
  appendPlacement,
  displayProject,
  elementCodes,
  moveLayoutItem,
  newSpacer,
  packLayout,
  relocateItem,
  isSpacer,
  laneOf,
  rowName,
  rowOf,
  sameLane,
  wallElements,
  wallUsage,
  span,
} from "../core/layout";
import type { LayoutItem, LayoutLane, Offer } from "../core/types";
import useKitchenFullscreen from "./useKitchenFullscreen";
import ElementStrip from "./elevation/ElementStrip";
import { elevationScene } from "../core/elevation";
import ElevationViewport from "./elevation/ElevationViewport";
import WallSettingsEditor from "./elevation/WallSettingsEditor";
import { Cabinet, Field, Modal, ModalPortalContext, number } from "./UI";
import ElementEditor from "./ElementEditor";
import SpacerEditor from "./SpacerEditor";
import useLayoutDrag from "./useLayoutDrag";
export default function KitchenView({
  offer,
  onChange,
  onSave,
  onPrice,
}: {
  offer: Offer;
  onChange: (o: Offer) => void;
  onSave: () => Promise<void>;
  onPrice: () => void;
}) {
  const [library, setLibrary] = useState(false),
    [group, setGroup] = useState("Donji"),
    [editor, setEditor] = useState<LayoutItem | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [wallModal, setWallModal] = useState(false),
    [wallLength, setWallLength] = useState(3000),
    [projectModal, setProjectModal] = useState(false),
    [client, setClient] = useState(offer.client),
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
  useEffect(() => {
    if (!fullscreen.active) setEditor(null);
  }, [fullscreen.active]);
  const root = useRef<HTMLDivElement>(null),
    packed = useMemo(
      () => packLayout(offer.elements, offer.layout!),
      [offer.elements, offer.layout],
    ),
    layout = packed.layout;
  const wall =
      layout.walls.find((w) => w.id === (previewWall || layout.activeWall)) ||
      layout.walls[0],
    elements = wallElements(packed.elements, wall.id, layout),
    usage = wallUsage(packed.elements, wall, layout),
    codes = elementCodes(offer.elements, layout);
  const change = (patch: Partial<Offer>) => {
    setDragNotice("");
    onChange({ ...offer, ...patch, updatedAt: new Date().toISOString() });
  };
  const chooseWall = (id: string) => {
    setDragNotice("");
    change({ layout: { ...layout, activeWall: id } });
  };
  function saveItem(item: LayoutItem) {
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
      : layout;
    const result = relocateItem(
      nextElements,
      nextLayout,
      item.id,
      item.placement!.wall,
      laneOf(item),
      item.placement!.order ?? Number.MAX_SAFE_INTEGER,
    );
    if (result)
      change({
        ...result,
        layout: { ...result.layout, activeWall: item.placement!.wall },
      });
    setSelected(item.id);
    setFocusRequest((n) => n + 1);
    setDragNotice("");
  }
  const scale = elevationScale;
  const scene = useMemo(() => elevationScene(offer, wall.id), [offer, wall.id]);
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
  const grouped =
    group === "Viseći" ? "Gornji" : group === "Ostali" ? "Dodatni" : group;
  function selectItem(e: LayoutItem) {
    setSelected(e.id);
    setFocusRequest((n) => n + 1);
    setEditor(e);
  }
  function duplicate(e: LayoutItem) {
    const copy = { ...structuredClone(e), id: uid() };
    copy.placement = appendPlacement(offer.elements, copy, wall.id, layout);
    saveItem(copy);
  }
  function removeItem(e: LayoutItem) {
    change({
      elements: offer.elements.filter((x) => x.id !== e.id),
      layout: {
        ...layout,
        spacers: layout.spacers!.filter((x) => x.id !== e.id),
      },
    });
    if (selected === e.id) setSelected(null);
  }
  function editorActions(item: LayoutItem) {
    if (!elements.some((e) => e.id === item.id)) return null;
    const lane = elements.filter((e) => sameLane(item, e)),
      index = lane.findIndex((e) => e.id === item.id);
    const move = (direction: -1 | 1) => {
      const result = moveLayoutItem(offer.elements, layout, item.id, direction);
      if (result) {
        change(result);
        setEditor(null);
      }
    };
    return (
      <div className="element-editor-actions">
        <button
          type="button"
          aria-label={`Pomeri ${codes.get(item.id)} levo`}
          disabled={index === 0 || laneOf(item) === "extra"}
          onClick={() => move(-1)}
        >
          <ArrowLeft size={18} />
          Levo
        </button>
        <button
          type="button"
          aria-label={`Pomeri ${codes.get(item.id)} desno`}
          disabled={index === lane.length - 1 || laneOf(item) === "extra"}
          onClick={() => move(1)}
        >
          <ArrowRight size={18} />
          Desno
        </button>
        <button
          type="button"
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
            {layout.walls.map((w) => (
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
              aria-label="Dodaj zid ili ostrvo"
              onClick={() => setAddWall(true)}
            >
              <Plus size={19} />
            </button>
          </div>
          <div
            className={`wall-measure ${usage.overrun ? "over-capacity" : ""}`}
          >
            <button
              className="wall-length"
              aria-label="Izmeni dužinu zida"
              onClick={() => {
                setWallLength(wall.length);
                setWallModal(true);
              }}
            >
              <Ruler size={19} />
              <strong>
                {number(wall.length / 10)}
                <small> cm</small>
              </strong>
              <Pencil size={15} />
            </button>
            <div>
              <span>
                Zauzeto <strong>{number(usage.occupied / 10)} cm</strong>
              </span>
              <span>
                Slobodno <strong>{number(usage.free / 10)} cm</strong>
              </span>
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
          <ElevationViewport
            scene={scene}
            scale={scale}
            onScale={setElevationScale}
            selected={selected}
            drag={drag}
            onSettings={() => setVisualSettings(true)}
            onSelect={(e) => {
              if (canOpen()) selectItem(e);
            }}
            fullscreen={fullscreen.active}
            focusRequest={focusRequest}
            onFullscreen={() => void fullscreen.enter()}
            onCloseFullscreen={() => void fullscreen.exit()}
            walls={layout.walls}
            onChooseWall={chooseWall}
          />
          <ElementStrip
            hidden={fullscreen.active}
            items={elements}
            scene={scene}
            selected={selected}
            onPick={selectItem}
          />
          <button
            className="btn primary full add-kitchen-element"
            onClick={() => setLibrary(true)}
          >
            <Plus size={22} /> Dodaj element
          </button>
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
              {["Donji", "Viseći", "Visoki", "Ostali"].map((g) => (
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
              {templates
                .filter((t) => t.group === grouped)
                .map((t) => (
                  <button
                    key={t.kind}
                    disabled={t.unsupported}
                    onClick={() => {
                      const e = newElement(t.kind, offer.selection);
                      let target = wall.id;
                      if (e.kind === "island") {
                        target = "island";
                        if (!layout.walls.some((w) => w.id === target))
                          change({
                            layout: {
                              ...layout,
                              walls: [
                                ...layout.walls,
                                { id: target, name: "Ostrvo", length: 3000 },
                              ],
                              activeWall: target,
                            },
                          });
                      }
                      e.placement = appendPlacement(
                        offer.elements,
                        e,
                        target,
                        layout,
                      );
                      setEditor(e);
                      setLibrary(false);
                    }}
                  >
                    <Cabinet kind={t.kind} size={62} />
                    <strong>{t.name}</strong>
                    {t.unsupported && (
                      <small>Precizan obračun nije podržan</small>
                    )}
                  </button>
                ))}
              {group !== "Visoki" && (
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
                  <Ruler size={55} />
                  <strong>Razmak</strong>
                </button>
              )}
            </div>
          </Modal>
        )}
        {editor &&
          (isSpacer(editor) ? (
            <SpacerEditor
              actions={editorActions(editor)}
              spacer={editor}
              layout={layout}
              onClose={() => setEditor(null)}
              onSave={saveItem}
            />
          ) : (
            <ElementEditor
              actions={editorActions(editor)}
              element={editor}
              products={offer.prices}
              global={offer.selection}
              settings={offer.settings}
              walls={layout.walls}
              elements={offer.elements}
              layout={layout}
              onClose={() => setEditor(null)}
              onSave={saveItem}
            />
          ))}
        {visualSettings && (
          <WallSettingsEditor
            config={scene.config}
            wall={wall.id}
            onClose={() => setVisualSettings(false)}
            onSave={(elevation) => change({ elevation })}
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
        {wallModal && (
          <Modal
            title={`Dužina · ${wall.name}`}
            onClose={() => setWallModal(false)}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                change({
                  layout: {
                    ...layout,
                    walls: layout.walls.map((w) =>
                      w.id === wall.id ? { ...w, length: wallLength } : w,
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
          <Modal title="Dodaj zid ili ostrvo" onClose={() => setAddWall(false)}>
            <div className="add-wall-options">
              {[
                { id: "A", name: "Zid A" },
                { id: "B", name: "Zid B" },
                { id: "C", name: "Zid C" },
                { id: "island", name: "Ostrvo" },
              ]
                .filter((w) => !layout.walls.some((x) => x.id === w.id))
                .map((w) => (
                  <button
                    className="btn secondary full"
                    key={w.id}
                    onClick={() => {
                      change({
                        layout: {
                          ...layout,
                          walls: [...layout.walls, { ...w, length: 3000 }],
                          activeWall: w.id,
                        },
                      });
                      setAddWall(false);
                    }}
                  >
                    <Plus size={20} />
                    {w.name}
                  </button>
                ))}
              {layout.walls.length >= 4 && (
                <p>Svi zidovi i ostrvo su dodati.</p>
              )}
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
                change({ client });
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
                  onChange={(e) =>
                    setClient({ ...client, layout: e.target.value })
                  }
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
              <button className="btn primary full">Sačuvaj</button>
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
