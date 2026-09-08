import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AuditLog from './components/AuditLog';
import Layout from './components/Layout';
import SecurityObjects from './components/SecurityObjects';
import type { JSX } from 'react/jsx-runtime';
import Clients from './components/Clients';
import Accounting from './components/Accounting';
import Personnel from './components/Personnel';
import GuardView from './components/GuardView';
import ProtectedRoute from './components/ProtectedRoute';


const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const token = localStorage.getItem('token');
  return token ? <Layout>{children}</Layout> : <Navigate to="/login" />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Відкритий маршрут для входу */}
        <Route path="/login" element={<Login />} />


        {/* МАРШРУТИ ТІЛЬКИ ДЛЯ ОХОРОНИ (ЕКІПАЖУ)        */}
        <Route element={<ProtectedRoute allowedRoles={['guard']} />}>
          <Route path="/guard" element={<GuardView />} />
        </Route>

        {/* МАРШРУТИ ДЛЯ АДМІНІВ ТА ДИСПЕТЧЕРІВ */}
        <Route element={<ProtectedRoute allowedRoles={['admin', 'dispatcher']} />}>
          <Route path="/clients" element={<PrivateRoute><Clients /></PrivateRoute>} />
          <Route path="/objects" element={<PrivateRoute><SecurityObjects /></PrivateRoute>} />
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/audit" element={<PrivateRoute><AuditLog /></PrivateRoute>} />
          <Route path="/accounting" element={<PrivateRoute><Accounting /></PrivateRoute>} />
          <Route path="/personnel" element={<PrivateRoute><Personnel /></PrivateRoute>} />
        </Route>
        {/* МАРШРУТИ ТІЛЬКИ ДЛЯ КЛІЄНТІВ */}
        <Route element={<ProtectedRoute allowedRoles={['client']} />}>
          <Route path="/client" element={<ClientDashboard />} />
        </Route>
        
        {/* Якщо адреса не знайдена, кидаємо на корінь, а там ProtectedRoute сам розбереться */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}


export default App;