import { useState, useEffect } from 'react';
import api from '../api';
import CreateClientModal from './CreateClientModal';
import ClientDetailsModal from './ClientDetailsModal'; // Імпортуємо нову модалку

interface ClientItem {
  id: number;
  user_id: number;
  email: string;
  full_name: string;
  phone_main: string;
  contract_status: string;
}

export default function Clients() {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Стейт для модалки створення
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  // Стейт для модалки перегляду/редагування
  const [selectedClient, setSelectedClient] = useState<ClientItem | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  useEffect(() => { 
    fetchClients(); 
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const response = await api.get('/client-profiles/');
      setClients(response.data);
    } catch (error) {
      console.error('Помилка завантаження клієнтів:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (client: ClientItem) => {
    setSelectedClient(client);
    setIsDetailsModalOpen(true);
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Клієнти</h1>
          <p className="text-sm text-gray-500 mt-1">Реєстр профілів та контактних даних клієнтів</p>
        </div>
        <div className="space-x-3">
          <button 
            onClick={() => setIsCreateModalOpen(true)} 
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium shadow-sm"
          >
            + Додати клієнта
          </button>
          <button 
            onClick={fetchClients} 
            className="bg-white text-gray-700 px-4 py-2 rounded border hover:bg-gray-50 font-medium shadow-sm"
          >
            ↻ Оновити
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Завантаження...</div>
        ) : clients.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Немає зареєстрованих клієнтів.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">П.І.Б. / Email</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Телефон</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Статус</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clients.map(client => (
                <tr 
                  key={client.user_id} 
                  onClick={() => handleRowClick(client)}
                  className="hover:bg-blue-50 transition cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className="font-bold text-slate-800 block">{client.full_name}</span>
                    <span className="text-gray-500 text-xs">{client.email}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{client.phone_main}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      client.contract_status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {client.contract_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CreateClientModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onSuccess={fetchClients} 
      />

      <ClientDetailsModal 
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        onSuccess={fetchClients}
        client={selectedClient}
      />
    </div>
  );
}