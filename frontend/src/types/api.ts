/**
 * Tipos espejo de las vistas que expone la API NestJS (backend/src/modules/**).
 * Cualquier cambio en el contrato del backend debe reflejarse aquí.
 */

export type Role = 'CLIENT' | 'STAFF' | 'ADMIN';
export type ProductKind = 'PRODUCT' | 'SERVICE';
export type MembershipLevel = 'BASIC' | 'PREMIUM' | 'ATHLETE';
export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PREPARING'
  | 'SHIPPED'
  | 'COMPLETED'
  | 'CANCELLED';
export type OrderType = 'CATALOG' | 'MEMBERSHIP';
export type PaymentStatus = 'CREATED' | 'APPROVED' | 'DECLINED' | 'ERROR';
export type MembershipStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
export type BookingStatus = 'CONFIRMED' | 'ATTENDED' | 'NO_SHOW' | 'CANCELLED';

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type PublicUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  phone: string | null;
  birthDate: string | null;
  isActive: boolean;
  createdAt: string;
};

export type Session = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: PublicUser;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
};

export type Product = {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  price: number;
  currency: string;
  imageUrl: string | null;
  kind: ProductKind;
  stock: number | null;
  durationMinutes: number | null;
  isActive: boolean;
  available: boolean;
  category: { id: string; name: string; slug: string };
};

export type StockMovement = {
  id: string;
  productId: string;
  userId: string | null;
  type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'SALE' | 'CANCELLATION';
  quantity: number;
  resultingStock: number;
  referenceCode: string | null;
  note: string | null;
  createdAt: string;
};

export type CartLine = {
  id: string;
  productId: string;
  productName: string;
  kind: ProductKind;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  available: boolean;
};

export type Cart = {
  id: string;
  items: CartLine[];
  totals: { subtotal: number; total: number; units: number };
};

export type OrderLine = {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type Order = {
  id: string;
  code: string;
  status: OrderStatus;
  statusLabel: string;
  type: OrderType;
  subtotal: number;
  total: number;
  currency: string;
  shippingAddress: string | null;
  receiverName: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderLine[];
};

export type Payment = {
  id: string;
  orderId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  gateway: string;
  reference: string | null;
  cardLast4: string | null;
  failureReason: string | null;
  createdAt: string;
};

export type PaymentResult = { payment: Payment; order: Order };

export type Plan = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  durationDays: number;
  accessLevel: MembershipLevel;
  includesClasses: boolean;
  isActive: boolean;
};

export type Membership = {
  id: string;
  plan: { id: string; name: string };
  startDate: string;
  endDate: string;
  status: MembershipStatus;
  daysRemaining: number;
};

export type Schedule = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  room: string | null;
  trainer: string | null;
  service: string | null;
  isActive: boolean;
  taken: number;
  remaining: number;
  myBooking: { id: string; status: BookingStatus } | null;
};

export type BookingSummary = {
  id: string;
  status: BookingStatus;
  title: string;
  startsAt: string;
};

export type BookingRow = {
  id: string;
  status: BookingStatus;
  student: string;
  title: string;
  startsAt: string;
};

export type NotificationItem = {
  id: string;
  userId: string;
  event: string;
  title: string;
  body: string;
  channel: string;
  deliveryStatus: 'PENDING' | 'SENT' | 'FAILED';
  readAt: string | null;
  createdAt: string;
};

export type Dashboard = {
  periodDays: number;
  since: string;
  sales: { revenue: number; paidOrders: number; averageTicket: number };
  ordersByStatus: Partial<Record<OrderStatus, number>>;
  topProducts: { productName: string; quantity: number; revenue: number }[];
  memberships: { active: number };
  bookings: { upcomingConfirmed: number };
  inventory: {
    activeProducts: number;
    lowStock: { name: string; sku: string; stock: number | null }[];
  };
  usersByRole: Partial<Record<Role, number>>;
};

export type AuditEntry = {
  id: string;
  userId: string | null;
  action: string;
  entityName: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
};
