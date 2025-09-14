import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/Card';

type KPIProps = { label: string; value: string; sub?: string };

export function KPI({ label, value, sub }: KPIProps) {
  return (
    <Card>
      <CardHeader>{label}</CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{value}</div>
        {sub ? <div className="text-sm text-gray-500 mt-1">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}

