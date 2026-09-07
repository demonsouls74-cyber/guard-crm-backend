import { useState, useEffect } from 'react';
import api from '../api';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

// Типізація згідно з нашими схемами
interface Incident {
  id: number;
  object_id: number;
  object_name: string;
  object_address: string;
  object_instructions: string | null;
  client_name: string | null;
  client_phone: string | null;
  status: string;
  guard_id: number | null;
}

export default function GuardView() {
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);

  // Завантажуємо поточну тривогу екіпажу
  const fetchMyIncident = async () => {
    try {
      const response = await api.get('/incidents/');
      
      // Для тестування беремо першу тривогу, яка має статус DISPATCHED (відправлена екіпажу)
      // В реальності тут буде фільтрація по guard_id поточного юзера
      const current = response.data.find(
        (inc: Incident) => inc.status === 'DISPATCHED' || inc.status === 'ACKNOWLEDGED'
      );
      
      setActiveIncident(current || null);
    } catch (error) {
      console.error('Помилка завантаження тривог:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyIncident();

    // ==========================================
    // ПІДКЛЮЧЕННЯ WEBSOCKET ДЛЯ МИТТЄВИХ ТРИВОГ
    // ==========================================
    // Використовуємо поточний хост (щоб працювало і на localhost, і через IP)
    const wsUrl = `ws://${window.location.hostname}:8000/ws/incidents`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("WebSocket сигнал:", data);
      
      // Якщо диспетчер призначив тривогу (UPDATE_INCIDENT + DISPATCHED)
      // Або надійшла нова тривога, миттєво оновлюємо екран
      if (data.type === 'NEW_INCIDENT' || data.type === 'UPDATE_INCIDENT') {
        fetchMyIncident();
      }
    };

    ws.onclose = () => console.log('WebSocket відключено');

    return () => {
      ws.close();
    };
  }, []);

  // Обробник прийняття виклику охоронцем
  const handleAcknowledge = async () => {
    if (!activeIncident) return;
    try {
      await api.put(`/incidents/${activeIncident.id}/`, {
        status: 'ACKNOWLEDGED'
      });
      // WebSocket сам відправить сигнал диспетчеру, і наш екран теж оновиться
      fetchMyIncident(); 
    } catch (error) {
      console.error('Помилка прийняття виклику:', error);
      alert('Не вдалося підтвердити виклик!');
    }
  };

  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-slate-900 text-white">Завантаження...</div>;
  }

  // ЕКРАН 1: РЕЖИМ ОЧІКУВАННЯ (Немає тривог)
  if (!activeIncident) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
        <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
          <div className="w-16 h-16 bg-emerald-500 rounded-full animate-pulse" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Екіпаж на чергуванні</h1>
        <p className="text-slate-400">Очікування команд від диспетчера...</p>
      </div>
    );
  }

  // ЕКРАН 2: ТРИВОГА! (Диспетчер призначив виклик, статус DISPATCHED)
  if (activeIncident.status === 'DISPATCHED') {
    return (
      <div className="h-screen w-full flex flex-col bg-red-600 text-white animate-pulse-fast p-6">
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <h1 className="text-6xl font-black uppercase mb-4 tracking-widest text-white drop-shadow-lg">Тривога!</h1>
          <h2 className="text-3xl font-bold mb-2">{activeIncident.object_name}</h2>
          <p className="text-xl font-medium opacity-90">{activeIncident.object_address}</p>
        </div>
        
        <button 
          onClick={handleAcknowledge}
          className="w-full bg-white text-red-700 font-black text-3xl py-8 rounded-2xl shadow-[0_10px_25px_rgba(0,0,0,0.5)] active:scale-95 transition-transform"
        >
          ПРИЙНЯТИ ВИКЛИК
        </button>
      </div>
    );
  }

  // ЕКРАН 3: У ДОРОЗІ (Статус ACKNOWLEDGED, екіпаж підтвердив виклик)
  return (
    <div className="h-screen w-full flex flex-col bg-slate-100">
      {/* Інформаційна панель */}
      <div className="bg-slate-900 text-white p-5 rounded-b-3xl shadow-xl z-10 relative">
        <div className="flex justify-between items-center mb-3">
          <span className="bg-red-500 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest animate-pulse">
            Виїзд на об'єкт
          </span>
          <span className="text-slate-400 text-sm">#{activeIncident.object_id}</span>
        </div>
        <h1 className="text-2xl font-bold mb-1">{activeIncident.object_name}</h1>
        <p className="text-lg text-slate-300 mb-4">📍 {activeIncident.object_address}</p>
        
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <span className="text-xs text-slate-400 uppercase font-bold block mb-1">Інструкції:</span>
          <p className="text-sm font-medium text-amber-400">
            {activeIncident.object_instructions || 'Спеціальні інструкції відсутні'}
          </p>
        </div>
      </div>

      {/* Карта (Займає весь залишок екрану) */}
      <div className="flex-1 w-full relative z-0">
        <MapContainer center={[47.653, 34.088]} zoom={15} zoomControl={false} className="h-full w-full">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {/* Тут згодом будемо малювати маркер об'єкта та маркер авто */}
        </MapContainer>
      </div>
    </div>
  );
}