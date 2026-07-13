import { useState, useEffect, useRef, useCallback } from 'react';
import Beams from '../components/Beams';
import ScrambleText from '../components/ScrambleText';
import { ArrowRight, Loader2, Info, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';

// Configurable API root
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:5000');

export default function LandingPage({ onAccessVault, initialError }) {
  const [showInput, setShowInput] = useState(false);
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError || '');
  const [showPassword, setShowPassword] = useState(false);
  const skipRef = useRef(null); // holds the skip function exposed by ScrambleText
  const inputRef = useRef(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimerRef = useRef(null);

  const handleReveal = useCallback(() => {
    setShowInput(true);
    // Auto-focus input after transition
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Click anywhere to skip scramble animation & cut straight to search input
  const handlePageClick = useCallback(() => {
    if (skipRef.current) skipRef.current();
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!key || key.length < 6) {
      setError('Key must be at least 6 characters long.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/api/vault/access`, { key });
      onAccessVault(key, response.data);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError('Unable to connect to backend server. Please verify your connection or ensure backend is running.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen w-screen overflow-hidden bg-black text-slate-200"
      onClick={handlePageClick}
    >
      {/* 1. Animated Beams Background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <Beams
          beamWidth={2}
          beamHeight={15}
          beamNumber={8}
          lightColor="#6a5acd"
          speed={1.2}
          noiseIntensity={1.2}
          scale={0.2}
          rotation={0}
        />
      </div>

      {/* 2. Centered Scramble Text & Form Overlay */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6">
        {/* Scramble Text plays automatically once; click anywhere to skip */}
        <div className="mb-10 select-none">
          <ScrambleText onComplete={handleReveal} skipRef={skipRef} isTyping={isTyping} />
        </div>

        {/* Input Form Reveal */}
        <div
          className={`flex flex-col items-center w-full max-w-md transition-all duration-300 ${showInput ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-2 pointer-events-none'
            }`}
        >
          <form onSubmit={handleSubmit} className="w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="relative group">
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter key to open or create vault..."
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  setIsTyping(true);
                  clearTimeout(typingTimerRef.current);
                  typingTimerRef.current = setTimeout(() => setIsTyping(false), 600);
                }}
                disabled={loading}
                className="w-full bg-black/60 backdrop-blur-md border border-violet-900/60 rounded-lg pl-4 pr-20 py-3 text-slate-100 font-mono text-center text-xs md:text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all duration-300 shadow-[0_0_15px_rgba(106,90,205,0.05)] focus:shadow-[0_0_20px_rgba(106,90,205,0.15)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-11 top-2.5 p-1 text-slate-500 hover:text-slate-300 transition-colors"
                aria-label={showPassword ? "Hide key" : "Show key"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="absolute right-2 top-2 p-1.5 bg-violet-600/80 hover:bg-violet-500 text-white rounded-md disabled:opacity-50 transition-colors"
                aria-label="Access Vault"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
              </button>
            </div>

            {error && (
              <p className="text-red-400 text-xs font-mono text-center bg-red-950/30 border border-red-900/40 rounded px-2 py-1.5">
                {error}
              </p>
            )}

            {/* Warning block */}
            <div className="bg-slate-950/75 backdrop-blur-sm border border-slate-900 rounded-lg p-4 text-xs text-slate-400 font-mono space-y-2 leading-relaxed">
              <div className="flex items-center gap-2 text-violet-300 font-semibold mb-1">
                <Info className="h-4 w-4 shrink-0" />
                <span>Ephemerality Rules</span>
              </div>
              <p>• Vaults expire exactly 24 hours after creation. No resets on activity.</p>
              <p>• At expiration, the vault and all its files are permanently purged.</p>
              <p>• No accounts, no password recoveries. Lost keys are lost forever.</p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
