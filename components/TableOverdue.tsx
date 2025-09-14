import React from 'react';
import { Card, CardHeader } from '@/components/Card';

type Row = { id: string; title: string; orgName?: string | null; ownerName?: string | null; planDate?: string | null; overdueDays: number; pdLink?: string | null };

export function TableOverdue({ rows }: { rows: Row[] }) {
  return (
    <Card>
      <CardHeader>Просроченные</CardHeader>
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-2 pr-4">Сделка</th>
              <th className="py-2 pr-4">Орг</th>
              <th className="py-2 pr-4">План дата</th>
              <th className="py-2 pr-4">Дней просрочки</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="py-2 pr-4">
                  {r.pdLink ? (
                    <a href={r.pdLink} target="_blank" rel="noreferrer" className="font-medium">
                      {r.title}
                    </a>
                  ) : (
                    r.title
                  )}
                </td>
                <td className="py-2 pr-4">{r.orgName || ''}</td>
                <td className="py-2 pr-4">{formatDate(r.planDate)}</td>
                <td className="py-2 pr-4">{formatDays(r.overdueDays)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function formatDate(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function formatDays(n: number) {
  return `${Math.max(0, Math.round(n))}`;
}

