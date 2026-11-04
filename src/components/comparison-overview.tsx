"use client";
import { useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  ArrowUpRight,
  ArrowRight,
  CheckCheck,
  Target,
} from "lucide-react";
import AnimatedNumber from "./animated-number";
import SearchPicker from "./search-picker";
import { number, decimal, labels } from "@/lib/engine";
import { categoryColor } from "@/lib/categories";
import {
  groupChanges,
  rate,
  signed,
  snapshotValues,
  type ComparisonMetric,
} from "@/lib/comparison-report";
import {
  snapshotOption,
  categoryChangeOption,
  statusComparisonOption,
} from "@/lib/comparison-chart-options";
import { formatDataDate } from "@/lib/dates";
import type { ComparisonData, ComparisonFilter, Week } from "@/lib/comparison";
const Chart = dynamic(() => import("./chart"), {
  ssr: false,
  loading: () => (
    <div className="report-chart-loading" role="status">
      Đang nạp biểu đồ…
    </div>
  ),
});
function ReportCard({
  label,
  value,
  title,
  tone = "neutral",
  onClick,
  icon,
}: {
  label: string;
  value: ReactNode;
  title?: string;
  tone?: string;
  onClick?: () => void;
  icon: ReactNode;
}) {
  const content = (
    <>
      <span className="report-card-label">
        {label}
        <span
          className="metric-icon"
          aria-hidden="true"
          data-motion-direction={tone === "safe" ? "down" : "up"}
        >
          {icon}
        </span>
      </span>
      <strong
        className="report-card-value"
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </strong>

    </>
  );
  return onClick ? (
    <button
      type="button"
      className={`comparison-report-card tone-${tone}`}
      data-metric-surface
      data-motion-reveal
      onClick={onClick}
      title={title}
    >
      {content}
    </button>
  ) : (
    <article
      className={`comparison-report-card tone-${tone}`}
      data-metric-surface
      data-motion-reveal
    >
      {content}
    </article>
  );
}
function MetricToggle({
  value,
  onChange,
  label,
}: {
  value: ComparisonMetric;
  onChange: (value: ComparisonMetric) => void;
  label: string;
}) {
  return (
    <div className="report-metric-toggle" role="group" aria-label={label}>
      {(["query", "impression"] as const).map((metric) => (
        <button
          type="button"
          key={metric}
          aria-pressed={metric === value}
          onClick={() => onChange(metric)}
        >
          {metric === "query" ? "Query" : "Impression"}
        </button>
      ))}
    </div>
  );
}
export default function ComparisonOverview({
  data,
  older,
  newer,
  category,
  onCategory,
  onTransition,
  loading,
}: {
  data: ComparisonData;
  older: Week;
  newer: Week;
  category: string;
  onCategory: (name: string) => void;
  onTransition: (filter: ComparisonFilter) => void;
  loading: boolean;
}) {
  const [metric, setMetric] = useState<ComparisonMetric>("query"),
    [groupMetric, setGroupMetric] = useState<ComparisonMetric>("query");
  const groups = groupChanges(data.categories),
    scope = data.report.category.replaceAll("_", " ") || "Toàn site",
    dates: [string, string] = [
      formatDataDate(older.week_start),
      formatDataDate(newer.week_start),
    ];
  const snapshot = snapshotValues(data, metric);
  const paired = useMemo(
    () => snapshotOption(snapshot.old, snapshot.next, dates),
    [snapshot.old, snapshot.next, dates[0], dates[1]],
  );
  const flow = useMemo(
    () => statusComparisonOption(data.old, data.new, dates),
    [data.old, data.new, dates[0], dates[1]],
  );
  const bars = useMemo(
    () => categoryChangeOption(data.categories, groupMetric, category),
    [data.categories, groupMetric, category],
  );
  const oldImpact = rate(
      data.old.affectedImpressions,
      data.report.site_old.impressions,
    ),
    newImpact = rate(
      data.new.affectedImpressions,
      data.report.site_new.impressions,
    ),
    impactDelta = newImpact - oldImpact;
  const transition = (filter: ComparisonFilter) => {
    onTransition(filter);
    document.getElementById("comparison-queries")?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  };
  const groupOptions = [
    { value: "", label: "Tất cả" },
    ...data.categories.map((c) => ({
      value: c.name,
      label: c.name.replaceAll("_", " "),
      color: categoryColor(c.name),
    })),
  ];
  return (
    <section
      className="comparison-overview"
      aria-label="Tổng quan so sánh"
      aria-busy={loading}
    >
      <div className="report-section-heading" data-motion-reveal>
        <h2>Biến động DMC3</h2>
        <span>{groups.total} nhóm được đối chiếu</span>
      </div>
      <div className="panel comparison-group-cards" aria-label="Tóm tắt biến động DMC3">
        <div className="group-movement-counts">
          {[
            {label:"Nhóm cải thiện",value:groups.improved,tone:"safe"},
            {label:"Nhóm tăng cannibal",value:groups.worsened,tone:"danger"},
            {label:"Nhóm không đổi",value:groups.unchanged,tone:"neutral"},
            {label:"Nhóm còn cannibal",value:groups.remaining,tone:"neutral"},
          ].map(item=><div className={`group-movement-stat ${item.tone}`} key={item.label}>
            <span>{item.label}</span><strong><AnimatedNumber value={item.value}/></strong>
          </div>)}
        </div>
        <div className="group-movement-extremes">
          {[
            {label:"Giảm nhiều nhất",group:groups.drop,ties:groups.dropTies,tone:"safe"},
            {label:"Tăng nhiều nhất",group:groups.rise,ties:groups.riseTies,tone:"danger"},
          ].map(item=><button type="button" className={`group-movement-extreme ${item.tone}`} key={item.label}
            disabled={!item.group} onClick={()=>item.group&&onCategory(item.group.name)}
            title={item.ties>1?`${item.ties} nhóm đồng hạng`:undefined}>
            <span>{item.label}</span>
            <strong>{item.group?.name.replaceAll("_"," ")||"Không có"}</strong>
            <span className="movement-delta">{item.group?`${signed(item.group.delta,number)} query`:"—"}</span>
            <ArrowUpRight size={16} aria-hidden="true"/>
          </button>)}
        </div>
      </div>
      <div
        className="report-section-heading report-scope-heading"
        data-motion-reveal
      >
        <div>
          <h2>Tổng quan so sánh</h2>
          <span>{loading ? "Đang cập nhật…" : scope}</span>
        </div>
        <SearchPicker
          label="DMC3"
          options={groupOptions}
          value={category}
          onChange={onCategory}
        />
      </div>
      <div className="comparison-insights">
        <ReportCard
          label="Mới bị cannibal"
          value={
            <>
              {number(data.report.transitions.new)}
              <small>query</small>
            </>
          }
          tone={data.report.transitions.new ? "danger" : "neutral"}
          onClick={() => transition("new")}
          icon={<ArrowUpRight size={17} />}
        />
        <ReportCard
          label={
            data.report.coverage?.old_only ? "Giảm cannibal" : "Đã hết cannibal"
          }
          value={
            <>
              {number(data.report.transitions.resolved)}
              <small>query</small>
            </>
          }
          tone={data.report.transitions.resolved ? "safe" : "neutral"}
          onClick={() => transition("resolved")}
          icon={<CheckCheck size={17} />}
        />
        <ReportCard
          label="Impression cannibal"
          title={scope}
          value={<>{number(data.new.affectedImpressions)}<small>impression</small></>}
          tone={
            data.new.affectedImpressions !== data.old.affectedImpressions
              ? data.new.affectedImpressions > data.old.affectedImpressions
                ? "danger"
                : "safe"
              : "neutral"
          }
          icon={<Target size={17} />}
        />
        <ReportCard
          label="Tỷ trọng impression / site"
          value={
            <span className="report-impact-pair">
              {decimal(oldImpact, 2)}%<ArrowRight size={16} />
              {decimal(newImpact, 2)}%
            </span>
          }
          tone={
            impactDelta > 0 ? "danger" : impactDelta < 0 ? "safe" : "neutral"
          }
          icon={<Target size={17} />}
        />
      </div>
      <div className="comparison-chart-grid">
        <section className="panel report-chart-card" data-scroll-reveal>
          <header>
            <div>
              <h3>Cannibal giữa hai ngày</h3>
            </div>
            <MetricToggle
              value={metric}
              onChange={setMetric}
              label="Chỉ số so sánh hai ngày"
            />
          </header>
          <div className="report-chart-values">
            <span>{number(snapshot.old)}</span>
            <ArrowRight size={18} />
            <strong>{number(snapshot.next)}</strong>
            <span
              className={`report-delta ${snapshot.delta > 0 ? "text-danger" : snapshot.delta < 0 ? "text-safe" : ""}`}
            >
              {signed(snapshot.delta, number)} {metric}
            </span>
          </div>
          <Chart
            option={paired}
            height={220}
            label={`${metric} cannibal ${scope}: ${dates[0]} ${number(snapshot.old)}, ${dates[1]} ${number(snapshot.next)}`}
          />
          <div className="report-chart-footer">
            <span>Tỷ lệ {metric} cannibal</span>
            <strong>
              {decimal(snapshot.oldRate, 2)}%<ArrowRight size={14} />
              {decimal(snapshot.newRate, 2)}%
            </strong>
          </div>
        </section>
        <section className="panel report-chart-card" data-scroll-reveal>
          <header>
            <div>
              <h3>Query theo mức độ</h3>
            </div>
            <span className="report-count">
              {number(data.report.transitions.changed)} thay đổi
            </span>
          </header>
          <div className="report-status-periods">
            <span><i className="period-before"/>Ngày trước · {dates[0]}</span>
            <span><i/>Ngày sau · {dates[1]}</span>
          </div>
          <Chart
            option={flow}
            height={Math.max(280, (4 + Number(Boolean(data.old.counts.unknown || data.new.counts.unknown)) + Number(Boolean(data.old.counts.data_issue || data.new.counts.data_issue))) * 64)}
            label={`So sánh query theo mức độ ${scope}: ${dates[0]} và ${dates[1]}`}
          />
          <details className="report-data-details">
            <summary>Xem số liệu chuyển trạng thái</summary>
            <div className="report-flow-list">
              {data.report.flows.map((f) => (
                <div key={`${f.from}:${f.to}`}>
                  <span>
                    {labels[f.from]}
                    <ArrowRight size={12} />
                    {labels[f.to]}
                  </span>
                  <strong>{number(f.value)}</strong>
                </div>
              ))}
            </div>
          </details>
        </section>
        <section
          className="panel report-chart-card report-group-chart"
          data-scroll-reveal
        >
          <header>
            <div>
              <h3>Biến động theo DMC3</h3>
              <span>Chọn nhóm để xem chi tiết</span>
            </div>
            <MetricToggle
              value={groupMetric}
              onChange={setGroupMetric}
              label="Chỉ số biến động DMC3"
            />
          </header>
          <div className="report-chart-legend">
            <span>
              <i className="safe" />
              Giảm cannibal
            </span>
            <span>
              <i className="danger" />
              Tăng cannibal
            </span>
            <span className="report-selected-group">
              {category ? scope : "Tất cả DMC3"}
              {category ? (
                <button className="text-link" onClick={() => onCategory("")}>
                  Bỏ chọn
                </button>
              ) : null}
            </span>
          </div>
          <div
            className="report-group-chart-scroll"
            tabIndex={0}
            aria-label="Biểu đồ biến động của tất cả DMC3"
          >
            <Chart
              option={bars}
              height={Math.max(240, groups.total * 36 + 48)}
              label={`Biến động ${groupMetric} cannibal của ${groups.total} DMC3`}
              onPick={(name) => onCategory(name === category ? "" : name)}
            />
          </div>
          <details className="report-data-details">
            <summary>Danh sách {groups.total} DMC3</summary>
            <div className="report-category-list">
              {data.categories
                .filter((c) => c.old_total || c.new_total)
                .map((c) => (
                  <button
                    key={c.name}
                    aria-pressed={c.name === category}
                    onClick={() =>
                      onCategory(c.name === category ? "" : c.name)
                    }
                  >
                    <span>
                      <i style={{ background: categoryColor(c.name) }} />
                      {c.name.replaceAll("_", " ")}
                    </span>
                    <span>
                      {number(groupMetric === "query" ? c.old : c.old_affected)}
                      <ArrowRight size={12} />
                      {number(groupMetric === "query" ? c.new : c.new_affected)}
                    </span>
                    <strong
                      className={
                        (groupMetric === "query" ? c.delta : c.affected_delta) >
                        0
                          ? "text-danger"
                          : (groupMetric === "query"
                                ? c.delta
                                : c.affected_delta) < 0
                            ? "text-safe"
                            : ""
                      }
                    >
                      {signed(
                        groupMetric === "query" ? c.delta : c.affected_delta,
                        number,
                      )}
                    </strong>
                  </button>
                ))}
            </div>
          </details>
        </section>
      </div>
    </section>
  );
}
