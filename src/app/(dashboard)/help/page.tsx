'use client'
import { useState, useMemo } from 'react'
import { Search, ChevronDown, ChevronRight, BookOpen, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Article {
  id: string
  question: string
  answer: string
}

interface Category {
  id: string
  title: string
  icon: string
  articles: Article[]
}

const FAQ_DATA: Category[] = [
  {
    id: 'orders', title: 'Заказы', icon: '📋',
    articles: [
      { id: 'o1', question: 'Как создать новый заказ?', answer: 'Нажмите кнопку «Новый заказ» в верхней части экрана или перейдите в раздел Заказы → Новый заказ. Заполните данные клиента, устройство и описание неисправности.' },
      { id: 'o2', question: 'Как изменить статус заказа?', answer: 'Откройте заказ, в правой боковой панели найдите блок «Статус». Выберите новый статус из выпадающего списка или используйте прогресс-бар в верхней части.' },
      { id: 'o3', question: 'Как добавить работы к заказу?', answer: 'В карточке заказа перейдите на вкладку «Работы». Нажмите кнопку «Добавить работу». Заполните наименование, цену, при необходимости укажите скидку, длительность и исполнителя.' },
      { id: 'o4', question: 'Как добавить запчасти к заказу?', answer: 'В карточке заказа перейдите на вкладку «Работы». Нажмите кнопку «Добавить запчасть». Выберите со склада (поиск по названию/артикулу/штрихкоду) или введите вручную.' },
      { id: 'o5', question: 'Как распечатать этикетку и квитанцию?', answer: 'В карточке заказа нажмите кнопку «Печать» в шапке. Выберите нужный вариант: этикетка, квитанция или QR-код для клиента.' },
      { id: 'o6', question: 'Что такое тип заказа «Услуга»?', answer: 'Тип «Услуга» предназначен для работ, не связанных с ремонтом физического устройства (например, консультации, выезд). В таком заказе скрыты поля IMEI, серийный номер, пароль и комплектация.' },
      { id: 'o7', question: 'Как клиент может отследить статус заказа?', answer: 'Каждый заказ имеет уникальный QR-код и ссылку для отслеживания. Клиент открывает ссылку и видит текущий статус, стоимость и историю изменений. Ссылку можно найти на этикетке или скопировать из карточки заказа.' },
    ],
  },
  {
    id: 'clients', title: 'Клиенты', icon: '👤',
    articles: [
      { id: 'cl1', question: 'Как добавить нового клиента?', answer: 'Клиент создаётся автоматически при создании заказа. Также можно добавить клиента вручную через раздел «Клиенты» → «Добавить клиента».' },
      { id: 'cl2', question: 'Что такое тип клиента физлицо/ИП/ООО?', answer: 'При создании заказа укажите тип клиента: Физлицо (обычный потребитель), ИП (индивидуальный предприниматель) или ООО (организация). Это влияет на формат квитанции и расчёт НДС.' },
      { id: 'cl3', question: 'Как посмотреть историю заказов клиента?', answer: 'Откройте карточку клиента через раздел «Клиенты». На странице клиента отображается вся история обращений, сумма покупок и последний визит.' },
    ],
  },
  {
    id: 'warehouse', title: 'Склад', icon: '📦',
    articles: [
      { id: 'w1', question: 'Как добавить новую запчасть на склад?', answer: 'В разделе «Запасные части» нажмите «Новый товар». Выберите тип «Запчасть», заполните название, артикул, штрихкод, место хранения, категорию, поставщика, себестоимость и цену продажи.' },
      { id: 'w2', question: 'Как оприходовать поступление товаров?', answer: 'Нажмите кнопку «Приёмка» или в строке товара нажмите иконку грузовика. Укажите количество к приёмке, поставщика и закупочную цену. Остаток обновится автоматически.' },
      { id: 'w3', question: 'Как использовать сканер штрихкодов?', answer: 'Нажмите кнопку «Сканировать» в шапке страницы склада. Поднесите штрихкод к сканеру (USB или Bluetooth). Система автоматически найдёт товар по штрихкоду.' },
      { id: 'w4', question: 'Что значат вкладки Запчасти и Товары?', answer: 'Запчасти — используются при ремонте и добавляются в заказы. Товары — продаются через кассу отдельно, без привязки к ремонту. Каждый тип имеет свои характеристики.' },
      { id: 'w5', question: 'Как включить серийный учёт?', answer: 'При создании или редактировании запчасти включите переключатель «Серийные номера». После этого при добавлении в заказ или продаже система запросит серийный номер конкретного экземпляра.' },
    ],
  },
  {
    id: 'kanban', title: 'Канбан', icon: '🗂️',
    articles: [
      { id: 'k1', question: 'Как переместить заказ в другой статус через канбан?', answer: 'В режиме «Канбан» перетащите карточку заказа из одной колонки в другую. Статус обновится автоматически.' },
      { id: 'k2', question: 'Что означают цветные полоски на карточках канбан?', answer: 'Красная полоска слева — заказ с приоритетом «Срочно». Оранжевая — приоритет «Высокий». Без полоски — нормальный приоритет.' },
    ],
  },
  {
    id: 'finance', title: 'Финансы', icon: '💰',
    articles: [
      { id: 'f1', question: 'Как добавить оплату к заказу?', answer: 'В карточке заказа перейдите на вкладку «Оплата». Введите сумму и выберите метод оплаты (наличные, карта, перевод, онлайн). Нажмите «Принять оплату».' },
      { id: 'f2', question: 'Как работает раздел «Финансы»?', answer: 'В разделе «Финансы» отображаются все доходы и расходы. Доходы создаются автоматически при выдаче заказа. Расходы можно добавить вручную (закупка запчастей, аренда и т.д.).' },
      { id: 'f3', question: 'Как добавить предоплату?', answer: 'В карточке заказа в правой панели найдите поле «Предоплата». Введите сумму и нажмите галочку. Сумма будет учтена при итоговом расчёте.' },
    ],
  },
  {
    id: 'reports', title: 'Отчёты', icon: '📊',
    articles: [
      { id: 'r1', question: 'Какие отчёты доступны?', answer: 'В разделе «Отчёты» доступны: сводка по выручке, отчёт по мастерам, статистика по устройствам, анализ источников клиентов, прибыль по периодам.' },
      { id: 'r2', question: 'Как экспортировать данные?', answer: 'В большинстве отчётов доступна кнопка экспорта в Excel/CSV. Нажмите иконку скачивания в правом верхнем углу раздела.' },
    ],
  },
  {
    id: 'employees', title: 'Сотрудники', icon: '👥',
    articles: [
      { id: 'e1', question: 'Как добавить нового сотрудника?', answer: 'Перейдите в раздел «Сотрудники» → «Добавить сотрудника». Введите имя, email и роль. Сотрудник получит письмо с приглашением для входа.' },
      { id: 'e2', question: 'Какие роли существуют?', answer: 'Владелец — полный доступ. Администратор — доступ ко всем функциям кроме настройки ролей. Мастер — только свои заказы и касса. Каждая роль настраивается в разделе «Права доступа».' },
    ],
  },
  {
    id: 'notifications', title: 'Уведомления', icon: '🔔',
    articles: [
      { id: 'n1', question: 'Как настроить уведомления клиентам?', answer: 'В разделе «Настройки» → «Уведомления» настройте шаблоны SMS и email сообщений. Уведомления отправляются автоматически при смене статуса заказа.' },
      { id: 'n2', question: 'Почему клиент не получает уведомления?', answer: 'Проверьте: 1) указан ли телефон/email клиента в заказе, 2) настроен ли провайдер SMS в настройках, 3) уведомление для данного статуса включено.' },
    ],
  },
]

export default function HelpPage() {
  const [query, setQuery] = useState('')
  const [openCategory, setOpenCategory] = useState<string | null>(null)
  const [openArticle, setOpenArticle] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!query.trim()) return FAQ_DATA
    const q = query.toLowerCase()
    return FAQ_DATA.map(cat => ({
      ...cat,
      articles: cat.articles.filter(a =>
        a.question.toLowerCase().includes(q) || a.answer.toLowerCase().includes(q)
      ),
    })).filter(cat => cat.articles.length > 0 || cat.title.toLowerCase().includes(q))
  }, [query])

  const totalArticles = FAQ_DATA.reduce((s, c) => s + c.articles.length, 0)

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-3">
          <div className="p-3 bg-blue-50 rounded-2xl">
            <HelpCircle className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-2">Справочный центр</h1>
        <p className="text-muted-foreground">{totalArticles} статей по {FAQ_DATA.length} категориям</p>
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Поиск по статьям..."
          className="w-full pl-12 pr-4 py-3.5 border-2 rounded-xl text-sm outline-none focus:border-blue-400 transition-colors"
          autoFocus
        />
      </div>

      {/* Category grid (when no search) */}
      {!query && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {FAQ_DATA.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setOpenCategory(openCategory === cat.id ? null : cat.id)}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors text-center',
                openCategory === cat.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-accent'
              )}
            >
              <span className="text-2xl">{cat.icon}</span>
              <span className="text-sm font-medium">{cat.title}</span>
              <span className="text-xs text-muted-foreground">{cat.articles.length} статей</span>
            </button>
          ))}
        </div>
      )}

      {/* Articles */}
      <div className="space-y-3">
        {(query ? filtered : (openCategory ? filtered.filter(c => c.id === openCategory) : filtered)).map(cat => (
          <div key={cat.id} className="bg-card border rounded-xl overflow-hidden">
            <div
              className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => setOpenCategory(openCategory === cat.id ? null : cat.id)}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{cat.icon}</span>
                <div>
                  <div className="font-semibold text-sm">{cat.title}</div>
                  <div className="text-xs text-muted-foreground">{cat.articles.length} статей</div>
                </div>
              </div>
              {openCategory === cat.id || query ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </div>

            {(openCategory === cat.id || query) && (
              <div className="border-t divide-y">
                {cat.articles.map(article => (
                  <div key={article.id} className="px-5">
                    <button
                      type="button"
                      className="flex items-center justify-between w-full py-3.5 text-left gap-3"
                      onClick={() => setOpenArticle(openArticle === article.id ? null : article.id)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <BookOpen className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="text-sm font-medium">{article.question}</span>
                      </div>
                      {openArticle === article.id ? (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      )}
                    </button>
                    {openArticle === article.id && (
                      <div className="pb-4 pl-6 text-sm text-muted-foreground leading-relaxed">
                        {article.answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Ничего не найдено по запросу «{query}»</p>
          </div>
        )}
      </div>
    </div>
  )
}
