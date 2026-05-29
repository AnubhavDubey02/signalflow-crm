import React from 'react';
import { createRoot } from 'react-dom/client';
import Sidebar from './components/Sidebar';

console.log("SignalFlow Content Script Executing...");

function init() {
  if (document.getElementById('signalflow-root')) {
    return;
  }
  
  console.log("SignalFlow Loaded");

  const rootEl = document.createElement('div');
  rootEl.id = 'signalflow-root';
  
  const shadow = rootEl.attachShadow({ mode: 'open' });

  const mountPoint = document.createElement('div');
  shadow.appendChild(mountPoint);
  
  document.body.appendChild(rootEl);

  try {
    const root = createRoot(mountPoint);
    root.render(<Sidebar />);
  } catch (error) {
    console.error("SignalFlow React Mount Failed:", error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
