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
      className="absolute inset-0 -z-10 w-full h-full bg-black" 
      aria-hidden
    >
      {/* Floating blueish-purple animated elements */}
      <div className="absolute top-20 left-20 w-[600px] h-[400px] bg-gradient-to-r from-blue-500/20 to-purple-600/30 rounded-full blur-3xl animate-pulse transform -rotate-12" 
           style={{
             animation: 'float1 8s ease-in-out infinite',
             animationDelay: '0s'
           }} />
      
      <div className="absolute top-1/2 right-10 w-[500px] h-[700px] bg-gradient-to-br from-purple-500/25 to-indigo-600/20 rounded-full blur-3xl transform rotate-45" 
           style={{
             animation: 'float2 12s ease-in-out infinite',
             animationDelay: '2s'
           }} />
      
      <div className="absolute bottom-10 left-1/4 w-[800px] h-[300px] bg-gradient-to-l from-violet-500/15 to-blue-600/25 rounded-full blur-3xl transform rotate-12" 
           style={{
             animation: 'float3 10s ease-in-out infinite',
             animationDelay: '4s'
           }} />
      
      <div className="absolute top-10 right-1/3 w-[400px] h-[500px] bg-gradient-to-t from-purple-600/20 to-blue-500/15 rounded-full blur-3xl transform -rotate-30" 
           style={{
             animation: 'float4 14s ease-in-out infinite',
             animationDelay: '1s'
           }} />
      
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[600px] bg-gradient-to-bl from-indigo-500/20 to-purple-500/25 rounded-full blur-3xl transform rotate-60" 
           style={{
             animation: 'float5 9s ease-in-out infinite',
             animationDelay: '3s'
           }} />

      {/* Subtle overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />
    </div>
  );
}