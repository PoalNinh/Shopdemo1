import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Tables from './pages/Tables';
import Orders from './pages/Orders';
import MainLayout from './layouts/MainLayout';
import authUtils from './utils/authUtils';
import Profile from './pages/Profile';
import Users from './pages/UserManagement';
import MobilePOS from './pages/MobilePOS';
import POSSystem from './pages/POSSystem';
import MobileOrderManagement from './pages/MobileOrderManagement';
// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const location = useLocation();

  if (!authUtils.isAuthenticated()) {
    // Lưu lại đường dẫn hiện tại trước khi chuyển hướng
    localStorage.setItem('returnUrl', location.pathname + location.search);
    return <Navigate to="/" replace />;
  }
  return children;
};

function App() {
  return (
    // Không cần basename vì đã có domain
    <BrowserRouter>
      <ToastContainer position="top-right" />
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Routes>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/pos" element={<MobilePOS />} />
                  <Route path="/posPC" element={<POSSystem />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/mobileorders" element={<MobileOrderManagement />} />
                  <Route path="/tables" element={<Tables />} />
                  <Route path="/users" element={<Users />} />



                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </MainLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;