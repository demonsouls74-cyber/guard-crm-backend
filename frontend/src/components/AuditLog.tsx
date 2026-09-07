import { useState, useEffect } from 'react';
import api from '../api';

interface AuditRecord {
  id: number;
  user_id: number;
  user_email: string;
  action: string;
  entity_type: string;
  entity_id: number;
  details: string;
  timestamp: string;
}

interface IncidentDetail {
  id: number;
  object_id: number;
  object_name: string;          // Додали назву об'єкта
  dispatcher_id: number | null;
  dispatcher_email: string | null; // Додали пошту диспетчера
  guard_id: number | null;
  guard_email: string | null;     // Додали пошту охоронця
  status: string;
  created_at: string;
}

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Стани для модального вікна деталей інциденту
  const [selectedIncident, setSelectedIncident] = useState<IncidentDetail | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await api.get('/audit-logs/');
      setLogs(response.data);
    } catch (error) {
      console.error('Помилка завантаження логів:', error);
    } finally {
      setLoading(false);
    }
  };

  // Функція для відкриття деталей інциденту при кліку
  const handleIncidentClick = async (entityType: string, entityId: number) => {
    if (entityType !== 'incident') return; // Поки що робимо клікабельними саме інциденти
    
    try {
      // Оскільки у нас поки немає ендпоінта GET /incidents/{id}, ми беремо список і шукаємо потрібний
      const response = await api.get('/incidents/');
      const incident = response.data.find((inc: IncidentDetail) => inc.id === entityId);
      
      if (incident) {
        setSelectedIncident(incident);
        setIsModalOpen(true);
      } else {
        alert(`Інцидент #${entityId} не знайдено або він був видалений.`);
      }
    } catch (error) {
      console.error('Помилка завантаження деталей інциденту:', error);
    }
  };

  return (
    <div className="p-8 relative">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Журнал аудиту</h1>
          <p className="text-sm text-gray-500 mt-1">Повний контроль і хронологія дій персоналу в системі</p>
        </div>
        <button onClick={fetchLogs} className="bg-white text-gray-700 px-4 py-2 rounded border border-gray-300 hover:bg-gray-50 transition shadow-sm font-medium">
          ↻ Оновити
        </button>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Завантаження журналу...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Журнал поки що порожній.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Час події</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Співробітник</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Об'єкт / Сутність</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Опис події (Деталі)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">#{log.id}</td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {new Date(log.timestamp).toLocaleString('uk-UA')}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md font-medium border border-blue-100">
                      {log.user_email}
                    </span>
                  </td>

                  {/* КЛІКАБЕЛЬНИЙ ЕЛЕМЕНТ */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                    {log.entity_type === 'incident' ? (
                      <button 
                        onClick={() => handleIncidentClick(log.entity_type, log.entity_id)}
                        className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        🔗 Інцидент #{log.entity_id}
                      </button>
                    ) : (
                      <span className="text-slate-700">{log.entity_type} #{log.entity_id}</span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* МОДАЛЬНЕ ВІКНО ДЕТАЛЕЙ ІНЦИДЕНТУ */}
      {isModalOpen && selectedIncident && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative animate-fadeIn">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-lg font-bold text-gray-800">Картка інциденту #{selectedIncident.id}</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-xl"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex justify-between bg-gray-50 p-2.5 rounded">
                <span className="font-semibold text-gray-700">Статус:</span>
                <span className="font-bold text-blue-600">{selectedIncident.status}</span>
              </div>
              <div className="flex justify-between bg-gray-50 p-2.5 rounded">
                <span className="font-semibold text-gray-700">Цільовий об'єкт:</span>
                <span className="font-medium text-gray-900">{selectedIncident.object_name}</span>
              </div>
              <div className="flex justify-between bg-gray-50 p-2.5 rounded">
                <span className="font-semibold text-gray-700">Диспетчер:</span>
                <span className="text-blue-600 font-medium">{selectedIncident.dispatcher_email || 'Не призначено'}</span>
              </div>
              <div className="flex justify-between bg-gray-50 p-2.5 rounded">
                <span className="font-semibold text-gray-700">Призначений екіпаж:</span>
                <span className="text-blue-600 font-medium">{selectedIncident.guard_email || 'Не призначено'}</span>
              </div>
              <div className="flex justify-between bg-gray-50 p-2.5 rounded">
                <span className="font-semibold text-gray-700">Час створення:</span>
                <span>{new Date(selectedIncident.created_at).toLocaleString('uk-UA')}</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsModalOpen(false)}
                className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 transition text-sm font-medium"
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}