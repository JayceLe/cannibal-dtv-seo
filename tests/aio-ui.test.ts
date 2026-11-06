import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  aioDefaults,
  aioScore,
  aioTone,
  aioVerdict,
  readApiKey,
  type AioResult,
} from "../src/lib/aio";
import AioResults, { AioUrl } from "../src/components/aio-results";
import AioRankTracker from "../src/components/aio-rank-tracker";

const result: AioResult = {
  id: "a".repeat(32),
  config: {
    ...aioDefaults,
    keyword: "thay pin",
    my_url: "https://example.com/pin",
  },
  rows: [
    {
      door: "Giá thay pin?",
      merged_variants: 2,
      your_score: 0.3156,
      best_rival_score: 0.6123,
      gap: 0.2967,
      your_rank: "2/3",
      spread: 0.4,
      verdict: "BEHIND - clear gap, rewrite this block",
      evidence_label: "Dữ kiện hoặc điều kiện khác nhau",
      reason: "Hai đoạn có điều kiện khác nhau; kiểm tra trước khi sửa.",
      best_rival: "https://competitor.example/pin",
      your_best_passage: "Đoạn nội dung ngắn…",
    },
  ],
  doors: [
    {
      representative: "Giá thay pin?",
      members: ["Giá thay pin?", "Thay pin bao nhiêu?"],
      member_indices: [0, 1],
    },
  ],
  competitors: ["https://competitor.example/pin"],
  passages: {
    "Giá thay pin?": {
      score: 0.3156,
      passage: "Nội dung của bạn <script>alert(1)</script>",
      rivals: [
        {
          url: "https://competitor.example/pin",
          score: 0.6123,
          gap: 0.2967,
          passage: "Nội dung đối thủ",
        },
      ],
    },
  },
  query_count: 2,
  read_competitors: 2,
};

test("AIO key imports accept notebook credentials without storing or inventing values", () => {
  assert.equal(readApiKey("  example-key\n"), "example-key");
  assert.equal(readApiKey('{"api_key":"example-key"}'), "example-key");
  assert.equal(readApiKey('{"key":"example-key"}'), "example-key");
  for (const invalid of ["", "{}", '{"api_key":2}', "{broken"])
    assert.throws(() => readApiKey(invalid));
  assert.equal(aioScore(0.123456), "0,1235");
  assert.equal(aioScore(null), "—");
  assert.equal(aioTone("BEHIND - close"), "danger");
  assert.equal(aioVerdict("AHEAD - clear leader"), "Dẫn đầu");
  assert.equal(aioVerdict("BEHIND - close, small rewrite wins"), "Gap điểm nhỏ");
  assert.equal(aioVerdict("BEHIND - clear gap, rewrite this block"), "Gap điểm rõ");
  assert.equal(aioVerdict("PARITY - field indistinguishable, ignore"), "Điểm tương đương");
  assert.equal(aioVerdict("PARITY - too close to call"), "Chênh lệch nhỏ");
  assert.equal(aioVerdict("INSUFFICIENT - no comparable passage"), "Thiếu đoạn khớp");
});

test("AIO results retain every audit field, door variants and side-by-side passages", () => {
  const html = renderToStaticMarkup(
    React.createElement(AioResults, { result }),
  );
  for (const label of [
    "Điểm của bạn",
    "Đối thủ tốt nhất",
    "Gap",
    "Spread",
    "Xếp trong nhóm",
    "Các URL đối chiếu",
    "Chọn door",
    "Số đối thủ",
    "Trang của bạn",
    "Đối thủ 1",
    "2 query được gom",
    "Giá thay pin?",
    "0,3156",
    "0,2967",
    "2/3",
    "BEHIND - clear gap",
    "Dữ kiện hoặc điều kiện khác nhau",
  ])
    assert.ok(html.includes(label), label);
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.match(html, /tabindex="0"/);
  assert.match(html, /scope="row"/);
});

test("Rank Tracker keeps editable complete doors and all XLSX controls", () => {
  const html = renderToStaticMarkup(
    React.createElement(AioRankTracker, { result }),
  );
  for (const label of [
    "Domain cần tracking",
    "Tra rank tự động",
    "Top 100 · đầy đủ",
    "Tải mẫu XLSX",
    "Import rank XLSX",
    "Xuất bảng đang nhập",
    "Rank Google",
    "URL đang xếp hạng",
    "Phân tích rank &amp; URL",
    "Giá thay pin?",
  ])
    assert.ok(html.includes(label), label);
  assert.match(html, /aria-label="Rank Google: Giá thay pin\?"/);
  assert.match(html, /aria-label="URL xếp hạng: Giá thay pin\?"/);
});

test("Provider content cannot produce executable links", () => {
  assert.doesNotMatch(
    renderToStaticMarkup(
      React.createElement(AioUrl, { url: "javascript:alert(1)" }),
    ),
    /<a/,
  );
  assert.match(
    renderToStaticMarkup(
      React.createElement(AioUrl, { url: "https://example.com/pin" }),
    ),
    /rel="noopener noreferrer"/,
  );
});
