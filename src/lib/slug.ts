/** Generate a lowercase ASCII kebab-case slug. Uniqueness is enforced by the DB. */
export function slugify(value: string): string {
  const slug = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) throw new Error("A slug needs at least one letter or number.");
  return slug;
}
