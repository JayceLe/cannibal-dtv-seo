import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { MAX_RANK_KEYWORDS, applyRankResult, extractKeywordColumn, listRankKeywords, listRankProjects, openRankDb, parseKeywords, rankMovement, removeRankKeywords, removeRankProject, saveRankKeywords, saveRankProject, type RankKeyword, type RankProject } from "../src/lib/rank-hub";

test("imports 35,000 distinct keywords, merges duplicates and rejects the 35,001st", () => {
  assert.equal(MAX_RANK_KEYWORDS, 35_000);
  const input = Array.from({ length: MAX_RANK_KEYWORDS }, (_, index) => `Từ khóa ${index + 1}`);
  assert.equal(parseKeywords(input).length, MAX_RANK_KEYWORDS);
  assert.equal(parseKeywords(["  Từ   Khóa 1 ", "từ khóa 1", "TỪ KHÓA 2"]).length, 2);
  assert.throws(() => parseKeywords([...input, "Từ khóa 35001"]), /35\.000/);
});

test("extracts keyword column from spreadsheet headers and numbered Spin rows", () => {
  assert.deepEqual(extractKeywordColumn([["STT", "Từ khóa", "Vị trí"], [1, "bảo trì máy", 3], [2, "tư vấn xe", null]]), ["bảo trì máy", "tư vấn xe"]);
  assert.deepEqual(extractKeywordColumn([[1, "thay kính"], [2, "thay pin"]]), ["thay kính", "thay pin"]);
  assert.deepEqual(extractKeywordColumn([["hoa lan"], ["du lịch Đà Lạt"]]), ["hoa lan", "du lịch Đà Lạt"]);
});

test("rank history keeps previous and best positions across updates and misses", () => {
  const empty: RankKeyword = { id: "p:k", projectId: "p", keyword: "k", rank: null, previousRank: null, bestRank: null, url: "", updatedAt: "", history: [] };
  const first = applyRankResult(empty, 24, "https://example.com/a", "2026-11-10T00:00:00Z");
  const better = applyRankResult(first, 11, "https://example.com/b", "2026-11-11T00:00:00Z");
  const missing = applyRankResult(better, null, "", "2026-11-12T00:00:00Z");
  assert.equal(rankMovement(better), 13);
  assert.equal(better.bestRank, 11);
  assert.equal(missing.previousRank, 11);
  assert.equal(missing.rank, null);
  assert.equal(missing.bestRank, 11);
  assert.equal(missing.history.length, 3);
  assert.equal(first.url, "https://example.com/a");
});

test("persists 35,000 keywords by project without mixing account data", async () => {
  const db = await openRankDb();
  const makeProject = (id: string, owner: string): RankProject => ({ id, owner, name: id, domain: "example.com", depth: 100, count: 0, cursor: 0, createdAt: "2026-11-12", updatedAt: "2026-11-12" });
  const mine = makeProject("mine", "account-a"), other = makeProject("other", "account-b");
  await saveRankProject(db, mine);
  await saveRankProject(db, other);
  const rows: RankKeyword[] = Array.from({ length: MAX_RANK_KEYWORDS }, (_, index) => ({ id: `mine:${index}`, projectId: mine.id, keyword: `key ${index}`, rank: null, previousRank: null, bestRank: null, url: "", updatedAt: "", history: [] }));
  await saveRankKeywords(db, rows);
  assert.equal((await listRankKeywords(db, mine.id)).length, MAX_RANK_KEYWORDS);
  assert.deepEqual((await listRankProjects(db, "account-a")).map(project => project.id), [mine.id]);
  assert.deepEqual((await listRankProjects(db, "account-b")).map(project => project.id), [other.id]);
  await removeRankKeywords(db, [rows[0].id]);
  assert.equal((await listRankKeywords(db, mine.id)).length, MAX_RANK_KEYWORDS - 1);
  await removeRankProject(db, mine.id);
  assert.equal((await listRankKeywords(db, mine.id)).length, 0);
  assert.equal((await listRankProjects(db, "account-b")).length, 1);
  db.close();
});
