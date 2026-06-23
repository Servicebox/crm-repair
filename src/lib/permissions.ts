import type { IUserPermissions } from '@/models/User'

export type PermissionKey = keyof IUserPermissions

const ALL_TRUE: IUserPermissions = {
  canViewAllOrders: true,
  canCreateOrders: true,
  canEditOrders: true,
  canDeleteOrders: true,
  canChangeStatus: true,
  canViewClients: true,
  canEditClients: true,
  canViewFinance: true,
  canManageCashRegister: true,
  canViewWarehouse: true,
  canManageWarehouse: true,
  canViewEmployees: true,
  canManageEmployees: true,
  canViewReports: true,
  canViewTelemetry: true,
  canManageSettings: true,
  canAccessSales: true,
}

export const DEFAULT_PERMISSIONS: Record<string, IUserPermissions> = {
  owner: { ...ALL_TRUE },
  admin: { ...ALL_TRUE, canDeleteOrders: false },
  manager: {
    canViewAllOrders: true,
    canCreateOrders: true,
    canEditOrders: true,
    canDeleteOrders: false,
    canChangeStatus: true,
    canViewClients: true,
    canEditClients: true,
    canViewFinance: true,
    canManageCashRegister: true,
    canViewWarehouse: true,
    canManageWarehouse: false,
    canViewEmployees: true,
    canManageEmployees: false,
    canViewReports: true,
    canViewTelemetry: true,
    canManageSettings: false,
    canAccessSales: true,
  },
  master: {
    canViewAllOrders: false,
    canCreateOrders: true,
    canEditOrders: false,
    canDeleteOrders: false,
    canChangeStatus: true,
    canViewClients: false,
    canEditClients: false,
    canViewFinance: false,
    canManageCashRegister: false,
    canViewWarehouse: true,
    canManageWarehouse: false,
    canViewEmployees: false,
    canManageEmployees: false,
    canViewReports: false,
    canViewTelemetry: false,
    canManageSettings: false,
    canAccessSales: true,
  },
}

export function getEffectivePermissions(
  user: { role: string; permissions?: Partial<IUserPermissions> }
): IUserPermissions {
  const defaults = DEFAULT_PERMISSIONS[user.role] ?? DEFAULT_PERMISSIONS.master
  if (!user.permissions) return defaults
  return { ...defaults, ...user.permissions }
}
