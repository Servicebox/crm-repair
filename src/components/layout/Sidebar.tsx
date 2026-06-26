'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/lib/sidebar-context'
import {
  Home, ClipboardList, Users, Package, DollarSign, BarChart2,
  Settings, HelpCircle, Bell, Shield, FileText, Upload,
  Wrench, ShoppingBag, Store, MessageCircle, TrendingUp,
  ChevronDown, ChevronRight, LogOut, User, Bot, RotateCcw,
  Menu, X, Sun, Moon, MapPin, Code2, Tag, Receipt, Clock, Globe, BookOpen,
} from 'lucide-react'

interface NavItem {
  label: string
  href?: string
  icon: React.ComponentType<{ className?: string }>
  children?: NavItem[]
  badge?: string | number
  roles?: string[]
  platformOnly?: boolean
}

const NAV: NavItem[] = [
  { label: 'Главная', href: '/dashboard', icon: Home },
  {
    label: 'Работа',
    icon: Wrench,
    children: [
      { label: 'Заказы', href: '/orders', icon: ClipboardList },
      { label: 'Мои заказы', href: '/my-orders', icon: ClipboardList },
      { label: 'Мой заработок', href: '/my-earnings', icon: DollarSign },
      { label: 'Телеметрия', href: '/telemetry', icon: BarChart2 },
      { label: 'AI-помощник', href: '/ai', icon: Bot },
    ],
  },
  {
    label: 'Клиенты',
    icon: Users,
    children: [
      { label: 'Все клиенты', href: '/clients', icon: Users },
      { label: 'Возврат клиентов', href: '/clients/return', icon: RotateCcw },
      { label: 'Воронка продаж', href: '/funnel', icon: TrendingUp },
    ],
  },
  {
    label: 'Продажи',
    icon: ShoppingBag,
    children: [
      { label: 'Касса', href: '/sales', icon: ShoppingBag },
      { label: 'Запасные части', href: '/warehouse', icon: Package },
      { label: 'Маркетплейс', href: '/marketplace', icon: Store },
    ],
  },
  {
    label: 'Деньги',
    icon: DollarSign,
    children: [
      { label: 'Финансы', href: '/finance', icon: DollarSign },
      { label: 'Отчёты', href: '/reports', icon: BarChart2 },
    ],
  },
  {
    label: 'Управление',
    icon: Settings,
    children: [
      { label: 'Сотрудники', href: '/employees', icon: Users, roles: ['owner', 'admin'] },
      { label: 'Смены', href: '/shifts', icon: Clock, roles: ['owner', 'admin'] },
      { label: 'Права доступа', href: '/settings/permissions', icon: Shield, roles: ['owner', 'admin'] },
      { label: 'Уведомления', href: '/notifications', icon: Bell },
      { label: 'Гарантии', href: '/warranties', icon: Shield },
      { label: 'Журнал', href: '/journal', icon: FileText },
      { label: 'Импорт', href: '/import', icon: Upload },
      { label: 'Услуги', href: '/services', icon: Wrench },
      { label: 'Чат', href: '/chat', icon: MessageCircle },
      { label: 'Локации', href: '/locations', icon: MapPin, roles: ['owner', 'admin'] },
      { label: 'API и интеграции', href: '/settings/api', icon: Code2, roles: ['owner', 'admin'] },
      { label: 'Библиотека данных', href: '/settings/dictionary', icon: BookOpen, roles: ['owner', 'admin'] },
      { label: 'Форма приёмки', href: '/settings/reception', icon: ClipboardList, roles: ['owner', 'admin'] },
      { label: 'Шаблоны документов', href: '/settings/documents', icon: FileText, roles: ['owner', 'admin'] },
      { label: 'Этикетка', href: '/settings/label', icon: Tag, roles: ['owner', 'admin'] },
      { label: 'Кассы', href: '/settings/cashier', icon: Receipt, roles: ['owner', 'admin'] },
    ],
  },
  { label: 'Настройки', href: '/settings', icon: Settings },
  { label: 'Справка', href: '/help', icon: HelpCircle },
  { label: 'Поддержка', href: '/support', icon: HelpCircle },
  { label: 'Платформа', href: '/platform', icon: Globe, platformOnly: true },
]

