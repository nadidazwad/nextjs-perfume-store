import { notFound } from "next/navigation";
import { count, desc } from "drizzle-orm";
import { Inbox } from "lucide-react";
import { publicDb } from "@/db";
import { setupRequests } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/session";
import { EmptyState, PageHeader, Pagination, Tag } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/admin/format";
import { env } from "@/lib/env";
import { setupPlanTitle } from "@/lib/setup-requests/plans";

export const metadata = { title: "Setup requests" };
const PAGE_SIZE = 20;

/** A reply link for what the shop owner typed: mail for emails, WhatsApp for numbers. */
function replyHref(contact: string) {
  // Encoded so a typed "?bcc=…&body=…" can't add recipients or text to the reply.
  if (contact.includes("@")) return `mailto:${encodeURIComponent(contact)}`;
  const digits = contact.replace(/\D/g, "");
  // Local Bangladesh numbers (01XXXXXXXXX) need the country code for wa.me.
  return `https://wa.me/${/^01\d{9}$/.test(digits) ? `88${digits}` : digits}`;
}
/** Only http(s) links become clickable; anything else stays plain text. */
function linkHref(link: string) {
  const url = /^https?:\/\//i.test(link) ? link : `https://${link}`;
  try {
    return ["http:", "https:"].includes(new URL(url).protocol) ? url : null;
  } catch {
    return null;
  }
}

export default async function SetupRequests({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireAdmin();
  // The public demo's owner only: demo visitors are admins of their sandbox, not of this inbox.
  if (!env.DEMO_MODE || user.role !== "admin") notFound();
  const page = Math.max(1, Math.min(10000, Number((await searchParams).page) || 1));
  const [rows, [total]] = await Promise.all([
    publicDb
      .select()
      .from(setupRequests)
      .orderBy(desc(setupRequests.createdAt), desc(setupRequests.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    publicDb.select({ count: count() }).from(setupRequests),
  ]);
  return (
    <>
      <PageHeader
        title="Setup requests"
        description="Shop owners who asked for their own store on the public demo's Get this store page. New ones also arrive through your notification channel."
      />
      {rows.length ? (
        <>
          <ol className="admin-setup-requests">
            {rows.map((r) => {
              const link = r.link ? linkHref(r.link) : null;
              return (
                <li key={r.id} id={r.id} className="admin-panel">
                  <div className="admin-setup-head">
                    <div>
                      <strong>{r.business}</strong>
                      <small className="admin-muted">
                        {r.name} · {formatDateTime(r.createdAt)}
                      </small>
                    </div>
                    <Tag tone={r.plan === "custom" ? "info" : "neutral"}>{setupPlanTitle(r.plan)}</Tag>
                  </div>
                  <dl>
                    <div>
                      <dt>Contact</dt>
                      <dd>
                        <a href={replyHref(r.contact)} target="_blank" rel="noreferrer">
                          {r.contact}
                        </a>
                      </dd>
                    </div>
                    {r.link && (
                      <div>
                        <dt>Page</dt>
                        <dd>
                          {link ? (
                            <a href={link} target="_blank" rel="noreferrer nofollow">
                              {r.link}
                            </a>
                          ) : (
                            r.link
                          )}
                        </dd>
                      </div>
                    )}
                    {r.message && (
                      <div>
                        <dt>Message</dt>
                        <dd className="admin-setup-message">{r.message}</dd>
                      </div>
                    )}
                  </dl>
                </li>
              );
            })}
          </ol>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total.count}
            noun="requests"
            href={(p) => (p > 1 ? `/admin/setup-requests?page=${p}` : "/admin/setup-requests")}
          />
        </>
      ) : (
        <div className="admin-table-card">
          <EmptyState icon={<Inbox size={22} />} title="No requests yet">
            They appear here when a shop owner sends the form at /get-your-store.
          </EmptyState>
        </div>
      )}
    </>
  );
}
