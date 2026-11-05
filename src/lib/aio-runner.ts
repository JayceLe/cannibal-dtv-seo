import type { AioRun } from "./aio";

export async function completeAioRun(
  initial: AioRun,
  controls: {
    step: (id: string) => Promise<AioRun>;
    onUpdate: (run: AioRun) => void;
    shouldStop: () => boolean;
    wait: (milliseconds: number) => Promise<void>;
  },
): Promise<AioRun> {
  let current = initial;
  while (current.stage !== "done" && !controls.shouldStop()) {
    current = await controls.step(current.id);
    if (controls.shouldStop()) break;
    controls.onUpdate(current);
    let remaining = Math.min(60, Math.max(0, current.retry_after || 0)) * 1000;
    while (remaining > 0 && !controls.shouldStop()) {
      const interval = Math.min(500, remaining);
      await controls.wait(interval);
      remaining -= interval;
    }
  }
  return current;
}
