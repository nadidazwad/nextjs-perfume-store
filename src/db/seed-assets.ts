/** Reproduce committed SVG fixtures with: node --import tsx src/db/seed-assets.ts */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { demoBrands, demoProducts } from "./seed-data";
import { slugify } from "@/lib/slug";

const escapeXml = (value: string) => value.replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]!);
function artwork(title: string, subtitle: string, color: string, wide = false, detail = false) {
  const words = title.split(" ");
  const split = Math.ceil(words.length / 2);
  const labelLines = [words.slice(0, split).join(" "), words.slice(split).join(" ")].filter(Boolean);
  const width = wide ? 1600 : 800;
  const height = wide ? 900 : 960;
  const center = width / 2;
  const variant = [...title].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3;
  const bottleWidth = [220, 250, 190][variant];
  const bottleHeight = [330, 280, 360][variant];
  const x = center - bottleWidth / 2;
  const y = height / 2 - bottleHeight / 2 + 35;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(title)}</title><desc id="desc">${escapeXml(subtitle)}. Original illustration of a fictional fragrance.</desc>
  <defs>
    <linearGradient id="bg" x2=".8" y2="1"><stop stop-color="#f6f3ec"/><stop offset="1" stop-color="#e7e2d6"/></linearGradient>
    <linearGradient id="glass"><stop stop-color="${color}" stop-opacity=".65"/><stop offset=".12" stop-color="#fcfaf3" stop-opacity=".8"/><stop offset=".25" stop-color="${color}" stop-opacity=".55"/><stop offset=".8" stop-color="${color}" stop-opacity=".8"/><stop offset=".95" stop-color="#f8f2dc" stop-opacity=".75"/><stop offset="1" stop-color="${color}"/></linearGradient>
    <linearGradient id="cap"><stop stop-color="#242820"/><stop offset=".45" stop-color="#555548"/><stop offset="1" stop-color="#22251e"/></linearGradient>
    <filter id="shadow"><feGaussianBlur stdDeviation="15"/></filter>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  ${wide ? `<path d="M0 0h${width*.3}L${width*.65} ${height}H${width*.4}Z" fill="#fff" opacity=".3"/><rect x="${center-250}" y="${y+bottleHeight-5}" width="520" height="200" fill="#d9d3c5"/>` : ''}
  <ellipse cx="${center+38}" cy="${y+bottleHeight+12}" rx="165" ry="24" fill="#49483b" opacity=".19" filter="url(#shadow)"/>
  <g transform="${detail ? `rotate(8 ${center} ${height/2})` : ''}">
    <rect x="${center-52}" y="${y-89}" width="104" height="82" rx="4" fill="url(#cap)"/>
    <rect x="${center-45}" y="${y-12}" width="90" height="18" fill="#b5a27d"/>
    <rect x="${x}" y="${y}" width="${bottleWidth}" height="${bottleHeight}" rx="${variant===2 ? 55 : 15}" fill="url(#glass)" stroke="#c6c5b7" stroke-width="2"/>
    <rect x="${x+10}" y="${y+10}" width="${bottleWidth-20}" height="${bottleHeight-21}" rx="${variant===2 ? 46 : 10}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>
    <path d="M${x+19} ${y+36}v${bottleHeight-90}" stroke="#fff" opacity=".6" stroke-width="5"/>
    <rect x="${x+24}" y="${y+85}" width="${bottleWidth-48}" height="145" fill="#faf8f0" stroke="#ded9cc"/>
    <text x="${center}" y="${y+117}" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" letter-spacing="2" fill="#585b4f">FRAGRANCE STUDY</text>
    ${labelLines.map((word,i) => `<text x="${center}" y="${y+149+i*23}" text-anchor="middle" font-family="Georgia,serif" font-size="21" fill="#34392e">${escapeXml(word)}</text>`).join('')}
    <path d="M${center-16} ${y+204}h32" stroke="#b6ad92"/>
  </g>
</svg>\n`;
}

async function main() {
  const directory = join(process.cwd(), "public/seed");
  await mkdir(directory, { recursive: true });
  const files: [string, string][] = [];
  for (const product of demoProducts) {
    files.push([`${product.slug}.svg`, artwork(product.name, product.brand.name, product.brand.color)]);
    files.push([`${product.slug}-detail.svg`, artwork(product.name, `${product.concentration.toUpperCase()} · ${product.brand.name}`, product.brand.color, false, true)]);
  }
  for (const brand of demoBrands) {
    const slug = slugify(brand.name);
    files.push([`brand-${slug}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400"><rect width="800" height="400" fill="#eeeee5"/><text x="400" y="210" text-anchor="middle" font-family="Georgia,serif" font-size="48" fill="#343e32">${escapeXml(brand.name)}</text><path d="M370 252h60" stroke="#919681"/></svg>`]);
    files.push([`brand-${slug}-hero.svg`, artwork(brand.name, "Explore the collection", brand.color, true)]);
  }
  for (const [slug, title, subtitle, color] of [
    ["men", "For Him", "Woods, citrus and quiet confidence", "#62758a"],
    ["women", "For Her", "Florals, soft musks and warm amber", "#b4898c"],
    ["niche", "A Different Direction", "Discover our imagined niche houses", "#73836b"],
    ["deals", "Everyday Discoveries", "Explore the demo fragrance edit", "#a77f57"],
    ["hero-discovery", "Find Your Next Fragrance", "Explore the fictional demo collection", "#687a80"],
    ["hero-oils", "Small Bottles, Rich Notes", "Discover oils and attars", "#9c7950"],
  ]) files.push([`${slug}.svg`, artwork(title, subtitle, color, true)]);
  await Promise.all(files.map(([name, svg]) => writeFile(join(directory, name), svg)));
  console.log(`Generated ${files.length} deterministic SVG fixtures in public/seed/.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
