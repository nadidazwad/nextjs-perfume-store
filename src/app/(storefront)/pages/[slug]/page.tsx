import { Breadcrumbs } from "@/components/storefront/ui";
import { env } from "@/lib/env";
import { notFound } from "next/navigation";
import { getStaticPage } from "@/lib/catalog/content";
import { pageMetadata } from "@/lib/seo";
import { Markdown } from "@/components/storefront/markdown";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const p = await getStaticPage((await params).slug);
  return p
    ? pageMetadata(
        p.title,
        `/pages/${p.slug}`,
        p.body.replace(/[#*]/g, "").slice(0, 160),
      )
    : {};
}
export default async function StaticPage({ params }: Props) {
  const p = await getStaticPage((await params).slug);
  if (!p) notFound();
  return (
    <article className="store-width static-page">
      <Breadcrumbs items={[["Home", "/"], [p.title]]} />
      <h1>{p.title}</h1>
      <Markdown body={p.body.replace(/^# [^\n]+\n*/, "")} ugc={env.DEMO_MODE} />
    </article>
  );
}
