import assert from 'node:assert/strict';
import { z } from 'zod';

// Run against a seeded, running storefront: node scripts/verify-storefront.mjs [origin].
const origin = process.argv[2] ?? 'http://localhost:3001';
const get = async (path) => {
  const response = await fetch(new URL(path, origin));
  assert(response.ok, `${path}: HTTP ${response.status}`);
  return response.text();
};
const sitemap = await get('/sitemap.xml');
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => new URL(m[1]));
assert(urls.length >= 3);
for (const prefix of ['/products/', '/brands/', '/c/', '/pages/']) {
  assert(urls.some((url) => url.pathname.startsWith(prefix)), `Sitemap missing ${prefix}`);
}
const productSchema = z.object({
  '@context': z.literal('https://schema.org'), '@type': z.literal('Product'),
  name: z.string().min(1), description: z.string().min(1), image: z.array(z.url()).min(1),
  brand: z.object({ '@type': z.literal('Brand'), name: z.string().min(1) }),
  offers: z.array(z.object({
    '@type': z.literal('Offer'), sku: z.string().min(1), url: z.url(),
    priceCurrency: z.string().regex(/^[A-Z]{3}$/), price: z.string().regex(/^\d+(\.\d{2})?$/),
    availability: z.enum(['https://schema.org/InStock', 'https://schema.org/OutOfStock']),
  })).min(1),
});
for (const url of urls) {
  const html = await get(url.pathname);
  assert(/<title>.+?<\/title>/.test(html), `${url.pathname}: title`);
  assert(/rel="canonical"/.test(html), `${url.pathname}: canonical`);
  assert(!html.includes('We could not load this page'), `${url.pathname}: error boundary`);
  if (url.pathname.startsWith('/products/')) {
    const data = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(m => JSON.parse(m[1]));
    productSchema.parse(data.find(d => d['@type'] === 'Product'));
    assert(data.some(d => d['@type'] === 'BreadcrumbList'));
  }
}
const malformed = await get('/products?minPrice=invalid&maxPrice=NaN&sort=invalid');
assert(!malformed.includes('We could not load this page'));
assert((await get('/search?q=there-is-no-such-fragrance')).includes('No fragrances found'));
const missing = await fetch(new URL('/products/no-such-product', origin));
const missingHtml = await missing.text();
assert(missingHtml.includes('Page not found'));
assert(missing.status === 404 || /noindex/.test(missingHtml));
assert((await get('/robots.txt')).includes('Sitemap:'));
// ST-08 autosuggest: shape, minimum length, and length cap.
const suggestSchema = z.object({
  products: z.array(z.object({ name: z.string(), slug: z.string(), brand: z.string(), price: z.number().int(), retailPrice: z.number().int() })).max(5),
  brands: z.array(z.object({ name: z.string(), slug: z.string() })).max(4),
  total: z.number().int(),
});
const firstProduct = urls.find((url) => url.pathname.startsWith('/products/'));
const term = decodeURIComponent(firstProduct.pathname.split('/').pop()).split('-')[0];
const suggest = suggestSchema.parse(JSON.parse(await get(`/api/search/suggest?q=${encodeURIComponent(term)}`)));
assert(suggest.products.length > 0, `suggest returned nothing for "${term}"`);
assert.equal(suggestSchema.parse(JSON.parse(await get('/api/search/suggest?q=a'))).products.length, 0);
assert.equal((await fetch(new URL(`/api/search/suggest?q=${'x'.repeat(200)}`, origin))).status, 400);
const og = await fetch(new URL('/opengraph-image', origin));
assert(og.ok && og.headers.get('content-type')?.startsWith('image/'));
console.log(`Verified ${urls.length} public sitemap URLs, Product JSON-LD, metadata, malformed filters, empty search, 404, robots, OG image and search suggest.`);
