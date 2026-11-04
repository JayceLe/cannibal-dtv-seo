"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { motionEase, motionTiming } from "@/lib/motion-tokens";

/** Retain a pointer-opened popup for its exit; keyboard paths are immediate. */
export function usePopupMotion(open: boolean) {
  const [present, setPresent] = useState(open);
  const ref = useRef<HTMLDivElement>(null),
    pointer = useRef(false),
    entered = useRef(false);
  useLayoutEffect(
    () => () => {
      const node = ref.current;
      if (node) {
        gsap.killTweensOf(node);
        node.style.removeProperty("opacity");
        node.style.removeProperty("transform");
      }
    },
    [],
  );
  useLayoutEffect(() => {
    if (open) setPresent(true);
  }, [open]);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const settle = () => {
      node.style.removeProperty("opacity");
      node.style.removeProperty("transform");
      if (!open) {
        entered.current = false;
        setPresent(false);
      }
    };
    const context = gsap.context(() => {
      if (preference.matches || !pointer.current) {
        settle();
        return;
      }
      if (open && !entered.current)
        gsap.set(node, { opacity: 0.72, scale: 0.98, y: 5 });
      entered.current = true;
      gsap.to(node, {
        opacity: open ? 1 : 0,
        scale: open ? 1 : 0.98,
        y: open ? 0 : 3,
        duration: open ? motionTiming.menu : motionTiming.press,
        ease: motionEase.ui,
        overwrite: true,
        onComplete: settle,
      });
    }, node);
    const reduce = () => {
      if (preference.matches) {
        context.kill(false);
        settle();
      }
    };
    preference.addEventListener("change", reduce);
    return () => {
      preference.removeEventListener("change", reduce);
      context.kill(false);
    };
  }, [open, present]);
  return { present, ref, pointer };
}
