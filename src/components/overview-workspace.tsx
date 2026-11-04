"use client";
import AnimatedNumber from "./animated-number";
import OverviewSummary from "./overview-summary";
import CannibalRatios from "./cannibal-ratios";
import CategorySidebar from "./category-sidebar";
import { CategoryDistributions } from "./overview-charts";
import QueryTable from "./query-table";
import type { OverviewData, QueryFilters } from "@/lib/overview";

/** Presentation only: all scopes, formulas and requests stay with Dashboard. */
export default function OverviewWorkspace({
  data,
  filters,
  loading,
  onFilter,
  onSelect,
  periodId,
}: {
  data: OverviewData;
  filters: QueryFilters;
  loading: boolean;
  onFilter: (part: Partial<QueryFilters>) => void;
  onSelect: (category: string) => void;
  periodId: string;
}) {
  return (
    <div className="overview-workspace">
      <section
        className="overview-section"
        aria-labelledby="overview-title"
        aria-busy={loading}
      >
        <div className="section-title" data-motion-reveal>
          <h1 id="overview-title">Tổng quan toàn site</h1>
          <span>
            <AnimatedNumber value={data.siteSummary.withData} /> query đã map
            trong kỳ
          </span>
        </div>
        <OverviewSummary
          categories={data.categories}
          siteCannibal={data.siteSummary.cannibal}
          onSelect={onSelect}
        />
      </section>
      <section
        id="query-analysis"
        className="analysis-section"
        aria-label="Phân tích theo DMC3"
      >
        <div className="analysis-layout overview-analysis">
          <CategorySidebar
            categories={data.categories}
            selected={filters.category}
            total={data.siteSummary.cannibal}
            onSelect={(category) => onFilter({ category })}
          />
          <div className="query-workspace">
            <CannibalRatios
              scoped={data.summary}
              site={data.siteSummary}
              category={filters.category}
              categories={data.categories}
              loading={loading}
              onSelect={(category) => onFilter({ category })}
            />
            <CategoryDistributions
              categories={data.categories}
              selected={filters.category}
              onSelect={onSelect}
            />
            <div className="query-list-section">
              <div className="section-title" data-motion-reveal>
                <h2>Query và URL cạnh tranh</h2>
              </div>
              <QueryTable
                key={`${periodId}:${filters.category}`}
                data={data}
                filters={filters}
                onFilter={onFilter}
                loading={loading}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
