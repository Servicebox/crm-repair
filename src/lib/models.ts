import type mongoose from 'mongoose'
import { getUserModel } from '@/models/User'
import { getOrderModel } from '@/models/Order'
import { getClientModel } from '@/models/Client'
import { getProductModel } from '@/models/Product'
import { getTransactionModel } from '@/models/Transaction'
import { getAuditLogModel } from '@/models/AuditLog'
import { getNotificationModel } from '@/models/Notification'
import { getFiscalReceiptModel } from '@/models/FiscalReceipt'
import { getLocationModel } from '@/models/Location'
import { getServiceModel } from '@/models/Service'
import { getPayrollRecordModel } from '@/models/PayrollRecord'
import { getShiftModel } from '@/models/Shift'
import { getChatMessageModel } from '@/models/ChatMessage'
import { getChatRoomModel } from '@/models/ChatRoom'

export function getModels(conn: mongoose.Connection) {
  return {
    User: getUserModel(conn),
    Order: getOrderModel(conn),
    Client: getClientModel(conn),
    Product: getProductModel(conn),
    Transaction: getTransactionModel(conn),
    AuditLog: getAuditLogModel(conn),
    Notification: getNotificationModel(conn),
    FiscalReceipt: getFiscalReceiptModel(conn),
    Location: getLocationModel(conn),
    Service: getServiceModel(conn),
    PayrollRecord: getPayrollRecordModel(conn),
    Shift: getShiftModel(conn),
    ChatMessage: getChatMessageModel(conn),
    ChatRoom: getChatRoomModel(conn),
  }
}

export type TenantModels = ReturnType<typeof getModels>
