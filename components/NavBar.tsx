"use client";
import Link from 'next/link';

export function NavBar({ title }: { title?: string }) {
  return (
    <div className="sticky top-0 z-10 bg-white/70 backdrop-blur border-b">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3">
        <Link href="/" className="text-sm text-blue-600 hover:underline">← На главную</Link>
        {title ? <div className="text-sm text-gray-500">/ {title}</div> : null}
      </div>
    </div>
  );
}

