import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Window } from "happy-dom";
import type { AioConfig, AioResult, AioRun } from "../src/lib/aio";

// CSS has no layout in this interaction test; the component and API client run unchanged.
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "", shortCircuit: true };
    return nextLoad(url, context);
  },
});

test("AIO illustrations cannot ship the screenshot's sample as a fabricated result", () => {
  // Canvas text is not in the DOM. Cover it too so a motion-only edit cannot reintroduce this bug.
  const directory = path.resolve("src/components");
  for (const name of readdirSync(directory).filter(name => /^aio-.*\.tsx$/.test(name))) {
    const source = readFileSync(path.join(directory, name), "utf8");
    assert.doesNotMatch(source,
      /thay\s+pin|dienthoaivui\.com|cellphones\.com|dienmayxanh\.com|Thiếu bảng giá|94\.2%|0,892|0,941|0,845/i,
      `${name} contains sample audit data instead of process labels/current response`);
  }
});

test("AIO opens empty, invalidates old output on edits and starts fresh for every submission", async () => {
  const win = new Window({ url: "https://workspace.test" });
  const media = (query: string) => Object.assign(new win.EventTarget(), {
    media: query, matches: query.includes("prefers-reduced-motion: reduce"), onchange: null,
  });
  Object.defineProperty(win, "matchMedia", { value: media });
  for (const name of ["document", "HTMLElement", "Element", "Node", "SVGElement", "MutationObserver", "Event", "CustomEvent"] as const)
    Object.defineProperty(globalThis, name, { configurable: true, value: win[name] });
  Object.defineProperty(globalThis, "window", { configurable: true, value: win });
  Object.defineProperty(globalThis, "matchMedia", { configurable: true, value: media });
  Object.defineProperty(globalThis, "getComputedStyle", { configurable: true, value: win.getComputedStyle.bind(win) });
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";

  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { db } = await import("../src/lib/supabase");
  const { default: AioWorkspace } = await import("../src/components/aio-workspace");
  const { gsap } = await import("gsap");
  const auth = db().auth;
  mock.method(auth, "getSession", async () => ({ data: { session: { access_token: "test-session" } }, error: null }));

  const calls: Record<string, unknown>[] = [];
  const runs = new Map<string, AioRun>();
  let started = 0;
  mock.method(globalThis, "fetch", async (input: RequestInfo | URL, options?: RequestInit) => {
    assert.equal(input, "/api/aio", "No external services are called by this test");
    assert.equal(options?.cache, "no-store");
    const payload = JSON.parse(String(options?.body)) as Record<string, unknown>;
    calls.push(payload);
    if (payload.action === "start") {
      const run: AioRun = {
        id: String(++started).padStart(32, "0"), config: payload.config as AioConfig,
        stage: "fanout", page_index: 0, progress: 0, logs: [], error: "",
      };
      runs.set(run.id, run);
      return Response.json(run);
    }
    const run = runs.get(String(payload.id));
    assert.ok(run);
    if (payload.action === "step") return Response.json({ ...run, stage: "done", progress: 100 });
    assert.equal(payload.action, "result");
    const door = `Cách dùng ${run.config.keyword}?`;
    const result: AioResult = {
      id: run.id, config: run.config, query_count: 1, read_competitors: 0, competitors: [],
      doors: [{ representative: door, members: [door], member_indices: [0] }],
      rows: [{ door, merged_variants: 1, your_score: null, best_rival_score: null,
        gap: null, spread: null, verdict: "INSUFFICIENT", your_rank: "—",
        best_rival: "", your_best_passage: "" }],
      passages: { [door]: { score: null, passage: `Nội dung lượt ${started}: ${run.config.keyword}`, rivals: [] } },
    };
    return Response.json(result);
  });

  const host = win.document.createElement("div");
  win.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  const input = (selector: string) => host.querySelector(selector)! as unknown as HTMLInputElement;
  const fill = async (selector: string, value: string) => {
    const field = input(selector);
    await React.act(async () => {
      Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")!.set!.call(field, value);
      field.dispatchEvent(new win.Event("input", { bubbles: true }) as unknown as Event);
    });
  };
  const submit = async () => {
    await React.act(async () => {
      host.querySelector("form")!.dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true }));
    });
  };
  const keyword = 'input[placeholder="Nhập từ khóa cần phân tích"]';

  try {
    await React.act(async () => root.render(React.createElement(AioWorkspace)));
    assert.equal(input(keyword).value, "");
    assert.equal(input('input[type="url"]').value, "");
    assert.equal(calls.length, 0, "Mount never loads an old audit");
    assert.doesNotMatch(host.textContent!, /thay pin|dienthoaivui|94\.2%|2\.450|0,892|Thiếu bảng giá/i);
    assert.match(host.querySelector(".aio-neural-telemetry-badge")!.textContent!, /CHƯA CHẠY/);
    assert.doesNotMatch(host.textContent!, /768D|CRAWLER · ACTIVE/);

    await fill(keyword, "thay pin iPhone");
    await fill('input[type="url"]', "https://workspace.example/article");
    await fill('input[name="gemini_api_key"]', "test-gemini");
    await fill('input[name="serp_api_key"]', "test-serp");
    await submit();
    assert.match(host.querySelector(".aio-output")?.textContent || "", /Nội dung lượt 1: thay pin iPhone/,
      host.querySelector(".error-message")?.textContent || JSON.stringify(calls));
    assert.match(host.querySelector(".aio-neural-telemetry-badge")!.textContent!, /HOÀN TẤT/);
    await submit();
    assert.match(host.querySelector(".aio-output")?.textContent || "", /Nội dung lượt 2: thay pin iPhone/);

    await fill(keyword, "phần mềm quản lý nhân sự");
    assert.equal(host.querySelector(".aio-output"), null, "Editing removes old passages and rank inputs");
    assert.doesNotMatch(host.textContent!, /thay pin/i);
    assert.equal(host.querySelector("#aio-progress-title")?.textContent, "Sẵn sàng bắt đầu");
    assert.match(host.querySelector(".aio-neural-telemetry-badge")!.textContent!, /CHƯA CHẠY/);
    await submit();
    assert.match(host.querySelector(".aio-output")?.textContent || "", /phần mềm quản lý nhân sự/);
    assert.doesNotMatch(host.textContent!, /thay pin/i);
    const starts = calls.filter(call => call.action === "start");
    assert.equal(starts.length, 3);
    assert.equal(new Set(runs.keys()).size, 3);
    assert.ok(starts.every(call => !Object.hasOwn(call, "id")), "New submissions cannot resume previous IDs");
    await fill('input[type="url"]', "https://another.example/article");
    assert.equal(host.querySelector(".aio-output"), null, "Changing the target also invalidates scores and ranks");

    await React.act(async () => root.render(null));
    await React.act(async () => root.render(React.createElement(AioWorkspace)));
    assert.equal(input(keyword).value, "");
    assert.equal(input('input[name="gemini_api_key"]').value, "");
    assert.equal(host.querySelector(".aio-output"), null);
    assert.equal(calls.filter(call => call.action === "start").length, 3);
  } finally {
    await React.act(async () => root.unmount());
    mock.restoreAll();
    await auth.stopAutoRefresh();
    // Supabase's cross-tab auth channel otherwise keeps the Node test process alive.
    (auth as unknown as { broadcastChannel?: BroadcastChannel }).broadcastChannel?.close();
    gsap.ticker.sleep();
    await win.happyDOM.abort();
  }
});
