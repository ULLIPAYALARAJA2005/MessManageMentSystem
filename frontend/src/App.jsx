import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { socket } from './socket';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Landing from './pages/Landing';
import AdminDashboard from './pages/AdminDashboard';
import StudentDashboard from './pages/StudentDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import StoreManagerDashboard from './pages/StoreManagerDashboard';
import PageWrapper from './components/PageWrapper';
import './index.css';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  if (!token) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={`/${role.toLowerCase()}`} replace />;
  }
  return children;
};

function App() {
  useEffect(() => {
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <Router>
      <Toaster position="top-right" />
      <PageWrapper>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/admin/*" element={<ProtectedRoute allowedRoles={['Admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/student/*" element={<ProtectedRoute allowedRoles={['Student']}><StudentDashboard /></ProtectedRoute>} />
          <Route path="/employee/*" element={<ProtectedRoute allowedRoles={['Employee']}><EmployeeDashboard /></ProtectedRoute>} />
          <Route path="/storemanager/*" element={<ProtectedRoute allowedRoles={['StoreManager']}><StoreManagerDashboard /></ProtectedRoute>} />
        </Routes>
      </PageWrapper>
    </Router>
  );
}

export default App;
