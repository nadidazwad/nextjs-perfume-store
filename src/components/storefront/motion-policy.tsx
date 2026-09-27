"use client";
import { useEffect } from "react";

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
    document.addEventListener("pointermove", hover, { passive: true });
    document.addEventListener("keydown", keyboard, true);
    document.addEventListener("pointerdown", pointer, true);
    return () => {
      document.removeEventListener("keydown", keyboard, true);
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("pointermove", hover);
      observer.disconnect();
      root.removeAttribute("data-header-scrolled");
      delete root.dataset.input;
    };
  }, []);
  return null;
}
