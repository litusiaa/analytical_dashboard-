"use client";
import Link from 'next/link';
import React from 'react';

async function toggleEdit(active: boolean) {
  if (active) {
    await fetch('/api/edit/exit', { method: 'POST' });
  } else {
    await fetch('/api/edit/enter', { method: 'POST' });
  }
  location.reload();
}

function hasEdit(): boolean {
  return /(?:^|;\s*)edit_mode=1(?:;|$)/.test(document.cookie);
}

export function NavBar({ title }: { title?: string }) {
  return (
    <div className="sticky top-0 z-10 bg-white/70 backdrop-blur border-b">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3">
        <Link href="/" className="text-sm text-blue-600 hover:underline px-2 py-1 rounded hover:bg-blue-50">← Все дашборды</Link>
        {title ? <div className="text-sm text-gray-500">/ {title}</div> : null}
        <div className="ml-auto">
          <button className="text-sm text-blue-600 underline px-2 py-1" onClick={() => toggleEdit(hasEdit())}>{hasEdit() ? 'Done' : 'Edit dashboard'}</button>
        </div>
      </div>
    </div>
  );
}

