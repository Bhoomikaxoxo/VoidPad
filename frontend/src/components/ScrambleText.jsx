import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';

// Register the ScrambleTextPlugin with GSAP
gsap.registerPlugin(ScrambleTextPlugin);

// Final text values for each span
const FINAL_TEXTS = [
  { id: 'scramble-text-1', text: 'Void Vault.' },
  { id: 'scramble-text-2', text: 'No accounts, no history.' },
  { id: 'scramble-text-3', text: '24 hours,' },
  { id: 'scramble-text-4', text: 'GONE' },
  { id: 'scramble-text-5', text: 'forever.' },
];

// Character pools per span (matches original animation flavour)
const CHAR_POOLS = [
  'abcdefghijklmnopqrstuvwxyz',   // Void Vault. — lowercase
  'XxOo',                          // No accounts — XO style
  '0123456789',                    // 24 hours — digits
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ',   // GONE — uppercase
  'abcdefghijklmnopqrstuvwxyz',   // forever. — lowercase
];

export default function ScrambleText({ onComplete, skipRef, isTyping }) {
  const tlRef = useRef(null);
  const completedRef = useRef(false);

  useEffect(() => {
    const tl = gsap.timeline({
      id: 'void-vault-intro',
      defaults: { ease: 'none' },
      onComplete: () => {
        completedRef.current = true;
        onComplete?.();
      }
    });

    tl.to('#scramble-text-1', {
      scrambleText: { text: 'Void Vault.', chars: 'lowerCase' },
      duration: 2
    })
      .to('#scramble-text-2', {
        scrambleText: { text: 'No accounts, no history.', chars: 'XO', speed: 0.4 },
        duration: 2
      })
      .to('#scramble-text-3', {
        scrambleText: { text: '24 hours,', chars: '0123456789' },
        duration: 2
      })
      .to('#scramble-text-4', {
        scrambleText: { text: 'GONE', chars: 'upperCase', speed: 0.3 },
        duration: 1
      })
      .to('#scramble-text-5', {
        scrambleText: { text: 'forever.', chars: 'lowerCase', speed: 0.3 },
        duration: 1.5
      });

    tlRef.current = tl;

    // Expose skip function to parent via ref
    if (skipRef) {
      skipRef.current = () => {
        if (completedRef.current) return; // already done
        completedRef.current = true;
        tl.kill();
        // Instantly set all spans to their final text
        FINAL_TEXTS.forEach(({ id, text }) => {
          const el = document.getElementById(id);
          if (el) el.textContent = text;
        });
        onComplete?.();
      };
    }

    return () => {
      tl.kill();
    };
  }, [onComplete, skipRef]);

  // --- Typing scramble effect ---
  // When the user types, randomly scramble ~30% of chars every 80ms
  useEffect(() => {
    if (!isTyping) {
      // Restore final text when typing stops
      FINAL_TEXTS.forEach(({ id, text }) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
      });
      return;
    }

    const interval = setInterval(() => {
      FINAL_TEXTS.forEach(({ id, text }, i) => {
        const el = document.getElementById(id);
        if (!el) return;
        const pool = CHAR_POOLS[i];
        el.textContent = text
          .split('')
          .map(char =>
            char === ' ' || char === '.' || char === ',' || Math.random() > 0.3
              ? char
              : pool[Math.floor(Math.random() * pool.length)]
          )
          .join('');
      });
    }, 80);

    return () => {
      clearInterval(interval);
      // Snap back to final text on cleanup
      FINAL_TEXTS.forEach(({ id, text }) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
      });
    };
  }, [isTyping]);

  return (
    <div className="text-scramble__content flex flex-col items-center gap-3">
      {/* Title Line */}
      <h1 className="font-bold text-violet-400 select-none" style={{ fontSize: 'max(2.4rem, min(6vw + 0.5rem, 3.4rem))', lineHeight: 1.2 }}>
        <span id="scramble-text-1"></span>
      </h1>

      {/* Subtitle Line */}
      <p className="text-scramble__subtitle text-slate-400 font-medium select-none" style={{ fontSize: 'max(1.05rem, min(2.2vw + 0.2rem, 1.3rem))', lineHeight: 1.5 }} aria-hidden="true">
        <span id="scramble-text-2" className="text-gray-400 font-normal"></span>{" "}
        <span id="scramble-text-3" className="text-yellow-500 font-semibold"></span>{" "}
        <span id="scramble-text-4" className="text-red-500 font-bold tracking-wider"></span>{" "}
        <span id="scramble-text-5" className="text-violet-300"></span>
      </p>
    </div>
  );
}
