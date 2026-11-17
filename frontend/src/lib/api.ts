import { api, postSession, request, type StoredSession } from './session';
import type {
  AuditEntry,
  BookingStatus,
  BookingSummary,
  Cart,
  Category,
  Dashboard,
  Membership,
  Order,
  OrderStatus,
  OrderType,
  Paginated,
  Payment,
  PaymentResult,
  Plan,
  Product,
  ProductKind,
  PublicUser,
  Role,
  Schedule,
  StockMovement,
} from '../types/api';

export type CatalogFilters = {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  kind?: ProductKind;
  minPrice?: number;
  maxPrice?: number;
  availableOnly?: boolean;
  includeInactive?: boolean;
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'name';
};

export const auth = {
  register: (input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone?: string;
    birthDate?: string;
  }) => postSession('/auth/register', input),
  login: (email: string, password: string) => postSession('/auth/login', { email, password }),
  logout: async (refreshToken: string): Promise<void> => {
    await request<void>('/auth/logout', { method: 'POST', body: { refreshToken }, auth: false }).catch(
      () => undefined,
    );
  },
  session: () => api.get<PublicUser>('/auth/session'),
  forgotPassword: (email: string) =>
    api.post<{ message: string }>('/auth/forgot-password', { email }),
  resetPassword: (token: string, newPassword: string) =>
    api.post<{ message: string }>('/auth/reset-password', { token, newPassword }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ message: string }>('/auth/change-password', { currentPassword, newPassword }),
};

export const users = {
  me: () => api.get<PublicUser>('/users/me'),
  updateMe: (input: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    birthDate?: string;
  }) => api.patch<PublicUser>('/users/me', input),
  list: (query: { page?: number; limit?: number; role?: Role; search?: string }) =>
    api.get<Paginated<PublicUser>>('/users', query),
  setRole: (id: string, role: Role) => api.patch<PublicUser>(`/users/${id}/role`, { role }),
  setStatus: (id: string, isActive: boolean) =>
    api.patch<PublicUser>(`/users/${id}/status`, { isActive }),
};

export const catalog = {
  products: (filters: CatalogFilters) => api.get<Paginated<Product>>('/catalog/products', filters),
  product: (id: string) => api.get<Product>(`/catalog/products/${id}`),
  categories: () => api.get<Category[]>('/catalog/categories'),
  createCategory: (input: { name: string; slug?: string; description?: string }) =>
    api.post<Category>('/catalog/categories', input),
  updateCategory: (
    id: string,
    input: { name: string; slug?: string; description?: string; isActive?: boolean },
  ) => api.patch<Category>(`/catalog/categories/${id}`, input),
  createProduct: (input: ProductInput) => api.post<Product>('/catalog/products', input),
  updateProduct: (id: string, input: Partial<ProductInput>) =>
    api.patch<Product>(`/catalog/products/${id}`, input),
  adjustStock: (id: string, quantity: number, note?: string) =>
    api.post<StockMovement>(`/catalog/products/${id}/stock`, { quantity, note }),
  movements: (id: string) => api.get<StockMovement[]>(`/catalog/products/${id}/movements`),
};

export type ProductInput = {
  name: string;
  sku: string;
  description?: string;
  price: number;
  currency?: string;
  imageUrl?: string;
  kind: ProductKind;
  stock?: number;
  durationMinutes?: number;
  isActive?: boolean;
  categoryId: string;
};

export const cart = {
  get: () => api.get<Cart>('/cart'),
  add: (productId: string, quantity = 1) => api.post<Cart>('/cart/items', { productId, quantity }),
  setQuantity: (itemId: string, quantity: number) =>
    api.patch<Cart>(`/cart/items/${itemId}`, { quantity }),
  remove: (itemId: string) => api.del<Cart>(`/cart/items/${itemId}`),
  clear: () => api.del<Cart>('/cart'),
};

