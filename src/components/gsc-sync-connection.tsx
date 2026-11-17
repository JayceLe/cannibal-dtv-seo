"use client";
import { useEffect, useRef, useState } from 'react';
import { CalendarClock, Check, FileUp } from 'lucide-react';
import { db } from '@/lib/supabase';

type Status = {
  configured: boolean; active: boolean; running: boolean; email?: string;
  period: { reportDate: string; startDate: string; endDate: string };
  lastResult?: { ok: boolean; error?: string; reportDate?: string; mappedKeywords?: number };
};
const date = (value?: string) => value ? value.split('-').reverse().join('/') : '—';

export default function GscSyncConnection({ onDone }: { onDone: (id?: string) => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const submitting = useRef(false);
  async function request(method = 'GET', body?: unknown) {
    const { data } = await db().auth.getSession();
    if (!data.session) throw new Error('Đăng nhập workspace để quản lý kết nối GSC.');
    const response = await fetch('/api/gsc/connection', {
      method, headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined, cache: 'no-store',
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Không kết nối được GSC.');
    return result;
  }
  useEffect(() => {
    mounted.current = true;
    void request().then(result => { if (mounted.current) setStatus(result); }).catch(err => { if (mounted.current) setError(err.message); });
    return () => { mounted.current = false; };
  }, []);
  async function connect(file?: File) {
    if (!file || submitting.current) return;
    submitting.current = true;
    setBusy(true); setError('');
    try {
      if (file.size > 65_536) throw new Error('Chọn file JSON tài khoản dịch vụ nhỏ hơn 64 KB.');
      let credentials: unknown;
      try { credentials = JSON.parse(await file.text()); } catch { throw new Error('File JSON không hợp lệ.'); }
      const result = await request('POST', { credentials });
      if (mounted.current) { setStatus(await request()); onDone(result.importId); }
    } catch (err) { if (mounted.current) setError(err instanceof Error ? err.message : 'Kết nối thất bại.'); }
    finally { submitting.current = false; if (mounted.current) setBusy(false); }
  }
  async function sync() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true); setError('');
    try {
      const result = await request('POST', { action: 'sync' });
      if (mounted.current) { setStatus(await request()); onDone(result.importId); }
    } catch (err) { if (mounted.current) setError(err instanceof Error ? err.message : 'Đồng bộ thất bại.'); }
    finally { submitting.current = false; if (mounted.current) setBusy(false); }
  }
  return <section className="panel gsc-connection" aria-label="Tự động cập nhật cannibal từ GSC">
    <div className="gsc-connection-title"><CalendarClock size={21} aria-hidden="true" /><h3>Tự động cập nhật GSC</h3></div>
    <p><strong>Thứ Hai · 10:00 giờ Việt Nam</strong><br />Lấy đến thứ Sáu liền trước, bắt đầu từ thứ Sáu của 4 tuần trước. Ngày báo cáo trên app là thứ Hai.</p>
    {status ? <>
      <p className="gsc-period">Kỳ {date(status.period.startDate)} → {date(status.period.endDate)}<br /><span>Ngày hiển thị: {date(status.period.reportDate)}</span></p>
      <p className={status.active ? 'gsc-connected' : 'muted'}>{status.active ? <><Check size={15} aria-hidden="true" /> Lịch đang bật</> : status.configured ? 'Đã kết nối; cần đồng bộ thành công để bật lịch.' : 'Chưa kết nối tài khoản dịch vụ GSC.'}</p>
      {status.active && status.lastResult?.ok ? <p className="muted">Lần gần nhất: {date(status.lastResult.reportDate)} · {(status.lastResult.mappedKeywords ?? 0).toLocaleString('vi-VN')} query đã map.</p> : null}
      {status.lastResult?.ok === false ? <p className="error-message" role="status">{status.lastResult.error}</p> : null}
      {status.configured ? <button type="button" className="btn secondary" disabled={busy || status.running} onClick={() => void sync()}>{status.running ? 'Đang đồng bộ trên máy chủ' : 'Đồng bộ kỳ này'}</button> : null}
      <details open={!status.configured}>
        <summary>{status.configured ? 'Thay kết nối GSC' : 'Thiết lập một lần'}</summary>
        <ol>
          <li><a href="https://console.cloud.google.com/apis/library/searchconsole.googleapis.com" target="_blank" rel="noopener noreferrer">Bật Search Console API</a> trong dự án Google Cloud của bạn.</li>
          <li><a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noopener noreferrer">Tạo tài khoản dịch vụ</a> và tải khóa JSON.</li>
          <li>Thêm email tài khoản dịch vụ vào <a href="https://search.google.com/search-console/users?resource_id=https%3A%2F%2Fdienthoaivui.com.vn%2F" target="_blank" rel="noopener noreferrer">quyền truy cập GSC của website</a>, chọn quyền <strong>Hạn chế</strong>.</li>
        </ol>
        {status.email ? <p className="gsc-account">{status.email}</p> : null}
        <input ref={input} type="file" accept=".json,application/json" hidden aria-label="File JSON tài khoản dịch vụ GSC" onChange={event => { void connect(event.target.files?.[0]); event.target.value = ''; }} />
        <button className="btn primary" type="button" disabled={busy} onClick={() => input.current?.click()}><FileUp size={16} /> Kết nối JSON & đồng bộ</button>
        <p className="muted">Khóa được mã hóa trên máy chủ. Ứng dụng chỉ yêu cầu quyền đọc Search Console.</p>
      </details>
    </> : !error ? <p role="status">Đang kiểm tra kết nối…</p> : null}
    {busy ? <p className="gsc-syncing" role="status">Đang kiểm tra và nhập toàn bộ kỳ dữ liệu. Có thể mất vài phút; giữ cửa sổ này mở để xem kết quả.</p> : null}
    {error ? <p className="error-message" role="alert">{error}</p> : null}
  </section>;
}
