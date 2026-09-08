import { Navigate, Outlet } from 'react-router-dom';

interface ProtectedRouteProps {
  allowedRoles: string[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  // 1. Якщо немає токена або ролі взагалі — викидаємо на сторінку входу
  if (!token || !role) {
    return <Navigate to="/login" replace />;
  }

  // 2. Якщо роль користувача НЕ входить у список дозволених для цього маршруту
  if (!allowedRoles.includes(role)) {
    // ЖОРСТКИЙ КОНТРОЛЬ: Якщо це охоронець, він ЗАВЖДИ має сидіти на /guard
    if (role === 'guard') {
      return <Navigate to="/guard" replace />;
    }
    // Якщо це адмін/диспетчер, який заблукав — повертаємо на головну
    return <Navigate to="/" replace />;
  }

  // 3. Якщо все добре, дозволяємо перегляд компонента
  return <Outlet />;
}