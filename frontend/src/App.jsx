import { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import VaultPage from './pages/VaultPage';
import { Loader2 } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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
        <p className="text-[10px] text-slate-600 mt-2">Connecting to Void Pad backend (Render cold-start check)</p>
      </div>
    );
  }

  if (route.page === 'vault' && vaultData) {
    return (
      <VaultPage
        vaultKey={vaultKey}
        initialVault={vaultData}
        onExit={handleLeaveVault}
      />
    );
  }

  return (
    <LandingPage
      onAccessVault={handleAccessVault}
      initialError={error}
    />
  );
}
