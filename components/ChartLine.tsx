"use client";
import React from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { Card, CardHeader } from '@/components/Card';

type Point = { month: string; launchPct: number };

export function ChartLine({ data }: { data: Point[] }) {
  return (
    <Card>
      <CardHeader>Тренд Launch %</CardHeader>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'Launch %']} />
            <Line type="monotone" dataKey="launchPct" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

