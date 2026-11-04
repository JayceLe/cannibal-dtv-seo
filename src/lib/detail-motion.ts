import { gsap } from "gsap";
import { motionTiming, motionEase } from "./motion-tokens";

/** Animate only new URL rows and visual bars; the numeric labels are always final. */
export function mountDetailMotion(root: HTMLElement) {
  const media = gsap.matchMedia();
  media.add("(prefers-reduced-motion: no-preference)", () => {
    const seen = new WeakSet<Element>(),
      targets = new Set<HTMLElement>();
    const tweens = new Set<gsap.core.Tween>();
    const scan = () => {
      const rows = [
        ...root.querySelectorAll<HTMLElement>(
          ".url-metric-row,.period-url-row",
        ),
      ].filter((row) => !seen.has(row));
      rows.forEach((row, index) => {
        seen.add(row);
        targets.add(row);
        const bars = [
          ...row.querySelectorAll<HTMLElement>(".url-share-track i"),
        ];
        bars.forEach((bar) => targets.add(bar));
        const tween = gsap.fromTo(
          row,
          { opacity: 0.72, y: 4 },
          {
            opacity: 1,
            y: 0,
            duration: motionTiming.open,
            delay: Math.min(index * 0.035, 0.21),
            ease: motionEase.reveal,
            clearProps: "opacity,transform",
          },
        );
        tweens.add(tween);
        if (bars.length)
          tweens.add(
            gsap.fromTo(
              bars,
              { scaleX: 0 },
              {
                scaleX: 1,
                duration: motionTiming.reveal,
                delay: Math.min(index * 0.035, 0.21),
                ease: motionEase.reveal,
                clearProps: "transform",
              },
            ),
          );
      });
    };
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      tweens.forEach((t) => t.kill());
      targets.forEach((node) =>
        gsap.set(node, { clearProps: "opacity,transform" }),
      );
    };
  });
  return () => media.revert();
}
