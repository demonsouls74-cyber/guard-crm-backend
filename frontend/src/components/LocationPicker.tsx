import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

// Налаштування іконок Leaflet
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface LocationPickerProps {
  address: string;
  setAddress: (val: string) => void;
  coords: string;
  setCoords: (val: string) => void;
}

// Допоміжні міні-компоненти для карти
function MapClickHandler({ setCoords, currentCoords }: { setCoords: (c: string) => void, currentCoords: string }) {
  useMapEvents({
    click(e) {
      setCoords(`${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`);
    },
  });

  let position: [number, number] | null = null;
  if (currentCoords.trim()) {
    const parts = currentCoords.split(',').map(item => parseFloat(item.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      position = [parts[0], parts[1]];
    }
  }

  return position ? <Marker position={position} /> : null;
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 16, { animate: true });
  }, [center, map]);
  return null;
}

// ОСНОВНИЙ ЕКСПОРТНИЙ КОМПОНЕНТ
export default function LocationPicker({ address, setAddress, coords, setCoords }: LocationPickerProps) {
  const [isSearchingMap, setIsSearchingMap] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([47.653, 34.088]); // Покров за замовчуванням

  const handleSearchAddress = async () => {
    if (!address.trim()) return;
    
    setIsSearchingMap(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        
        setCoords(`${lat.toFixed(6)}, ${lon.toFixed(6)}`);
        setMapCenter([lat, lon]);
      } else {
        alert("На жаль, адресу не знайдено. Спробуйте додати назву міста.");
      }
    } catch (error) {
      console.error("Помилка геокодування:", error);
      alert("Не вдалося підключитися до сервісу пошуку адрес.");
    } finally {
      setIsSearchingMap(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Поле адреси з кнопкою пошуку */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Адреса</label>
        <div className="flex space-x-2">
          <input 
            type="text" 
            required
            value={address} 
            onChange={e => setAddress(e.target.value)}
            placeholder="напр., м. Покров, Героїв України 6"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleSearchAddress}
            disabled={isSearchingMap || !address.trim()}
            className="px-3 py-2 bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-sm hover:bg-slate-200 transition font-medium flex items-center shadow-sm disabled:opacity-50"
          >
            {isSearchingMap ? '⏳ Шукаю...' : '📍 Знайти'}
          </button>
        </div>
      </div>

      {/* Карта */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Розташування на мапі</label>
        <div className="h-48 w-full mb-2 rounded-lg overflow-hidden border border-gray-300 z-0 relative">
          <MapContainer center={mapCenter} zoom={13} className="h-full w-full">
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler setCoords={setCoords} currentCoords={coords} />
            <MapUpdater center={mapCenter} />
          </MapContainer>
        </div>

        <input 
          type="text" 
          value={coords} 
          onChange={e => setCoords(e.target.value)}
          placeholder="Координати з'являться тут..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          Натисніть "Знайти" або клікніть по мапі, щоб уточнити місце маркеру.
        </p>
      </div>
    </div>
  );
}