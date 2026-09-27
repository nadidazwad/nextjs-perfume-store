import Link from "next/link";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { getPublicOrder } from "@/lib/orders/public-order";
import { OrderSummary } from "@/components/storefront/order-tracking";
import { PaymentInstructions } from "@/components/storefront/checkout";
import { SuccessMark } from "@/components/storefront/ui";
import { storeConfig as config } from "../../../../../../store.config";
export const metadata = {
  title: "Order received",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const token = (await cookies()).get("attar-order")?.value;
  const [record] = token
    ? await db
        .select()
        .from(orders)
        .where(and(eq(orders.id, token), eq(orders.orderNumber, orderNumber)))
    : [];
  if (!record)
    return (
      <div className="store-width commerce-page">
        <h1>Look up your order</h1>
        <p>Enter your order number and phone number to view its details.</p>
        <Link className="button primary" href="/track-order">
          Track your order
        </Link>
      </div>
    );
  const order = await getPublicOrder(record.orderNumber, record.customerPhone);
  return (
    <div className="store-width commerce-page confirmation-page">
      <SuccessMark size={44} />
      <p className="muted">Order received</p>
      <h1>{record.orderNumber}</h1>
      <p className="confirmation-note">{config.checkout.confirmationNote}</p>
      <ol className="next-steps">
        <li>
          <strong>We&apos;ll call you</strong>
          <span>Keep your phone nearby.</span>
        </li>
        <li>
          <strong>You confirm the details</strong>
          <span>We check availability and your delivery address.</span>
        </li>
        <li>
          <strong>We send your order</strong>
          <span>Follow its progress on the tracking page.</span>
        </li>
      </ol>
      {record.paymentMethod !== "cod" && (
        <section>
          <p className="confirmation-note">
            Transaction ID {record.paymentTxnId} received. We will verify your
            payment during the confirmation call. Please do not send it again.
          </p>
          <PaymentInstructions method={record.paymentMethod} />
        </section>
      )}
      <div className="confirmation-links">
        <Link className="button primary" href="/track-order">
          Track your order
        </Link>
        <a
          className="text-link"
          href={`tel:${config.contact.phone.replace(/\s/g, "")}`}
        >
          Call {config.contact.phone}
        </a>
        {config.contact.whatsapp && (
          <a
            className="text-link"
            href={`https://wa.me/${config.contact.whatsapp.replace(/\D/g, "")}`}
          >
            WhatsApp
          </a>
        )}
      </div>
      {order && <OrderSummary order={order} />}
    </div>
  );
}
