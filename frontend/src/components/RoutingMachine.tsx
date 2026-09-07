import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';

interface RoutingProps {
  start: [number, number];
  end: [number, number];
}

export default function RoutingMachine({ start, end }: RoutingProps) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Використовуємо as any, щоб повністю уникнути проблем із застарілими чи суворими типами бібліотеки
    const routingControl = (L.Routing as any).control({
      waypoints: [
        L.latLng(start[0], start[1]),
        L.latLng(end[0], end[1])
      ],
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: false, // <--- ЗМІНИТИ ТУТ НА FALSE
      show: false,
      lineOptions: {
        styles: [
          { color: '#2563eb', opacity: 0.8, weight: 6 }
        ],
        extendToWaypoints: true,
        missingRouteTolerance: 50
      } as any,
      createMarker: () => null 
    }).addTo(map);

    return () => {
      try {
        map.removeControl(routingControl);
      } catch (e) {
        // Ігноруємо помилки очищення
      }
    };
  }, [map, start, end]);

  return null;
}