import Link from 'next/link';
import './globals.css';
import { Card, CardContent, CardTitle } from '@/components/Card';

export default function HomePage() {
  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">BI Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardTitle>PM</CardTitle>
          <CardContent className="mt-2">
            <Link href="/pm" className="inline-block bg-blue-600 text-white px-4 py-2 rounded">Перейти</Link>
          </CardContent>
        </Card>
        <Card>
          <CardTitle>DS</CardTitle>
          <CardContent className="mt-2">
            <Link href="/dashboards/ds" className="inline-block bg-blue-600 text-white px-4 py-2 rounded">Перейти</Link>
          </CardContent>
        </Card>
        <Card>
          <CardTitle>CSM</CardTitle>
          <CardContent className="mt-2">
            <Link href="/dashboards/csm" className="inline-block bg-blue-600 text-white px-4 py-2 rounded">Перейти</Link>
          </CardContent>
        </Card>
        <Card>
          <CardTitle>Finance</CardTitle>
          <CardContent className="mt-2">
            <Link href="/dashboards/finance" className="inline-block bg-blue-600 text-white px-4 py-2 rounded">Перейти</Link>
          </CardContent>
        </Card>
        <Card>
          <CardTitle>Partner</CardTitle>
          <CardContent className="mt-2">
            <Link href="/dashboards/partner" className="inline-block bg-blue-600 text-white px-4 py-2 rounded">Перейти</Link>
          </CardContent>
        </Card>
        <Card>
          <CardTitle>Sales</CardTitle>
          <CardContent className="mt-2">
            <Link href="/dashboards/sales" className="inline-block bg-blue-600 text-white px-4 py-2 rounded">Перейти</Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

