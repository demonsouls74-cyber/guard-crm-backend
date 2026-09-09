import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import RoutingMachine from './RoutingMachine';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const alarmIcon = new L.DivIcon({
  className: 'bg-transparent',
  html: `<div class="relative flex h-6 w-6">
           <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
           <span class="relative inline-flex rounded-full h-6 w-6 bg-red-600 border-2 border-white shadow-lg"></span>
         </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Активна іконка для онлайн-екіпажу
const guardOnlineIcon = new L.DivIcon({
  className: 'bg-transparent',
  html: `<div class="flex items-center justify-center h-7 w-7 rounded-full bg-green-600 border-2 border-white shadow-md text-white font-bold text-xs">
           👮‍♂️
         </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// Бліда іконка для оффлайн-екіпажу (сірий колір, менша непрозорість)
const guardOfflineIcon = new L.DivIcon({
  className: 'bg-transparent',
  html: `<div class="flex items-center justify-center h-6 w-6 rounded-full bg-slate-400 border-2 border-white shadow-sm text-white font-bold text-[10px] opacity-50 grayscale">
           👮‍♂️
         </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

interface MapObject {
  id: number;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

interface Incident {
  id: number;
  object_id: number;
  status: string;
  guard_id?: number | null;
}

interface Guard {
  id: number;
  email: string;
  latitude: number | null;
  longitude: number | null;
  is_online?: boolean; // <-- Додали підтримку статусу
  full_name?: string | null;
}

interface MapWidgetProps {
  objects: MapObject[];
  activeIncidents?: Incident[];
  guards?: Guard[];
}

export default function MapWidget({ objects, activeIncidents = [], guards = [] }: MapWidgetProps) {
  const validObjects = objects.filter(obj => obj.latitude && obj.longitude);
  // Тепер беремо і тих, у кого є GPS координати (навіть якщо вони нещодавно вийшли з мережі)
  const validGuards = guards.filter(guard => guard.latitude && guard.longitude);

  let activeRoute: { start: [number, number]; end: [number, number] } | null = null;

  const dispatchedIncident = activeIncidents.find(inc => inc.status === 'DISPATCHED' && inc.guard_id);
  if (dispatchedIncident) {
    const targetObj = validObjects.find(o => o.id === dispatchedIncident.object_id);
    const assignedGuard = validGuards.find(g => g.id === dispatchedIncident.guard_id);

    if (targetObj && targetObj.latitude && targetObj.longitude && assignedGuard && assignedGuard.latitude && assignedGuard.longitude) {
      activeRoute = {
        start: [assignedGuard.latitude, assignedGuard.longitude],
        end: [targetObj.latitude, targetObj.longitude]
      };
    }
  }

  return (
    <div className="h-full w-full relative z-0">
      <MapContainer 
        center={[47.653, 34.088]} 
        zoom={13} 
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Лінія маршруту */}
        {activeRoute && <RoutingMachine start={activeRoute.start} end={activeRoute.end} />}

        {/* Об'єкти охорони */}
        {validObjects.map((obj) => {
          const isAlarm = activeIncidents.some(inc => inc.object_id === obj.id);

          return (
            <Marker 
              key={`obj-${obj.id}`} 
              position={[obj.latitude as number, obj.longitude as number]}
              icon={isAlarm ? alarmIcon : new L.Icon.Default()}
            >
              <Popup>
                <div className="text-center">
                  <h3 className="font-bold text-gray-800">{obj.name}</h3>
                  <p className="text-xs text-gray-500 mb-2">{obj.address}</p>
                  {isAlarm && (
                    <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded">
                      УВАГА: ТРИВОГА!
                    </span>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Екіпажі (і онлайн, і оффлайн, але з різними іконками) */}
        {validGuards.map((guard) => {
          const isOnline = guard.is_online ?? false;

          return (
            <Marker 
              key={`guard-${guard.id}`} 
              position={[guard.latitude as number, guard.longitude as number]}
              icon={isOnline ? guardOnlineIcon : guardOfflineIcon}
            >
              <Popup>
                <div className="text-center">
                  <h3 className={`font-bold ${isOnline ? 'text-green-700' : 'text-slate-500'}`}>
                    {guard.full_name || `Екіпаж #${guard.id}`}
                  </h3>
                  <p className="text-xs text-gray-500">{guard.email}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded mt-1 inline-block ${
                    isOnline ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {isOnline ? '🟢 На зв\'язку (Онлайн)' : '⚪ Поза мережею (Оффлайн)'}
                  </span>
                </div>
              </Popup>
            </Marker>
          );
        })}

      </MapContainer>
    </div>
  );
}