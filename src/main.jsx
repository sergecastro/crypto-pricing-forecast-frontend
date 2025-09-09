import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app'; // Capital 'A', no extra dots or paths
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);