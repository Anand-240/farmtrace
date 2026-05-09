import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Register from './pages/Register';
import Transfer from './pages/Transfer';
import Payment from './pages/Payment';
import Transactions from './pages/Transactions';
import AIAssistant from './pages/AIAssistant';
import Verify from './pages/Verify';
import Profile from './pages/Profile';
import ChangePassword from './pages/ChangePassword';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import { LanguageProvider } from './lib/language';
import { NotificationProvider } from './context/NotificationContext';
import LotOperations from './pages/LotOperations';
import DispatchLogistics from './pages/DispatchLogistics';
import Escrow from './pages/Escrow';
import Marketplace from './pages/Marketplace';
import KycVerification from './pages/KycVerification';
import AdminKyc from './pages/AdminKyc';
import CropDisease from './pages/CropDisease';
import MandiPrices from './pages/MandiPrices';
import AuctionPage from './pages/Auction';
import QualityGrading from './pages/QualityGrading';
import WarehousePage from './pages/Warehouse';
import Finance from './pages/Finance';
import DisputeResolution from './pages/DisputeResolution';
import MarketAdvisory from './pages/MarketAdvisory';
import BuyerRatings from './pages/BuyerRatings';
import GovtSchemes from './pages/GovtSchemes';
import GSTInvoice from './pages/GSTInvoice';
import { Toaster } from 'react-hot-toast';
import { SentryErrorBoundary } from './lib/sentry';
import { identifyUser } from './lib/posthog';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
}

function App() {
  const storedUser = (() => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } })();
  if (storedUser?.id) identifyUser(storedUser.id, { name: storedUser.name, role: storedUser.role });

  return (
    <SentryErrorBoundary fallback={<div style={{padding:'2rem',textAlign:'center'}}><h2>Something went wrong.</h2><p>Our team has been notified. Please refresh the page.</p></div>}>
    <LanguageProvider>
      <NotificationProvider>
        <Toaster position="top-center" />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/verify/:id" element={<Verify />} />
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
            <Route path="/change-password" element={<PrivateRoute><ChangePassword /></PrivateRoute>} />
            <Route path="/lot-ops" element={<PrivateRoute><LotOperations /></PrivateRoute>} />
            <Route path="/register-produce" element={<PrivateRoute><Register /></PrivateRoute>} />
            <Route path="/transfer" element={<PrivateRoute><Transfer /></PrivateRoute>} />
            <Route path="/payment" element={<PrivateRoute><Payment /></PrivateRoute>} />
            <Route path="/transactions" element={<PrivateRoute><Transactions /></PrivateRoute>} />
            <Route path="/dispatch-logistics" element={<PrivateRoute><DispatchLogistics /></PrivateRoute>} />
            <Route path="/escrow" element={<PrivateRoute><Escrow /></PrivateRoute>} />
            <Route path="/marketplace" element={<PrivateRoute><Marketplace /></PrivateRoute>} />
            <Route path="/kyc" element={<PrivateRoute><KycVerification /></PrivateRoute>} />
            <Route path="/ai" element={<PrivateRoute><AIAssistant /></PrivateRoute>} />
            <Route path="/crop-disease" element={<PrivateRoute><CropDisease /></PrivateRoute>} />

            {/* eNAM-inspired new features */}
            <Route path="/mandi-prices" element={<PrivateRoute><MandiPrices /></PrivateRoute>} />
            <Route path="/auction" element={<PrivateRoute><AuctionPage /></PrivateRoute>} />
            <Route path="/quality-grading" element={<PrivateRoute><QualityGrading /></PrivateRoute>} />
            <Route path="/warehouse" element={<PrivateRoute><WarehousePage /></PrivateRoute>} />
            <Route path="/finance" element={<PrivateRoute><Finance /></PrivateRoute>} />
            <Route path="/dispute" element={<PrivateRoute><DisputeResolution /></PrivateRoute>} />
            <Route path="/market-advisory" element={<PrivateRoute><MarketAdvisory /></PrivateRoute>} />
            <Route path="/buyer-ratings" element={<PrivateRoute><BuyerRatings /></PrivateRoute>} />
            <Route path="/govt-schemes" element={<PrivateRoute><GovtSchemes /></PrivateRoute>} />
            <Route path="/gst-invoice" element={<PrivateRoute><GSTInvoice /></PrivateRoute>} />

            <Route path="/admin" element={<AdminKyc />} />
            <Route path="/" element={<Navigate to="/dashboard" />} />
          </Routes>
        </BrowserRouter>
      </NotificationProvider>
    </LanguageProvider>
    </SentryErrorBoundary>
  );
}

export default App;
