import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { products, productImages } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/session";
import { editorChoices } from "@/lib/admin/choices";
import { ProductEditor } from "@/components/admin/product-editor";
export default async function Product({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const choices = await editorChoices();
  const p =
    id === "new"
      ? undefined
      : await db.query.products.findFirst({
          where: eq(products.id, id),
          with: {
            variants: true,
            images: { orderBy: asc(productImages.sortOrder) },
            notes: true,
          },
        });
  if (id !== "new" && !p) notFound();
  return (
    <ProductEditor
        key={p?.updatedAt.toISOString() ?? "new"}
        id={p?.id}
        choices={choices}
        initial={
          p
            ? {
                ...p,
                variants: p.variants.map((v) => ({
                  ...v,
                  expectedStock: v.stockQuantity,
                })),
                images: p.images.map((v) => ({ url: v.url, alt: v.alt })),
                notes: p.notes.map((v) => ({
                  noteId: v.noteId,
                  position: v.position,
                })),
              }
            : undefined
        }
      />
  );
}
