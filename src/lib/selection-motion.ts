import { gsap } from "gsap";
import { motionEase, motionTiming } from "./motion-tokens";

/** One moving mark per group; native focus and active colors remain immediate. */
export function mountSelectionMotion(root: HTMLElement) {
  let alive = true,
    keyboard = false;
  const preference = matchMedia("(prefers-reduced-motion: reduce)");
  const marks = new Map<
    HTMLElement,
    { node: HTMLElement; selected: HTMLElement; tween?: gsap.core.Timeline }
  >();
  const key = () => {
      keyboard = true;
    },
    pointer = () => {
      keyboard = false;
    };
  root.addEventListener("keydown", key, true);
  root.addEventListener("pointerdown", pointer, true);
  const clear = () =>
    marks.forEach((item) => {
      item.tween?.kill();
      gsap.set(item.node, {
        clearProps: "transform,opacity,width,height,position,top,left",
      });
    });
  preference.addEventListener("change", clear);
  void import("gsap/Flip")
    .then(({ Flip }) => {
      if (!alive) return;
      gsap.registerPlugin(Flip);
      const scan = () => {
        root
          .querySelectorAll<HTMLElement>(".main-navigation,.category-list")
          .forEach((group) => {
            const selected = group.querySelector<HTMLElement>(
              ':scope > button[aria-selected="true"],:scope > button[aria-pressed="true"]',
            );
            if (!selected) return;
            const old = marks.get(group);
            if (old?.selected === selected) return;
            const node = old?.node ?? document.createElement("span");
            node.className = "selection-marker";
            node.setAttribute("aria-hidden", "true");
            old?.tween?.kill();
            const state =
              old && !preference.matches && !keyboard
                ? Flip.getState(node)
                : null;
            selected.append(node);
            const tween = state
              ? Flip.from(state, {
                  duration: motionTiming.update,
                  ease: motionEase.reveal,
                  scale: true,
                  onComplete: () => gsap.set(node, { clearProps: "transform" }),
                })
              : undefined;
            marks.set(group, { node, selected, tween });
          });
        for (const [group, item] of marks)
          if (!root.contains(group)) {
            item.tween?.kill();
            item.node.remove();
            marks.delete(group);
          }
      };
      scan();
      observer = new MutationObserver(scan);
      observer.observe(root, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["aria-selected", "aria-pressed"],
      });
    })
    .catch(() => {
      /* Active state works without the optional moving indicator. */
    });
  let observer: MutationObserver | undefined;
  return () => {
    alive = false;
    observer?.disconnect();
    clear();
    marks.forEach((item) => item.node.remove());
    marks.clear();
    preference.removeEventListener("change", clear);
    root.removeEventListener("keydown", key, true);
    root.removeEventListener("pointerdown", pointer, true);
  };
}
