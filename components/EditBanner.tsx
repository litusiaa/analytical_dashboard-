"use client";
import React, { useEffect, useState } from 'react';

export function EditBanner() {
  const [ttl, setTtl] = useState<number | null>(null);
  useEffect(() => {
    // naive countdown based on cookie max-age is not accessible; simple 60-min default client timer
    let remaining = (Number(process.env.NEXT_PUBLIC_EDIT_TTL_MIN || '60') || 60) * 60;
    setTtl(remaining);
    const id = setInterval(() => {
      remaining -= 1; if (remaining < 0) remaining = 0; setTtl(remaining);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const mins = ttl !== null ? Math.floor(ttl / 60) : 60;
  const secs = ttl !== null ? ttl % 60 : 0;

  async function exit() {
    await fetch('/api/edit/exit', { method: 'POST' });
    location.reload();
  }

  async function extend() {
    const code = prompt('Введите код для продления');
    if (!code) return;
    const res = await fetch('/api/edit/enter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
    if (res.ok) location.reload();
    else alert('Неверный код. Повторите ввод.');
  }

  return (
    <div className="sticky top-0 z-20 bg-yellow-100 text-yellow-900 text-sm px-4 py-2 flex items-center justify-between shadow">
      <div className="flex items-center gap-2"><span className="inline-flex items-center px-2 py-0.5 text-xs bg-purple-200 text-purple-900 rounded">Editing</span><span>Изменения сохраняются как черновик</span> <span className="text-xs text-gray-700">(осталось {String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')})</span></div>
      <div className="flex gap-2">
        <button className="underline" onClick={async () => {
          try {
            const payload = (() => {
              try { const w: any = (window as any); if (w && w.__currentLayout && w.__currentSlug) { return { slug: String(w.__currentSlug), widgets: Object.entries(w.__currentLayout).map(([id, r]: any)=> ({ id: Number(id), ...r })) }; } } catch {}
              return null;
            })();
            if (payload && payload.slug) {
              await fetch(`/api/dashboards/${payload.slug}/layout/draft`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ widgets: payload.widgets }), credentials: 'include' });
            }
          } catch {}
          await fetch(location.pathname.replace(/\/$/, '') + '/draft', { method: 'POST', credentials: 'include' }); location.reload();
        }}>Сохранить как черновик</button>
        <button className="underline" onClick={async () => { await fetch(location.pathname.replace(/\/$/, '') + '/publish', { method: 'POST', credentials: 'include' }); location.reload(); }}>Опубликовать</button>
        <button className="underline" onClick={async () => { await fetch(location.pathname.replace(/\/$/, '') + '/discard', { method: 'POST', credentials: 'include' }); location.reload(); }}>Отменить изменения</button>
        <button className="underline" onClick={extend}>Продлить</button>
        <button className="underline" onClick={exit}>Выйти</button>
      </div>
    </div>
  );
}

