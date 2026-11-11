import { useEffect, useRef, useState } from "react";
import { formatDateOnly, parseDateOnly } from "../lib/dates";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";

// Selector de fecha propio para que la fecha SIEMPRE se vea en dd/mm/yyyy,
// sin importar el idioma del sistema operativo de quien lo usa — un
// `<input type="date">` nativo la muestra en su propio selector según el
// locale del navegador, que no se puede forzar desde CSS/JS (ver
// lib/dates.ts). El campo de texto es de solo lectura a propósito: la fecha
// solo se elige con el calendario, nunca escribiéndola a mano, así nunca hay
// ambigüedad de formato ni que parsear un texto parcial.
//
// `value`/`onChange` siguen el mismo contrato que un input nativo de fecha
// (string "YYYY-MM-DD", o "" sin fecha), así que es un reemplazo directo de
// `<input type="date" {...register("campo")} />` vía react-hook-form
// `Controller` (ver AcademicsAdminPage.tsx/StudentsAdminPage.tsx/
// CourseDetailPage.tsx para el patrón de uso).
const WEEKDAY_INITIALS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("es", { month: "long", year: "numeric" });

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  id?: string;
  name?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
}

export function DatePicker({
  value,
  onChange,
  onBlur,
  id,
  name,
  placeholder = "dd/mm/yyyy",
  className,
  disabled,
  ...rest
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() =>
    monthStart(value ? parseDateOnly(value) : new Date()),
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        onBlur?.();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onBlur]);

  function openPicker() {
    if (disabled) return;
    setViewMonth(monthStart(value ? parseDateOnly(value) : new Date()));
    setIsOpen((v) => !v);
  }

  function pick(iso: string) {
    onChange(iso);
    setIsOpen(false);
    onBlur?.();
  }

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // 0 = lunes
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  const todayIso = toIsoDate(new Date());

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          id={id}
          name={name}
          readOnly
          disabled={disabled}
          value={value ? formatDateOnly(value) : ""}
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openPicker();
            }
          }}
          placeholder={placeholder}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          {...rest}
          className={`${
            className ??
            "focus-ring w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-400"
          } pr-8`}
        />
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          title="Elegir fecha"
          aria-label="Elegir fecha"
          className="absolute inset-y-0 right-0 flex items-center px-2 text-slate-400 hover:text-brand-600 disabled:text-slate-300"
        >
          <CalendarIcon className="h-4 w-4" />
        </button>
      </div>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Elegir fecha"
          className="absolute z-20 mt-1 w-64 rounded-xl border border-brand-100 bg-white p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMonth((d) => addMonths(d, -1))}
              title="Mes anterior"
              aria-label="Mes anterior"
              className="focus-ring rounded-md p-1 text-slate-500 hover:bg-slate-100"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold text-brand-900 capitalize">
              {MONTH_LABEL_FORMATTER.format(viewMonth)}
            </p>
            <button
              type="button"
              onClick={() => setViewMonth((d) => addMonths(d, 1))}
              title="Mes siguiente"
              aria-label="Mes siguiente"
              className="focus-ring rounded-md p-1 text-slate-500 hover:bg-slate-100"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-[10px] font-medium text-brand-600">
            {WEEKDAY_INITIALS.map((label, i) => (
              <span key={`${label}-${i}`}>{label}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (!day) return <span key={`blank-${i}`} />;
              const iso = toIsoDate(day);
              const isSelected = iso === value;
              const isToday = iso === todayIso;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => pick(iso)}
                  className={`focus-ring rounded-md py-1 text-xs ${
                    isSelected
                      ? "bg-brand-600 font-semibold text-white"
                      : isToday
                        ? "bg-brand-50 font-semibold text-brand-900"
                        : "text-slate-700 hover:bg-brand-50"
                  }`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
          {value && (
            <button
              type="button"
              onClick={() => pick("")}
              className="focus-ring mt-2 w-full rounded-md border border-slate-200 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              Quitar fecha
            </button>
          )}
        </div>
      )}
    </div>
  );
}
