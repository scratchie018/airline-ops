const STYLES: Record<string, string> = {
  SCHEDULED: "bg-outline/10 text-ink-muted ring-outline/20",
  BOARDING: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  DEPARTED: "bg-brand-500/15 text-brand-300 ring-brand-500/30",
  EN_ROUTE: "bg-brand-500/15 text-brand-300 ring-brand-500/30",
  LANDED: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  CANCELLED: "bg-tuired-500/15 text-tuired-400 ring-tuired-500/30",
  ACTIVE: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  MAINTENANCE: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  RETIRED: "bg-outline/10 text-ink-muted ring-outline/20",
  CONFIRMED: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  CHECKED_IN: "bg-brand-500/15 text-brand-300 ring-brand-500/30",
};

const ICONS: Record<string, string> = {
  SCHEDULED: "fa-regular fa-clock",
  BOARDING: "fa-solid fa-door-open",
  DEPARTED: "fa-solid fa-plane-departure",
  EN_ROUTE: "fa-solid fa-plane",
  LANDED: "fa-solid fa-plane-arrival",
  CANCELLED: "fa-solid fa-ban",
  ACTIVE: "fa-solid fa-circle-check",
  MAINTENANCE: "fa-solid fa-screwdriver-wrench",
  RETIRED: "fa-solid fa-box-archive",
  CONFIRMED: "fa-solid fa-check",
  CHECKED_IN: "fa-solid fa-clipboard-check",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ${
        STYLES[status] || "bg-outline/10 text-ink-muted ring-outline/20"
      }`}
    >
      <i className={`${ICONS[status] || "fa-solid fa-circle"} text-[10px]`} />
      {status.replace("_", " ")}
    </span>
  );
}
