import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import "fake-indexeddb/auto";
import { Window } from "happy-dom";

registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "", shortCircuit: true };
  return nextLoad(url, context);
} });

test("Check Rank creates a project, adds keywords and restores them after remount", async () => {
  const win = new Window({ url: "https://rank.test" });
  for (const name of ["document", "HTMLElement", "Element", "Node", "SVGElement", "MutationObserver", "Event", "CustomEvent", "DOMParser"] as const)
    Object.defineProperty(globalThis, name, { configurable: true, value: win[name] });
  Object.defineProperty(globalThis, "window", { configurable: true, value: win });
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  win.document.addEventListener("TestScheckPro", () => win.document.dispatchEvent(new win.CustomEvent("TestScheckProSuccess")));
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { default: CheckRankWorkspace } = await import("../src/components/check-rank-workspace");
  const host = win.document.createElement("div");
  win.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  const wait = () => new Promise(resolve => setTimeout(resolve, 80));
  const fill = async (selector: string, value: string) => React.act(async () => {
    const field = host.querySelector(selector)! as unknown as HTMLInputElement | HTMLTextAreaElement;
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), "value")!.set!.call(field, value);
    field.dispatchEvent(new win.Event("input", { bubbles: true }) as unknown as Event);
  });
  try {
    await React.act(async () => root.render(React.createElement(CheckRankWorkspace, { owner: "test-owner" })));
    await React.act(async () => wait());
    await fill('.cr-project-controls input[placeholder="Ví dụ: Blog"]', "Blog thử nghiệm");
    await fill('.cr-project-controls input[placeholder="example.com"]', "example.com");
    assert.equal((host.querySelector('.cr-project-controls input[placeholder="Ví dụ: Blog"]') as unknown as HTMLInputElement).value, "Blog thử nghiệm");
    assert.equal((host.querySelector('.cr-project-controls input[placeholder="example.com"]') as unknown as HTMLInputElement).value, "example.com");
    assert.equal((host.querySelector(".cr-project .btn.primary") as unknown as HTMLButtonElement).disabled, false, host.textContent || "");
    await React.act(async () => { (host.querySelector(".cr-project .btn.primary") as unknown as HTMLButtonElement).click(); await wait(); });
    assert.match(host.textContent!, /Từ khóa tracking/, host.querySelector("[role=alert]")?.textContent || "");
    await fill(".cr-import textarea", "hoa lan\nphần mềm nhân sự\nhoa lan");
    await React.act(async () => { (host.querySelector(".cr-import .btn.primary") as unknown as HTMLButtonElement).click(); await wait(); });
    assert.equal(host.querySelectorAll(".cr-table-scroll tbody tr").length, 2);
    assert.match(host.textContent!, /tổng 2\/30\.000/);
    await React.act(async () => root.render(null));
    await React.act(async () => root.render(React.createElement(CheckRankWorkspace, { owner: "test-owner" })));
    await React.act(async () => wait());
    assert.equal(host.querySelectorAll(".cr-project select option").length >= 2, true);
    await React.act(async () => {
      const select = host.querySelector(".cr-project select") as unknown as HTMLSelectElement;
      select.value = (select.querySelectorAll("option")[1] as unknown as HTMLOptionElement).value;
      select.dispatchEvent(new win.Event("change", { bubbles: true }) as unknown as Event);
      await wait();
    });
    assert.equal(host.querySelectorAll(".cr-table-scroll tbody tr").length, 2);
  } finally {
    await React.act(async () => root.unmount());
    await win.happyDOM.abort();
  }
});
