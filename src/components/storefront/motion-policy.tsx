"use client";
import { useEffect } from "react";
import { PHONE_QUERY } from "./device";

/** Keep keyboard interaction immediate, including portalled storefront surfaces. */
export function MotionPolicy() {
  useEffect(() => {
    const root = document.documentElement;
    const update = (mode: string) => {
      if (root.dataset.input === mode) return;
      root.dataset.input = mode;
      document.dispatchEvent(new Event("attar-input-change"));
    };
    const keyboard = () => update("keyboard");
    const pointer = () => update("pointer");
    const sentinel = document.querySelector(".header-scroll-sentinel");
    const observer = new IntersectionObserver(([entry]) => {
      root.toggleAttribute("data-header-scrolled", !entry.isIntersecting);
    });
    if (sentinel) observer.observe(sentinel);
    const hover = (event: PointerEvent) => {
      if (event.pointerType === "mouse") update("pointer");
    };
    // Phones: the tapped card's photo morphs into the product page gallery
    // (`.gallery-main` carries the same view-transition-name in app-shell.css).
    // Named on tap, so repeated cards of one product never share the name.
    let unname = 0;
    const morph = (event: MouseEvent) => {
      if (!window.matchMedia(PHONE_QUERY).matches) return;
      const link = (event.target as Element | null)?.closest?.(".product-card-link");
      const photo = link?.closest(".product-card")?.querySelector<HTMLElement>(".product-card-media");
      if (!photo) return;
      document.querySelectorAll<HTMLElement>(".gallery-main").forEach((el) => (el.style.viewTransitionName = "none"));
      photo.style.viewTransitionName = "product-photo";
      clearTimeout(unname);
      unname = window.setTimeout(() => photo.style.removeProperty("view-transition-name"), 2000);
    };
    document.addEventListener("click", morph, true);
    document.addEventListener("pointermove", hover, { passive: true });
    document.addEventListener("keydown", keyboard, true);
    document.addEventListener("pointerdown", pointer, true);
    return () => {
      document.removeEventListener("keydown", keyboard, true);
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("pointermove", hover);
      document.removeEventListener("click", morph, true);
      clearTimeout(unname);
      observer.disconnect();
      root.removeAttribute("data-header-scrolled");
      delete root.dataset.input;
    };
  }, []);
  return null;
}
