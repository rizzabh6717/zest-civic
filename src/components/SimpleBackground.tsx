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
      className="absolute inset-0 -z-10 w-full h-full bg-gradient-to-br from-generative-purple via-generative-violet to-black" 
      aria-hidden
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
      {/* Organic flowing shapes to mimic shader effect */}
      <div className="absolute top-10 left-10 w-[800px] h-[600px] bg-generative-violet/30 rounded-full blur-3xl animate-pulse transform -rotate-12" />
      <div className="absolute top-1/3 right-0 w-[600px] h-[800px] bg-generative-purple/25 rounded-full blur-3xl animate-pulse transform rotate-45" style={{animationDelay: '2s'}} />
      <div className="absolute bottom-0 left-1/3 w-[700px] h-[500px] bg-generative-violet/20 rounded-full blur-3xl animate-pulse transform rotate-12" style={{animationDelay: '4s'}} />
      <div className="absolute top-0 right-1/4 w-[400px] h-[600px] bg-generative-purple/15 rounded-full blur-3xl animate-pulse transform -rotate-45" style={{animationDelay: '6s'}} />
    </div>
  );
}