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


const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const token = localStorage.getItem('token');
  return token ? <Layout>{children}</Layout> : <Navigate to="/login" />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/clients" element={<PrivateRoute><Clients /></PrivateRoute>} />
        <Route path="/objects" element={<PrivateRoute><SecurityObjects /></PrivateRoute>} />
        <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/audit" element={<PrivateRoute><AuditLog /></PrivateRoute>} />
        <Route path="/accounting" element={<PrivateRoute><Accounting /></PrivateRoute>} />
        <Route path="/personnel" element={<PrivateRoute><Personnel /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  );
}


export default App;