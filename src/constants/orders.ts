export const ORDER_STATUSES = [
  { value: 'new', label: 'Новый', color: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
  { value: 'diagnostics', label: 'Диагностика', color: 'bg-purple-100 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  { value: 'waiting_approval', label: 'Ожидает согласования', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  { value: 'waiting_parts', label: 'Ожидает запчасти', color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  { value: 'in_repair', label: 'В ремонте', color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  { value: 'quality_check', label: 'Проверка качества', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  { value: 'ready', label: 'Готов к выдаче', color: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' },
  { value: 'issued', label: 'Выдан', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-600' },
  { value: 'cancelled', label: 'Отменён', color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
  { value: 'client_declined', label: 'Отказ от ремонта', color: 'bg-red-100 text-red-800 border-red-300', dot: 'bg-red-600' },
] as const

export const PRIORITY_CONFIG = {
  low: { label: 'Низкий', color: 'text-slate-500' },
  normal: { label: 'Обычный', color: 'text-blue-500' },
  high: { label: 'Высокий', color: 'text-orange-500' },
  urgent: { label: 'Срочный', color: 'text-red-500' },
} as const

export const DEVICE_TYPES = [
  'Смартфон', 'Планшет', 'Ноутбук', 'ПК', 'Моноблок',
  'Принтер', 'МФУ', 'Телевизор', 'Игровая консоль', 'Умные часы',
  'Наушники', 'Колонка', 'Другое',
]

export const DEFECT_TEMPLATES = [
  'Не включается',
  'Не заряжается',
  'Разбит экран',
  'Быстро разряжается',
  'Не работает камера',
  'Попала влага',
  'Не работает звук',
  'Не работает сенсор',
  'Перегревается',
  'Не видит SIM',
  'Не работает Wi-Fi',
  'Не работает кнопка',
]

export const SOURCES = [
  'Проходящий трафик',
  'Сайт',
  'ВКонтакте',
  'Авито',
  'Telegram',
  'WhatsApp',
  'Звонок',
  'Рекомендация',
  'Повторный клиент',
]

export const ACCESSORY_TEMPLATES = [
  'Зарядка', 'Кабель', 'Чехол', 'Коробка', 'SIM-лоток',
  'Карта памяти', 'Стилус', 'Блок питания',
]

export const CONDITION_TEMPLATES = [
  'Без видимых повреждений',
  'Мелкие потертости',
  'Царапины на корпусе',
  'Трещина стекла',
  'Разбит дисплей',
  'Следы вскрытия',
  'Следы попадания влаги',
  'Нет задней крышки',
  'Корпус деформирован',
]
