import { gsap } from "gsap";
import { motionEase, motionTiming } from "./motion-tokens";

/** Scope transitions never replay counts in tables or move the controls being operated. */
export function mountReportMotion(root: HTMLElement) {
  const media = gsap.matchMedia();
  media.add("(prefers-reduced-motion: no-preference)", () => {
    let alive = true,
      keyboard = false,
      frame = 0;
    const tweens = new Set<gsap.core.Tween>(),
      targets = new Set<HTMLElement>();
    const key = () => {
        keyboard = true;
      },
      pointer = () => {
        keyboard = false;
      };
    const enter = (
      node: HTMLElement,
      duration: number = motionTiming.update,
    ) => {
      if (keyboard || !root.contains(node)) return;
      gsap.killTweensOf(node);
      targets.add(node);
      const tween = gsap.fromTo(
        node,
        { opacity: 0.72, y: 6 },
        {
          opacity: 1,
          y: 0,
          duration,
          ease: motionEase.reveal,
          clearProps: "opacity,transform",
          onComplete: () => {
            tweens.delete(tween);
            targets.delete(node);
          },
          onInterrupt: () => {
            tweens.delete(tween);
            targets.delete(node);
          },
        },
      );
      tweens.add(tween);
    };
    root.addEventListener("keydown", key, true);
    root.addEventListener("pointerdown", pointer, true);
    const changes = new MutationObserver((records) => {
      records.forEach((record) => {
        if (
          record.type === "attributes" &&
          record.target instanceof HTMLElement
        )
          enter(record.target);
      });
      if (
        records.some(
          (record) =>
            record.type === "childList" &&
            [...record.addedNodes, ...record.removedNodes].some(
              (node) => node instanceof Element,
            ),
        )
      ) {
        if (scanScroll) scanScroll();
        else loadScroll();
      }
    });
    changes.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-motion-view", "data-motion-key"],
    });
    const triggers = new Map<HTMLElement, { kill: () => void }>();
    let scanScroll: (() => void) | undefined;
    let scrollLoading = false;
    const loadScroll = () => {
      if (scrollLoading || !root.querySelector("[data-scroll-reveal]")) return;
      scrollLoading = true;
      void import("gsap/ScrollTrigger")
        .then(({ ScrollTrigger }) => {
          if (!alive) return;
          gsap.registerPlugin(ScrollTrigger);
          scanScroll = () => {
            root
              .querySelectorAll<HTMLElement>("[data-scroll-reveal]")
              .forEach((node) => {
                if (triggers.has(node)) return;
                const trigger = ScrollTrigger.create({
                  trigger: node,
                  start: "top 94%",
                  once: true,
                  onEnter: () => enter(node, motionTiming.reveal),
                });
                triggers.set(node, trigger);
              });
            for (const [node, trigger] of triggers)
              if (!root.contains(node)) {
                trigger.kill();
                triggers.delete(node);
              }
          };
          scanScroll();
        })
        .catch(() => {
          /* Reports remain visible when the optional scroll enhancement fails. */
        });
    };
    loadScroll();
    const sticky = () => {
      frame = 0;
      root
        .querySelectorAll<HTMLElement>(".category-sidebar")
        .forEach((node) => {
          const top = parseFloat(getComputedStyle(node).top);
          node.toggleAttribute(
            "data-stuck",
            Number.isFinite(top) && node.getBoundingClientRect().top <= top + 1,
          );
        });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(sticky);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      alive = false;
      changes.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      root.removeEventListener("keydown", key, true);
      root.removeEventListener("pointerdown", pointer, true);
      const pending = [...targets];
      triggers.forEach((trigger) => trigger.kill());
      tweens.forEach((tween) => tween.kill());
      pending.forEach((node) =>
        gsap.set(node, { clearProps: "opacity,transform" }),
      );
      root
        .querySelectorAll("[data-stuck]")
        .forEach((node) => node.removeAttribute("data-stuck"));
    };
  });
  return () => media.revert();
}
