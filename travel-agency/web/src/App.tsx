import { Navigate, Route, Routes } from 'react-router-dom';
import { SessionProvider, useSession } from './context/SessionContext';
import AppShell from './components/AppShell';
import LoginPage from './pages/LoginPage';
import TodayPage from './pages/TodayPage';
import DealsPage from './pages/DealsPage';
import DealDetailPage from './pages/DealDetailPage';
import NewDealPage from './pages/NewDealPage';
import ClientsPage from './pages/ClientsPage';
import CrmPage from './pages/CrmPage';
import ClientDetailPage from './pages/ClientDetailPage';
import BookPage from './pages/BookPage';
import MoneyPage from './pages/MoneyPage';
import SettingsPage from './pages/SettingsPage';
import QuoteEditorPage from './pages/QuoteEditorPage';
import PublicProposalPage from './pages/PublicProposalPage';
import { isTravelDemo } from './lib/demoMode';

function PrivateRoutes() {
  const { user, loading, demoSession } = useSession();
  if (loading) return <p className="p-8 text-slate-500">Loading…</p>;
  if (!user && !demoSession) return <Navigate to="/login" replace />;
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<TodayPage />} />
        <Route path="crm" element={<CrmPage />} />
        <Route path="crm/contacts/:contactId" element={<ClientDetailPage />} />
        <Route path="deals" element={<DealsPage />} />
        <Route path="deals/new" element={<NewDealPage />} />
        <Route path="deals/:dealId" element={<DealDetailPage />} />
        <Route path="deals/:dealId/quote" element={<QuoteEditorPage />} />
        <Route path="deals/:dealId/quote/:quoteId" element={<QuoteEditorPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="book" element={<BookPage />} />
        <Route path="money" element={<MoneyPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/p/:token" element={<PublicProposalPage />} />
        <Route path="/*" element={<PrivateRoutes />} />
      </Routes>
    </SessionProvider>
  );
}
