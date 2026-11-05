"use client";

import { useState } from "react";
import { ExternalLink, ChevronDown } from "lucide-react";
import { aioScore, aioTone, aioVerdict, type AioResult } from "@/lib/aio";
import SearchPicker from "./search-picker";
import SelectMenu from "./select-menu";

export function AioUrl({
  url,
  children,
}: {
  url: string;
  children?: React.ReactNode;
}) {
  if (!/^https?:\/\//i.test(url)) return <span>{children || url || "—"}</span>;
  return (
    <a className="aio-url" href={url} target="_blank" rel="noopener noreferrer">
      {children || url}
      <ExternalLink size={13} aria-hidden="true" />
    </a>
  );
}

export default function AioResults({ result }: { result: AioResult }) {
  const [door, setDoor] = useState(result.rows[0]?.door || "");
  const [rivals, setRivals] = useState("2");
  const passage = result.passages[door];
  const shownRivals = passage?.rivals.length ? passage.rivals : passage?.comparison ? [passage.comparison] : [];
  const selected = result.rows.find((r) => r.door === door);
  const grouped = result.doors.find((d) => d.representative === door);
  const counts = result.rows.reduce<Record<string, number>>((acc, row) => {
    const tone = aioTone(row.verdict);
    acc[tone] = (acc[tone] || 0) + 1;
    return acc;
  }, {});
  return (
    <>
      <section
        className="aio-panel aio-results"
        aria-labelledby="aio-results-title"
      >
        <div className="aio-panel-head">
          <div>
            <span className="aio-eyebrow">Kết quả audit</span>
            <h2 id="aio-results-title">Nội dung theo từng door</h2>
          </div>
          <span className="aio-count">
            {result.rows.length} door · {result.read_competitors} đối thủ đọc
            được
          </span>
        </div>
        <div className="aio-result-summary" aria-label="Tóm tắt kết quả">
          <span>
            <strong>{result.query_count}</strong> query fan-out
          </span>
          <span className="aio-tone-danger">
            <strong>{counts.danger || 0}</strong> cần cải thiện
          </span>
          <span className="aio-tone-medium">
            <strong>{counts.medium || 0}</strong> ngang nhau
          </span>
          <span className="aio-tone-safe">
            <strong>{counts.safe || 0}</strong> dẫn đầu
          </span>
          <span>
            <strong>{counts.neutral || 0}</strong> chưa đủ căn cứ
          </span>
        </div>
        <div
          className="aio-table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Kết quả từng door, cuộn ngang để xem đủ cột"
        >
          <table className="aio-table aio-audit-table">
            <thead>
              <tr>
                <th scope="col">Door / query</th>
                <th scope="col">Trạng thái</th>
                <th scope="col" className="aio-numeric">
                  Điểm của bạn
                </th>
                <th scope="col" className="aio-numeric">
                  Đối thủ tốt nhất
                </th>
                <th scope="col" className="aio-numeric">
                  Gap đã đối chiếu
                </th>
                <th scope="col" className="aio-numeric">
                  Xếp trong nhóm
                </th>
                <th scope="col" className="aio-numeric">
                  Spread
                </th>
                <th scope="col">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.door} data-selected={door === row.door}>
                  <th scope="row">
                    <button
                      className="aio-door-button"
                      onClick={() => {
                        setDoor(row.door);
                        document
                          .getElementById("aio-passages")
                          ?.scrollIntoView({
                            block: "start",
                            behavior: window.matchMedia(
                              "(prefers-reduced-motion: reduce)",
                            ).matches
                              ? "instant"
                              : "smooth",
                          });
                      }}
                    >
                      {row.door}
                    </button>
                    <small>{row.merged_variants} biến thể</small>
                  </th>
                  <td>
                    <span
                      className={`aio-badge aio-tone-${aioTone(row.verdict)}`}
                      title={row.verdict}
                    >
                      {aioVerdict(row.verdict)}
                    </span>
                  </td>
                  <td className="aio-numeric">
                    <strong>{aioScore(row.your_score)}</strong>
                  </td>
                  <td className="aio-numeric">
                    {aioScore(row.best_rival_score)}
                  </td>
                  <td className="aio-numeric">{aioScore(row.gap)}</td>
                  <td className="aio-numeric">{row.your_rank}</td>
                  <td className="aio-numeric">{aioScore(row.spread)}</td>
                  <td>
                    <details>
                      <summary>
                        <ChevronDown size={14} aria-hidden="true" /> Xem
                      </summary>
                      <div className="aio-row-detail">
                        <p>{row.reason || row.verdict}</p>
                        <p>
                          <strong>Đối thủ: </strong>
                          {row.best_rival || "—"}
                        </p>
                        <p>{row.your_best_passage}</p>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details className="aio-disclosure">
          <summary>
            Các URL đối chiếu <span>{result.competitors.length}</span>
          </summary>
          <ul className="aio-source-list">
            {result.competitors.map((url) => (
              <li key={url}>
                <AioUrl url={url} />
              </li>
            ))}
          </ul>
        </details>
      </section>
      <section
        className="aio-panel"
        id="aio-passages"
        aria-labelledby="aio-passages-title"
      >
        <div className="aio-panel-head">
          <div>
            <span className="aio-eyebrow">Đối chiếu nội dung</span>
            <h2 id="aio-passages-title">Bằng chứng theo từng door</h2>
          </div>
          <span className="aio-count">Đối chiếu đoạn trả lời theo query</span>
        </div>
        <div className="aio-passage-controls">
          <SearchPicker
            label="Chọn door"
            options={result.rows.map((r) => ({ value: r.door, label: r.door }))}
            value={door}
            onChange={setDoor}
            searchLabel="Tìm door"
          />
          <SelectMenu
            label="Số đối thủ"
            value={rivals}
            onChange={setRivals}
            options={[1, 2, 3].map((n) => ({
              value: String(n),
              label: `${n} đối thủ`,
            }))}
          />
        </div>
        {passage && selected ? (
          <>
            <div className="aio-passage-title">
              <h3>{door}</h3>
              <span
                className={`aio-badge aio-tone-${aioTone(selected.verdict)}`}
              >
                {aioVerdict(selected.verdict)}
              </span>
            </div>
            {selected.reason && <p className="aio-count">{selected.reason}</p>}
            {grouped && grouped.members.length > 1 ? (
              <details className="aio-disclosure">
                <summary>
                  {grouped.members.length} query được gom vào door này
                </summary>
                <ul>
                  {grouped.members.map((member, i) => (
                    <li key={`${i}-${member}`}>{member}</li>
                  ))}
                </ul>
              </details>
            ) : null}
            <div className="aio-passage-grid">
              <article className="aio-passage aio-passage-own">
                <div className="aio-passage-head">
                  <span>Trang của bạn</span>
                  <strong>{aioScore(passage.score)}</strong>
                </div>
                <AioUrl url={result.config.my_url} />
                <p>{passage.passage || "Không có đoạn phù hợp."}</p>
              </article>
              <div className="aio-rivals">
                {shownRivals.slice(0, Number(rivals)).map((rival, index) => (
                  <article className="aio-passage" key={rival.url}>
                    <div className="aio-passage-head">
                      <span>Đối thủ {index + 1}</span>
                      <strong>
                        {aioScore(rival.score)}{" "}
                        {rival.gap != null && <small>chênh điểm {rival.gap > 0 ? "+" : ""}{aioScore(rival.gap)}</small>}
                      </strong>
                    </div>
                    <AioUrl url={rival.url} />
                    <p>{rival.passage}</p>
                  </article>
                ))}
                {!shownRivals.length ? (
                  <div className="aio-empty">
                    <strong>{selected.gap == null ? "Chưa đủ bằng chứng để kết luận gap." : "Trang của bạn đang dẫn đầu door này."}</strong>
                    {selected.gap != null && <p>Không có đối thủ nào có điểm cao hơn để đối chiếu.</p>}
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <p className="aio-empty">Chọn một door để xem các đoạn nội dung.</p>
        )}
      </section>
    </>
  );
}
