import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export function SimpleBackground() {
  const bgRef = useRef<HTMLDivElement>(null);
  
  useGSAP(
    () => {
      if (!bgRef.current) return;
      
      gsap.set(bgRef.current, {
        scale: 1.1,
        autoAlpha: 0.7
      });
      
      gsap.to(bgRef.current, {
        scale: 1,
        autoAlpha: 1,
        duration: 1.5,
        ease: 'power3.out',
        delay: 0.3
      });
    },
    { scope: bgRef }
  );
  
  return (
    <div 
      ref={bgRef} 
      className="absolute inset-0 -z-10 w-full h-full bg-gradient-to-br from-civic-blue via-civic-blue to-civic-green" 
      aria-hidden
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-black/30" />
      {/* Animated circles for visual interest */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-civic-green/20 rounded-full blur-2xl animate-pulse" style={{animationDelay: '1s'}} />
    </div>
  );
}