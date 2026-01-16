import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import DesignAnalysis from './pages/DesignAnalysis';
import Analytics from './pages/Analytics';
import BrandKits from './pages/BrandKits';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="reports" element={<Reports />} />
          <Route path="analysis/:id" element={<DesignAnalysis />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="brand-kits" element={<BrandKits />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
