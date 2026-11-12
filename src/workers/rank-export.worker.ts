import ExcelJS from "exceljs";
import type { RankKeyword } from "../lib/rank-hub";

self.onmessage = async (event: MessageEvent<RankKeyword[]>) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Check Rank", { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.columns = [
      { header: "Từ khóa", key: "keyword", width: 52 },
      { header: "Vị trí", key: "rank", width: 14 },
      { header: "Vị trí cũ", key: "previousRank", width: 15 },
      { header: "Vị trí tốt nhất", key: "bestRank", width: 18 },
      { header: "Cập nhật", key: "updatedAt", width: 24 },
      { header: "Liên kết", key: "url", width: 70 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.autoFilter = { from: "A1", to: "F1" };
    for (const row of event.data) {
      sheet.addRow({
        keyword: row.keyword,
        rank: row.rank ?? "n/a",
        previousRank: row.previousRank ?? "",
        bestRank: row.bestRank ?? "",
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toLocaleString("vi-VN") : "",
        url: row.url,
      });
    }
    const buffer = await workbook.xlsx.writeBuffer();
    const bytes = new Uint8Array(buffer as ArrayBuffer);
    self.postMessage({ bytes });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
