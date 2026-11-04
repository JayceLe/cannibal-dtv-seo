"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { motionEase, motionTiming } from "@/lib/motion-tokens";

export default function EntryMotion({
  error,
  children,
}: {
  error: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        gsap.fromTo(
          ref.current,
          { opacity: 0.72, y: 10 },
          {
            opacity: 1,
            y: 0,
            duration: motionTiming.reveal,
            ease: motionEase.reveal,
            clearProps: "opacity,transform",
          },
        );
      }, ref);
      return () => context.revert();
    });
    return () => media.revert();
  }, []);
  useEffect(() => {
    if (!error) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        gsap
          .timeline({
            defaults: { ease: motionEase.ui },
            onComplete: () =>
              gsap.set(ref.current, { clearProps: "transform" }),
          })
          .to(ref.current, { x: -5, duration: 0.06 })
          .to(ref.current, { x: 5, duration: 0.08 })
          .to(ref.current, { x: -3, duration: 0.08 })
          .to(ref.current, { x: 0, duration: 0.1 });
      }, ref);
      return () => context.revert();
    });
    return () => media.revert();
  }, [error]);
  return (
    <section ref={ref} className="panel workspace-entry-card">
      {children}
    </section>
  );
}
