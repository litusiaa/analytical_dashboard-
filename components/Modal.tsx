"use client";
import React from 'react';

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev || 'auto'; };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-xl bg-white shadow-xl max-h-[80vh] flex flex-col">
        <header className="px-4 py-3 border-b">
          <h3 className="text-lg font-medium">{title}</h3>
        </header>
        <div className="px-4 py-3 overflow-auto grow [@supports(-webkit-touch-callout:none)]:[webkit-overflow-scrolling:touch]">
          {children}
        </div>
        <footer className="px-4 py-3 border-t bg-white sticky bottom-0">
          <div className="flex gap-2 justify-end">
            {/* Управляющие кнопки передаём из children как форма; оставляем контейнер */}
          </div>
        </footer>
      </div>
    </div>
  );
}

