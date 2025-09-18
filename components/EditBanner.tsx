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
    <div className="bg-yellow-100 text-yellow-900 text-sm px-4 py-2 flex items-center justify-between">
      <div><strong>EDIT MODE — active</strong> (expires in {String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')})</div>
      <div className="flex gap-2">
        <button className="underline" onClick={() => location.reload()}>Save draft</button>
        <button className="underline" onClick={() => alert('Publish: будет реализовано в следующей итерации')}>Publish</button>
        <button className="underline" onClick={extend}>Продлить</button>
        <button className="underline" onClick={exit}>Exit edit mode</button>
      </div>
    </div>
  );
}

