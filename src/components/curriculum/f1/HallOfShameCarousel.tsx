"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";

export interface HallOfShameItem {
  image: string;
  title: string;
  story: string;
  impact: string;
}

interface HallOfShameCarouselProps {
  items: HallOfShameItem[];
}

const HallOfShameCarousel = ({ items }: HallOfShameCarouselProps) => {
  const [viewportRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" });
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 p-4 text-white shadow-xl backdrop-blur">
      <div className="flex items-center justify-between px-2 pb-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-rose-300">
            <AlertTriangle className="h-4 w-4" />
            Cautionary Tales from the Trenches
          </p>
          <h3 className="text-2xl font-bold text-white">The Hall of Shame</h3>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={scrollPrev}
            aria-label="Previous incident"
            className="rounded-full border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={scrollNext}
            aria-label="Next incident"
            className="rounded-full border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="overflow-hidden" ref={viewportRef}>
        <div className="flex">
          {items.map((item, index) => (
            <article
              key={item.title}
              className="min-w-0 shrink-0 grow-0 basis-full px-2"
              aria-roledescription="slide"
              aria-label={`${item.title} (${index + 1} of ${items.length})`}
            >
              <div className="grid gap-6 rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-inner lg:grid-cols-[1.4fr,1fr]">
                <div className="space-y-4">
                  <div className="relative h-56 w-full overflow-hidden rounded-2xl border border-white/10">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="(min-width: 1024px) 60vw, 90vw"
                      className="object-cover"
                      priority={index === 0}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 text-sm">
                      <p className="font-semibold uppercase tracking-[0.3em] text-rose-300">{item.title}</p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-200">{item.story}</p>
                </div>
                <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-5 text-sm text-slate-200">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Impact</p>
                    <p className="text-lg font-semibold text-white">{item.impact}</p>
                  </div>
                  <p className="text-xs text-slate-400">
                    Every bug that escapes adds unplanned cost, erodes trust, and teaches the industry a hard
                    lesson. Verification keeps these stories out of your portfolio.
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        {items.map((_, index) => (
          <button
            key={`dot-${index}`}
            type="button"
            className={`h-2 w-8 rounded-full transition ${
              index === selectedIndex ? "bg-rose-400" : "bg-white/20"
            }`}
            onClick={() => emblaApi?.scrollTo(index)}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default HallOfShameCarousel;
