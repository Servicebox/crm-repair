/**
 * CRM target field registry.
 * Each entry maps a dot-notation path (what the importer writes to)
 * to human-readable aliases and a set of synonym strings for fuzzy matching.
 */

export interface TargetField {
  path: string
  label: string
  entity: string
  required?: boolean
  synonyms: string[]
}

export const TARGET_FIELDS: TargetField[] = [
  // ── Clients ──────────────────────────────────────────────────────────
  {
    path: 'client.name',
    label: 'Имя клиента',
    entity: 'clients',
    required: true,
    synonyms: ['имя', 'клиент', 'фио', 'наименование', 'контакт', 'name', 'client', 'customer', 'full_name', 'fullname', 'contact'],
  },
  {
    path: 'client.phone',
    label: 'Телефон',
    entity: 'clients',
    synonyms: ['телефон', 'тел', 'phone', 'mobile', 'cell', 'contact_phone', 'телефон клиента', 'моб'],
  },
  {
    path: 'client.email',
    label: 'Email',
    entity: 'clients',
    synonyms: ['email', 'почта', 'e-mail', 'электронная почта', 'mail'],
  },
  {
    path: 'client.source',
    label: 'Источник',
    entity: 'clients',
    synonyms: ['источник', 'source', 'channel', 'канал', 'откуда'],
  },
  {
    path: 'client.notes',
    label: 'Примечание',
    entity: 'clients',
    synonyms: ['примечание', 'заметки', 'notes', 'comment', 'комментарий', 'описание'],
  },
  {
    path: 'client.discount',
    label: 'Скидка (%)',
    entity: 'clients',
    synonyms: ['скидка', 'discount', 'скидка клиента', '%'],
  },

  // ── Orders ───────────────────────────────────────────────────────────
  {
    path: 'order.number',
    label: 'Номер заказа',
    entity: 'orders',
    synonyms: ['номер', 'заказ', 'order', 'order_number', 'номер заказа', 'id', '№'],
  },
  {
    path: 'order.client_name',
    label: 'Имя клиента (заказ)',
    entity: 'orders',
    synonyms: ['клиент', 'заказчик', 'client', 'customer', 'имя'],
  },
  {
    path: 'order.client_phone',
    label: 'Телефон клиента',
    entity: 'orders',
    synonyms: ['телефон', 'тел клиента', 'phone', 'contact'],
  },
  {
    path: 'order.device_name',
    label: 'Устройство',
    entity: 'orders',
    synonyms: ['устройство', 'device', 'техника', 'оборудование', 'аппарат'],
  },
  {
    path: 'order.device_brand',
    label: 'Марка',
    entity: 'orders',
    synonyms: ['марка', 'бренд', 'brand', 'manufacturer', 'производитель'],
  },
  {
    path: 'order.device_model',
    label: 'Модель',
    entity: 'orders',
    synonyms: ['модель', 'model', 'серия'],
  },
  {
    path: 'order.serial_number',
    label: 'Серийный номер',
    entity: 'orders',
    synonyms: ['серийный номер', 'serial', 'sn', 'imei', 's/n', 'серийник'],
  },
  {
    path: 'order.malfunction',
    label: 'Неисправность',
    entity: 'orders',
    synonyms: ['неисправность', 'описание', 'problem', 'issue', 'жалоба', 'дефект', 'поломка'],
  },
  {
    path: 'order.status',
    label: 'Статус',
    entity: 'orders',
    synonyms: ['статус', 'status', 'state', 'состояние', 'стадия'],
  },
  {
    path: 'order.total_price',
    label: 'Стоимость',
    entity: 'orders',
    synonyms: ['стоимость', 'сумма', 'price', 'total', 'итого', 'цена', 'amount'],
  },
  {
    path: 'order.created_at',
    label: 'Дата приёма',
    entity: 'orders',
    synonyms: ['дата', 'дата приёма', 'date', 'created', 'принят', 'поступление'],
  },
  {
    path: 'order.completed_at',
    label: 'Дата выдачи',
    entity: 'orders',
    synonyms: ['дата выдачи', 'выдан', 'completed', 'issued', 'закрыт'],
  },
  {
    path: 'order.master_name',
    label: 'Мастер',
    entity: 'orders',
    synonyms: ['мастер', 'master', 'technician', 'исполнитель', 'техник'],
  },
  {
    path: 'order.notes',
    label: 'Примечания (заказ)',
    entity: 'orders',
    synonyms: ['примечание', 'заметки', 'notes', 'комментарий'],
  },
  {
    path: 'order.discount',
    label: 'Скидка (заказ)',
    entity: 'orders',
    synonyms: ['скидка', 'discount', 'скидка на ремонт'],
  },
  {
    path: 'order.prepayment',
    label: 'Предоплата',
    entity: 'orders',
    synonyms: ['предоплата', 'аванс', 'prepayment', 'deposit', 'advance'],
  },
  {
    path: 'order.due_date',
    label: 'Срок готовности',
    entity: 'orders',
    synonyms: ['срок', 'готовность', 'due_date', 'deadline', 'дата готовности'],
  },

  // ── Products / Warehouse ─────────────────────────────────────────────
  {
    path: 'product.name',
    label: 'Название товара',
    entity: 'products',
    required: true,
    synonyms: ['название', 'наименование', 'name', 'товар', 'product', 'item'],
  },
  {
    path: 'product.sku',
    label: 'Артикул',
    entity: 'products',
    synonyms: ['артикул', 'sku', 'code', 'код', 'part_number', 'vendor_code'],
  },
  {
    path: 'product.barcode',
    label: 'Штрих-код',
    entity: 'products',
    synonyms: ['штрихкод', 'barcode', 'ean', 'upc', 'штрих-код'],
  },
  {
    path: 'product.category',
    label: 'Категория',
    entity: 'products',
    synonyms: ['категория', 'category', 'group', 'тип', 'раздел'],
  },
  {
    path: 'product.quantity',
    label: 'Количество',
    entity: 'products',
    synonyms: ['количество', 'qty', 'count', 'stock', 'остаток', 'кол-во'],
  },
  {
    path: 'product.cost',
    label: 'Себестоимость',
    entity: 'products',
    synonyms: ['себестоимость', 'cost', 'закупочная', 'purchase_price', 'закупка'],
  },
  {
    path: 'product.price',
    label: 'Цена продажи',
    entity: 'products',
    synonyms: ['цена', 'price', 'sell_price', 'selling_price', 'розничная'],
  },
  {
    path: 'product.supplier',
    label: 'Поставщик',
    entity: 'products',
    synonyms: ['поставщик', 'supplier', 'vendor', 'производитель'],
  },
  {
    path: 'product.description',
    label: 'Описание',
    entity: 'products',
    synonyms: ['описание', 'description', 'заметки', 'notes'],
  },
]

export const TARGET_ENTITIES = [
  { value: 'clients', label: 'Клиенты' },
  { value: 'orders', label: 'Заказы' },
  { value: 'products', label: 'Товары / Склад' },
]

export function getFieldsForEntity(entity: string): TargetField[] {
  return TARGET_FIELDS.filter(f => f.entity === entity)
}

export function getFieldByPath(path: string): TargetField | undefined {
  return TARGET_FIELDS.find(f => f.path === path)
}
