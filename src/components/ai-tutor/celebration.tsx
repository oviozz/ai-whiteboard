"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type CelebrationProps = {
  isActive: boolean;
  type?: "confetti" | "sparkle" | "success";
  message?: string;
  onComplete?: () => void;
  duration?: number;
};

// Particle colors
const PARTICLE_COLORS = [
  "#818CF8", // Indigo
  "#34D399", // Emerald
  "#FBBF24", // Amber
  "#F472B6", // Pink
  "#60A5FA", // Blue
  "#A78BFA", // Purple
];

type Particle = {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  rotation: number;
  velocityX: number;
  velocityY: number;
  delay: number;
};

function generateParticles(count: number, centerX: number, centerY: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: centerX,
    y: centerY,
    size: Math.random() * 8 + 4,
    color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
    rotation: Math.random() * 360,
    velocityX: (Math.random() - 0.5) * 200,
    velocityY: Math.random() * -150 - 50,
    delay: Math.random() * 200,
  }));
}

export default function Celebration({
  isActive,
  type = "confetti",
  message = "Great job!",
  onComplete,
  duration = 2000,
}: CelebrationProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    if (isActive) {
      // Generate particles at center of screen
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      setParticles(generateParticles(30, centerX, centerY));
      setShowMessage(true);

      const timer = setTimeout(() => {
        setParticles([]);
        setShowMessage(false);
        onComplete?.();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isActive, duration, onComplete]);

  if (!isActive && particles.length === 0 && !showMessage) {
    return null;
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {/* Particles */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute animate-confetti-fall"
          style={{
            left: particle.x,
            top: particle.y,
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            borderRadius: type === "sparkle" ? "50%" : "2px",
            transform: `rotate(${particle.rotation}deg)`,
            animationDelay: `${particle.delay}ms`,
            // CSS custom properties for animation
            "--velocity-x": `${particle.velocityX}px`,
            "--velocity-y": `${particle.velocityY}px`,
          } as React.CSSProperties}
        />
      ))}

      {/* Success Message */}
      {showMessage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              "px-6 py-4 rounded-xl bg-white border-2 border-emerald-200",
              "animate-celebration-pop"
            )}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎉</span>
              <div>
                <p className="text-lg font-semibold text-emerald-700">{message}</p>
                <p className="text-sm text-emerald-600">Keep up the great work!</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateX(0) translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateX(var(--velocity-x)) translateY(calc(var(--velocity-y) + 400px)) rotate(720deg);
            opacity: 0;
          }
        }

        @keyframes celebration-pop {
          0% {
            transform: scale(0.5);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .animate-confetti-fall {
          animation: confetti-fall 2s ease-out forwards;
        }

        .animate-celebration-pop {
          animation: celebration-pop 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

// Hook to trigger celebrations
export function useCelebration() {
  const [celebration, setCelebration] = useState<{
    isActive: boolean;
    type?: "confetti" | "sparkle" | "success";
    message?: string;
  }>({ isActive: false });

  const celebrate = (
    type: "confetti" | "sparkle" | "success" = "confetti",
    message?: string
  ) => {
    setCelebration({ isActive: true, type, message });
  };

  const onComplete = () => {
    setCelebration({ isActive: false });
  };

  return {
    celebration,
    celebrate,
    onComplete,
    CelebrationComponent: () => (
      <Celebration
        isActive={celebration.isActive}
        type={celebration.type}
        message={celebration.message}
        onComplete={onComplete}
      />
    ),
  };
}

