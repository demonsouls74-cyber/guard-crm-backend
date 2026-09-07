import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const menuItems = [
    { path: '/', label: '🚨 Дашборд (Інциденти)' },
    { path: '/objects', label: '🛡️ Об’єкти охорони' },
    { path: '/audit', label: '📋 Журнал аудиту (Admin only)' },
    { path: '/clients', label: 'Клієнти' },
    { path: '/accounting', label: 'Бухгалтерія' },
    { path: '/personnel', label: 'Персонал' },
  ];

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Бокова панель (Sidebar) */}
      <div className="w-64 bg-gray-800 text-white flex flex-col shadow-xl">
        <div className="p-6 bg-gray-800 border-b border-slate-800">
          <h1 className="text-xl font-bold text-blue-400 tracking-wider">CRM DISPATCH</h1>
          <p className="text-xs text-slate-400 mt-1">v1.0 Security System</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`block px-4 py-3 rounded-lg transition-colors ${
                location.pathname === item.path
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={handleLogout}
            className="w-full bg-slate-800 hover:bg-red-500 text-slate-300 hover:text-white px-4 py-2 rounded transition-colors"
          >
            🚪 Вийти з системи
          </button>
        </div>
      </div>

      {/* Основний контент сторінки */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}