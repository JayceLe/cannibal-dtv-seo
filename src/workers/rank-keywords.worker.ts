import Papa from "papaparse";
import readXlsxFile from "read-excel-file/web-worker";
import { extractKeywordColumn, parseKeywords } from "../lib/rank-hub";

self.onmessage = async (event: MessageEvent<File>) => {
  try {
    const file = event.data;
    if (file.size > 25 * 1024 * 1024) throw new Error("File vượt 25 MB.");
    let keywords: string[];
    if (/\.xlsx$/i.test(file.name)) {
      const sheets = await readXlsxFile(file);
      keywords = extractKeywordColumn(sheets[0]?.data ?? []);
    } else if (/\.(csv|tsv)$/i.test(file.name)) {
      const parsed = Papa.parse<unknown[]>(await file.text(), { delimiter: /\.tsv$/i.test(file.name) ? "\t" : undefined, skipEmptyLines: "greedy" });
      if (parsed.errors.length) throw new Error(`File không hợp lệ: ${parsed.errors[0].message}`);
      keywords = extractKeywordColumn(parsed.data);
    } else if (/\.txt$/i.test(file.name)) {
      keywords = parseKeywords((await file.text()).split(/\r?\n/));
    } else throw new Error("Chọn file .xlsx, .csv, .tsv hoặc .txt.");
    self.postMessage({ keywords });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
