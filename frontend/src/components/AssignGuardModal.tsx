import { useState, useEffect } from 'react';
import api from '../api';

interface User {
  id: number;
  email: string;
  role: string;
  latitude: number | null;
  longitude: number | null;
}

interface AssignGuardModalProps {
  isOpen: boolean;
  incidentId: number | null;
  objectName: string;
  onClose: () => void;
  onSuccess: () => void;
}

// Формула для розрахунку відстані в кілометрах між двома координатами
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default function AssignGuardModal({ isOpen, incidentId, objectName, onClose, onSuccess }: AssignGuardModalProps) {
  const [guards, setGuards] = useState<(User & { distance?: number })[]>([]);
  const [selectedGuardId, setSelectedGuardId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && incidentId) {
      fetchDataAndCalculate();
    }
  }, [isOpen, incidentId]);

  const fetchDataAndCalculate = async () => {
    try {
      // Паралельно завантажуємо юзерів та деталі інциденту (щоб дізнатися координати об'єкта)
      const [usersRes, incidentsRes, objectsRes] = await Promise.all([
        api.get('/users/'),
        api.get('/incidents/'),
        api.get('/objects/')
      ]);

      const guardList = usersRes.data.filter((user: User) => user.role === 'guard');
      
      // Знаходимо поточний інцидент, щоб дізнатися object_id
      const currentIncident = incidentsRes.data.find((inc: any) => inc.id === incidentId);
      let objLat: number | null = null;
      let objLng: number | null = null;

      if (currentIncident) {
        const targetObj = objectsRes.data.find((o: any) => o.id === currentIncident.object_id);
        if (targetObj) {
          objLat = targetObj.latitude;
          objLng = targetObj.longitude;
        }
      }

      // Рахуємо відстань для кожного охоронця від об'єкта тривоги
      const guardsWithDistance = guardList.map((guard: User) => {
        let dist = 999999; // Якщо немає координат — ставимо в самий кінець
        if (objLat !== null && objLng !== null && guard.latitude !== null && guard.longitude !== null) {
          dist = calculateDistance(objLat, objLng, guard.latitude, guard.longitude);
        }
        return { ...guard, distance: dist };
      });

      // Сортуємо: найближчий (менша відстань) іде першим
      guardsWithDistance.sort((a: any, b: any) => a.distance - b.distance);

      setGuards(guardsWithDistance);
      if (guardsWithDistance.length > 0) {
        setSelectedGuardId(guardsWithDistance[0].id);
      }
    } catch (error) {
      console.error('Помилка завантаження екіпажів:', error);
    }
  };

  if (!isOpen || !incidentId) return null;

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGuardId) return;

    setLoading(true);
    try {
      await api.put(`/incidents/${incidentId}/`, {
        status: 'DISPATCHED',
        guard_id: selectedGuardId
      });
      
      onSuccess();
      onClose();
    } catch (error: any) {
      alert(`Помилка: ${error.response?.data?.detail || "Не вдалося призначити екіпаж"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 relative">
        <div className="flex justify-between items-center mb-4 border-b pb-3">
          <h3 className="text-xl font-bold text-gray-800">Призначення екіпажу</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
        </div>

        <div className="mb-4 bg-red-50 p-3 rounded-lg border border-red-200">
          <p className="text-xs text-red-600 font-semibold uppercase">Тривога по об'єкту:</p>
          <p className="text-base font-bold text-red-900">{objectName}</p>
        </div>

        <form onSubmit={handleAssign} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Доступні екіпажи (сортування за відстанню):
            </label>
            
            {guards.length === 0 ? (
              <p className="text-sm text-red-500 italic">У системі немає зареєстрованих охоронців (guard).</p>
            ) : (
              /* Скрол-список замість випадаючого меню */
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1 border border-gray-200 rounded-lg p-2 bg-gray-50 custom-scrollbar">
                {guards.map((guard, index) => {
                  const isClosest = index === 0;
                  const isSelected = selectedGuardId === guard.id;

                  return (
                    <div 
                      key={guard.id}
                      onClick={() => setSelectedGuardId(guard.id)}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition ${
                        isSelected 
                          ? 'bg-blue-50 border-blue-500 shadow-sm' 
                          : 'bg-white border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <input 
                          type="radio" 
                          name="guardSelection"
                          checked={isSelected}
                          onChange={() => setSelectedGuardId(guard.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div className="font-bold text-sm text-gray-800 flex items-center space-x-2">
                            <span>Охоронець #{guard.id}</span>
                            {isClosest && (
                              <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                НАЙБЛИЖЧИЙ
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">{guard.email}</div>
                        </div>
                      </div>

                      <div className="text-right font-mono text-xs">
                        {guard.distance !== undefined && guard.distance < 99999 ? (
                          <span className="font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                            {guard.distance < 1 ? `${Math.round(guard.distance * 1000)} м` : `${guard.distance.toFixed(1)} км`}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">GPS немає</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 font-medium"
            >
              Скасувати
            </button>
            <button 
              type="submit" 
              disabled={loading || guards.length === 0 || !selectedGuardId}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 font-medium shadow-sm disabled:opacity-50"
            >
              {loading ? 'Призначення...' : 'Підтвердити виїзд'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}