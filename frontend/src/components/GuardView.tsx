import { useState, useEffect, useRef } from 'react';
import api from '../api';
// 1. Додаємо імпорт useMap
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';

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

const carIcon = L.divIcon({
  className: 'custom-car-marker',
  html: `<div style="background-color: #4dff29; width: 24px; height: 24px; border: 3px solid white; border-radius: 50%; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold;">🚗</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const objectIcon = L.divIcon({
  className: 'custom-object-marker',
  html: `<div style="background-color: #6aa8ff; width: 18px; height: 18px; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});


// 2. СТВОРЮЄМО КОМПОНЕНТ-НАВІГАТОР (АВТОФОКУС)
function MapUpdater({ location }: { location: { lat: number; lon: number } | null }) {
  const map = useMap(); // Отримуємо доступ до об'єкта карти Leaflet
  
  useEffect(() => {
    if (location) {
      // Плавно переміщуємо центр карти на нові координати екіпажу
      map.setView([location.lat, location.lon], map.getZoom(), {
        animate: true,
        duration: 1 // Тривалість анімації польоту
      });
    }
  }, [location, map]);
  
  return null; // Цей компонент нічого не малює, він лише керує камерою
}


export default function GuardView() {
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [allObjects, setAllObjects] = useState<SecurityObject[]>([]);
  const [myLocation, setMyLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const navigate = useNavigate();
  const wsRef = useRef<WebSocket | null>(null);

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

  const fetchAllObjects = async () => {
    try {
      const response = await api.get('/objects/');
      setAllObjects(response.data);
    } catch (error) {
      console.error('Помилка завантаження об’єктів:', error);
    }
  };

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

    const connectWebSocket = () => {
      const wsUrl = 'wss://guard-crm-backend-1.onrender.com/ws/incidents';
      const ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
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

    const pollingInterval = setInterval(() => {
      fetchMyIncident();
    }, 5000);

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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login');
  };

  return (
    // 3. ЗМІНА ТУТ: h-screen замінено на h-[100dvh] для ідеального розміру на мобілках
    <div className="relative h-[100dvh] w-full bg-slate-900 overflow-hidden font-sans">
      
      {/* КАРТА */}
      <div className="absolute inset-0 z-0">
        <MapContainer 
          center={myLocation ? [myLocation.lat, myLocation.lon] : [47.653, 34.088]} 
          zoom={15} 
          zoomControl={false} 
          className="h-full w-full"
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
          {/* 4. ВСТАВЛЯЄМО НАШ НАВІГАТОР ДЛЯ КАМЕРИ */}
          <MapUpdater location={myLocation} />

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

          {myLocation && (
            <Marker position={[myLocation.lat, myLocation.lon]} icon={carIcon}>
              <Popup>Ваш екіпаж</Popup>
            </Marker>
          )}

          {routeCoords.length > 0 && (
            <Polyline positions={routeCoords} color="#3b82f6" weight={5} opacity={0.8} />
          )}
        </MapContainer>
      </div>

      {/* ВЕРХНЯ ПАНЕЛЬ */}
      <div className="absolute top-4 left-4 z-30 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-xl shadow-lg border border-slate-200 flex items-center space-x-3">
        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
        <div>
          <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Патрулювання</h3>
          <p className="text-[10px] text-slate-500">GPS активний</p>
        </div>
      </div>

      <button 
        onClick={handleLogout} 
        className="absolute top-4 right-4 z-30 bg-slate-800/90 hover:bg-red-500 text-white text-xs font-bold px-3 py-2.5 rounded-xl shadow-lg transition"
      >
        Вийти
      </button>

      {/* UI: ТРИВОГА (Модальне вікно по центру екрана) */}
      {activeIncident?.status === 'DISPATCHED' && (
        <div className="absolute inset-0 z-50 bg-red-600/95 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-fade-in text-center">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-4 animate-bounce">
            <span className="text-4xl">🚨</span>
          </div>
          
          <h1 className="text-5xl font-black uppercase tracking-widest text-white drop-shadow-lg mb-2">Тривога!</h1>
          <h2 className="text-2xl font-bold text-white mb-1">{activeIncident.object_name}</h2>
          <p className="text-base text-red-100 font-medium mb-8 max-w-xs">📍 {activeIncident.object_address}</p>
          
          <button 
            onClick={handleAcknowledge}
            className="w-full max-w-sm bg-white text-red-700 font-black text-xl py-5 rounded-2xl shadow-[0_10px_25px_rgba(0,0,0,0.5)] active:scale-95 transition-transform"
          >
            ПРИЙНЯТИ ВИКЛИК
          </button>
        </div>
      )}

      {/* UI: МАРШРУТ (ПАНЕЛЬ ІНФОРМАЦІЇ ЗНИЗУ) */}
      {activeIncident?.status === 'ACKNOWLEDGED' && (
        <div className="absolute bottom-4 left-4 right-4 z-20 bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
          <div className="bg-slate-900 p-3">
            <div className="flex justify-between items-center mb-1">
              <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest animate-pulse">
                Екіпаж у дорозі
              </span>
            </div>
            <h2 className="text-base font-bold text-white leading-tight">{activeIncident.object_name}</h2>
            <p className="text-xs text-slate-300 mt-0.5">📍 {activeIncident.object_address}</p>
          </div>
          
          <div className="p-3 bg-slate-50">
            <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Інструкції для екіпажу:</span>
            <p className="text-xs font-bold text-amber-700 bg-amber-100 p-2 rounded-lg border border-amber-200">
              {activeIncident.object_instructions || 'Спеціальні інструкції відсутні'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}