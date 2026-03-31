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
import LotOperations from './pages/LotOperations';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/verify/:id" element={<Verify />} />
          <Route path="/dashboard" element={
            <PrivateRoute><Dashboard /></PrivateRoute>
          } />
          <Route path="/profile" element={
            <PrivateRoute><Profile /></PrivateRoute>
          } />
          <Route path="/change-password" element={
            <PrivateRoute><ChangePassword /></PrivateRoute>
          } />
          <Route path="/lot-ops" element={
            <PrivateRoute><LotOperations /></PrivateRoute>
          } />
          <Route path="/register-produce" element={
            <PrivateRoute><Register /></PrivateRoute>
          } />
          <Route path="/transfer" element={
            <PrivateRoute><Transfer /></PrivateRoute>
          } />
          <Route path="/payment" element={
            <PrivateRoute><Payment /></PrivateRoute>
          } />
          <Route path="/transactions" element={
            <PrivateRoute><Transactions /></PrivateRoute>
          } />
          <Route path="/ai" element={
            <PrivateRoute><AIAssistant /></PrivateRoute>
          } />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}

export default App;
