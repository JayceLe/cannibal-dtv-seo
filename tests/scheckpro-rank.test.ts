import test from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import {
  detectSCheckPro, isRankDomainMatch, lookupSCheckProRank,
  normalizeRankDomain, parseGoogleOrganic,
} from "../src/lib/scheckpro-rank";

const window = new Window();
Object.assign(globalThis, {
  document: window.document,
  CustomEvent: window.CustomEvent,
  DOMParser: window.DOMParser,
  DOMException: window.DOMException,
});

const html = (query: string, urls: string[], next = false) => `
  <title>${query} - Tìm trên Google</title>
  <div id="rso">
    <h3>Chế độ AI đã trả lời</h3>
    ${urls.map((url) => `<a href="${url}"><h3>Kết quả</h3></a>`).join("")}
  </div>
  ${next ? '<a id="pnnext" href="/search?start=10">Tiếp</a>' : ""}`;

test("Rank domain matching is exact or a real subdomain", () => {
  assert.equal(normalizeRankDomain("https://WWW.Example.com"), "example.com");
  assert.throws(() => normalizeRankDomain("example.com/pin"));
  assert.equal(isRankDomainMatch("https://blog.example.com/pin", "example.com"), true);
  assert.equal(isRankDomainMatch("https://notexample.com/pin", "example.com"), false);
});

test("Google parsing excludes unlinked headings and rejects unrelated pages", () => {
  assert.deepEqual(parseGoogleOrganic(html("thay pin iPhone", ["https://a.vn", "https://example.com/pin"], true), "thay pin iPhone"), {
    urls: ["https://a.vn/", "https://example.com/pin"], hasNext: true,
  });
  assert.throws(() => parseGoogleOrganic(html("khác", ["https://example.com"]), "thay pin iPhone"));
});

test("SCheckPro bridge checks the requested domain without a server key", async () => {
  const onTest = () => document.dispatchEvent(new CustomEvent("TestScheckProSuccess"));
  const onRequest = (event: Event) => {
    const request = (event as CustomEvent).detail;
    assert.equal(request.captcha, false);
    const url = new URL(request.url);
    assert.equal(url.searchParams.get("q"), "thay pin iPhone");
    const page = url.searchParams.get("start") === "0"
      ? html("thay pin iPhone", ["https://a.vn/pin"], true)
      : html("thay pin iPhone", ["https://example.com/pin"]);
    document.dispatchEvent(new CustomEvent("RequestLinkSuccess", { detail: page }));
  };
  document.addEventListener("TestScheckPro", onTest);
  document.addEventListener("RequestLink", onRequest);
  try {
    assert.equal(await detectSCheckPro(), true);
    const found = await lookupSCheckProRank("example.com", "thay pin iPhone", 30);
    assert.equal(found.rank, 11);
    assert.equal(found.ranking_url, "https://example.com/pin");
    assert.equal(found.checked, 2);
  } finally {
    document.removeEventListener("TestScheckPro", onTest);
    document.removeEventListener("RequestLink", onRequest);
    window.happyDOM.abort();
  }
});
