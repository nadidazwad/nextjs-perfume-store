import { db } from "@/db";
import { asc } from "drizzle-orm";
import { brands, notes, collections, products } from "@/db/schema";
import { requireAdmin } from "./session";
export async function editorChoices() {
  await requireAdmin();
  const [b, n, c, f] = await Promise.all([
    db
      .select({ id: brands.id, name: brands.name, slug: brands.slug })
      .from(brands)
      .orderBy(asc(brands.name)),
    db
      .select({
        id: notes.id,
        name: notes.name,
        slug: notes.slug,
        group: notes.group,
      })
      .from(notes)
      .orderBy(asc(notes.name)),
    db.select({ id: collections.id, name: collections.name }).from(collections),
    db.selectDistinct({ name: products.fragranceFamily }).from(products),
  ]);
  return {
    brands: b,
    notes: n,
    collections: c,
    families: f.map((v) => v.name).filter((v): v is string => Boolean(v)),
  };
}
