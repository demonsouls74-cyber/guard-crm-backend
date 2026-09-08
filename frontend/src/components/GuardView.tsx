import { useState, useEffect } from 'react';
import api from '../api';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; // Обов'язково для карти!

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
  const [myLocation, setMyLocation] = useState<{ lat: number; lon: number } | null>(null);

  // 1. ФУНКЦІЯ ОТРИМАННЯ ТРИВОГИ
  const fetchMyIncident = async () => {
    try {
      const response = await api.get('/incidents/');
      // Шукаємо активну тривогу (в ідеалі тут має бути фільтр по ID поточного охоронця)
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
    // При відкритті екрану одразу перевіряємо, чи є тривога
    fetchMyIncident();

    // ==========================================
    // 2. ПІДКЛЮЧАЄМО WEBSOCKET ("ТЕЛЕФОННИЙ ДЗВІНОК")
    // ==========================================
    //  wss:// замість https://
    const wsUrl = 'wss://guard-crm-backend-1.onrender.com/ws/incidents';
    const ws = new WebSocket(wsUrl);

    // Що робити, коли сервер щось "каже" в трубку:
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Отримано сигнал від диспетчера:", data);
      
      // Якщо сервер каже, що є нова тривога або змінився її статус — оновлюємо дані!
      if (data.type === 'NEW_INCIDENT' || data.type === 'UPDATE_INCIDENT') {
        fetchMyIncident();
      }
    };

    ws.onclose = () => console.log('Зв\'язок з диспетчерською втрачено (WebSocket закрито)');

    // ==========================================
    // 3. АВТОМАТИЧНИЙ GPS-ТРЕКЕР ЕКІПАЖУ
    // ==========================================
    let watchId: number;
    
    if ('geolocation' in navigator) {
      // watchPosition сам спрацьовує щоразу, коли планшет змінює координати
      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          setMyLocation({ lat, lon });

          try {
            // Відправляємо координати на бекенд (без відома охоронця, у фоні)
            await api.put(`/guards/location/?lat=${lat}&lon=${lon}`);
          } catch (error) {
            console.error("Не вдалося відправити локацію на сервер");
          }
        },
        (error) => console.error("Помилка GPS:", error),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
    } else {
      alert("Ваш пристрій не підтримує GPS");
    }

    // Коли охоронець закриває вкладку — кладемо трубку і вимикаємо GPS
    return () => {
      ws.close();
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // 4. КНОПКА "ПРИЙНЯТИ ВИКЛИК"
  const handleAcknowledge = async () => {
    if (!activeIncident) return;
    try {
      await api.put(`/incidents/${activeIncident.id}/`, {
        status: 'ACKNOWLEDGED'
      });
      // Щойно ми змінили статус, бекенд сам розішле WebSocket сигнал, 
      // і наш екран (та екран диспетчера) оновиться автоматично!
      fetchMyIncident(); 
    } catch (error) {
      alert('Не вдалося підтвердити виклик! Перевірте інтернет.');
    }
  };

  // ==========================================
  // ВІЗУАЛЬНА ЧАСТИНА (ІНТЕРФЕЙС ПЛАНШЕТА)
  // ==========================================

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white font-bold">Зв'язок із сервером...</div>;

  // ЕКРАН 1: РЕЖИМ ОЧІКУВАННЯ (Зелений екран)
  if (!activeIncident) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
        <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
          <div className="w-16 h-16 bg-emerald-500 rounded-full animate-pulse" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Екіпаж на чергуванні</h1>
        <p className="text-slate-400">Очікування команд від диспетчера...</p>
        
        {myLocation && (
          <p className="mt-8 text-xs text-slate-500 font-mono">
            GPS активний: {myLocation.lat.toFixed(4)}, {myLocation.lon.toFixed(4)}
          </p>
        )}
      </div>
    );
  }

  // ЕКРАН 2: ТРИВОГА! (Червоний екран, треба прийняти)
  if (activeIncident.status === 'DISPATCHED') {
    return (
      <div className="h-screen w-full flex flex-col bg-red-600 text-white p-6">
        <div className="flex-1 flex flex-col items-center justify-center text-center animate-pulse">
          <h1 className="text-6xl font-black uppercase mb-4 tracking-widest text-white drop-shadow-lg">Тривога!</h1>
          <h2 className="text-3xl font-bold mb-2">{activeIncident.object_name}</h2>
          <p className="text-xl font-medium opacity-90">{activeIncident.object_address}</p>
        </div>
        
        <button 
          onClick={handleAcknowledge}
          className="w-full bg-white text-red-700 font-black text-3xl py-10 rounded-2xl shadow-[0_10px_25px_rgba(0,0,0,0.5)] active:scale-95 transition-transform"
        >
          ПРИЙНЯТИ ВИКЛИК
        </button>
      </div>
    );
  }

  // ЕКРАН 3: У ДОРОЗІ (Карта та інструкції)
  return (
    <div className="h-screen w-full flex flex-col bg-slate-100">
      <div className="bg-slate-900 text-white p-5 rounded-b-3xl shadow-xl z-10 relative">
        <div className="flex justify-between items-center mb-3">
          <span className="bg-red-500 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest animate-pulse">
            Виїзд на об'єкт
          </span>
          <span className="text-slate-400 text-sm">Тривога #{activeIncident.id}</span>
        </div>
        <h1 className="text-2xl font-bold mb-1">{activeIncident.object_name}</h1>
        <p className="text-lg text-slate-300 mb-4">📍 {activeIncident.object_address}</p>
        
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <span className="text-xs text-slate-400 uppercase font-bold block mb-1">Інструкції для екіпажу:</span>
          <p className="text-sm font-medium text-amber-400">
            {activeIncident.object_instructions || 'Спеціальні інструкції відсутні'}
          </p>
        </div>
      </div>

      <div className="flex-1 w-full relative z-0">
        <MapContainer 
          // Фокусуємо карту на координатах екіпажу, якщо вони є, або на центрі міста
          center={myLocation ? [myLocation.lat, myLocation.lon] : [47.653, 34.088]} 
          zoom={15} 
          zoomControl={false} 
          className="h-full w-full"
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
          {/* Маркер екіпажу (синій) */}
          {myLocation && (
            <Marker position={[myLocation.lat, myLocation.lon]}>
              <Popup>Ваша позиція</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  );
}