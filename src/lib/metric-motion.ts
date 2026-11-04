import { gsap } from "gsap";
import { motionTiming, motionEase } from "./motion-tokens";

const surface = "[data-metric-surface]";
const icons = ".metric-icon,.metric-action-icon";
const content =
  ".highlight-label,.highlight-main,.highlight-footer,.report-card-label,.report-card-value,.report-card-detail,.ratio-visual,.ratio-copy > *";

/** Surface transform and spotlight belong to GSAP; readable children reveal only once. */
export function mountMetricMotion(root: HTMLElement) {
  const seen = new WeakSet<HTMLElement>(),
    media = gsap.matchMedia();
  media.add(
    {
      motion: "(prefers-reduced-motion: no-preference)",
      hover: "(hover: hover) and (pointer: fine)",
    },
    (context) => {
      if (!context.conditions?.motion) return;
      const canHover = Boolean(context.conditions.hover);
      const observed = new Set<HTMLElement>(),
        styled = new Set<HTMLElement>(),
        tweens = new Set<gsap.core.Tween>();
      const lights = new Map<
        HTMLElement,
        {
          node: HTMLElement;
          rect: DOMRect | null;
          x: gsap.QuickToFunc;
          y: gsap.QuickToFunc;
        }
      >();
      let pointer: HTMLElement | null = null,
        pressed: HTMLElement | null = null,
        alive = true;
      const animate = (target: gsap.TweenTarget, vars: gsap.TweenVars) => {
        let tween: gsap.core.Tween;
        const forget = () => tweens.delete(tween);
        tween = gsap.to(target, {
          ...vars,
          onComplete: forget,
          onInterrupt: forget,
        });
        tweens.add(tween);
        return tween;
      };
      const find = (target: EventTarget | null) =>
        target instanceof Element ? target.closest<HTMLElement>(surface) : null;
      const enabled = (el: HTMLElement | null): el is HTMLElement =>
        Boolean(
          el &&
          root.contains(el) &&
          !el.matches(":disabled") &&
          !el.closest('[aria-busy="true"]'),
        );
      const lightFor = (el: HTMLElement) => {
        let light = lights.get(el);
        if (!light) {
          const node = document.createElement("span");
          node.className = "metric-spotlight";
          node.setAttribute("aria-hidden", "true");
          el.append(node);
          light = {
            node,
            rect: null,
            x: gsap.quickTo(node, "x", {
              duration: motionTiming.update,
              ease: motionEase.reveal,
            }),
            y: gsap.quickTo(node, "y", {
              duration: motionTiming.update,
              ease: motionEase.reveal,
            }),
          };
          lights.set(el, light);
        }
        return light;
      };
      const illuminate = (el: HTMLElement, active: boolean) => {
        styled.add(el);
        el.toggleAttribute("data-metric-active", active);
        animate(el, {
          y: active ? -2 : 0,
          duration: motionTiming.hover,
          ease: motionEase.ui,
          overwrite: "auto",
        });
        el.querySelectorAll<HTMLElement>(icons).forEach((icon) => {
          animate(icon, {
            x: active ? 2 : 0,
            y: active ? (icon.dataset.motionDirection === "down" ? 2 : -2) : 0,
            duration: active ? motionTiming.update : motionTiming.release,
            ease: motionEase.ui,
            overwrite: "auto",
          });
        });
        const light = lightFor(el);
        animate(light.node, {
          opacity: active ? 1 : 0,
          duration: motionTiming.hover,
          ease: motionEase.ui,
          overwrite: "auto",
        });
      };
      const point = (el: HTMLElement, e: PointerEvent) => {
        const light = lightFor(el),
          rect = (light.rect ??= el.getBoundingClientRect());
        if (!rect.width || !rect.height) return;
        light.x(gsap.utils.clamp(0, rect.width, e.clientX - rect.left) - 160);
        light.y(gsap.utils.clamp(0, rect.height, e.clientY - rect.top) - 110);
      };
      const over = (e: PointerEvent) => {
        if (!canHover || e.pointerType === "touch") return;
        const el = find(e.target);
        if (
          !enabled(el) ||
          (e.relatedTarget instanceof Node && el.contains(e.relatedTarget))
        )
          return;
        pointer = el;
        lightFor(el).rect = null;
        illuminate(el, true);
        point(el, e);
      };
      const out = (e: PointerEvent) => {
        const el = find(e.target);
        if (
          !el ||
          !root.contains(el) ||
          (e.relatedTarget instanceof Node && el.contains(e.relatedTarget))
        )
          return;
        if (pointer === el) pointer = null;
        illuminate(el, false);
        el.removeAttribute("data-metric-pressed");
      };
      const move = (e: PointerEvent) => {
        if (canHover && e.pointerType !== "touch" && enabled(pointer))
          point(pointer, e);
      };
      const down = (e: PointerEvent) => {
        const el = find(e.target);
        if (e.button !== 0 || !enabled(el) || !el.matches("button")) return;
        pressed = el;
        styled.add(el);
        el.setAttribute("data-metric-pressed", "");
        animate(el.querySelectorAll(icons), {
          x: 0,
          y: 0,
          duration: motionTiming.press,
          ease: motionEase.ui,
          overwrite: "auto",
        });
        animate(el, {
          y: 0,
          duration: motionTiming.press,
          ease: motionEase.ui,
          overwrite: "auto",
        });
      };
      const release = () => {
        if (!pressed) return;
        const el = pressed;
        pressed = null;
        el.removeAttribute("data-metric-pressed");
        if (root.contains(el)) illuminate(el, pointer === el);
      };
      const invalidate = () =>
        lights.forEach((light) => {
          light.rect = null;
        });
      const reveal = (el: HTMLElement, index: number) => {
        if (!alive || seen.has(el) || !root.contains(el)) return;
        seen.add(el);
        styled.add(el);
        const children = [...el.querySelectorAll<HTMLElement>(content)];
        gsap.set(children, { opacity: 0.72, y: 6 });
        animate(children, {
          opacity: 1,
          y: 0,
          duration: motionTiming.reveal,
          delay: Math.min(index * motionTiming.stagger, 0.21),
          stagger: 0.04,
          ease: motionEase.reveal,
          clearProps: "opacity,transform",
        });
        // SVG arcs always retain their exact proportion; never animate the represented data twice.
      };
      const observer =
        typeof IntersectionObserver === "undefined"
          ? null
          : new IntersectionObserver(
              (entries) => {
                entries
                  .filter((e) => e.isIntersecting)
                  .forEach((entry, index) => {
                    const el = entry.target as HTMLElement;
                    observer?.unobserve(el);
                    observed.delete(el);
                    reveal(el, index);
                  });
              },
              { threshold: 0.12, rootMargin: "0px 0px -12px 0px" },
            );
      const scan = (node: HTMLElement) => {
        [
          ...(node.matches(surface) ? [node] : []),
          ...node.querySelectorAll<HTMLElement>(surface),
        ].forEach((el) => {
          if (!seen.has(el) && !observed.has(el)) {
            if (observer) {
              observer.observe(el);
              observed.add(el);
            } else reveal(el, 0);
          }
        });
      };
      const reset = (el: HTMLElement) => {
        const light = lights.get(el);
        light?.x.tween.kill();
        light?.y.tween.kill();
        const targets = [
          el,
          light?.node,
          ...el.querySelectorAll(`${content},${icons}`),
        ];
        tweens.forEach((t) => {
          if (
            t
              .targets()
              .some((target) => targets.some((node) => node === target))
          ) {
            t.kill();
            tweens.delete(t);
          }
        });
        light?.node.remove();
        lights.delete(el);
        gsap.set(el, { clearProps: "transform" });
        gsap.set(el.querySelectorAll(`${content},${icons}`), {
          clearProps: "opacity,transform",
        });
        el.removeAttribute("data-metric-active");
        el.removeAttribute("data-metric-pressed");
        styled.delete(el);
      };
      const changes = new MutationObserver((records) => {
        let removed = false;
        records.forEach((record) => {
          record.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) scan(node);
          });
          if ([...record.removedNodes].some((node) => node instanceof Element))
            removed = true;
        });
        if (!removed) return;
        for (const el of observed)
          if (!root.contains(el)) {
            observer?.unobserve(el);
            observed.delete(el);
          }
        for (const el of styled)
          if (!root.contains(el)) {
            reset(el);
            if (pointer === el) pointer = null;
            if (pressed === el) pressed = null;
          }
      });
      scan(root);
      changes.observe(root, { childList: true, subtree: true });
      root.addEventListener("pointerover", over);
      root.addEventListener("pointerout", out);
      root.addEventListener("pointermove", move, { passive: true });
      root.addEventListener("pointerdown", down);
      window.addEventListener("pointerup", release);
      window.addEventListener("pointercancel", release);
      window.addEventListener("blur", release);
      window.addEventListener("resize", invalidate);
      window.addEventListener("scroll", invalidate, {
        passive: true,
        capture: true,
      });
      return () => {
        alive = false;
        observer?.disconnect();
        changes.disconnect();
        root.removeEventListener("pointerover", over);
        root.removeEventListener("pointerout", out);
        root.removeEventListener("pointermove", move);
        root.removeEventListener("pointerdown", down);
        window.removeEventListener("pointerup", release);
        window.removeEventListener("pointercancel", release);
        window.removeEventListener("blur", release);
        window.removeEventListener("resize", invalidate);
        window.removeEventListener("scroll", invalidate, true);
        tweens.forEach((t) => t.kill());
        tweens.clear();
        styled.forEach(reset);
        observed.clear();
      };
    },
  );
  return () => media.revert();
}
