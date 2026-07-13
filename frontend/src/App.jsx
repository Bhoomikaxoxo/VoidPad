import { useState, useEffect, Component } from 'react';
import LandingPage from './pages/LandingPage';
import VaultPage from './pages/VaultPage';
import { Loader2, AlertTriangle } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:5000');

function getInitialRoute() {
  const path = window.location.pathname;
  if (path.startsWith('/v/')) {
    const key = path.substring(3);
    if (key && key.length >= 6) {
      return { page: 'vault', key };
    }
  }
  return { page: 'landing' };
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Vault App Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#030305] text-slate-100 flex flex-col items-center justify-center p-6 font-mono">
          <div className="bg-red-950/30 border border-red-900/50 rounded-xl max-w-md w-full p-6 text-center shadow-2xl space-y-4">
            <AlertTriangle className="h-10 w-10 text-red-500 mx-auto" />
            <h2 className="text-sm font-bold text-red-400 tracking-wider uppercase">Vault Render Warning</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              {this.state.error?.message || 'An unexpected error occurred while loading this vault.'}
            </p>
            <button
              onClick={() => {
                window.history.pushState(null, '', '/');
                window.location.reload();
              }}
              className="px-4 py-2 bg-violet-600/80 hover:bg-violet-500 text-white text-xs font-semibold rounded transition-colors"
            >
              Return to Home Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [route, setRoute] = useState(getInitialRoute);
  const [vaultKey, setVaultKey] = useState('');
  const [vaultData, setVaultData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle URL changes (browser back/forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      setRoute(getInitialRoute());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch vault data when mounting directly on a vault URL (e.g. sharing link)
  useEffect(() => {
    if (route.page === 'vault' && !vaultData) {
      const fetchVault = async () => {
        setLoading(true);
        setError('');
        try {
          const response = await axios.post(`${API_URL}/api/vault/access`, { key: route.key });
          setVaultKey(route.key);
          setVaultData(response.data);
        } catch (err) {
          console.error(err);
          // Redirect back to landing on failure
          window.history.pushState(null, '', '/');
          setRoute({ page: 'landing' });
          if (err.response && err.response.data && err.response.data.error) {
            setError(err.response.data.error);
          } else {
            setError('Failed to load shared vault. Server may still be waking up.');
          }
        } finally {
          setLoading(false);
        }
      };
      fetchVault();
    }
  }, [route, vaultData]);

  const handleAccessVault = (key, data) => {
    window.history.pushState(null, '', `/v/${key}`);
    setVaultKey(key);
    setVaultData(data);
    setRoute({ page: 'vault', key });
  };

  const handleLeaveVault = () => {
    window.history.pushState(null, '', '/');
    setVaultKey('');
    setVaultData(null);
    setError('');
    setRoute({ page: 'landing' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-slate-100 flex flex-col items-center justify-center font-mono">
        <Loader2 className="h-10 w-10 animate-spin text-violet-500 mb-4" />
        <p className="text-sm text-slate-400">Accessing secure vault...</p>
        <p className="text-[10px] text-slate-600 mt-2">Connecting to Void Vault backend...</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {route.page === 'vault' && vaultData ? (
        <VaultPage
          vaultKey={vaultKey}
          initialVault={vaultData}
          onExit={handleLeaveVault}
        />
      ) : (
        <LandingPage
          onAccessVault={handleAccessVault}
          initialError={error}
        />
      )}
    </ErrorBoundary>
  );
}
