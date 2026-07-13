import { useState, useEffect, memo } from 'react';
import { Clock } from 'lucide-react';

/**
 * Isolated countdown timer component.
 * Isolating timer state prevents ticking intervals from triggering unnecessary 
 * top-level re-renders on the entire VaultPage container.
 */
const ExpiryTimer = memo(function ExpiryTimer({ expiresAt, onExit }) {
  const [timeLeft, setTimeLeft] = useState('');

  const formattedExpiry = new Date(expiresAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const expires = new Date(expiresAt).getTime();
      const now = Date.now();
      const diff = expires - now;

      if (diff <= 0) {
        setTimeLeft('EXPIRED');
        alert('This vault has expired and is being permanently deleted.');
        onExit();
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const hStr = hours.toString().padStart(2, '0');
      const mStr = minutes.toString().padStart(2, '0');
      const sStr = seconds.toString().padStart(2, '0');

      setTimeLeft(`${hStr}:${mStr}:${sStr}`);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExit]);

  return (
    <div className="flex items-center gap-2 text-xs text-violet-300 font-semibold select-none font-mono">
      <Clock className="h-3.5 w-3.5 text-violet-400 animate-pulse" />
      <span>
        expires at {formattedExpiry} ({timeLeft || 'calculating...'})
      </span>
    </div>
  );
});

export default ExpiryTimer;
