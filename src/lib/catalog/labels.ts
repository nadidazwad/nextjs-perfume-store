/** Display names for catalog enum values. Zod-free so client components can import it cheaply. */
export const labels: Record<string, string> = {
  men: "Men",
  women: "Women",
  unisex: "Unisex",
  edt: "Eau de toilette",
  edp: "Eau de parfum",
  parfum: "Parfum",
  extrait: "Extrait",
  edc: "Eau de cologne",
  oil: "Perfume oil",
  attar: "Attar",
  standard: "Standard",
  tester: "Tester",
  sample: "Sample",
  mini: "Mini",
  gift_set: "Gift set",
  "under-50": "Under 50 ml",
  "50-99": "50–99 ml",
  "100-plus": "100 ml and over",
};
export function label(value: string) {
  return (
    labels[value] ??
    value.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase())
  );
}
