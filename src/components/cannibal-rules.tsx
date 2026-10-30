import FocusDialog from './focus-dialog';

export default function CannibalRules({onClose}:{onClose:()=>void}){
 return <FocusDialog title="Quy tắc tính cannibal" closeLabel="Đóng quy tắc" className="rules-dialog" onClose={onClose}>
  <div className="rules-body">
   <section className="rules-threshold"><span>Điều kiện cannibal</span><h3>Impression URL phụ ≥ 20% URL chính</h3><p>Một query có cannibal khi ít nhất một URL phụ đạt từ 20% impression của URL chính. URL chính (Top 1) là URL có impression cao nhất trong query.</p><div className="rules-example">Ví dụ: URL chính có <strong>1.000 impression</strong> → URL phụ từ <strong>200 impression</strong> đạt ngưỡng.</div></section>
   <section aria-labelledby="severity-rules"><h3 id="severity-rules">Phân loại mức độ</h3><p className="rules-intro">Chỉ phân loại sau khi query đã đạt điều kiện cannibal.</p><div className="rules-severity-grid">
    <article className="rule-level safe"><h4><i/>An toàn</h4><strong>Gap rank &lt; 0,5</strong><p>Rank Top 1 ≤ 3.</p></article>
    <article className="rule-level medium"><h4><i/>Trung bình</h4><strong>Gap rank 0,5–1</strong><p>Rank Top 1 ≤ 3; bao gồm cả 0,5 và 1.</p></article>
    <article className="rule-level danger"><h4><i/>Nguy hiểm</h4><strong>Rank Top 1 &gt; 3<br/>hoặc gap rank &gt; 1</strong><p>Rank Top 1 &gt; 3 được ưu tiên xếp Nguy hiểm.</p></article>
   </div></section>
   <dl className="rules-definitions"><div><dt>Gap rank</dt><dd>Làm tròn rank mỗi URL đến 1 chữ số thập phân trước khi tính. Gap là chênh lệch tuyệt đối giữa rank Top 1 và Top 2 theo impression. Phân loại và so sánh đều dùng rank đã làm tròn.</dd></div><div><dt>Impression cannibal</dt><dd>Chỉ cộng impression các URL phụ đạt ngưỡng ≥ 20%; không cộng URL chính.</dd></div></dl>
   <p className="rules-data-note">Thiếu rank hoặc dữ liệu lỗi sẽ được ghi nhận riêng, không tự gán mức độ.</p>
  </div>
 </FocusDialog>;
}
