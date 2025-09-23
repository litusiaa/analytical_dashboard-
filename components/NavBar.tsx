"use client";
import Link from 'next/link';
import React from 'react';

import { useEffect, useState } from 'react';

async function toggleEdit(active: boolean) {
  if (active) {
    await fetch('/api/edit/exit', { method: 'POST', credentials: 'include' });
  } else {
    await fetch('/api/edit/enter', { method: 'POST', credentials: 'include' });
  }
  location.reload();
}

export function NavBar({ title, initialActive = false }: { title?: string; initialActive?: boolean }) {
  return (
    <div className={`sticky top-0 z-10 border-b ${initialActive ? 'bg-gray-100' : 'bg-white/70 backdrop-blur'}`}>
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3">
        <Link href="/" className="text-sm text-blue-600 hover:underline px-2 py-1 rounded hover:bg-blue-50">← Все дашборды</Link>
        {title ? <div className="text-sm text-gray-500">/ {title}</div> : null}
        <EditToggle initialActive={initialActive} />
      </div>
    </div>
  );
}

function EditToggle({ initialActive = false }: { initialActive?: boolean }) {
  const [active, setActive] = useState(initialActive);
  useEffect(() => {
    setActive(/(?:^|;\s*)edit_mode=1(?:;|$)/.test(document.cookie));
  }, []);
  return (
    <div className="ml-auto flex items-center gap-3">
      {active ? <span className="inline-flex items-center px-2 py-1 text-xs bg-yellow-200 text-yellow-900 rounded">Editing</span> : null}
      <button className="text-sm text-blue-600 underline px-2 py-1" onClick={() => toggleEdit(active)}>{active ? 'Done' : 'Edit dashboard'}</button>
    </div>
  );
}

