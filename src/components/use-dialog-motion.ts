"use client";
import { useCallback, useEffect, useRef } from "react";
import { gsap } from "gsap";
import { mountDetailMotion } from "@/lib/detail-motion";
import { motionEase, motionTiming } from "@/lib/motion-tokens";

/** Native dialog keeps focus trapped. Exit retains the top layer and lock until it finishes. */
export function useDialogMotion(onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const callback = useRef(onClose),
    dismiss = useRef<() => void>(() => {});
  callback.current = onClose;
  useEffect(() => {
    const dialog = ref.current!,
      previous = document.activeElement;
    const overflow = document.documentElement.style.overflow;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    let closing = false,
      disposed = false,
      finished = false;
    document.documentElement.style.overflow = "hidden";
    dialog.showModal();
    const stopDetails = mountDetailMotion(dialog);
    const finish = () => {
      if (!disposed && !finished) {
        finished = true;
        callback.current();
      }
    };
    const context = gsap.context(() => {}, dialog);
    let animation: gsap.core.Tween | undefined;
    context.add(() => {
      if (!preference.matches)
        animation = gsap.fromTo(
          dialog,
          { opacity: 0.75, scale: 0.98, y: 8 },
          {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: motionTiming.open,
            ease: motionEase.reveal,
          },
        );
    });
    dismiss.current = () => {
      if (closing || disposed) return;
      closing = true;
      dialog.setAttribute("data-closing", "");
      animation?.kill();
      if (preference.matches) {
        finish();
        return;
      }
      context.add(() => {
        animation = gsap.to(dialog, {
          opacity: 0,
          scale: 0.98,
          y: 6,
          duration: motionTiming.close,
          ease: motionEase.ui,
          overwrite: true,
          onComplete: finish,
        });
      });
    };
    const reduce = () => {
      if (!preference.matches) return;
      animation?.kill();
      dialog.style.removeProperty("opacity");
      dialog.style.removeProperty("transform");
      if (closing) finish();
    };
    preference.addEventListener("change", reduce);
    return () => {
      disposed = true;
      dismiss.current = () => {};
      preference.removeEventListener("change", reduce);
      context.revert();
      stopDetails();
      dialog.removeAttribute("data-closing");
      dialog.close();
      document.documentElement.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, []);
  return { ref, close: useCallback(() => dismiss.current(), []) };
}
