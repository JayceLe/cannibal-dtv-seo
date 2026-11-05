import test from "node:test";
import assert from "node:assert/strict";
import { completeAioRun } from "../src/lib/aio-runner";
import { aioDefaults, type AioRun } from "../src/lib/aio";

const initial: AioRun = {
  id: "a".repeat(32), stage: "pages", config: aioDefaults,
  page_index: 0, progress: 15, logs: [], error: "",
};
test("One run continues through repeated quota checkpoints using the same job", async () => {
  const responses: AioRun[] = [
    { ...initial, retry_after: 2 },
    { ...initial, retry_after: 1 },
    { ...initial, page_index: 1, progress: 85, stage: "score" },
    { ...initial, progress: 100, stage: "done" },
  ];
  const ids: string[] = [], updates: AioRun[] = [];
  let waited = 0;
  const final = await completeAioRun(initial, {
    step: async id => { ids.push(id); return responses.shift()!; },
    onUpdate: run => updates.push(run),
    shouldStop: () => false,
    wait: async ms => { waited += ms; },
  });
  assert.equal(final.stage, "done");
  assert.deepEqual(ids, Array(4).fill(initial.id));
  assert.equal(updates.length, 4);
  assert.equal(waited, 3000);
});
test("Pause interrupts quota waiting before another API request", async () => {
  let stopped = false, calls = 0;
  const final = await completeAioRun(initial, {
    step: async () => { calls++; return { ...initial, retry_after: 60 }; },
    onUpdate: () => {},
    shouldStop: () => stopped,
    wait: async () => { stopped = true; },
  });
  assert.equal(calls, 1);
  assert.equal(final.id, initial.id);
  assert.equal(final.stage, "pages");
});
test("Permanent errors surface once without retrying a paid call", async () => {
  let calls = 0;
  await assert.rejects(completeAioRun(initial, {
    step: async () => { calls++; throw new Error("Invalid API key"); },
    onUpdate: () => {}, shouldStop: () => false, wait: async () => {},
  }), /Invalid API key/);
  assert.equal(calls, 1);
});
