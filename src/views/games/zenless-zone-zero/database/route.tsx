import { lazy, Suspense } from 'react';

const Database = lazy(() => import('./index'));

export default function DatabaseRoute() {
  return <Suspense fallback={<div role="status" style={{ color: 'white' }}>กำลังโหลดฐานข้อมูล…</div>}><Database /></Suspense>;
}
