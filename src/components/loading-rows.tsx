export default function LoadingRows({
  label = "Đang tải dữ liệu…",
}: {
  label?: string;
}) {
  return (
    <div className="loading-rows" role="status">
      <span>{label}</span>
      <div aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <div className="skeleton-row" key={row}>
            <i />
            <i />
            <i />
          </div>
        ))}
      </div>
    </div>
  );
}
