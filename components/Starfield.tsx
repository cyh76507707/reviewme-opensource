'use client';

import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  z: number;
  size: number;
  brightness: number;
  hue: number;
  twinkleOffset: number;
  vx: number;
  vy: number;
  angle: number;
  distance: number;
  orbitSpeed: number;
}

interface StarfieldProps {
  density?: number;
  speed?: number;
  mouseInteraction?: boolean;
  mouseRepulsion?: boolean;
  twinkleIntensity?: number;
  hueShift?: number;
  glowIntensity?: number;
  className?: string;
}

export default function Starfield({
  density = 1,
  speed = 1,
  mouseInteraction = true,
  mouseRepulsion = true,
  twinkleIntensity = 0.3,
  hueShift = 140,
  glowIntensity = 0.3,
  className = '',
}: StarfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const mouseRef = useRef({ x: 0.5, y: 0.5, active: false });
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
      initStars();
    };

    // Initialize stars (60% of original - 180 stars)
    const initStars = () => {
      const numStars = Math.floor(180 * density);
      starsRef.current = [];
      
      for (let i = 0; i < numStars; i++) {
        const x = Math.random();
        const y = Math.random();
        const centerX = 0.5;
        const centerY = 0.5;
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        
        starsRef.current.push({
          x,
          y,
          z: Math.random(),
          size: Math.random() * 2.5 + 0.5,
          brightness: Math.random() * 0.6 + 0.4,
          hue: Math.random() * 360,
          twinkleOffset: Math.random() * Math.PI * 2,
          vx: 0,
          vy: 0,
          angle,
          distance,
          orbitSpeed: (Math.random() - 0.5) * 0.0003,
        });
      }
    };

    // Mouse handlers
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
        active: true,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    // Animation loop
    let time = 0;
    const animate = () => {
      time += 0.016 * speed;
      
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Draw stars
      starsRef.current.forEach((star) => {
        // Animate Z-axis (depth movement)
        star.z += 0.0003 * speed;
        if (star.z > 1) star.z = 0;
        if (star.z < 0) star.z = 1;
        
        // Calculate position based on depth
        const scale = 1 - star.z * 0.7;
        
        // Rotation effect around center
        star.angle += star.orbitSpeed * speed;
        const centerX = width * 0.5;
        const centerY = height * 0.5;
        const rotatedX = centerX + Math.cos(star.angle) * star.distance * width;
        const rotatedY = centerY + Math.sin(star.angle) * star.distance * height;
        
        let starX = rotatedX;
        let starY = rotatedY;

        // Mouse interaction with parallax
        if (mouseInteraction && mouseRef.current.active) {
          const mouseX = mouseRef.current.x * width;
          const mouseY = mouseRef.current.y * height;
          
          // Parallax effect based on depth
          const parallaxStrength = (1 - star.z) * 30;
          const dx = (mouseX - width / 2) * 0.03 * parallaxStrength;
          const dy = (mouseY - height / 2) * 0.03 * parallaxStrength;
          starX += dx;
          starY += dy;
          
          // Repulsion effect
          const distX = starX - mouseX;
          const distY = starY - mouseY;
          const dist = Math.sqrt(distX * distX + distY * distY);

          if (mouseRepulsion && dist < 250) {
            const force = (1 - dist / 250) * 2.5;
            star.vx += (distX / dist) * force * 0.8;
            star.vy += (distY / dist) * force * 0.8;
          }
        }

        // Apply velocity with damping
        star.vx *= 0.92;
        star.vy *= 0.92;
        starX += star.vx;
        starY += star.vy;

        // Soft boundary wrap
        if (starX < -50) starX = width + 50;
        if (starX > width + 50) starX = -50;
        if (starY < -50) starY = height + 50;
        if (starY > height + 50) starY = -50;

        // Twinkle effect with more variation
        const twinkle = Math.sin(time * 2 + star.twinkleOffset) * twinkleIntensity + (1 - twinkleIntensity);
        const brightness = star.brightness * twinkle * scale;

        // Calculate color with hue shift
        const hue = (star.hue + hueShift) % 360;
        const alpha = brightness;

        // Enhanced glow with multiple layers
        const baseSize = star.size * scale;
        const glowSize = baseSize * (2 + glowIntensity * 3);
        
        // Outer glow (large, soft)
        const outerGradient = ctx.createRadialGradient(starX, starY, 0, starX, starY, glowSize * 2);
        outerGradient.addColorStop(0, `hsla(${hue}, 80%, 90%, ${alpha * 0.6})`);
        outerGradient.addColorStop(0.2, `hsla(${hue}, 75%, 75%, ${alpha * 0.4})`);
        outerGradient.addColorStop(0.5, `hsla(${hue}, 70%, 60%, ${alpha * 0.2})`);
        outerGradient.addColorStop(1, `hsla(${hue}, 60%, 50%, 0)`);
        
        ctx.fillStyle = outerGradient;
        ctx.beginPath();
        ctx.arc(starX, starY, glowSize * 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Middle glow (medium, brighter)
        const middleGradient = ctx.createRadialGradient(starX, starY, 0, starX, starY, glowSize);
        middleGradient.addColorStop(0, `hsla(${hue}, 85%, 95%, ${alpha * 0.9})`);
        middleGradient.addColorStop(0.4, `hsla(${hue}, 80%, 85%, ${alpha * 0.6})`);
        middleGradient.addColorStop(1, `hsla(${hue}, 75%, 70%, 0)`);
        
        ctx.fillStyle = middleGradient;
        ctx.beginPath();
        ctx.arc(starX, starY, glowSize, 0, Math.PI * 2);
        ctx.fill();

        // Star core (bright center)
        ctx.fillStyle = `hsla(${hue}, 100%, 100%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(starX, starY, baseSize * 0.8, 0, Math.PI * 2);
        ctx.fill();
        
        // Add cross flare for brighter stars
        if (star.size > 1.5 && brightness > 0.6) {
          ctx.strokeStyle = `hsla(${hue}, 90%, 95%, ${alpha * 0.4})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(starX - glowSize, starY);
          ctx.lineTo(starX + glowSize, starY);
          ctx.moveTo(starX, starY - glowSize);
          ctx.lineTo(starX, starY + glowSize);
          ctx.stroke();
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    // Setup
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    if (mouseInteraction) {
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('mouseleave', handleMouseLeave);
    }

    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (mouseInteraction) {
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mouseleave', handleMouseLeave);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [density, speed, mouseInteraction, mouseRepulsion, twinkleIntensity, hueShift, glowIntensity]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${className}`}
      style={{ display: 'block' }}
    />
  );
}