function NavItemComponent({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const userRole = session?.user?.role

  const [open, setOpen] = useState(() => {
    if (!item.children) return false
    return item.children.some(c => c.href && pathname.startsWith(c.href))
  })

  if (item.roles && !item.roles.includes(userRole ?? '')) return null
  if (item.platformOnly && session?.user?.email !== process.env.NEXT_PUBLIC_PLATFORM_OWNER_EMAIL) return null

  if (item.children) {
    return (
      <div>
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent',
            depth > 0 && 'pl-8'
          )}
        >
          <item.icon className="w-4 h-4 shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        {open && (
          <div className="mt-0.5 space-y-0.5">
            {item.children.map(child => (
              <NavItemComponent key={child.href ?? child.label} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  const isActive = item.href ? pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href)) : false

  return (
    <Link
      href={item.href ?? '#'}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
        depth > 0 && 'pl-8',
        isActive
          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
          : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent'
      )}
    >
      <item.icon className="w-4 h-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.badge && (
        <span className="text-xs bg-blue-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
          {item.badge}
        </span>
      )}
    </Link>
  )
}

function SidebarContent({
  collapsed,
  darkMode,
  toggleDarkMode,
  onNavClick,
}: {
  collapsed: boolean
  darkMode: boolean
  toggleDarkMode: () => void
  onNavClick?: () => void
}) {
  return (
    <>
      <nav className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-0.5" onClick={onNavClick}>
        {!collapsed &&
          NAV.map(item => (
            <NavItemComponent key={item.href ?? item.label} item={item} />
          ))}
        {collapsed &&
          NAV.flatMap(item =>
            item.children
              ? item.children.map(child => (
                  <Link
                    key={child.href}
                    href={child.href ?? '#'}
                    title={child.label}
                    className="flex items-center justify-center p-2.5 rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  >
                    <child.icon className="w-5 h-5" />
                  </Link>
                ))
              : [
                  <Link
                    key={item.href}
                    href={item.href ?? '#'}
                    title={item.label}
                    className="flex items-center justify-center p-2.5 rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  >
                    <item.icon className="w-5 h-5" />
                  </Link>,
                ]
          )}
      </nav>

      <div className="p-2 border-t border-sidebar-border space-y-0.5 shrink-0">
        <button
          onClick={toggleDarkMode}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors',
            collapsed && 'justify-center'
          )}
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {!collapsed && <span>{darkMode ? 'Светлая' : 'Тёмная'}</span>}
        </button>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-colors',
            collapsed && 'justify-center'
          )}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span>Выйти</span>}
        </button>
      </div>
    </>
  )
}

export default function Sidebar() {
  const { data: session } = useSession()
  const { mobileOpen, setMobileOpen } = useSidebar()
  const [collapsed, setCollapsed] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

  function toggleDarkMode() {
    setDarkMode(!darkMode)
    document.documentElement.classList.toggle('dark')
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-200',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {collapsed ? (
          <div className="flex items-center justify-center h-14 border-b border-sidebar-border shrink-0">
            <button
              onClick={() => setCollapsed(false)}
              className="text-sidebar-foreground/50 hover:text-sidebar-foreground p-2 rounded"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 h-14 border-b border-sidebar-border shrink-0">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <Wrench className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-sidebar-foreground">SERVICE BOX</div>
              <div className="text-xs text-sidebar-foreground/60 truncate">{session?.user?.name}</div>
            </div>
            <button
              onClick={() => setCollapsed(true)}
              className="text-sidebar-foreground/50 hover:text-sidebar-foreground p-1 rounded"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        )}

        <SidebarContent
          collapsed={collapsed}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
        />
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
            <div className="flex items-center gap-3 px-4 h-14 border-b border-sidebar-border shrink-0">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
                <Wrench className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-sidebar-foreground">SERVICE BOX</div>
                <div className="text-xs text-sidebar-foreground/60 truncate">{session?.user?.name}</div>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-sidebar-foreground/50 hover:text-sidebar-foreground p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <SidebarContent
              collapsed={false}
              darkMode={darkMode}
              toggleDarkMode={toggleDarkMode}
              onNavClick={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}
    </>
  )
}
