import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import AmbulanceDashboard from './components/AmbulanceDashboard';
import PoliceDashboard from './components/PoliceDashboard';
import HospitalDashboard from './components/HospitalDashboard';
import AdminDashboard from './components/AdminDashboard';
import AmbulanceMapPage from './components/AmbulanceMapPage';
import TrafficMapPage from './components/TrafficMapPage';
import HospitalMapPage from './components/HospitalMapPage';
import './App.css';

// Protected Route Component
function ProtectedRoute({ children, requiredRole }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const token = localStorage.getItem('authToken');

  if (!token || !user.id) {
    return <Navigate to="/login" />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/login" />;
  }

  return children;
}

function App() {
  useEffect(() => {
    // Check environment configuration
    console.log('API URL:', import.meta.env.VITE_API_URL || 'http://localhost:5000/api');
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/dashboard/ambulance"
          element={
            <ProtectedRoute requiredRole="ambulance">
              <AmbulanceDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/police"
          element={
            <ProtectedRoute requiredRole="police">
              <PoliceDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/hospital"
          element={
            <ProtectedRoute requiredRole="hospital">
              <HospitalDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Map Routes */}
        <Route
          path="/map/ambulance"
          element={
            <ProtectedRoute requiredRole="ambulance">
              <AmbulanceMapPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/map/traffic"
          element={
            <ProtectedRoute requiredRole="police">
              <TrafficMapPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/map/hospital"
          element={
            <ProtectedRoute requiredRole="hospital">
              <HospitalMapPage />
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;
