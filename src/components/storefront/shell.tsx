import Link from "next/link";
import { ChevronDown, Mail, MapPin, Phone } from "lucide-react";
import { MessageCircle, Camera, Video, Music2 } from "./icons";
import { storeConfig as config } from "../../../store.config";
import { getNavigation, getBanners, getBrandSpotlights } from "@/lib/catalog/content";
import {
  Announcement,
  BrandMenu,
  DesktopNavigation,
  HeaderActions,
  MobileMenu,
  Newsletter,
  SearchForm,
} from "./shell-controls";
import { Media } from "./media";
import { ugcRel } from "@/lib/demo/links";
export const whatsappHref = config.contact.whatsapp
  ? `https://wa.me/${config.contact.whatsapp.replace(/\D/g, "")}`
  : null;
const tel = `tel:${config.contact.phone.replace(/\s/g, "")}`;
const paymentNames = Object.entries(config.checkout.paymentMethods)
  .filter(([, method]) => method.enabled)
  .map(([key, method]) => ("label" in method ? method.label : key === "bkash" ? "bKash" : "Nagad"));

function Logo({ className = "store-logo" }: { className?: string }) {
  return (
    <Link href="/" className={className}>
      {config.store.logo ? <Media src={config.store.logo} alt={config.store.name} sizes="200px" /> : config.store.name}
    </Link>
  );
}

export async function StoreHeader() {
  const [nav, spotlights, banners] = await Promise.all([
    getNavigation(),
    getBrandSpotlights(),
    config.announcementBar.enabled ? getBanners() : Promise.resolve([]),
  ]);
  // Category links: fixed shortcuts first, then any extra active collections.
  const links = [
    { name: "Men", href: "/products?gender=men" },
    { name: "Women", href: "/products?gender=women" },
    { name: "Unisex", href: "/products?gender=unisex" },
    { name: "New arrivals", href: "/products?new=true" },
    ...nav.collections
      .filter((c) => !["men", "women", "unisex", "deals"].includes(c.slug))
      .map((c) => ({ name: c.name, href: `/c/${c.slug}` })),
    { name: "Deals", href: "/products?deal=true&sort=discount" },
  ];
  const brands = nav.brands.map((b) => ({ name: b.name, href: `/brands/${b.slug}` }));
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {config.announcementBar.enabled && (
        <Announcement
          messages={banners
            .filter((b) => b.placement === "announcement")
            .map((b) => ({ title: b.title, href: b.href, rel: ugcRel(b.href) }))}
        />
      )}
      <span className="header-scroll-sentinel" aria-hidden />
      <header className="store-header">
        <div className="header-main store-width">
          <MobileMenu links={links} brands={brands} />
          <Logo />
          <SearchForm className="header-search" />
          <a className="header-call" href={tel}>
            <span className="icon-tile sm">
              <Phone size={15} aria-hidden />
            </span>
            <span>
              <small>Order by phone</small>
              {config.contact.phone}
            </span>
          </a>
          <HeaderActions />
        </div>
        <DesktopNavigation links={links}>
          <details name="store-navigation" className="nav-menu">
            <summary className="nav-link">
              Brands <ChevronDown size={15} aria-hidden />
            </summary>
            <BrandMenu
              brands={nav.brands.map((b) => {
                const product = spotlights.get(b.id);
                return {
                  id: b.id,
                  name: b.name,
                  href: `/brands/${b.slug}`,
                  isFeatured: b.isFeatured,
                  spotlight: product && { name: product.name, href: `/products/${product.slug}`, imageUrl: product.imageUrl },
                };
              })}
            />
          </details>
        </DesktopNavigation>
      </header>
    </>
  );
}

export async function StoreFooter() {
  const { pages } = await getNavigation();
  const socialIcons = {
    facebook: MessageCircle,
    instagram: Camera,
    youtube: Video,
    tiktok: Music2,
  };
  const socials = Object.entries(config.contact.social).filter(([, url]) => url);
  return (
    <footer className="store-footer">
      <div className="store-width">
        <div className="footer-card">
          <div className="footer-brand">
            <Logo className="store-logo footer-logo" />
            <p>{config.store.tagline}</p>
            <ul className="footer-contact">
              <li>
                <Phone size={15} aria-hidden />
                <a href={tel}>{config.contact.phone}</a>
                {whatsappHref && (
                  <>
                    {" · "}
                    <a href={whatsappHref}>WhatsApp</a>
                  </>
                )}
              </li>
              {config.contact.email && (
                <li>
                  <Mail size={15} aria-hidden />
                  <a href={`mailto:${config.contact.email}`}>{config.contact.email}</a>
                </li>
              )}
              {config.contact.addressLines.length > 0 && (
                <li>
                  <MapPin size={15} aria-hidden />
                  <address>{config.contact.addressLines.join(", ")}</address>
                </li>
              )}
            </ul>
            {socials.length > 0 && (
              <div className="social-links">
                {socials.map(([key, url]) => {
                  const Icon = socialIcons[key as keyof typeof socialIcons];
                  return (
                    <a key={key} href={url!} aria-label={key} className="icon-button">
                      <Icon size={17} />
                    </a>
                  );
                })}
              </div>
            )}
          </div>
          <nav aria-label="Shop" className="footer-links">
            <p>Shop</p>
            <Link href="/products">All fragrances</Link>
            <Link href="/brands">Brands</Link>
            <Link href="/products?new=true">New arrivals</Link>
            <Link href="/products?deal=true&sort=discount">Deals</Link>
          </nav>
          <nav aria-label="Help and information" className="footer-links">
            <p>Help</p>
            <Link href="/track-order">Track your order</Link>
            {pages.map((page) => (
              <Link key={page.slug} href={`/pages/${page.slug}`}>
                {page.title}
              </Link>
            ))}
          </nav>
          <div className="footer-newsletter">
            <Newsletter />
          </div>
        </div>
        <div className="footer-bottom">
          <p>
            © {new Date().getFullYear()} {config.store.name}
          </p>
          <ul className="payment-chips" aria-label="Payment methods">
            {paymentNames.map((name) => (
              <li key={name} className="chip">
                {name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
