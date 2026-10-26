import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Download,
  FolderOpen,
  Home,
  Layers3,
  Plus,
  Settings2,
  SlidersHorizontal,
  Upload,
  WifiOff,
  X,
  Trash2,
  Search,
  HardDrive,
  CircleHelp,
  Palette,
} from "lucide-react";
import { defaultSelection, defaults, findProduct } from "./core/catalog";
import {
  createOffer,
  db,
  exportBackup,
  restoreBackup,
  saveOffer,
  seedDatabase,
  persistProject,
  type Backup,
} from "./core/db";
import { calculateOffer, onlyUnsupportedErrors } from "./core/engine";
import { download } from "./core/files";
import type {
  Offer,
  Product,
  Selection,
  Settings,
  Supplier,
} from "./core/types";
import { Field, Modal } from "./components/UI";
import OfferView from "./components/OfferView";
import PriceList from "./components/PriceList";
import KitchenView from "./components/KitchenView";
import AppearanceView from "./components/AppearanceView";
import { defaultLayout, displayProject, ensureLayout } from "./core/layout";
import { ensureElevation } from "./core/elevation";
import { ensureOpenings, productSelectionKeys } from "./core/opening";
type Page = "home" | "kitchen" | "cost" | "offers" | "prices" | "appearance";
export default function App() {
  const [page, setPage] = useState<Page>("home"),
    [offers, setOffers] = useState<Offer[]>([]),
    [products, setProducts] = useState<Product[]>([]),
    [suppliers, setSuppliers] = useState<Supplier[]>([]),
    [settings, setSettings] = useState<Settings>(defaults),
    [draftSettings, setDraftSettings] = useState<Settings>(defaults),
    [offer, setOffer] = useState<Offer | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [settingsOpen, setSettingsOpen] = useState(false),
    [settingsTab, setSettingsTab] = useState<"general" | "prices">("general"),
    [openMaterials, setOpenMaterials] = useState(false),
    [newOpen, setNewOpen] = useState(false),
    [newClient, setNewClient] = useState(createOffer().client),
    [newLength, setNewLength] = useState(3000),
    [query, setQuery] = useState(""),
    [offline, setOffline] = useState(!navigator.onLine),
    [backup, setBackup] = useState<Backup | null>(null),
    [deleteOffer, setDeleteOffer] = useState<Offer | null>(null),
    [help, setHelp] = useState(false),
    [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const backupRef = useRef<HTMLInputElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = (text: string) => {
    setToast(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 6000);
  };
  async function refresh() {
    const [o, p, s, st] = await Promise.all([
      db.offers.toArray(),
      db.products.toArray(),
      db.suppliers.toArray(),
      db.settings.get("main"),
    ]);
    setOffers(o.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    setProducts(p);
    setSuppliers(s);
    if (st) setSettings(st.value);
  }
  useEffect(() => {
    seedDatabase()
      .then(refresh)
      .then(async () => {
        const draft = await db.meta.get("draft");
        if (draft?.value) {
          setOffer(
            ensureOpenings(ensureElevation(ensureLayout(draft.value as Offer))),
          );
        }
        setReady(true);
      })
      .catch((e) => setError("Lokalna baza nije dostupna: " + e.message));
    const online = () => setOffline(!navigator.onLine),
      onInstall = (e: Event) => {
        e.preventDefault();
        setInstallPrompt(e);
      };
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
      window.removeEventListener("beforeinstallprompt", onInstall);
    };
  }, []);
  function changeOffer(next: Offer) {
    const normalized = ensureOpenings(ensureElevation(ensureLayout(next)));
    setOffer(normalized);
    void persistProject(normalized)
      .then((saved) => {
        if (saved)
          setOffers((current) =>
            [normalized, ...current.filter((o) => o.id !== normalized.id)].sort(
              (a, b) => b.updatedAt.localeCompare(a.updatedAt),
            ),
          );
      })
      .catch(() =>
        notify("Radna kopija nije sačuvana. Proverite prostor na uređaju."),
      );
  }
  function open(o: Offer) {
    changeOffer(ensureLayout(o));
    setPage("kitchen");
    window.scrollTo({ top: 0 });
  }
  async function save() {
    if (!offer) return;
    const c = calculateOffer(offer);
    if (!c.count || (c.errors.length && !onlyUnsupportedErrors(offer))) {
      notify("Dodajte elemente i ispravite greške pre čuvanja.");
      return;
    }
    try {
      const savedOffer = await saveOffer(offer);
      setOffer(savedOffer);
      await db.meta.put({ id: "draft", value: savedOffer });
      await refresh();
      notify(c.errors.length ? "Projekat sačuvan. Precizan obračun za neke elemente nije dostupan." : "Projekat sačuvan.");
    } catch (e) {
      notify("Čuvanje nije uspelo: " + (e as Error).message);
    }
  }
  function startNew() {
    setNewClient({
      ...createOffer().client,
      project: "Nova kuhinja",
      layout: "Prava kuhinja",
    });
    setNewLength(3000);
    setNewOpen(true);
  }
  function makeNew() {
    const o = createOffer();
    o.client = newClient;
    o.prices = structuredClone(products);
    o.settings = { ...settings };
    const selected = { ...defaultSelection };
    for (const key of productSelectionKeys) {
      const old = products.find((p) => p.id === selected[key]);
      const p = findProduct(
        products,
        key === "golaEnd" ? "golaEnd" : (key as Product["category"]),
        old?.tier,
        old?.kind,
        suppliers.find((s) => s.isDefault)?.name,
      );
      if (p) selected[key] = p.id;
    }
    o.selection = selected;
    o.layout = defaultLayout(o.client.layout, newLength);
    open(o);
    setNewOpen(false);
  }
  const doBackup = async () => {
    try {
      download(
        JSON.stringify(await exportBackup(), null, 2),
        "Kuhinja-rezervna-kopija.json",
        "application/json",
      );
      notify("Rezervna kopija je izvezena.");
    } catch (e) {
      notify((e as Error).message);
    }
  };

  const projectCard = (o: Offer, removable = false) => (
    <article className="project-card" key={o.id}>
      <button className="project-open" onClick={() => open(o)}>
        <span className="project-thumb">
          <img
            src={
              offers.findIndex((project) => project.id === o.id) % 2 === 0
                ? "/brand/kitchen-light.png"
                : "/brand/kitchen-walnut.png"
            }
            alt=""
            width="70"
            height="70"
          />
        </span>
        <span>
          <strong>{displayProject(o.client.project)}</strong>
          <small>
            {o.elements.reduce((a, e) => a + e.quantity, 0)} elemenata
            {o.client.location ? " · " + o.client.location : ""}
          </small>
        </span>
        <ChevronRight size={21} />
      </button>
      {removable && (
        <button
          className="icon-btn"
          aria-label={`Obriši ponudu ${displayProject(o.client.project)}`}
          onClick={() => setDeleteOffer(o)}
        >
          <Trash2 size={20} />
        </button>
      )}
    </article>
  );
  if (error)
    return (
      <div className="startup">
        <h1>Kuhinja po meri</h1>
        <p>{error}</p>
        <button className="btn primary" onClick={() => location.reload()}>
          Pokušaj ponovo
        </button>
      </div>
    );
  if (!ready)
    return (
      <div className="startup">
        <img src="/brand/logo.png" width="58" alt="" />
        <h1>Kuhinja po meri</h1>
        <span className="loading" />
      </div>
    );
  const nav = [
    { id: "home" as Page, label: "Početna", icon: Home },
    { id: "kitchen" as Page, label: "Kuhinja", icon: Layers3 },
    { id: "cost" as Page, label: "Cena", icon: SlidersHorizontal },
    { id: "appearance" as Page, label: "Izgled", icon: Palette },
  ];
  const go = (next: Page) => {
    setOpenMaterials(false);
    if (
      (next === "kitchen" || next === "cost" || next === "appearance") &&
      !offer
    ) {
      if (offers.length) {
        setOffer(ensureOpenings(ensureElevation(ensureLayout(offers[0]))));
        setPage(next);
      } else startNew();
    } else setPage(next);
    window.scrollTo({ top: 0 });
  };
  const last = offer || offers[0];
  const recent = offers.filter((o) => o.id !== last?.id).slice(0, 3);
  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("home");
          }}
        >
          <img src="/brand/logo.png" alt="" />
          <span>
            Kuhinja<strong>Kalkulator</strong>
          </span>
        </a>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              aria-current={page === n.id ? "page" : undefined}
              className={page === n.id ? "active" : ""}
              onClick={() => go(n.id)}
            >
              <n.icon size={23} />
              {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            onClick={() => {
              setDraftSettings({ ...settings });
              setSettingsTab("general");
              setSettingsOpen(true);
            }}
          >
            <Settings2 size={22} /> Podešavanja
          </button>
          <button onClick={() => setHelp(true)}>
            <CircleHelp size={22} /> Pomoć
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="app-header">
          <button className="mobile-brand" onClick={() => go("home")}>
            <img src="/brand/logo.png" alt="" />
            <span>Kuhinja po meri</span>
          </button>
          <div className="header-right">
            {offline && (
              <span className="offline-indicator">
                <WifiOff size={18} />
                <span>Bez mreže</span>
              </span>
            )}
            <button
              className="icon-btn"
              aria-label="Podešavanja"
              onClick={() => {
                setDraftSettings({ ...settings });
                setSettingsTab("general");
                setSettingsOpen(true);
              }}
            >
              <Settings2 size={23} />
            </button>
          </div>
        </header>
        <main
          className={`page-content page-${page} ${page === "kitchen" ? "kitchen-page" : ""}`}
        >
          {page === "home" && (
            <div className="home-view">
              <h1>Vaše kuhinje</h1>
              <button
                className="btn primary full new-kitchen"
                onClick={startNew}
              >
                <Plus size={23} /> Nova kuhinja{" "}
                <ChevronRight
                  className="new-kitchen-arrow"
                  size={22}
                  aria-hidden="true"
                />
              </button>
              {last && (
                <button className="continue-project" onClick={() => open(last)}>
                  <span>
                    <small>Nastavi poslednji projekat</small>
                    <strong>{displayProject(last.client.project)}</strong>
                    <span className="continue-action">
                      Otvori kuhinju <ArrowRight size={19} />
                    </span>
                  </span>
                </button>
              )}
              <div className="section-row">
                <h2>Poslednji projekti</h2>
                <button
                  className="text-btn show-projects"
                  onClick={() => go("offers")}
                >
                  Prikaži sve <ChevronRight size={18} />
                </button>
              </div>
              <div className="project-list">
                {recent.map((o) => projectCard(o))}
              </div>
              <button
                className="btn secondary full saved-offers"
                onClick={() => go("offers")}
              >
                <FolderOpen size={22} /> Sačuvane ponude{" "}
                <span>{offers.length}</span>
                <ArrowRight size={19} />
              </button>
            </div>
          )}
          {page === "kitchen" && offer && (
            <KitchenView
              key={offer.id}
              offer={offer}
              onChange={changeOffer}
              onSave={save}
              onPrice={() => go("cost")}
            />
          )}
          {page === "cost" && offer && (
            <OfferView
              key={offer.id + "-" + openMaterials}
              offer={offer}
              onChange={changeOffer}
              onSave={save}
              onBack={() => go("kitchen")}
              products={products}
              suppliers={suppliers}
              notify={notify}
              initialScreen={openMaterials ? "optimize" : "summary"}
            />
          )}
          {page === "appearance" && offer && (
            <AppearanceView
              key={offer.id}
              offer={offer}
              products={products}
              onChange={changeOffer}
              onOpening={() => {
                setOpenMaterials(true);
                setPage("cost");
                window.scrollTo({ top: 0 });
              }}
            />
          )}
          {page === "offers" && (
            <>
              <div className="page-title-row">
                <button
                  className="icon-btn"
                  aria-label="Nazad na početnu"
                  onClick={() => go("home")}
                >
                  <ArrowRight
                    size={22}
                    style={{ transform: "rotate(180deg)" }}
                  />
                </button>
                <h1>Sačuvane ponude</h1>
              </div>
              <label className="search">
                <Search size={21} />
                <input
                  aria-label="Pretraži projekte"
                  placeholder="Pretraži projekte"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <div className="project-list">
                {offers
                  .filter((o) =>
                    (o.client.project + " " + o.client.name)
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((o) => projectCard(o, true))}
              </div>
            </>
          )}
          {page === "prices" && (
            <PriceList
              products={products}
              suppliers={suppliers}
              settings={settings}
              onRefresh={refresh}
              notify={notify}
            />
          )}
        </main>
        <nav className="bottom-nav" aria-label="Glavna navigacija">
          {nav.map((n) => (
            <button
              key={n.id}
              aria-current={page === n.id ? "page" : undefined}
              className={page === n.id ? "active" : ""}
              onClick={() => go(n.id)}
            >
              <n.icon size={23} strokeWidth={page === n.id ? 2 : 1.7} />
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={19} />
          <span>{toast}</span>
          <button aria-label="Zatvori obaveštenje" onClick={() => setToast("")}>
            <X size={19} />
          </button>
        </div>
      )}
      {newOpen && (
        <Modal title="Nova kuhinja" onClose={() => setNewOpen(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              makeNew();
            }}
          >
            <Field label="Naziv projekta">
              <input
                required
                value={newClient.project}
                onChange={(e) =>
                  setNewClient({ ...newClient, project: e.target.value })
                }
              />
            </Field>
            <Field label="Dužina zida (mm)">
              <input
                className="large-number"
                type="number"
                inputMode="numeric"
                min="100"
                max="30000"
                required
                value={newLength || ""}
                onChange={(e) => setNewLength(Number(e.target.value))}
              />
            </Field>
            <Field label="Tip kuhinje">
              <select
                value={newClient.layout}
                onChange={(e) =>
                  setNewClient({ ...newClient, layout: e.target.value })
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
            <details className="disclosure">
              <summary>Podaci o mušteriji</summary>
              <Field label="Ime i prezime">
                <input
                  value={newClient.name}
                  onChange={(e) =>
                    setNewClient({ ...newClient, name: e.target.value })
                  }
                />
              </Field>
              <Field label="Telefon">
                <input
                  type="tel"
                  value={newClient.phone}
                  onChange={(e) =>
                    setNewClient({ ...newClient, phone: e.target.value })
                  }
                />
              </Field>
              <Field label="Lokacija">
                <input
                  value={newClient.location}
                  onChange={(e) =>
                    setNewClient({ ...newClient, location: e.target.value })
                  }
                />
              </Field>
            </details>
            <button className="btn primary full" type="submit">
              Dodaj elemente <ArrowRight size={21} />
            </button>
          </form>
        </Modal>
      )}
      {settingsOpen && (
        <Modal
          title="Podešavanja i rezervne kopije"
          wide
          onClose={() => setSettingsOpen(false)}
        >
          <div
            className="settings-tabs choice-buttons"
            role="tablist"
            aria-label="Stranice podešavanja"
          >
            <button
              role="tab"
              aria-selected={settingsTab === "general"}
              onClick={() => setSettingsTab("general")}
            >
              Opšte
            </button>
            <button
              role="tab"
              aria-selected={settingsTab === "prices"}
              onClick={() => setSettingsTab("prices")}
            >
              Cenovnik
            </button>
          </div>
          {settingsTab === "prices" ? (
            <div role="tabpanel" aria-label="Cenovnik">
              <PriceList
                products={products}
                suppliers={suppliers}
                settings={settings}
                onRefresh={refresh}
                notify={notify}
              />
            </div>
          ) : (
            <div role="tabpanel" aria-label="Opšta podešavanja">
              <div className="info-note">
                <Settings2 size={19} />
                <span>Podrazumevane vrednosti za nove projekte.</span>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await db.settings.put({ id: "main", value: draftSettings });
                  await refresh();
                  setSettingsOpen(false);
                  notify("Podešavanja su sačuvana za nove kalkulacije.");
                }}
              >
                <div className="settings-grid">
                  {(
                    [
                      {
                        key: "thickness",
                        label: "Debljina ploče (mm)",
                        min: 10,
                        max: 40,
                      },
                      {
                        key: "backThickness",
                        label: "Debljina leđa (mm)",
                        min: 2,
                        max: 18,
                      },
                      {
                        key: "gap",
                        label: "Zazor frontova (mm)",
                        min: 0,
                        max: 10,
                      },
                      {
                        key: "clearance",
                        label: "Razmak klizača po strani (mm)",
                        min: 1,
                        max: 40,
                      },
                      {
                        key: "waste",
                        label: "Tehnološki otpad (%)",
                        min: 0,
                        max: 100,
                      },
                      {
                        key: "eurRate",
                        label: "Ručni kurs EUR / RSD",
                        min: 1,
                        max: 1000,
                      },
                      { key: "margin", label: "Marža (%)", min: 0, max: 99 },
                      {
                        key: "markup",
                        label: "Procentualna doplata (%)",
                        min: 0,
                        max: 500,
                      },
                    ] as const
                  ).map((x) => (
                    <Field key={x.key} label={x.label}>
                      <input
                        required
                        type="number"
                        step="0.1"
                        min={x.min}
                        max={x.max}
                        value={draftSettings[x.key]}
                        onChange={(e) =>
                          setDraftSettings({
                            ...draftSettings,
                            [x.key]: Number(e.target.value),
                          })
                        }
                      />
                    </Field>
                  ))}
                </div>
                <Field label="Način formiranja prodajne cene">
                  <select
                    value={draftSettings.profitMode}
                    onChange={(e) =>
                      setDraftSettings({
                        ...draftSettings,
                        profitMode: e.target.value as Settings["profitMode"],
                      })
                    }
                  >
                    <option value="margin">Marža: trošak / (1 − marža)</option>
                    <option value="markup">
                      Doplata: trošak × (1 + doplata)
                    </option>
                  </select>
                </Field>
                <Field label="Način nabavke materijala po tabli">
                  <select
                    value={draftSettings.purchaseMode}
                    onChange={(e) =>
                      setDraftSettings({
                        ...draftSettings,
                        purchaseMode: e.target
                          .value as Settings["purchaseMode"],
                      })
                    }
                  >
                    <option value="area">
                      Teorijska potrošnja m² sa otpadom
                    </option>
                    <option value="sheets">
                      Cele table · površinski minimum (bez optimizacije)
                    </option>
                  </select>
                </Field>
                <Field label="Kantovanje korpusa">
                  <select
                    value={draftSettings.edgeMode}
                    onChange={(e) =>
                      setDraftSettings({
                        ...draftSettings,
                        edgeMode: e.target.value as Settings["edgeMode"],
                      })
                    }
                  >
                    <option value="front">Vidljive prednje ivice</option>
                    <option value="all">Sve ivice stranica, dna i krova</option>
                  </select>
                </Field>
                <button className="btn primary full" type="submit">
                  Sačuvaj podešavanja za nove ponude
                </button>
              </form>
              <div className="backup-section">
                <h3>
                  <HardDrive size={19} /> Rezervne kopije
                </h3>
                <p>
                  Sačuvajte JSON kopiju pre promene telefona ili brisanja
                  podataka pregledača.
                </p>
                <div className="form-actions">
                  <button
                    className="btn secondary"
                    onClick={() => void doBackup()}
                  >
                    <Download size={17} /> Izvezi sve podatke
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => backupRef.current?.click()}
                  >
                    <Upload size={17} /> Uvezi JSON kopiju
                  </button>
                </div>
                <input
                  ref={backupRef}
                  hidden
                  type="file"
                  accept=".json"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      setBackup(JSON.parse(await file.text()));
                    } catch {
                      notify("JSON fajl nije ispravan.");
                    }
                    e.target.value = "";
                  }}
                />
              </div>
              {installPrompt && (
                <button
                  className="btn secondary full"
                  onClick={async () => {
                    await (
                      installPrompt as Event & { prompt: () => Promise<void> }
                    ).prompt();
                    setInstallPrompt(null);
                  }}
                >
                  <Download size={17} /> Instaliraj aplikaciju
                </button>
              )}
              <button
                className="text-btn centered"
                onClick={() => {
                  setSettingsOpen(false);
                  setHelp(true);
                }}
              >
                Kako instalirati na telefon
              </button>
            </div>
          )}
        </Modal>
      )}
      {backup && (
        <Modal
          title="Potvrda vraćanja rezervne kopije"
          onClose={() => setBackup(null)}
        >
          <p>
            Uvoz zamenjuje sve ponude, cenovnike, dobavljače i podešavanja na
            ovom uređaju. Prvo izvezite trenutne podatke.
          </p>
          <button
            className="btn secondary full"
            onClick={() => void doBackup()}
          >
            Preuzmi trenutnu rezervnu kopiju
          </button>
          <button
            className="btn primary full"
            onClick={async () => {
              try {
                await restoreBackup(backup);
                await db.meta.delete("draft");
                setOffer(null);
                await refresh();
                setBackup(null);
                setSettingsOpen(false);
                setPage("home");
                notify("Rezervna kopija je uspešno vraćena.");
              } catch (e) {
                notify((e as Error).message);
              }
            }}
          >
            Zameni podatke ovom kopijom
          </button>
        </Modal>
      )}
      {deleteOffer && (
        <Modal title="Obriši ponudu?" onClose={() => setDeleteOffer(null)}>
          <p>
            Obrisaćete ponudu „{deleteOffer.client.project}“ i njene varijante
            sa ovog uređaja.
          </p>
          <button
            className="btn danger full"
            onClick={async () => {
              await db.offers.delete(deleteOffer.id);
              if (offer?.id === deleteOffer.id) {
                setOffer(null);
                await db.meta.delete("draft");
              }
              await refresh();
              setDeleteOffer(null);
              notify("Ponuda je obrisana.");
            }}
          >
            Obriši ponudu
          </button>
        </Modal>
      )}

      {help && (
        <Modal title="Pomoć" onClose={() => setHelp(false)}>
          <h3>Raspored kuhinje</h3>
          <p>
            Zadate dužinu zida, dodajte elemente i izmenite ih dodirom na šemu.
            Dugi pritisak pokreće prevlačenje. Zadržite iznad drugog zida da ga
            otvorite, pa otpustite u odgovarajućem redu. Dugmad Levo/Desno u
            editoru elementa takođe menjaju redosled.
          </p>
          <p>
            Donji i visoki elementi dele donji red. Viseći su iznad. Radna
            ploča, sokla i obloge su u listi i ne zauzimaju dodatnu širinu. Šema
            prikazuje redosled i širine, bez geometrije uglova i sudara u
            dubini.
          </p>
          <p>
            Elementi se automatski slažu jedan do drugog. Namernu prazninu
            dodajte kao „Razmak“. Postojeće praznine iz ranijih verzija sačuvane
            su kao razmaci. Donji i visoki elementi pripadaju donjem redu,
            viseći visećem; razmak se može premeštati između oba reda. Širine se
            ne menjaju radi uklapanja.
          </p>
          <h3>2D prikaz</h3>
          <p>
            Dodirom crteža ili kartice ispod njega otvarate izmenu elementa.
            Dugmad Levo/Desno, Dupliraj, Pomeri i Obriši dostupna su u editoru.
            Dugmad + i − zumiraju, a Uklopi vraća pregled zida. Crtež možete
            pomerati prstom. Ikona uz zumiranje otvara mere zida, prozore, vrata
            i prepreke. Smer vrata, staklo i opcioni uređaji podešavaju se u
            editoru, pod Izgled u 2D prikazu.
          </p>
          <p>
            Ikona proširenja otvara prikaz preko celog ekrana. Elementi se mogu
            uređivati i prevlačiti u tom režimu; dva prsta menjaju zumiranje. X
            vraća standardni ekran. Ako uređaj ne dozvoljava automatski
            landscape, okrenite telefon horizontalno. Validne izmene automatski
            se čuvaju lokalno.
          </p>
          <h3>Cena i ponuda</h3>
          <p>
            Cena se vidi u sekciji Cena. Izbor „Zadrži moj izbor“ sprečava
            globalne promene za taj element. Stare ponude čuvaju svoje cene;
            novi cenovnik primenite iz opcija obračuna.
          </p>
          <h3>Instalacija i offline rad</h3>
          <p>
            Instalirajte produkcionu aplikaciju kroz Chrome meni na Androidu
            preko pouzdanog HTTPS-a ili localhost-a. Obična HTTP adresa na
            lokalnoj mreži služi za pristup dok je računar uključen.
          </p>
          <h3>Ograničenja</h3>
          <p>
            Obračun nije proizvodno proveren. Početne cene su izmišljeni
            primeri. Ugaoni element nije podržan za precizan obračun. GOLA radi
            samo za standardne donje elemente i fiokare. Broj tabli je
            površinski minimum bez optimizacije krojenja.
          </p>
        </Modal>
      )}
    </div>
  );
}
