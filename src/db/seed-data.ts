import { storeConfig } from "../../store.config";
import { slugify } from "@/lib/slug";
import type { brands, notes, products } from "./schema";

// Invented demo houses and product names. None represent licensed merchandise.
export const demoBrands = [
  { name: "Avenmere Atelier", brandType: "designer", color: "#374c69" },
  { name: "Vellune House", brandType: "designer", color: "#76624f" },
  { name: "Orivane Studio", brandType: "niche", color: "#5a695d" },
  { name: "Thistlewake", brandType: "niche", color: "#675276" },
  { name: "Sahmira Scents", brandType: "arabian", color: "#937245" },
  { name: "Qamriven", brandType: "arabian", color: "#365e61" },
  { name: "Elowen Stage", brandType: "celebrity", color: "#925b65" },
  { name: "Mirovale Lights", brandType: "celebrity", color: "#705d81" },
  { name: "Meghvara", brandType: "local", color: "#496b61" },
  { name: "Bhorika Works", brandType: "local", color: "#92644e" },
] satisfies { name: string; brandType: typeof brands.$inferInsert.brandType; color: string }[];

const notesByGroup = {
  citrus: ["Bergamot", "Lemon", "Mandarin", "Grapefruit", "Yuzu", "Pomelo"],
  floral: ["Rose", "Jasmine", "Iris", "Violet", "Tuberose", "Orange Blossom"],
  woody: ["Cedarwood", "Sandalwood", "Vetiver", "Guaiac Wood", "Birch", "Oakwood"],
  oriental: ["Amber", "Benzoin", "Labdanum", "Myrrh", "Frankincense", "Oud"],
  fresh: ["Lavender", "Mint", "Eucalyptus", "Juniper", "Ginger Water", "Linen Accord"],
  spicy: ["Cardamom", "Pink Pepper", "Black Pepper", "Cinnamon", "Clove", "Saffron"],
  sweet: ["Vanilla", "Tonka Bean", "Praline", "Honey", "Cocoa", "Caramel"],
  musky: ["White Musk", "Ambrette", "Soft Musk", "Cashmere Musk", "Powder Musk", "Clean Musk"],
  green: ["Fig Leaf", "Violet Leaf", "Green Tea", "Basil", "Galbanum", "Cut Grass"],
  aquatic: ["Sea Salt", "Marine Accord", "Rain Accord", "Water Lily", "Lotus", "Driftwood Accord"],
} satisfies Record<typeof notes.$inferInsert.group, string[]>;

export const demoNotes = Object.entries(notesByGroup).flatMap(([group, names]) =>
  names.map((name) => ({ name, slug: slugify(name), group: group as typeof notes.$inferInsert.group })),
);

const productNames = [
  "Cedar Interval", "Glass Orchard", "Velvet Meridian", "Rainward", 
  "Copper Reverie", "Petal Archive", "Linen Voyage", "Amber Folio",
  "Moss Arithmetic", "Quiet Solstice", "Fig Cartography", "Salt Manuscript",
  "Fern Nocturne", "Iris Semaphore", "Cloud Almanac", "Thistle Current",
  "Saffron Lantern", "Dune Letter", "Resin Compass", "Oud Tapestry",
  "Moonwell Amber", "Silken Myrrh", "Cardamom Terrace", "Oasis Thread",
  "Rose Interlude", "Cocoa Applause", "Violet Curtain", "Honey Cadenza",
  "Citrus Spotlight", "Praline Echo", "Jasmine Refrain", "Musk Encore",
  "Monsoon Sketch", "Tea Courtyard", "Lotus Footpath", "Green Veranda",
  "Morning Loom", "Basil Postcard", "Clay Blossom", "River Saffron",
];

const genders = ["men", "women", "unisex"] as const;
const concentrations = ["edt", "edp", "parfum", "extrait", "edc", "oil", "attar"] as const;
const packagings = ["standard", "tester", "sample", "mini", "gift_set"] as const;
const families = ["Woody Aromatic", "Floral", "Amber", "Fresh Citrus", "Green", "Aquatic", "Spicy Woody", "Soft Musk"];

export const demoProducts = productNames.map((name, index) => {
  const brand = demoBrands[Math.floor(index / 4)];
  const concentration = concentrations[index % concentrations.length];
  const packaging = packagings[index % packagings.length];
  const sizes = packaging === "sample" ? [2, 5] : packaging === "mini" ? [10, 15]
    : packaging === "gift_set" ? [60, 90] : ["oil", "attar"].includes(concentration) ? [6, 12] : [50, 100];
  return {
    name, slug: slugify(name), brand, index, concentration, packaging, sizes,
    gender: genders[index % genders.length], fragranceFamily: families[index % families.length],
    imageUrl: `/seed/${slugify(name)}.svg`, hoverImageUrl: `/seed/${slugify(name)}-detail.svg`,
  } satisfies { name: string; slug: string; brand: typeof brand; index: number; concentration: typeof products.$inferInsert.concentration; packaging: typeof products.$inferInsert.packaging; sizes: number[]; gender: typeof products.$inferInsert.gender; fragranceFamily: string; imageUrl: string; hoverImageUrl: string };
});

/** Convert whole demo currency units into this store's integer minor units. */
export const demoMoney = (wholeUnits: number) => wholeUnits * 10 ** storeConfig.currency.minorUnits;
export const demoSeedKey = "demo_seed_v1";
