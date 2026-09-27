import Link from "next/link";
import { BadgeCheck, MessageSquareText } from "lucide-react";
import { getProductReviews, REVIEWS_PAGE_SIZE } from "@/lib/reviews/server";
import { Stars } from "./ui";
import { ReviewDialog } from "./review-form";

const date = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" });

/** PDP reviews: summary, 5→1 distribution, approved reviews, "Write a review". Flag-gated by the loader. */
export async function ProductReviews({
  product,
  page,
}: {
  product: { id: string; name: string; slug: string };
  page: number;
}) {
  const data = await getProductReviews(product.id, page);
  if (!data) return null;
  const { summary, reviews, hasMore } = data;
  return (
    <section id="reviews" className="reviews-section" aria-labelledby="reviews-title">
      <div className="reviews-summary panel">
        <h2 id="reviews-title">Customer reviews</h2>
        {summary.count ? (
          <>
            <div className="reviews-score">
              <strong>{summary.average.toFixed(1)}</strong>
              <div>
                <Stars value={summary.average} size={18} />
                <span className="muted">
                  Based on {summary.count} {summary.count === 1 ? "review" : "reviews"}
                </span>
              </div>
            </div>
            <ul className="reviews-bars" aria-label="Rating distribution">
              {summary.distribution.map((row) => (
                <li key={row.stars}>
                  <span className="reviews-bar-label">{row.stars} star</span>
                  <span className="reviews-bar" aria-hidden>
                    <i style={{ width: `${row.percent}%` }} />
                  </span>
                  <span className="reviews-bar-count">
                    {row.count}
                    <span className="sr-only"> {row.count === 1 ? "review" : "reviews"}, {row.percent}%</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted">No reviews yet. Tried {product.name}? Tell other shoppers what you think.</p>
        )}
        <ReviewDialog productId={product.id} productName={product.name} />
        <p className="reviews-policy">Reviews are checked by our team before they appear.</p>
      </div>
      <div className="reviews-list">
        {reviews.length ? (
          <>
            <ol>
              {reviews.map((r) => (
                <li key={r.id} className="review">
                  <div className="review-head">
                    <Stars value={r.rating} label={`${r.rating} out of 5 stars`} />
                    {r.verified && (
                      <span className="review-verified">
                        <BadgeCheck size={15} aria-hidden /> Verified purchase
                      </span>
                    )}
                  </div>
                  {r.title && <h3>{r.title}</h3>}
                  <p className="review-body">{r.body}</p>
                  <p className="review-meta">
                    <strong>{r.name}</strong> · <time dateTime={r.createdAt.toISOString()}>{date(r.createdAt)}</time>
                  </p>
                </li>
              ))}
            </ol>
            {hasMore && (
              <Link
                className="button"
                href={`/products/${product.slug}?reviews=${Math.floor(reviews.length / REVIEWS_PAGE_SIZE) + 1}#reviews`}
                scroll={false}
                replace
              >
                Show more reviews
                <span className="muted">
                  {reviews.length} of {summary.count}
                </span>
              </Link>
            )}
          </>
        ) : (
          <div className="reviews-empty">
            <span className="icon-tile lg">
              <MessageSquareText size={22} aria-hidden />
            </span>
            <p>Be the first to review this fragrance.</p>
          </div>
        )}
      </div>
    </section>
  );
}
