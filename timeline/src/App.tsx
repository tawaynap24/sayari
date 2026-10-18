import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Timeline from './views/timeline';

export default function App() {
  return <BrowserRouter><div className="timeline-shell"><Routes>
    <Route path="/" element={<Navigate to="/timeline" replace />} />
    <Route path="/timeline/*" element={<Timeline />} />
    <Route path="*" element={<p>ไม่พบหน้านี้ <a href="/timeline">กลับ Timeline</a></p>} />
  </Routes></div></BrowserRouter>;
}
