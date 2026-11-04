"use client";
import AnimatedNumber from "./animated-number";
import { Layers3, TrendingDown, TrendingUp, Eye } from "lucide-react";
import { number } from "@/lib/engine";
import { overviewHighlights, type CategoryStat } from "@/lib/overview";
import { categoryColor } from "@/lib/categories";
export default function OverviewSummary({
  categories,
  siteCannibal,
  onSelect,
}: {
  categories: CategoryStat[];
  siteCannibal: number;
  onSelect: (name: string) => void;
}) {
  const h = overviewHighlights(categories, siteCannibal);
  const cards = [
    {
      label: "Số DMC3 bị cannibal",
      value: h.totalGroups ? h.affected : null,
      denominator: h.totalGroups ? number(h.totalGroups) : "",
      group: "",
      name: "",
      tone: "overview-total",
      icon: Layers3,
      ties: 1,
    },
    {
      label: "Nhóm cannibal cao nhất",
      value: h.highest?.percent ?? null,
      denominator: "",
      group: h.highest?.name.replaceAll("_", " ") || "Chưa có dữ liệu",
      name: h.highest?.name || "",
      tone: "overview-high",
      icon: TrendingUp,
      ties: h.highest?.ties ?? 1,
    },
    {
      label: "Nhóm cannibal thấp nhất",
      value: h.lowest?.percent ?? null,
      denominator: "",
      group: h.lowest?.name.replaceAll("_", " ") || "Chưa có dữ liệu",
      name: h.lowest?.name || "",
      tone: "overview-low",
      icon: TrendingDown,
      ties: h.lowest?.ties ?? 1,
    },
    {
      label: "Impression cannibal lớn nhất",
      value: h.topImpressions?.cannibalImpressions ?? null,
      denominator: "",
      group: h.topImpressions?.name.replaceAll("_", " ") || "Chưa có dữ liệu",
      name: h.topImpressions?.name || "",
      tone: "overview-impression",
      icon: Eye,
      ties: h.topImpressions
        ? categories.filter(
            (g) =>
              g.total > 0 &&
              g.cannibalImpressions === h.topImpressions!.cannibalImpressions,
          ).length
        : 1,
    },
  ];
  return (
    <div className="overview-highlights">
      {cards.map((c) => {
        const Icon = c.icon;
        const isTotal = c.tone === "overview-total";
        return (
          <button
            type="button"
            key={c.label}
            data-motion-reveal
            data-metric-surface
            className={`highlight-card ${c.tone}`}
            onClick={() => onSelect(c.name)}
          >
            <span className="highlight-label" data-motion-text>
              {c.label}
              <span
                className="metric-icon"
                aria-hidden="true"
                data-motion-direction={
                  c.tone === "overview-low" ? "down" : "up"
                }
              >
                <Icon size={16} />
              </span>
            </span>
            <strong className="highlight-main" data-motion-text>
              {!isTotal && c.name ? (
                <i style={{ background: categoryColor(c.name) }} />
              ) : null}
              <span title={isTotal ? String(c.value ?? "—") : c.group}>
                {isTotal ? <AnimatedNumber value={c.value} wrap /> : c.group}
              </span>
            </strong>
            <span className="highlight-footer" data-motion-update>
              {isTotal ? (
                c.denominator ? (
                  `Trên tổng ${c.denominator} DMC3`
                ) : (
                  "Chưa có danh mục DMC3"
                )
              ) : (
                <>
                  <AnimatedNumber
                    value={c.value}
                    wrap
                    digits={c.tone === "overview-impression" ? 0 : 2}
                    suffix={c.tone === "overview-impression" ? "" : "%"}
                  />
                  {c.tone === "overview-impression" ? " impression" : ""}
                  {c.ties > 1 ? (
                    <small className="highlight-ties">
                      {c.ties} nhóm đồng hạng
                    </small>
                  ) : null}
                </>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
