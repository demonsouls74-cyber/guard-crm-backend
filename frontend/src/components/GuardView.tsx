import { useState, useEffect, useRef } from 'react';
import api from '../api';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

interface Incident {
  id: number;
  object_name: string;
  object_address: string;
  object_latitude: number | null;
  object_longitude: number | null;
  object_instructions: string | null;
  status: string;
}

interface SecurityObject {
  id: number;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

// Кастомна іконка для машини екіпажу (яскраво-синій круг із машиною або чіткий бідж)
const carIcon = L.divIcon({
  className: 'custom-car-marker',
  html: `<div style="background-color: #4dff29; width: 24px; height: 24px; border: 3px solid white; border-radius: 50%; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold;">🚗</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Кастомна іконка для звичайних об'єктів охорони
const objectIcon = L.divIcon({
  className: 'custom-object-marker',
  html: `<div style="background-color: #6aa8ff; width: 18px; height: 18px; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export default function GuardView() {
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [allObjects, setAllObjects] = useState<SecurityObject[]>([]);
  const [myLocation, setMyLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);

  // 1. Завантаження активної тривоги
  const fetchMyIncident = async () => {
    try {
      const response = await api.get('/incidents/');
      const current = response.data.find(
        (inc: Incident) => inc.status === 'DISPATCHED' || inc.status === 'ACKNOWLEDGED'
      );
      setActiveIncident(current || null);
    } catch (error) {
      console.error('Помилка завантаження тривог:', error);
    }
  };

  // 2. Завантаження всіх об'єктів для карти патрулювання
  const fetchAllObjects = async () => {
    try {
      const response = await api.get('/objects/');
      setAllObjects(response.data);
    } catch (error) {
      console.error('Помилка завантаження об’єктів:', error);
    }
  };

  // ФУНКЦІЯ ПРОКЛАДАННЯ МАРШРУТУ (OSRM API)
  const getRoute = async (startLat: number, startLon: number, endLat: number, endLon: number) => {
    try {
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`);
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
        setRouteCoords(route);
      }
    } catch (error) {
      console.error("Не вдалося прокласти маршрут:", error);
    }
  };

  useEffect(() => {
    fetchMyIncident();
    fetchAllObjects();

    // РОЗУМНИЙ WEBSOCKET З АВТОПЕРЕПІДКЛЮЧЕННЯМ
    const connectWebSocket = () => {
      const wsUrl = 'wss://guard-crm-backend-1.onrender.com/ws/incidents';
      const ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        // Будь-який сигнал про нову тривогу або зміну статусу змушує оновити дані
        if (data.type === 'NEW_INCIDENT' || data.type === 'UPDATE_INCIDENT') {
          fetchMyIncident();
        }
      };

      ws.onclose = () => {
        console.log('WS відключено. Спроба перепідключення через 3 сек...');
        setTimeout(connectWebSocket, 3000);
      };

      wsRef.current = ws;
    };

    connectWebSocket();

    // РЕХУЛЯРНЕ ФОНОВЕ ОПИТУВАННЯ (FALLBACK) КОЖНІ 5 СЕКУНД
    // Гарантує, що навіть якщо WebSocket "мовчить", тривога все одно з'явиться автоматично
    const pollingInterval = setInterval(() => {
      fetchMyIncident();
    }, 5000);

    // АВТОМАТИЧНИЙ GPS-ТРЕКЕР
    let watchId: number;
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          setMyLocation({ lat, lon });
          
          try {
            await api.put(`/guards/location/?lat=${lat}&lon=${lon}`);
          } catch (e) {}
        },
        (error) => console.error("Помилка GPS:", error),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 5000 }
      );
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
      clearInterval(pollingInterval);
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // МАЛЮЄМО МАРШРУТ ПРИ ПРИЙНЯТТІ ВИКЛИКУ
  useEffect(() => {
    if (
      activeIncident?.status === 'ACKNOWLEDGED' && 
      activeIncident.object_latitude !== null && 
      activeIncident.object_longitude !== null && 
      myLocation
    ) {
      getRoute(
        myLocation.lat, 
        myLocation.lon, 
        activeIncident.object_latitude, 
        activeIncident.object_longitude
      );
    } else {
      setRouteCoords([]); 
    }
  }, [activeIncident?.status, myLocation]);

  const handleAcknowledge = async () => {
    if (!activeIncident) return;
    try {
      await api.put(`/incidents/${activeIncident.id}/`, { status: 'ACKNOWLEDGED' });
      fetchMyIncident(); 
    } catch (error) {
      alert('Не вдалося підтвердити виклик!');
    }
  };

  return (
    <div className="relative h-screen w-full bg-slate-900 overflow-hidden font-sans">
      
      {/* КАРТА (ЗАВЖДИ НА ФОНІ) */}
      <div className="absolute inset-0 z-0">
        <MapContainer 
          center={myLocation ? [myLocation.lat, myLocation.lon] : [47.653, 34.088]} 
          zoom={15} 
          zoomControl={false} 
          className="h-full w-full"
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
          {/* 1. ВСІ ОБ'ЄКТИ ОХОРОНИ НА КАРТІ (РЕЖИМ ПАТРУЛЮВАННЯ) */}
          {allObjects.map((obj) => {
            if (obj.latitude && obj.longitude) {
              return (
                <Marker key={obj.id} position={[obj.latitude, obj.longitude]} icon={objectIcon}>
                  <Popup>
                    <strong>{obj.name}</strong><br />
                    {obj.address}
                  </Popup>
                </Marker>
              );
            }
            return null;
          })}

          {/* 2. МАРКЕР АВТО ЕКІПАЖУ */}
          {myLocation && (
            <Marker position={[myLocation.lat, myLocation.lon]} icon={carIcon}>
              <Popup>Ваш екіпаж</Popup>
            </Marker>
          )}

          {/* 3. ЛІНІЯ МАРШРУТУ ДО ОБ'ЄКТА */}
          {routeCoords.length > 0 && (
            <Polyline positions={routeCoords} color="#3b82f6" weight={5} opacity={0.8} />
          )}
        </MapContainer>
      </div>

      {/* UI: РЕЖИМ ОЧІКУВАННЯ */}
      {!activeIncident && (
        <div className="absolute top-4 left-4 right-4 z-10 bg-white/90 backdrop-blur-sm p-4 rounded-2xl shadow-lg border border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Патрулювання</h3>
            <p className="text-xs text-slate-500">Очікування команд...</p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-bold text-emerald-700">GPS Активний</span>
          </div>
        </div>
      )}

      {/* UI: ТРИВОГА (ПІВ ЕКРАНА ЗНИЗУ) */}
      {activeIncident?.status === 'DISPATCHED' && (
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-red-600 rounded-t-3xl shadow-[0_-10px_40px_rgba(220,38,38,0.5)] p-6 animate-slide-up">
          <div className="w-12 h-1.5 bg-white/30 rounded-full mx-auto mb-6"></div>
          <div className="text-center mb-8">
            <h1 className="text-5xl font-black uppercase tracking-widest text-white drop-shadow-md mb-2">Тривога!</h1>
            <h2 className="text-2xl font-bold text-white">{activeIncident.object_name}</h2>
            <p className="text-lg text-red-100 font-medium mt-1">📍 {activeIncident.object_address}</p>
          </div>
          
          <button 
            onClick={handleAcknowledge}
            className="w-full bg-white text-red-700 font-black text-2xl py-6 rounded-2xl shadow-xl active:scale-95 transition-transform"
          >
            ПРИЙНЯТИ ВИКЛИК
          </button>
        </div>
      )}

      {/* UI: МАРШРУТ (ПАНЕЛЬ ІНФОРМАЦІЇ ЗНИЗУ) */}
      {activeIncident?.status === 'ACKNOWLEDGED' && (
        <div className="absolute bottom-4 left-4 right-4 z-20 bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
          <div className="bg-slate-900 p-4">
            <div className="flex justify-between items-center mb-1">
              <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest animate-pulse">
                Екіпаж у дорозі
              </span>
            </div>
            <h2 className="text-xl font-bold text-white leading-tight">{activeIncident.object_name}</h2>
            <p className="text-sm text-slate-300 mt-1">📍 {activeIncident.object_address}</p>
          </div>
          
          <div className="p-4 bg-slate-50">
            <span className="text-xs text-slate-500 uppercase font-bold block mb-1">Інструкції для екіпажу:</span>
            <p className="text-sm font-bold text-amber-700 bg-amber-100 p-3 rounded-xl border border-amber-200">
              {activeIncident.object_instructions || 'Спеціальні інструкції відсутні'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}