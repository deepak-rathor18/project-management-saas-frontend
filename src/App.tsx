import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';

const Shell = lazy(() => import('./components/Shell'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const ProjectPage = lazy(() => import('./pages/ProjectPage'));
const OrganizationPage = lazy(() => import('./pages/OrganizationPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const ActivityPage = lazy(() => import('./pages/ActivityPage'));

function RouteLoading() {
  return <div className="page-loading"><span className="spinner" /> Loading page…</div>;
}

function ProtectedApp() {
  const { user, isInitializing } = useAuth();
  if (isInitializing) return <RouteLoading />;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <Shell>
      <Routes>
        <Route index element={<DashboardPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:projectId" element={<ProjectPage />} />
        <Route path="organization" element={<OrganizationPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/*" element={<ProtectedApp />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
