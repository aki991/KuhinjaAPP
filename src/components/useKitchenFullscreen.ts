import { useEffect, useRef, useState, type RefObject } from "react";
type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: string) => Promise<void>;
};

export default function useKitchenFullscreen(
  host: RefObject<HTMLElement | null>,
) {
  const [active, setActive] = useState(false),
    mounted = useRef(true),
    session = useRef(0),
    locked = useRef(false),
    native = useRef(false),
    savedViewport = useRef({ scroll: 0, overflow: "" });
  const unlock = () => {
    if (locked.current) {
      try {
        screen.orientation?.unlock();
      } catch {
        /* The browser may already have released the lock. */
      }
      locked.current = false;
    }
  };
  const release = () => {
    session.current++;
    unlock();
    native.current = false;
    setActive(false);
  };
  useEffect(() => {
    mounted.current = true;
    const changed = () => {
      if (native.current && document.fullscreenElement !== host.current)
        release();
    };
    document.addEventListener("fullscreenchange", changed);
    return () => {
      mounted.current = false;
      session.current++;
      unlock();
      document.removeEventListener("fullscreenchange", changed);
      if (document.fullscreenElement === host.current)
        void document.exitFullscreen().catch(() => {});
    };
  }, [host]);
  useEffect(() => {
    if (!active) return;
    const { scroll, overflow } = savedViewport.current;
    document.body.style.overflow = "hidden";
    document.body.classList.add("kitchen-fullscreen-open");
    return () => {
      document.body.classList.remove("kitchen-fullscreen-open");
      document.body.style.overflow = overflow;
      window.scrollTo(0, scroll);
    };
  }, [active]);
  async function enter() {
    const node = host.current;
    if (!node || active) return;
    const id = ++session.current;
    savedViewport.current = {
      scroll: window.scrollY,
      overflow: document.body.style.overflow,
    };
    setActive(true);
    try {
      if (node.requestFullscreen) {
        await node.requestFullscreen();
        if (!mounted.current || session.current !== id) {
          if (document.fullscreenElement === node)
            await document.exitFullscreen();
          return;
        }
        native.current = document.fullscreenElement === node;
      }
    } catch {
      /* Use the same editor across the available viewport if native fullscreen is denied. */
    }
    if (!mounted.current || session.current !== id) return;
    try {
      const orientation = screen.orientation as LockableOrientation | undefined;
      if (orientation?.lock) {
        await orientation.lock("landscape");
        if (!mounted.current || session.current !== id) {
          orientation.unlock();
          return;
        }
        locked.current = true;
      }
    } catch {
      /* Keep the real orientation and show the portrait hint. */
    }
  }
  async function exit() {
    release();
    if (document.fullscreenElement === host.current)
      try {
        await document.exitFullscreen();
      } catch {
        /* The viewport fallback has already closed. */
      }
  }
  useEffect(() => {
    if (!active) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !host.current?.querySelector("[role=dialog]")) {
        e.preventDefault();
        void exit();
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [active]);
  return { active, enter, exit };
}
