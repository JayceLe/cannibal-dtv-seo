"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, BarChart3, Copy, Download, FileUp, Play, Plus, Search, Square, Trash2 } from "lucide-react";
import { detectSCheckPro, lookupSCheckProRank, normalizeRankDomain } from "@/lib/scheckpro-rank";
import {
  MAX_RANK_KEYWORDS, applyRankResult, keywordKey, listRankKeywords, listRankProjects,
  openRankDb, parseKeywords, rankMovement, removeRankKeywords, removeRankProject,
  saveRankKeywords, saveRankProject,
  type RankDepth, type RankKeyword, type RankProject,
} from "@/lib/rank-hub";
import "../app/check-rank.css";

const PAGE_SIZE = 100;
const fmt = (value: number) => value.toLocaleString("vi-VN");
const day = (at: string) => at ? new Date(at).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

function downloadCsv(project: RankProject, rows: RankKeyword[]) {
  const safe = (value: unknown) => {
    let text = String(value ?? "");
    if (/^[\s]*[=+@\-\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const lines = ["Từ khóa,Vị trí,Vị trí cũ,Vị trí tốt nhất,Cập nhật,Liên kết", ...rows.map(row =>
    [row.keyword, row.rank ?? "n/a", row.previousRank ?? "", row.bestRank ?? "", day(row.updatedAt), row.url].map(safe).join(","))];
  const url = URL.createObjectURL(new Blob(["\ufeff", lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${project.name.trim().replace(/[^\p{L}\p{N}._-]+/gu, "-") || "check-rank"}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function RankChart({ row, onClose }: { row: RankKeyword; onClose: () => void }) {
  const points = row.history.slice(-40);
  const path = points.map((point, index) => `${index ? "L" : "M"}${points.length === 1 ? 50 : index * 100 / (points.length - 1)},${point.rank === null ? 100 : Math.min(100, Math.max(0, (point.rank - 1) / 99 * 100))}`).join(" ");
  return <div className="cr-chart-backdrop" role="presentation" onClick={onClose}>
    <section className="cr-chart" role="dialog" aria-modal="true" aria-label={`Lịch sử rank: ${row.keyword}`} onClick={event => event.stopPropagation()}>
      <div className="cr-chart-head"><div><span className="cr-eyebrow">Lịch sử thứ hạng</span><h2>{row.keyword}</h2></div><button type="button" className="btn secondary" onClick={onClose}>Đóng</button></div>
      {points.length ? <><div className="cr-chart-plot"><span>Top 1</span><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Biểu đồ ${points.length} lần cập nhật`}><path d={path} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />{points.map((point, index) => <circle key={`${point.at}-${index}`} cx={points.length === 1 ? 50 : index * 100 / (points.length - 1)} cy={point.rank === null ? 100 : Math.min(100, Math.max(0, (point.rank - 1) / 99 * 100))} r="1.6" fill="currentColor" />)}</svg><span>Top 100 / N/A</span></div>
        <div className="cr-chart-history">{points.slice().reverse().map((point, index) => <div key={`${point.at}-${index}`}><time>{day(point.at)}</time><strong>{point.rank ?? "N/A"}</strong><span>{point.url || "Chưa tìm thấy"}</span></div>)}</div></> : <p className="muted">Chưa có lần kiểm tra nào.</p>}
    </section>
  </div>;
}

export default function CheckRankWorkspace({ owner }: { owner: string }) {
  const dbRef = useRef<IDBDatabase | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const checkingRef = useRef(false);
  const rowsRef = useRef<RankKeyword[]>([]);
  const [projects, setProjects] = useState<RankProject[]>([]);
  const [projectId, setProjectId] = useState("");
  const [rows, setRows] = useState<RankKeyword[]>([]);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [depth, setDepth] = useState<RankDepth>(100);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"keyword" | "rank" | "previousRank" | "bestRank" | "updatedAt">("keyword");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [chart, setChart] = useState<RankKeyword | null>(null);
  const [ready, setReady] = useState<boolean | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const active = projects.find(project => project.id === projectId);
  const configDirty = !!active && (name.trim() !== active.name || domain.trim() !== active.domain || depth !== active.depth);

  useEffect(() => {
    if (!chart) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setChart(null); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [chart]);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    void openRankDb().then(async db => {
      if (!mounted) { db.close(); return; }
      dbRef.current = db;
      const items = await listRankProjects(db, owner);
      if (mounted) { setProjects(items); setStorageReady(true); }
    }).catch(err => { if (mounted) setError(err instanceof Error ? err.message : String(err)); });
    void detectSCheckPro(controller.signal).then(found => { if (mounted) setReady(found); });
    return () => {
      mounted = false;
      controller.abort();
      abortRef.current?.abort();
      workerRef.current?.terminate();
      dbRef.current?.close();
    };
  }, [owner]);

  const shown = useMemo(() => {
    const term = keywordKey(search);
    const matched = term ? rows.filter(row => keywordKey(row.keyword).includes(term)) : [...rows];
    matched.sort((a, b) => {
      if (sort === "keyword") return direction * a.keyword.localeCompare(b.keyword, "vi");
      if (sort === "updatedAt") return direction * a.updatedAt.localeCompare(b.updatedAt);
      return direction * ((a[sort] ?? 999) - (b[sort] ?? 999));
    });
    return matched;
  }, [rows, search, sort, direction]);
  const visible = shown.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function report(error: unknown) { setError(error instanceof Error ? error.message : String(error)); }
  function updateRows(next: RankKeyword[]) { rowsRef.current = next; setRows(next); }
  async function openProject(project: RankProject) {
    const db = dbRef.current;
    if (!db || busy) return;
    setError(""); setMessage(""); setSelected(new Set()); setSearch(""); setPage(0);
    setBusy("loading");
    try {
      const loaded = await listRankKeywords(db, project.id);
      updateRows(loaded);
      setProjectId(project.id); setName(project.name); setDomain(project.domain); setDepth(project.depth);
      setProgress(project.cursor);
    } catch (err) { report(err); }
    finally { setBusy(""); }
  }
  async function createProject() {
    const db = dbRef.current;
    if (!db || busy) return;
    setError("");
    try {
      const normalized = normalizeRankDomain(domain);
      if (!name.trim()) throw new Error("Nhập tên dự án.");
      const at = new Date().toISOString();
      const project: RankProject = { id: crypto.randomUUID(), owner, name: name.trim(), domain: normalized, depth, count: 0, cursor: 0, createdAt: at, updatedAt: at };
      await saveRankProject(db, project);
      setProjects(current => [project, ...current]);
      updateRows([]); setProjectId(project.id); setDomain(normalized); setSelected(new Set()); setPage(0);
      setMessage("Đã tạo dự án. Thêm từ khóa để bắt đầu.");
    } catch (err) { report(err); }
  }
  async function updateProject() {
    const db = dbRef.current;
    if (!db || !active || busy) return;
    setError("");
    try {
      const normalized = normalizeRankDomain(domain);
      if (!name.trim()) throw new Error("Nhập tên dự án.");
      if (normalized !== active.domain && rowsRef.current.some(row => row.updatedAt)) {
        if (!window.confirm("Đổi domain sẽ xóa lịch sử rank của dự án này vì kết quả cũ thuộc domain khác. Tiếp tục?")) return;
        const reset = rowsRef.current.map(row => ({ ...row, rank: null, previousRank: null, bestRank: null, url: "", updatedAt: "", history: [] }));
        await saveRankKeywords(db, reset); updateRows(reset);
      }
      const next = { ...active, name: name.trim(), domain: normalized, depth, cursor: 0, updatedAt: new Date().toISOString() };
      await saveRankProject(db, next);
      setProjects(current => current.map(project => project.id === next.id ? next : project));
      setDomain(normalized); setProgress(0); setMessage("Đã cập nhật dự án.");
    } catch (err) { report(err); }
  }
  async function deleteProject() {
    const db = dbRef.current;
    if (!db || !active || busy || !window.confirm(`Xóa dự án “${active.name}” và toàn bộ lịch sử rank?`)) return;
    setBusy("delete"); setError("");
    try {
      await removeRankProject(db, active.id);
      setProjects(current => current.filter(project => project.id !== active.id));
      setProjectId(""); updateRows([]); setSelected(new Set()); setName(""); setDomain(""); setMessage("Đã xóa dự án.");
    } catch (err) { report(err); }
    finally { setBusy(""); }
  }
  async function addKeywords(input: string[]) {
    const db = dbRef.current;
    if (!db || !active || busy) return;
    setError(""); setMessage(""); setBusy("import");
    try {
      const known = new Set(rowsRef.current.map(row => keywordKey(row.keyword)));
      const fresh = parseKeywords(input).filter(word => !known.has(keywordKey(word)));
      if (known.size + fresh.length > MAX_RANK_KEYWORDS) throw new Error(`Dự án chỉ chứa tối đa ${fmt(MAX_RANK_KEYWORDS)} từ khóa.`);
      const added: RankKeyword[] = fresh.map(keyword => ({ id: `${active.id}:${keywordKey(keyword)}`, projectId: active.id, keyword, rank: null, previousRank: null, bestRank: null, url: "", updatedAt: "", history: [] }));
      await saveRankKeywords(db, added);
      const next = [...rowsRef.current, ...added];
      const updated = { ...active, count: next.length, cursor: 0, updatedAt: new Date().toISOString() };
      await saveRankProject(db, updated);
      updateRows(next); setProjects(current => current.map(project => project.id === updated.id ? updated : project));
      setProgress(0); setText(""); setMessage(`Đã thêm ${fmt(added.length)} từ khóa · tổng ${fmt(next.length)}/${fmt(MAX_RANK_KEYWORDS)}.`);
    } catch (err) { report(err); }
    finally { setBusy(""); }
  }
  async function importFile(file?: File) {
    if (!file || !active || busy) return;
    setError(""); setBusy("reading");
    const worker = new Worker(new URL("../workers/rank-keywords.worker.ts", import.meta.url));
    workerRef.current = worker;
    worker.onmessage = event => {
      worker.terminate(); workerRef.current = null; setBusy("");
      if (event.data.error) report(new Error(event.data.error));
      else void addKeywords(event.data.keywords);
    };
    worker.onerror = () => { worker.terminate(); workerRef.current = null; setBusy(""); setError("Không đọc được file từ khóa."); };
    worker.postMessage(file);
  }
  function exportXlsx() {
    if (!active || busy) return;
    setBusy("export"); setError("");
    const worker = new Worker(new URL("../workers/rank-export.worker.ts", import.meta.url));
    workerRef.current = worker;
    worker.onmessage = event => {
      worker.terminate(); workerRef.current = null; setBusy("");
      if (event.data.error) { report(new Error(event.data.error)); return; }
      const url = URL.createObjectURL(new Blob([event.data.bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${active.name.trim().replace(/[^\p{L}\p{N}._-]+/gu, "-") || "check-rank"}.xlsx`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    };
    worker.onerror = () => { worker.terminate(); workerRef.current = null; setBusy(""); setError("Không xuất được file Excel."); };
    worker.postMessage(rowsRef.current);
  }
  async function deleteSelected() {
    const db = dbRef.current;
    if (!db || !active || !selected.size || busy || !window.confirm(`Xóa ${fmt(selected.size)} từ khóa đã chọn?`)) return;
    setBusy("delete"); setError("");
    try {
      await removeRankKeywords(db, [...selected]);
      const next = rowsRef.current.filter(row => !selected.has(row.id));
      const updated = { ...active, count: next.length, cursor: 0, updatedAt: new Date().toISOString() };
      await saveRankProject(db, updated);
      updateRows(next); setProjects(current => current.map(project => project.id === updated.id ? updated : project));
      setSelected(new Set()); setPage(0); setProgress(0); setMessage("Đã xóa từ khóa đã chọn.");
    } catch (err) { report(err); }
    finally { setBusy(""); }
  }
  async function checkRanks(resume = false) {
    const db = dbRef.current;
    if (!db || !active || busy || checkingRef.current) return;
    setError(""); setMessage("");
    if (configDirty) { setError("Lưu thay đổi dự án trước khi kiểm tra rank."); return; }
    if (!rowsRef.current.length) { setError("Thêm ít nhất một từ khóa trước khi kiểm tra."); return; }
    checkingRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy("checking");
    let cursor = resume ? active.cursor : 0;
    setProgress(cursor);
    try {
      if (!(await detectSCheckPro(controller.signal))) throw new Error("Không tìm thấy SCheckPro trên Chrome. Bật tiện ích và tải lại trang.");
      for (; cursor < rowsRef.current.length; cursor++) {
        if (controller.signal.aborted) break;
        const original = rowsRef.current[cursor];
        const result = await lookupSCheckProRank(active.domain, original.keyword, active.depth, controller.signal, true);
        const updated = applyRankResult(original, result.rank, result.ranking_url, new Date().toISOString());
        await saveRankKeywords(db, [updated]);
        rowsRef.current[cursor] = updated;
        const updatedProject = { ...active, cursor: cursor + 1, updatedAt: updated.updatedAt };
        await saveRankProject(db, updatedProject);
        setProjects(current => current.map(project => project.id === updatedProject.id ? updatedProject : project));
        setProgress(cursor + 1);
        if ((cursor + 1) % 10 === 0 || cursor + 1 === rowsRef.current.length) setRows([...rowsRef.current]);
      }
      if (cursor === rowsRef.current.length) {
        const complete = { ...active, cursor: 0, updatedAt: new Date().toISOString() };
        await saveRankProject(db, complete);
        setProjects(current => current.map(project => project.id === complete.id ? complete : project));
        setProgress(0); setMessage(`Đã kiểm tra ${fmt(rowsRef.current.length)} từ khóa.`);
      } else setMessage(`Đã dừng ở ${fmt(cursor)}/${fmt(rowsRef.current.length)}. Chọn Tiếp tục để chạy tiếp.`);
    } catch (err) {
      if (!controller.signal.aborted) report(err);
      setMessage(`Đã lưu ${fmt(cursor)}/${fmt(rowsRef.current.length)} từ khóa. Có thể tiếp tục khi Google sẵn sàng.`);
    } finally {
      setRows([...rowsRef.current]);
      abortRef.current = null;
      checkingRef.current = false;
      setBusy("");
    }
  }
  function changeSort(next: typeof sort) {
    setDirection(next === sort ? direction === 1 ? -1 : 1 : 1);
    setSort(next); setPage(0);
  }
  const selectedVisible = visible.length > 0 && visible.every(row => selected.has(row.id));

  return <div className="cr-workspace">
    <div className="cr-heading"><div><span className="cr-eyebrow">RANK TRACKER / SCheckPro</span><h1>Check Rank</h1><p>Quản lý dự án, theo dõi Top 100 và lịch sử vị trí cho tối đa {fmt(MAX_RANK_KEYWORDS)} từ khóa mỗi dự án.</p></div><span className={`cr-connection ${ready ? "is-ready" : ""}`}>{ready === null ? "Đang kiểm tra tiện ích" : ready ? "SCheckPro đã kết nối" : "Cần bật SCheckPro trên Chrome"}</span></div>
    {error ? <p className="error-message" role="alert">{error}</p> : null}
    <section className="cr-panel cr-project" aria-label="Dự án tracking">
      <div className="cr-project-controls">
        <label>Dự án<select aria-label="Chọn dự án" value={projectId} disabled={!!busy} onChange={event => { const project = projects.find(item => item.id === event.target.value); if (project) void openProject(project); else { setProjectId(""); updateRows([]); setName(""); setDomain(""); } }}><option value="">Tạo dự án mới…</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name} · {project.domain} · {fmt(project.count)}</option>)}</select></label>
        <label>Tên dự án<input value={name} disabled={!!busy} onChange={event => setName(event.target.value)} placeholder="Ví dụ: Blog" /></label>
        <label>Domain tracking<input value={domain} disabled={!!busy} onChange={event => setDomain(event.target.value)} placeholder="example.com" autoComplete="off" spellCheck={false} /></label>
        <label>Phạm vi<select value={depth} disabled={!!busy} onChange={event => setDepth(Number(event.target.value) as RankDepth)}><option value={10}>Top 10</option><option value={30}>Top 30</option><option value={100}>Top 100</option></select></label>
      </div>
      <div className="cr-actions"><button type="button" className="btn primary" disabled={!!busy || !storageReady} onClick={() => void (active ? updateProject() : createProject())}>{active ? "Cập nhật dự án" : <><Plus size={17} /> Thêm dự án</>}</button>{active ? <button type="button" className="btn secondary" disabled={!!busy} onClick={() => void deleteProject()}><Trash2 size={16} /> Xóa dự án</button> : null}<span className="cr-note">{storageReady ? "Dữ liệu được lưu trên trình duyệt này. Xuất file định kỳ để sao lưu." : "Đang mở bộ nhớ dự án…"}</span></div>
      {busy && busy !== "checking" ? <p className="cr-note" role="status">{busy === "reading" ? "Đang đọc file…" : busy === "import" ? "Đang lưu từ khóa…" : busy === "export" ? "Đang tạo file Excel…" : busy === "delete" ? "Đang xóa…" : "Đang mở dự án…"}</p> : null}
    </section>
    {active ? <>
      <section className="cr-panel cr-import" aria-label="Thêm từ khóa"><div className="cr-section-head"><div><span className="cr-eyebrow">01 / DANH SÁCH</span><h2>Từ khóa tracking</h2></div><strong>{fmt(rows.length)} <small>/ {fmt(MAX_RANK_KEYWORDS)}</small></strong></div><div className="cr-import-grid"><label>Nhập mỗi từ khóa một dòng<textarea rows={4} value={text} disabled={!!busy} onChange={event => setText(event.target.value)} placeholder="Nhập từ khóa theo mỗi dòng" /></label><div className="cr-import-side"><p>Thêm trực tiếp hoặc import XLSX, CSV, TSV, TXT. Từ khóa trùng được gộp lại.</p><div className="cr-actions"><button className="btn primary" type="button" disabled={!!busy || !text.trim()} onClick={() => void addKeywords(text.split(/\r?\n/))}><Plus size={16} /> Thêm từ khóa</button><button className="btn secondary" type="button" disabled={!!busy} onClick={() => fileRef.current?.click()}><FileUp size={16} /> Import file</button><input ref={fileRef} type="file" hidden accept=".xlsx,.csv,.tsv,.txt" onChange={event => { void importFile(event.target.files?.[0]); event.target.value = ""; }} /></div></div></div></section>
      <section className="cr-panel cr-results" aria-label="Kết quả thứ hạng"><div className="cr-section-head"><div><span className="cr-eyebrow">02 / THEO DÕI</span><h2>Bảng thứ hạng</h2></div><div className="cr-actions">{busy === "checking" ? <button className="btn secondary" type="button" onClick={() => abortRef.current?.abort()}><Square size={15} /> Dừng</button> : <><button className="btn primary" type="button" disabled={!!busy || !rows.length || ready !== true || configDirty} onClick={() => void checkRanks(false)}><Play size={16} /> Cập nhật tất cả</button>{active.cursor > 0 ? <button className="btn secondary" type="button" disabled={!!busy || ready !== true || configDirty} onClick={() => void checkRanks(true)}>Tiếp tục từ {fmt(active.cursor + 1)}</button> : null}</>}<button className="btn secondary" type="button" disabled={!!busy || !rows.length} onClick={exportXlsx}><Download size={16} /> Xuất Excel</button><button className="btn secondary" type="button" disabled={!!busy || !rows.length} onClick={() => void downloadCsv(active, rowsRef.current)}>CSV</button><button className="btn secondary" type="button" disabled={!!busy || !rows.length} onClick={() => void navigator.clipboard.writeText(rowsRef.current.map(row => `${row.keyword}\t${row.rank ?? "n/a"}\t${row.url}`).join("\n")).then(() => setMessage("Đã sao chép toàn bộ bảng.")).catch(report)}><Copy size={16} /> Copy All</button></div></div>
        <p className="cr-note">Rank lấy URL đầu tiên khớp đúng domain; slug không ảnh hưởng. Giữ tab mở khi đang kiểm tra. Google có thể giới hạn tốc độ và khi đó bạn có thể tiếp tục từ vị trí đã lưu.</p>
        {configDirty ? <p className="cr-message" role="status">Lưu thay đổi dự án để kiểm tra với domain và phạm vi mới.</p> : null}
        {busy === "checking" ? <div className="cr-progress" role="progressbar" aria-label="Tiến độ kiểm tra rank" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={rows.length}><span style={{ width: `${rows.length ? progress / rows.length * 100 : 0}%` }} /></div> : null}
        {busy === "checking" ? <p role="status">Đang kiểm tra {fmt(progress)}/{fmt(rows.length)} từ khóa…</p> : null}
        {message ? <p className="cr-message" role="status">{message}</p> : null}
        <div className="cr-filter"><label><Search size={16} /><input value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} placeholder="Tìm từ khóa…" aria-label="Tìm từ khóa" /></label><button type="button" className="btn secondary" disabled={!selected.size || !!busy} onClick={() => void deleteSelected()}><Trash2 size={15} /> Xóa {selected.size ? fmt(selected.size) : "đã chọn"}</button><span>{fmt(shown.length)} kết quả</span></div>
        <div className="cr-table-scroll" role="region" aria-label="Bảng thứ hạng có thể cuộn ngang" tabIndex={0}><table><thead><tr><th><input type="checkbox" aria-label="Chọn trang hiện tại" checked={selectedVisible} onChange={event => { const next = new Set(selected); for (const row of visible) event.target.checked ? next.add(row.id) : next.delete(row.id); setSelected(next); }} /></th><th>STT</th><th><button onClick={() => changeSort("keyword")}>Từ khóa</button></th><th><button onClick={() => changeSort("rank")}>Vị trí</button></th><th><button onClick={() => changeSort("previousRank")}>Vị trí cũ</button></th><th><button onClick={() => changeSort("bestRank")}>Tốt nhất</button></th><th><button onClick={() => changeSort("updatedAt")}>Cập nhật</button></th><th>Liên kết</th><th>Biểu đồ</th></tr></thead><tbody>{visible.map((row, index) => { const movement = rankMovement(row); return <tr key={row.id}><td><input type="checkbox" aria-label={`Chọn ${row.keyword}`} checked={selected.has(row.id)} onChange={event => { const next = new Set(selected); event.target.checked ? next.add(row.id) : next.delete(row.id); setSelected(next); }} /></td><td>{page * PAGE_SIZE + index + 1}</td><th scope="row">{row.keyword}</th><td><strong>{row.rank ?? "n/a"}</strong>{movement !== null && movement !== 0 ? <small className={movement > 0 ? "cr-up" : "cr-down"}>{movement > 0 ? <ArrowUp size={13} /> : <ArrowDown size={13} />}{Math.abs(movement)}</small> : null}</td><td>{row.previousRank ?? "—"}</td><td>{row.bestRank ?? "—"}</td><td>{day(row.updatedAt)}</td><td className="cr-url">{row.url ? <a href={row.url} target="_blank" rel="noopener noreferrer" title={row.url}>{row.url}</a> : "—"}</td><td><button type="button" className="cr-chart-button" aria-label={`Biểu đồ ${row.keyword}`} onClick={() => setChart(row)}><BarChart3 size={17} /></button></td></tr>; })}{!visible.length ? <tr><td colSpan={9} className="cr-empty">{rows.length ? "Không có từ khóa khớp tìm kiếm." : "Chưa có từ khóa. Thêm hoặc import file để bắt đầu."}</td></tr> : null}</tbody></table></div>
        <div className="cr-pages"><span>{shown.length ? `${fmt(page * PAGE_SIZE + 1)}–${fmt(Math.min((page + 1) * PAGE_SIZE, shown.length))}` : "0"} / {fmt(shown.length)} từ khóa</span><div><button type="button" className="btn secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Trước</button><span>Trang {page + 1} / {Math.max(1, Math.ceil(shown.length / PAGE_SIZE))}</span><button type="button" className="btn secondary" disabled={(page + 1) * PAGE_SIZE >= shown.length} onClick={() => setPage(page + 1)}>Sau</button></div></div>
      </section>
    </> : <section className="cr-panel cr-empty-project"><h2>Bắt đầu theo dõi</h2><p>Tạo dự án với tên và domain; sau đó thêm hoặc import danh sách từ khóa.</p></section>}
    {chart ? <RankChart row={chart} onClose={() => setChart(null)} /> : null}
  </div>;
}
