"use client";
import { Fragment, useEffect, useRef } from "react";
import { gsap } from "gsap";
import { motionTiming } from "@/lib/motion-tokens";

export default function AnimatedNumber({
  value,
  digits = 0,
  suffix = "",
  instant = false,
  wrap = false,
}: {
  value: number | null;
  digits?: number;
  suffix?: string;
  instant?: boolean;
  wrap?: boolean;
}) {
  const formatter = new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: digits,
  });
  const label =
    value == null || !Number.isFinite(value)
      ? "—"
      : formatter.format(value) + suffix;
  const node = useRef<HTMLSpanElement>(null),
    current = useRef<number | null>(null),
    shown = useRef(false);
  useEffect(() => {
    const el = node.current!;
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    let tween: gsap.core.Tween | undefined,
      observer: IntersectionObserver | undefined,
      alive = true;
    const display = (text: string) => {
      if (!wrap) {
        el.textContent = text;
        return;
      }
      const fragment = document.createDocumentFragment();
      text.split(/(?=\.\d)/).forEach((part, index) => {
        if (index) fragment.append(document.createElement("wbr"));
        fragment.append(part);
      });
      el.replaceChildren(fragment);
    };
    const finish = () => {
      tween?.kill();
      display(label);
      current.current = value;
    };
    const play = () => {
      if (!alive) return;
      observer?.disconnect();
      const first = !shown.current;
      shown.current = true;
      if (value == null || !Number.isFinite(value) || instant || mq.matches) {
        finish();
        return;
      }
      const from = first ? 0 : (current.current ?? 0);
      const state = { value: from };
      tween = gsap.to(state, {
        value,
        duration: first ? motionTiming.reveal : motionTiming.update,
        ease: "power2.out",
        onUpdate: () => {
          current.current = state.value;
          display(
            formatter.format(
              digits === 0 ? Math.round(state.value) : state.value,
            ) + suffix,
          );
        },
        onComplete: finish,
      });
    };
    const preference = () => {
      if (mq.matches) {
        observer?.disconnect();
        finish();
      }
    };
    mq.addEventListener("change", preference);
    if (
      shown.current ||
      mq.matches ||
      instant ||
      typeof IntersectionObserver === "undefined"
    )
      play();
    else {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) play();
        },
        { threshold: 0.1 },
      );
      observer.observe(el);
    }
    return () => {
      alive = false;
      tween?.kill();
      observer?.disconnect();
      mq.removeEventListener("change", preference);
    };
    // The formatter is derived only from digits; do not restart for parent-only rerenders.
  }, [value, digits, suffix, instant, label, wrap]);
  const content = wrap
    ? label.split(/(?=\.\d)/).map((part, index) => (
        <Fragment key={index}>
          {index ? <wbr /> : null}
          {part}
        </Fragment>
      ))
    : label;
  return (
    <span
      className="animated-number"
      data-animated-number
      data-wrap={wrap || undefined}
      aria-label={label}
    >
      <span className="number-reserve" aria-hidden="true">
        {content}
      </span>
      <span className="number-display" aria-hidden="true" ref={node}>
        {content}
      </span>
    </span>
  );
}
