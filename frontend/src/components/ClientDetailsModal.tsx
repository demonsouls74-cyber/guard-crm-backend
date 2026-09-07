import { useState, useEffect } from 'react';
import api from '../api';

interface ClientItem {
    id: number;
    user_id: number;
    email: string;
    full_name: string;
    phone_main: string;
    contract_status: string;
}

interface ClientDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    client: ClientItem | null;
}

export default function ClientDetailsModal({ isOpen, onClose, onSuccess, client }: ClientDetailsModalProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Стейт для форми
    const [fullName, setFullName] = useState('');
    const [phoneMain, setPhoneMain] = useState('');
    const [phoneAlt, setPhoneAlt] = useState('');
    const [taxId, setTaxId] = useState('');
    const [birthday, setBirthday] = useState('');
    const [status, setStatus] = useState('ACTIVE');

    // Коли модалка відкривається, завантажуємо ПОВНІ дані профілю
    useEffect(() => {
        if (client && isOpen) {
            setIsEditing(false);
            fetchFullProfile(client.user_id);
        }
    }, [client, isOpen]);

    // Функція для показу тост-повідомлення
    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => {
            setToastMessage(null);
        }, 2000);
    };

    const fetchFullProfile = async (userId: number) => {
        setLoadingDetails(true);
        try {
            const response = await api.get(`/client-profiles/${userId}/`);
            const profile = response.data;

            setFullName(profile.full_name || '');
            setPhoneMain(profile.phone_main || '');
            setPhoneAlt(profile.phone_alt || '');
            setTaxId(profile.tax_id || '');
            setBirthday(profile.birthday || '');
            setStatus(profile.contract_status || 'ACTIVE');
        } catch (error) {
            console.error('Помилка завантаження деталей профілю:', error);
            // Якщо профілю раптом немає, підставимо те, що є в таблиці
            setFullName(client?.full_name || '');
            setPhoneMain(client?.phone_main || '');
            setStatus(client?.contract_status || 'ACTIVE');
        } finally {
            setLoadingDetails(false);
        }
    };

    if (!isOpen || !client) return null;

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Відправляємо PUT запит. Залежно від того, як ти назвав роут,
            // це може бути /client-profiles/${client.id}/ АБО /client-profiles/${client.user_id}/
            await api.put(`/client-profiles/${client.id}/`, {
                full_name: fullName,
                phone_main: phoneMain,
                phone_alt: phoneAlt || null,
                tax_id: taxId || null,
                birthday: birthday || null,
                contract_status: status
            });

            setIsEditing(false);
            onSuccess(); // Оновлюємо таблицю
        } catch (error: any) {
            alert(`Помилка: ${error.response?.data?.detail || "Не вдалося оновити профіль"}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 relative max-h-[95vh] overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center mb-4 border-b pb-3">
                    <h3 className="text-xl font-bold text-gray-800">
                        {isEditing ? 'Редагування клієнта' : 'Картка клієнта'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
                </div>

                {loadingDetails ? (
                    <div className="py-10 text-center text-gray-500">Завантаження деталей...</div>
                ) : !isEditing ? (
                    // ================= РЕЖИМ ПЕРЕГЛЯДУ =================
                    <div className="space-y-5">
                        <div>
                            <span className="text-xs text-gray-500 font-bold uppercase">Акаунт (Email)</span>
                            <p className="text-lg font-bold text-slate-800">{client.email}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <div className="col-span-2">
                                <span className="text-xs text-gray-500 font-bold uppercase">П.І.Б.</span>
                                <p className="text-sm font-bold text-gray-900">{fullName}</p>
                            </div>

                            <div>
                                <span className="text-xs text-gray-500 font-bold uppercase">Осн. телефон</span>

                                {/* Загальний контейнер для рядка */}
                                <div className="flex items-center space-x-2 mt-1">
                                    {phoneMain ? (
                                        <a href={`tel:${phoneMain}`} className="text-sm font-medium text-blue-600 hover:underline">
                                            {phoneMain}
                                        </a>
                                    ) : (
                                        <p className="text-sm font-medium text-gray-800">—</p>
                                    )}

                                    {/* Кнопка копіювання з'явиться поруч, якщо номер існує */}
                                    {phoneMain && (
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(phoneMain);
                                                showToast("Телефон скопійовано до буфера!");
                                            }}
                                            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded border transition"
                                            title="Копіювати номер"
                                        >
                                            📋
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 font-bold uppercase">Дод. телефон</span>
                                <div className="flex items-center space-x-2 mt-1">
                                    {phoneAlt ? (
                                        <a
                                            href={`tel:${phoneAlt}`}
                                            className="text-sm font-medium text-blue-600 hover:underline"
                                        >
                                            {phoneAlt}
                                        </a>
                                    ) : (
                                        <p className="text-sm font-medium text-gray-800">—</p>
                                    )}

                                    {phoneAlt && (
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(phoneAlt);

                                            }}
                                            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded border transition"
                                            title="Копіювати номер"
                                        >
                                            📋
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 font-bold uppercase">ІПН / РНОКПП</span>
                                <p className="text-sm font-medium text-gray-800">{taxId || '—'}</p>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 font-bold uppercase">Дата народження</span>
                                <p className="text-sm font-medium text-gray-800">{birthday || '—'}</p>
                            </div>
                        </div>

                        <div>
                            <span className="text-xs text-gray-500 font-bold uppercase">Статус договору</span>
                            <div className="mt-1">
                                <span className={`px-3 py-1 rounded-md text-sm font-bold ${status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                    {status}
                                </span>
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3 pt-4 border-t">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 font-medium"
                            >
                                Закрити
                            </button>
                            <button
                                onClick={() => setIsEditing(true)}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 font-medium shadow-sm"
                            >
                                ✏️ Редагувати
                            </button>
                        </div>
                    </div>
                ) : (
                    // ================= РЕЖИМ РЕДАГУВАННЯ =================
                    <form onSubmit={handleUpdate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Email (Редагування заборонено)</label>
                            <input
                                type="email" disabled value={client.email}
                                className="w-full border border-gray-200 bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">П.І.Б. *</label>
                            <input
                                type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Осн. телефон *</label>
                                <input
                                    type="text" required value={phoneMain} onChange={e => setPhoneMain(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Дод. телефон</label>
                                <input
                                    type="text" value={phoneAlt} onChange={e => setPhoneAlt(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">ІПН / РНОКПП</label>
                                <input
                                    type="text" value={taxId} onChange={e => setTaxId(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Дата народження</label>
                                <input
                                    type="date" value={birthday} onChange={e => setBirthday(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Статус договору</label>
                            <select
                                value={status} onChange={e => setStatus(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                                <option value="ACTIVE">Активний</option>
                                <option value="SUSPENDED_BY_CLIENT">Призупинено клієнтом</option>
                                <option value="SUSPENDED_BY_ADMIN">Призупинено за борги</option>
                                <option value="TERMINATED">Розірвано</option>
                            </select>
                        </div>

                        <div className="flex justify-end space-x-3 pt-4 border-t">
                            <button
                                type="button" onClick={() => setIsEditing(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 font-medium"
                            >
                                Скасувати
                            </button>
                            <button
                                type="submit" disabled={loading}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 font-medium shadow-sm"
                            >
                                {loading ? 'Збереження...' : '✅ Зберегти'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
            {/* Зелене плаваюче сповіщення */}
            {toastMessage && (
                <div className="absolute bottom-6 right-6 bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-xl shadow-lg flex items-center space-x-2 animate-bounce">
                    <span>✅</span>
                    <span>{toastMessage}</span>
                </div>
            )}
        </div>
    );
}