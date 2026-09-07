import { useState, useEffect } from 'react';
import api from '../api';
import MapWidget from './MapWidget';
import AssignGuardModal from './AssignGuardModal';

interface SecurityObject {
  id: number;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

interface Incident {
  id: number;
  object_id: number;
  object_name: string;
  object_address?: string;       // адреса
  object_instructions?: string;  // інструкції
  client_name?: string;          // ПІБ клієнта
  client_phone?: string;         // телефон
  status: string;
  created_at: string;
}

interface User {
  id: number;
  email: string;
  role: string;
  latitude: number | null;
  longitude: number | null;
}

export default function Dashboard() {
  const [objects, setObjects] = useState<SecurityObject[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [guards, setGuards] = useState<User[]>([]);
  
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); 
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [objRes, incRes, userRes] = await Promise.all([
        api.get('/objects/'),
        api.get('/incidents/'),
        api.get('/users/')
      ]);
      setObjects(objRes.data);
      setIncidents(incRes.data);
      // Фільтруємо охоронців
      const guardList = userRes.data.filter((user: User) => user.role === 'guard');
      setGuards(guardList);
    } catch (error) {
      console.error('Помилка завантаження даних дашборду:', error);
    }
  };

  const activeIncidents = incidents.filter(inc => 
  ['PENDING', 'DISPATCHED', 'ACKNOWLEDGED'].includes(inc.status));

  const openAssignModal = (incident: Incident) => {
    setSelectedIncident(incident);
    setIsAssignModalOpen(true);
  };

  // НОВА ФУНКЦІЯ: Зміна статусу інциденту прямо з Дашборду
  const handleUpdateStatus = async (incidentId: number, newStatus: string) => {
    try {
      await api.put(`/incidents/${incidentId}/`, { status: newStatus });
      fetchData(); // Одразу оновлюємо список
    } catch (error) {
      console.error('Помилка оновлення статусу:', error);
      alert('Не вдалося оновити статус інциденту');
    }
  };

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden bg-gray-100">
      
      {/* 1. ФОН: Велика тактична мапа з об'єктами, тривогами та екіпажами */}
      <div className="absolute inset-0 z-0">
        <MapWidget objects={objects} activeIncidents={activeIncidents} guards={guards} />
      </div>

      {/* 2. ЛІВА ПАНЕЛЬ: Динамічний список екіпажів */}
      <div className="absolute top-4 left-4 bottom-4 w-80 bg-white/95 backdrop-blur shadow-lg rounded-lg border border-gray-200 flex flex-col z-10 overflow-hidden">
        <div className="p-4 bg-slate-800 text-white font-bold flex justify-between items-center">
          <span>Екіпажі (ПШР)</span>
          <span className="bg-green-500 text-xs px-2 py-1 rounded-full">{guards.length} на зв'язку</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {guards.length === 0 ? (
            <p className="text-xs text-gray-500 text-center italic">Немає зареєстрованих екіпажів (guard).</p>
          ) : (
            guards.map(guard => (
              <div key={guard.id} className="p-3 border rounded-lg bg-green-50 border-green-200">
                <div className="font-bold text-green-800">Екіпаж #{guard.id}</div>
                <div className="text-xs text-gray-600 truncate">{guard.email}</div>
                <div className="text-[11px] text-green-600 mt-1 font-mono">
                  {guard.latitude && guard.longitude 
                    ? `GPS: ${guard.latitude.toFixed(4)}, ${guard.longitude.toFixed(4)}` 
                    : 'GPS: Немає даних'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 3. ПРАВА ПАНЕЛЬ: Стек тривог */}
      <div className="absolute top-4 right-4 bottom-4 w-96 flex flex-col z-10 pointer-events-none">
        <div className="flex justify-end mb-2">
          {activeIncidents.length > 0 && (
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-4 pointer-events-auto pb-4 pr-2 custom-scrollbar">
          {activeIncidents.length === 0 ? (
            <div className="bg-white/90 backdrop-blur shadow p-4 rounded-lg border border-green-200 text-center">
              <div className="text-green-600 font-bold">Ситуація стабільна</div>
              <div className="text-sm text-gray-500">Активних тривог немає</div>
            </div>
          ) : (
            activeIncidents.map(inc => (
              <div key={inc.id} className="bg-white shadow-xl rounded-lg border-l-4 border-red-600 overflow-hidden animate-slide-in">
                <div className="p-4 bg-red-50">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="bg-red-100 text-red-800 text-xs font-extrabold px-2 py-1 rounded">
                        ТРИВОГА #{inc.id}
                      </span>
                      <h3 className="font-bold text-lg text-gray-900 mt-2">{inc.object_name}</h3>
                      <p className="text-xs text-gray-700 mt-1 font-medium flex items-start">
                        <span className="mr-1">📍</span> 
                        {inc.object_address || 'Адреса не вказана'}
                      </p>
                    </div>
                    <div className="text-xs font-mono text-gray-500">
                      {new Date(inc.created_at).toLocaleTimeString()}
                    </div>
                  </div>

                  {/* БЛОК ОПЕРАТИВНОЇ ІНФОРМАЦІЇ */}
                  <div className="bg-white/70 p-3 rounded-md border border-red-100 text-sm mb-4 space-y-2 shadow-inner">
                    {/* Контакти клієнта */}
                    {inc.client_name ? (
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 font-semibold uppercase">Власник:</span>
                        <span className="font-bold text-gray-800">{inc.client_name}</span>
                        {inc.client_phone && (
                          <a 
                            href={`tel:${inc.client_phone}`} 
                            className="text-blue-600 hover:text-blue-800 font-medium flex items-center mt-0.5"
                          >
                            📞 {inc.client_phone}
                          </a>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-400 italic text-xs">Дані клієнта відсутні</p>
                    )}
                    
                    {/* Інструкції для екіпажу */}
                    {inc.object_instructions && (
                      <div className="pt-2 border-t border-red-100/50">
                        <span className="text-xs text-orange-600 font-semibold uppercase block">⚠️ Інструкції:</span>
                        <span className="text-gray-700 text-xs">{inc.object_instructions}</span>
                      </div>
                    )}
                  </div>

                  {/* РОЗУМНІ КНОПКИ ЗАЛЕЖНО ВІД СТАТУСУ */}
                  <div className="flex space-x-2">
                    {inc.status === 'PENDING' ? (
                      <button 
                        onClick={() => openAssignModal(inc)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-2 px-4 rounded transition shadow-sm"
                      >
                        Призначити екіпаж
                      </button>
                    ) : (
                      <>
                        <button 
                          onClick={() => handleUpdateStatus(inc.id, 'RESOLVED')}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2 px-3 rounded transition shadow-sm"
                        >
                          ✅ Вирішено
                        </button>
                        <button 
                          onClick={() => handleUpdateStatus(inc.id, 'FALSE_ALARM')}
                          className="flex-1 bg-gray-500 hover:bg-gray-600 text-white text-sm font-bold py-2 px-3 rounded transition shadow-sm"
                        >
                          ❌ Хибна
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AssignGuardModal 
        isOpen={isAssignModalOpen}
        incidentId={selectedIncident?.id ?? null}
        objectName={selectedIncident?.object_name ?? ''}
        onClose={() => setIsAssignModalOpen(false)}
        onSuccess={fetchData}
      />

    </div>
  );
}