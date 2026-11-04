import { gsap } from "gsap";
import { motionEase, motionTiming } from "./motion-tokens";

/** Scope transitions never replay counts in tables or move the controls being operated. */
export function mountReportMotion(root: HTMLElement) {
  const media = gsap.matchMedia();
  const seenRows = new WeakSet<HTMLElement>();
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
    const pendingRows = new Set<HTMLElement>();
    const washes = new Set<HTMLElement>();
    const revealRow = (row: HTMLElement) => {
      rowObserver?.unobserve(row);
      pendingRows.delete(row);
      if (seenRows.has(row)) return;
      seenRows.add(row);
      if (keyboard || !alive || !root.contains(row)) return;
      // Paint a separate layer; table geometry and readable values never move.
      const layers = [...row.children].map((cell) => {
        const layer = document.createElement("span");
        layer.className = "row-change-wash";
        layer.setAttribute("aria-hidden", "true");
        cell.append(layer);
        washes.add(layer);
        return layer;
      });
      const remove = () =>
        layers.forEach((layer) => {
          layer.remove();
          washes.delete(layer);
        });
      const tween = gsap.fromTo(
        layers,
        { opacity: 0.24 },
        {
          opacity: 0,
          duration: motionTiming.reveal,
          ease: motionEase.reveal,
          onComplete: () => {
            tweens.delete(tween);
            remove();
          },
          onInterrupt: () => {
            tweens.delete(tween);
            remove();
          },
        },
      );
      tweens.add(tween);
    };
    const rowObserver =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              entries
                .filter((entry) => entry.isIntersecting)
                .forEach((entry) => revealRow(entry.target as HTMLElement));
            },
            { threshold: 0.25 },
          );
    const scanRows = () => {
      for (const row of pendingRows)
        if (!root.contains(row)) {
          rowObserver?.unobserve(row);
          pendingRows.delete(row);
        }
      root
        .querySelectorAll<HTMLElement>(
          '.query-row.danger, .query-row[data-status-change="true"]',
        )
        .forEach((row) => {
          if (seenRows.has(row) || pendingRows.has(row)) return;
          if (rowObserver) {
            pendingRows.add(row);
            rowObserver.observe(row);
          } else revealRow(row);
        });
    };
    scanRows();
    root.addEventListener("keydown", key, true);
    root.addEventListener("pointerdown", pointer, true);
    const changes = new MutationObserver((records) => {
      records.forEach((record) => {
        if (
          record.type === "attributes" &&
          record.target instanceof HTMLElement
        ) {
          if (record.target.matches(".query-row")) scanRows();
          else if (record.attributeName === "data-motion-view" || record.attributeName === "data-motion-key") enter(record.target);
        }
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
        scanRows();
        if (scanScroll) scanScroll();
        else loadScroll();
      }
    });
    changes.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-motion-view", "data-motion-key", "class", "data-status-change"],
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
      rowObserver?.disconnect();
      pendingRows.clear();
      washes.forEach((layer) => layer.remove());
      washes.clear();
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
