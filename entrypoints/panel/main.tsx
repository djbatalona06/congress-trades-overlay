// Shared styles first: the window's own style.css must come last so its ".trades { max-height: none }" wins.
import '@/components/trades.css';
import '@/components/graphs.css';
import './style.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Panel } from './Panel';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Panel />
  </StrictMode>,
);
