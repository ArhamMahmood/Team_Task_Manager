import { AuthProvider, useAuth } from './auth/AuthContext';
import { AuthPage } from './components/AuthPage';
import { Dashboard } from './components/Dashboard';
import { FullPageSpinner } from './components/Spinner';

function Root() {
  const { user, loading } = useAuth();

  if (loading) return <FullPageSpinner label="Loading your workspace..." />;
  return user ? <Dashboard /> : <AuthPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
