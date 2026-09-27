import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, reviews } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/session";
import { AdminShell } from "@/components/admin/navigation";
import { DemoBar } from "@/components/demo/demo-bar";
import { storeConfig } from "../../../../store.config";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  const [[pending], pendingReviews] = await Promise.all([
    db.select({ count: count() }).from(orders).where(eq(orders.status, "pending")),
    storeConfig.features.reviews
      ? db.select({ count: count() }).from(reviews).where(eq(reviews.status, "pending"))
      : Promise.resolve([{ count: 0 }]),
  ]);
  return (
    <AdminShell
      storeName={storeConfig.store.name}
      pending={pending.count}
      pendingReviews={pendingReviews[0].count}
      user={{ name: user.name, email: user.email, role: user.role }}
      banner={<DemoBar place="admin" />}
    >
      {children}
    </AdminShell>
  );
}