export const orders = {
  checkout: (shippingAddress: string, receiverName: string) =>
    api.post<Order>('/orders/checkout', { shippingAddress, receiverName }),
  buyMembership: (planId: string) => api.post<Order>('/orders/membership', { planId }),
  mine: (query: { page?: number; limit?: number; status?: OrderStatus }) =>
    api.get<Paginated<Order>>('/orders', query),
  admin: (query: {
    page?: number;
    limit?: number;
    status?: OrderStatus;
    search?: string;
    userId?: string;
  }) => api.get<Paginated<Order>>('/orders/admin', query),
  byId: (id: string) => api.get<Order>(`/orders/${id}`),
  setStatus: (id: string, status: OrderStatus, note?: string) =>
    api.patch<Order>(`/orders/${id}/status`, { status, note }),
};

export const payments = {
  pay: (input: {
    orderId: string;
    card: {
      number: string;
      holderName: string;
      expiryMonth: number;
      expiryYear: number;
      cvv: string;
    };
    idempotencyKey?: string;
  }) => api.post<PaymentResult>('/payments', input),
  forOrder: (orderId: string) => api.get<Payment | null>(`/payments/order/${orderId}`),
};

export const memberships = {
  plans: () => api.get<Plan[]>('/memberships/plans'),
  mine: () => api.get<Membership[]>('/memberships/me'),
  active: () => api.get<{ id: string; planId: string; endDate: string } | null>(
    '/memberships/me/active',
  ),
  cancel: (id: string) => api.patch<Membership>(`/memberships/${id}/cancel`),
  adminPlans: () => api.get<Plan[]>('/memberships/admin/plans'),
  createPlan: (input: PlanInput) => api.post<Plan>('/memberships/plans', input),
  updatePlan: (id: string, input: Partial<PlanInput>) =>
    api.patch<Plan>(`/memberships/plans/${id}`, input),
};

export type PlanInput = {
  name: string;
  description?: string;
  price: number;
  durationDays: number;
  accessLevel: 'BASIC' | 'PREMIUM' | 'ATHLETE';
  includesClasses?: boolean;
  isActive?: boolean;
};

export const bookings = {
  schedules: (
    query: { page?: number; limit?: number; from?: string; to?: string; includeInactive?: boolean } = {},
  ) => api.get<Paginated<Schedule>>('/bookings/schedules', query),
  book: (scheduleId: string) => api.post<Schedule>('/bookings', { scheduleId }),
  mine: (history = false) =>
    api.get<BookingSummary[]>('/bookings/me', { history: history ? 'true' : undefined }),
  cancel: (id: string) => api.patch<{ message: string }>(`/bookings/${id}/cancel`),
  createSchedule: (input: ScheduleInput) => api.post<Schedule>('/bookings/schedules', input),
  updateSchedule: (id: string, input: Partial<ScheduleInput>) =>
    api.patch<Schedule>(`/bookings/schedules/${id}`, input),
  all: (query: { page?: number; limit?: number; scheduleId?: string; status?: BookingStatus }) =>
    api.get<Paginated<import('../types/api').BookingRow>>('/bookings/all', query),
  setAttendance: (id: string, status: BookingStatus) =>
    api.patch<{ id: string; status: BookingStatus }>(`/bookings/${id}/attendance`, { status }),
};

export type ScheduleInput = {
  title: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  room?: string;
  trainerId?: string;
  productId?: string;
  isActive?: boolean;
};

export const notifications = {
  list: (limit = 30) =>
    api.get<{ items: import('../types/api').NotificationItem[]; unread: number }>(
      '/notifications',
      { limit },
    ),
  markRead: (id: string) => api.patch<import('../types/api').NotificationItem>(
    `/notifications/${id}/read`,
  ),
};

export const admin = {
  dashboard: (days = 30, lowStockThreshold = 5) =>
    api.get<Dashboard>('/admin/dashboard', { days, lowStockThreshold }),
  audit: (limit = 100) => api.get<AuditEntry[]>('/admin/audit', { limit }),
};

export type { OrderType, StoredSession };
