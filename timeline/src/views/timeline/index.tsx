import { lazy, Suspense } from 'react';

const TimelineApp = lazy(() => import('../../features/timeline/TimelineApp'));

export default function Timeline() {
  return (
    <Suspense fallback={<div role="status" style={{ color: 'white' }}>กำลังโหลด Timeline…</div>}>
      <TimelineApp />
    </Suspense>
  );
}
