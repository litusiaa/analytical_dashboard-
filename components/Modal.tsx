"use client";
import React from 'react';

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded shadow-lg w-full max-w-lg p-4">
        <div className="text-lg font-semibold mb-2">{title}</div>
        {children}
      </div>
    </div>
  );
}

