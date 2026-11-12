import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import type { RankKeyword } from "../src/lib/rank-hub";

test("Excel export writes readable rank columns and Unicode keywords", async () => {
  let receive: (value: { bytes?: Uint8Array; error?: string }) => void = () => {};
  const result = new Promise<{ bytes?: Uint8Array; error?: string }>(resolve => { receive = resolve; });
  const worker = { postMessage: (value: { bytes?: Uint8Array; error?: string }) => receive(value), onmessage: null as null | ((event: MessageEvent<RankKeyword[]>) => Promise<void>) };
  Object.defineProperty(globalThis, "self", { configurable: true, value: worker });
  await import("../src/workers/rank-export.worker");
  const row: RankKeyword = { id: "p:k", projectId: "p", keyword: "điện thoại cũ", rank: 12, previousRank: 20, bestRank: 5, url: "https://example.com/slug", updatedAt: "2026-11-12T03:00:00Z", history: [] };
  await worker.onmessage!({ data: [row] } as MessageEvent<RankKeyword[]>);
  const output = await result;
  assert.equal(output.error, undefined);
  assert.ok(output.bytes?.length);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(output.bytes!) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.getWorksheet("Check Rank")!;
  assert.equal(sheet.getCell("A2").value, "điện thoại cũ");
  assert.equal(sheet.getCell("B2").value, 12);
  assert.equal(sheet.getCell("C2").value, 20);
  assert.equal(sheet.getCell("D2").value, 5);
  assert.equal(sheet.getCell("F2").value, "https://example.com/slug");
});
