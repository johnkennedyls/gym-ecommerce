import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { RequireAuth, RequireRole } from './components/Guards';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { CatalogPage } from './pages/CatalogPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrdersPage } from './pages/OrdersPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { PlansPage } from './pages/PlansPage';
import { MyMembershipsPage } from './pages/MyMembershipsPage';
import { ClassesPage } from './pages/ClassesPage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { DashboardPage } from './pages/admin/DashboardPage';
import { AdminProductsPage } from './pages/admin/AdminProductsPage';
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminPlansPage } from './pages/admin/AdminPlansPage';
import { AdminSchedulesPage } from './pages/admin/AdminSchedulesPage';
import { AdminBookingsPage } from './pages/admin/AdminBookingsPage';
import { AdminAuditPage } from './pages/admin/AdminAuditPage';
import { EmptyState } from './components/ui';

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<CatalogPage />} />
        <Route path="/productos/:id" element={<ProductDetailPage />} />
        <Route path="/membresias" element={<PlansPage />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegisterPage />} />
        <Route path="/recuperar" element={<ForgotPasswordPage />} />
        <Route path="/restablecer" element={<ResetPasswordPage />} />

        <Route
          path="/carrito"
          element={
            <RequireAuth>
              <CartPage />
            </RequireAuth>
          }
        />
        <Route
          path="/pago"
          element={
            <RequireAuth>
              <CheckoutPage />
            </RequireAuth>
          }
        />
        <Route
          path="/pedidos"
          element={
            <RequireAuth>
              <OrdersPage />
            </RequireAuth>
          }
        />
        <Route
          path="/pedidos/:id"
          element={
            <RequireAuth>
              <OrderDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/clases"
          element={
            <RequireAuth>
              <ClassesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/mis-membresias"
          element={
            <RequireAuth>
              <MyMembershipsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/mis-reservas"
          element={
            <RequireAuth>
              <MyBookingsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/notificaciones"
          element={
            <RequireAuth>
              <NotificationsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/perfil"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />

        <Route
          path="/admin"
          element={
            <RequireRole roles={['ADMIN']}>
              <DashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/productos"
          element={
            <RequireRole roles={['ADMIN']}>
              <AdminProductsPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/pedidos"
          element={
            <RequireRole roles={['ADMIN']}>
              <AdminOrdersPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/usuarios"
          element={
            <RequireRole roles={['ADMIN']}>
              <AdminUsersPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/planes"
          element={
            <RequireRole roles={['ADMIN']}>
              <AdminPlansPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/horarios"
          element={
            <RequireRole roles={['ADMIN', 'STAFF']}>
              <AdminSchedulesPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/reservas"
          element={
            <RequireRole roles={['ADMIN', 'STAFF']}>
              <AdminBookingsPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/auditoria"
          element={
            <RequireRole roles={['ADMIN']}>
              <AdminAuditPage />
            </RequireRole>
          }
        />

        <Route path="/inicio" element={<Navigate to="/" replace />} />
        <Route
          path="*"
          element={
            <EmptyState
              title="Página no encontrada"
              description="La ruta solicitada no existe en la tienda."
            />
          }
        />
      </Routes>
    </AppShell>
  );
}
