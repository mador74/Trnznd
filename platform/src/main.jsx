import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { StoreProvider } from './state/store.jsx';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Connections from './pages/Connections.jsx';
import ConnectionDetail from './pages/ConnectionDetail.jsx';
import Transactions from './pages/Transactions.jsx';
import Approvals from './pages/Approvals.jsx';
import Team from './pages/Team.jsx';
import Audit from './pages/Audit.jsx';
import Settings from './pages/Settings.jsx';
import Invoices from './pages/Invoices.jsx';
import Send from './pages/Send.jsx';
import Convert from './pages/Convert.jsx';
import Fund from './pages/Fund.jsx';
import Terms from './pages/Terms.jsx';
import './styles.css';

// HashRouter so the static build works on GitHub Pages without server rewrites.
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StoreProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="connections" element={<Connections />} />
            <Route path="connections/:id" element={<ConnectionDetail />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="send" element={<Send />} />
            <Route path="convert" element={<Convert />} />
            <Route path="fund" element={<Fund />} />
            <Route path="terms" element={<Terms />} />
            <Route path="approvals" element={<Approvals />} />
            <Route path="team" element={<Team />} />
            <Route path="audit" element={<Audit />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<p>Page not found.</p>} />
          </Route>
        </Routes>
      </HashRouter>
    </StoreProvider>
  </React.StrictMode>,
);
