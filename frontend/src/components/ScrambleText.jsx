import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';

// Register the ScrambleTextPlugin with GSAP
gsap.registerPlugin(ScrambleTextPlugin);

export default function ScrambleText({ onComplete }) {
  useEffect(() => {
    // 5-span scramble animation timeline matching the requested specs
    const tl = gsap.timeline({
      id: 'void-vault-intro',
      defaults: { ease: 'none' },
      onComplete: onComplete
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
        scrambleText: { text: ' 24 hours,', chars: '0123456789' },
        duration: 2
      })
      .to('#scramble-text-4', {
        scrambleText: { text: 'GONE', chars: 'upperCase', speed: 0.3 },
        duration: 1
      })
      .to('#scramble-text-5', {
        scrambleText: { text: ' forever.', chars: 'lowerCase', speed: 0.3 },
        duration: 1.5
      });

    return () => {
      tl.kill();
    };
  }, [onComplete]);

  return (
    <div className="text-scramble__content">
      <p className="text-scramble__text" aria-hidden="true">
        <span id="scramble-text-1" className="text-violet-400"></span>
        <span id="scramble-text-2" className="text-gray-400 font-normal"></span>
        <span id="scramble-text-3" className="text-yellow-500 font-semibold"></span>
        <span id="scramble-text-4" className="text-red-500 font-bold tracking-wider"></span>
        <span id="scramble-text-5" className="text-violet-300"></span>
      </p>
    </div>
  );
}
