"use client";
import { useState } from "react";
import Link from "next/link";
import { Media } from "./media";
export function BrandIndex({
  brands,
}: {
  brands: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    isFeatured: boolean;
  }[];
}) {
  const [search, setSearch] = useState("");
  const filtered = brands.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()),
  );
  const letters = [...new Set(filtered.map((b) => b.name[0].toUpperCase()))];
  return (
    <>
      <div className="brand-featured">
        {brands
          .filter((b) => b.isFeatured)
          .map((b) => (
            <Link href={`/brands/${b.slug}`} key={b.id}>
              <Media src={b.logoUrl} alt={b.name} sizes="180px" />
            </Link>
          ))}
      </div>
      <label className="brand-search">
        Find a brand
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Brand name"
        />
      </label>
      <nav className="brand-alphabet" aria-label="Brand letters">
        {letters.map((letter) => (
          <a key={letter} href={`#brand-${letter}`}>
            {letter}
          </a>
        ))}
      </nav>
      {letters.map((letter) => (
        <section className="brand-letter" key={letter} id={`brand-${letter}`}>
          <h2>{letter}</h2>
          <div>
            {filtered
              .filter((b) => b.name[0].toUpperCase() === letter)
              .map((b) => (
                <Link key={b.id} href={`/brands/${b.slug}`}>
                  {b.name}
                </Link>
              ))}
          </div>
        </section>
      ))}
      {!filtered.length && <p>No brands match your search.</p>}
    </>
  );
}
