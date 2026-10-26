import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X, Check, ArrowUpRight, type LucideIcon } from "lucide-react";
import type { KitchenElement } from "../core/types";
export const money = (n: number) =>
  new Intl.NumberFormat("sr-Latn-RS", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n) + " RSD";
export const number = (n: number) =>
  new Intl.NumberFormat("sr-Latn-RS", { maximumFractionDigits: 2 }).format(n);
export function IconBox({
  icon: Icon,
  tone = "blue",
}: {
  icon: LucideIcon;
  tone?: string;
}) {
  return (
    <span className={`icon-box ${tone}`}>
      <Icon size={22} strokeWidth={1.7} />
    </span>
  );
}
let openSheets = 0;
export const ModalPortalContext = createContext<HTMLElement | null>(null);
let bodyOverflow = "";
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLElement>(null),
    close = useRef(onClose);
  const portal = useContext(ModalPortalContext);
  close.current = onClose;
  useEffect(() => {
    const manageBody = !portal;
    if (manageBody && openSheets++ === 0) {
      bodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    const escape = (e: KeyboardEvent) => {
      const dialogs = document.querySelectorAll("[role=dialog]");
      if (
        e.key === "Escape" &&
        dialogs[dialogs.length - 1] === dialog.current
      ) {
        e.preventDefault();
        close.current();
      }
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("keydown", escape);
      if (manageBody && --openSheets === 0)
        document.body.style.overflow = bodyOverflow;
    };
  }, [portal]);
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={dialog}
        className={`sheet ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <header className="sheet-header">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Zatvori" onClick={onClose}>
            <X size={22} />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </section>
    </div>,
    portal || document.body,
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Cabinet({
  kind = "base2",
  size = 48,
}: {
  kind?: KitchenElement["kind"];
  size?: number;
}) {
  const drawer = kind.startsWith("drawer"),
    wall = ["wall1", "wall2", "open", "lift"].includes(kind),
    tall = ["tall", "fridge", "tallOven"].includes(kind),
    panel = ["side", "panel", "plinth", "worktop"].includes(kind);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className="cabinet"
    >
      <path
        d={
          panel
            ? "M8 25h48v13H8z"
            : tall
              ? "M17 5h30v51H17z"
              : wall
                ? "M10 10h44v36H10z"
                : "M8 14h48v38H8z"
        }
        fill="currentColor"
        fillOpacity=".035"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {!panel && (
        <>
          <path
            d={wall ? "M10 17h44" : tall ? "M17 28h30" : "M8 20h48"}
            stroke="currentColor"
            strokeWidth="1.3"
          />
          {drawer ? (
            <>
              {[30, 41].map((y) => (
                <path
                  key={y}
                  d={`M8 ${y}h48m-29 -5h10`}
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
              ))}
            </>
          ) : kind === "oven" ? (
            <>
              <rect
                x="16"
                y="25"
                width="32"
                height="21"
                rx="2"
                stroke="currentColor"
              />
              <path d="M21 28h22" stroke="currentColor" />
            </>
          ) : kind === "open" ? (
            <path d="M10 27h44M10 36h44" stroke="currentColor" />
          ) : (
            <>
              <path
                d={tall ? "M38 17v6M38 38v6" : "M32 20v32M27 31v7M37 31v7"}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </>
          )}
          {!wall && (
            <path
              d={tall ? "M21 56v4m22-4v4" : "M13 52v6m38-6v6"}
              stroke="currentColor"
              strokeWidth="2"
            />
          )}
        </>
      )}
    </svg>
  );
}
export function OptionCard({
  title,
  subtitle,
  selected,
  onClick,
  price,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onClick: () => void;
  price?: string;
}) {
  return (
    <button
      className={`option-card ${selected ? "selected" : ""}`}
      onClick={onClick}
    >
      <span className="option-top">
        <strong>{title}</strong>
        <span className="radio-dot">{selected && <Check size={12} />}</span>
      </span>
      {subtitle && <small>{subtitle}</small>}
      {price && <span className="option-price">{price}</span>}
    </button>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
export function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
      </div>
      {children}
    </div>
  );
}
export function LinkArrow() {
  return <ArrowUpRight size={19} />;
}
