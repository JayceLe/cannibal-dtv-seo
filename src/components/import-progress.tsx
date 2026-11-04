"use client";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { motionTiming, motionEase } from "@/lib/motion-tokens";

export default function ImportProgress({
  value,
  phase,
  done,
}: {
  value: number;
  phase: string;
  done: boolean;
}) {
  const bar = useRef<HTMLElement>(null),
    tick = useRef<SVGPathElement>(null);
  const initialScale = useRef(Math.max(0, Math.min(1, value / 100)));
  useEffect(() => {
    const node = bar.current;
    if (!node) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    let tween: gsap.core.Tween | undefined;
    const finish = () => {
      tween?.kill();
      gsap.set(node, { scaleX: Math.max(0, Math.min(1, value / 100)) });
    };
    if (preference.matches) finish();
    else
      tween = gsap.to(node, {
        scaleX: Math.max(0, Math.min(1, value / 100)),
        duration: motionTiming.update,
        ease: motionEase.ui,
        overwrite: true,
      });
    const reduce = () => {
      if (preference.matches) finish();
    };
    preference.addEventListener("change", reduce);
    return () => {
      tween?.kill();
      preference.removeEventListener("change", reduce);
    };
  }, [value, phase]);
  useEffect(() => {
    const node = tick.current;
    if (!node || !done) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      // A single completion icon, not a chart/data mark.
      const tween = gsap.fromTo(
        node,
        { strokeDashoffset: 1 },
        {
          strokeDashoffset: 0,
          duration: motionTiming.reveal,
          ease: motionEase.reveal,
          clearProps: "strokeDashoffset",
        },
      );
      return () => {
        tween.kill();
        node.style.removeProperty("stroke-dashoffset");
      };
    });
    return () => media.revert();
  }, [done]);
  if (done)
    return (
      <div className="import-complete" role="status">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            ref={tick}
            d="m5 12 4 4 10-10"
            pathLength="1"
            strokeDasharray="1 1"
          />
        </svg>
        <strong>Đã lưu thành công</strong>
      </div>
    );
  if (!phase) return null;
  return (
    <div className="progress-block" role="status">
      <p data-motion-key={phase}>
        {phase}
        <span>{value}%</span>
      </p>
      <div
        className="import-progress-track"
        role="progressbar"
        aria-label={phase}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <i ref={bar} style={{ transform: `scaleX(${initialScale.current})` }} />
      </div>
    </div>
  );
}
