export function formatYuan(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "¥0.00";
  return "¥" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatDate(value: unknown): string {
  if (!value) return "-";
  if (typeof value === "string" && value.length <= 10) return value;
  const d = new Date(value as string | number);
  if (isNaN(d.getTime())) return String(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}
