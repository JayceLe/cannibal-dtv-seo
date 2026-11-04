/** Seconds. Data/series belong to ECharts; these tokens govern interface motion only. */
export const motionTiming = {
  press: 0.12,
  hover: 0.18,
  menu: 0.18,
  release: 0.18,
  close: 0.18,
  update: 0.24,
  open: 0.28,
  reveal: 0.48,
  stagger: 0.07,
} as const;
export const motionEase = { ui: "power2.out", reveal: "power3.out" } as const;
