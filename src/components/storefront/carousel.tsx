"use client";
import { useEffect, useState } from "react";
import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
export function StoreCarousel({
  children,
  label,
  hero = false,
}: {
  children: React.ReactNode[];
  label: string;
  hero?: boolean;
}) {
  const [api, setApi] = useState<CarouselApi>();
  useEffect(() => {
    if (!api) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => api.reInit({ duration: reduced.matches || document.documentElement.dataset.input === "keyboard" ? 0 : 25 });
    update();
    reduced.addEventListener("change", update);
    document.addEventListener("attar-input-change", update);
    return () => {
      reduced.removeEventListener("change", update);
      document.removeEventListener("attar-input-change", update);
    };
  }, [api]);
  return (
    <Carousel
      setApi={setApi}
      onKeyDownCapture={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "ArrowLeft") api?.scrollPrev(true);
        else api?.scrollNext(true);
      }}
      opts={{ align: "start", loop: hero && children.length > 1 }}
      aria-label={label}
      className={hero ? "hero-carousel" : "store-carousel"}
    >
      <CarouselContent>
        {children.map((child, i) => (
          <CarouselItem
            key={i}
            className={hero ? "" : "basis-[72%] sm:basis-[42%] md:basis-1/3 lg:basis-1/4"}
          >
            {child}
          </CarouselItem>
        ))}
      </CarouselContent>
      {children.length > 1 && (
        <div className="carousel-controls" data-count={children.length}>
          <CarouselPrevious />
          <CarouselNext />
        </div>
      )}
    </Carousel>
  );
}
