// index.jsx - React 진입점
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// React 18의 createRoot API 사용
const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

console.log('React 앱이 성공적으로 마운트되었습니다.');
