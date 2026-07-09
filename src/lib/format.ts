// Small utilities shared across pages
export function formatEUR(v: number | string | null | undefined): string {
  const n = typeof v === "string" ? Number(v) : v ?? 0;
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(n || 0);
}

export function metodoLabel(m: string): string {
  switch (m) {
    case "dinheiro":
      return "Dinheiro";
    case "multibanco":
      return "Multibanco";
    case "mbway":
      return "MB Way";
    default:
      return m;
  }
}
