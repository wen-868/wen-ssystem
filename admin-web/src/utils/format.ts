export function formatYuan(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "¥0.00";
  return "¥" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
