import { Suspense } from 'react';
import HomeClient from './home-client';

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg)]" />}>
      <HomeClient />
    </Suspense>
  );
}
