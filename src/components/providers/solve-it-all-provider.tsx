
"use client";

import React, { useMemo } from "react";
import useSolveAll from "@/app/store/use-solve-all";

// Colors
const slate200_rgb = "226, 232, 240"; // Overlay background
const white_rgb = "255, 255, 255";    // Shimmer
const slate700_hex = "#334155";       // Main text
const slate500_hex = "#64748B";       // Sub-text

// Spark Color Palette (RGB strings for rgba)
const SPARK_COLORS_RGB = [
    "250, 160, 100", // Soft Orange/Peach
    "120, 180, 250", // Soft Blue
    "150, 120, 220", // Soft Purple/Violet
    "100, 200, 150", // Soft Green/Teal
    "240, 120, 150", // Soft Pink/Rose
];

const NUM_SPARKS = 50; // Reduced slightly as they are bigger

export default function SolveItAllProvider({ children }: { children: React.ReactNode }) {

    const { isLoading } = useSolveAll();

    const keyframes = `
        @keyframes shimmer {
            0% { transform: translateX(-100%) skewX(-12deg); }
            100% { transform: translateX(100%) skewX(-12deg); }
        }
        @keyframes pulseText {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        @keyframes pulseOverlay {
            0%, 100% { background-color: rgba(${slate200_rgb}, 0.75); }
            50% { background-color: rgba(${slate200_rgb}, 0.68); } /* Slightly more noticeable pulse */
        }
        @keyframes sparkle {
            0%, 100% { opacity: 0; transform: scale(0.5) rotate(0deg); }
            25% { opacity: 0.7; transform: scale(1) rotate(60deg); }
            50% { opacity: 1; transform: scale(1.4) rotate(120deg); } /* Max visibility & size */
            75% { opacity: 0.7; transform: scale(1) rotate(180deg); }
        }
        /* For responsive text size */
        @media (min-width: 768px) {
            .solve-it-all-text {
                font-size: 1.5rem;
                line-height: 2rem;
            }
        }
    `;

    const sparkElements = useMemo(() => {
        if (!isLoading) return [];
        return Array.from({ length: NUM_SPARKS }).map((_, i) => {
            const size = Math.random() * 5.5 + 7.5; // Sparks between 2.5px and 6px
            const duration = Math.random() * 2 + 2;   // 2s to 4s
            const delay = Math.random() * 0.15;
            const top = Math.random() * 100;
            const left = Math.random() * 100;
            const initialRotation = Math.random() * 360;
            const color = SPARK_COLORS_RGB[Math.floor(Math.random() * SPARK_COLORS_RGB.length)];

            return (
                <div
                    key={`spark-${i}`}
                    style={{
                        position: 'absolute',
                        top: `${top}%`,
                        left: `${left}%`,
                        width: `${size}px`,
                        height: `${size}px`,
                        backgroundColor: `rgba(${color}, 0.85)`, // Good opacity for visibility
                        // borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%', // blobby shape
                        // borderRadius: '50%', // round shape
                        // For a more "star-like" feel, you might use a clip-path with a pseudo-element or an SVG.
                        // Simple square or slightly rotated square works well for "glints".
                        // Lets keep it simple square with rotation from animation for now.
                        transform: `rotate(${initialRotation}deg)`,
                        opacity: 0, // Initial state for animation
                        animation: `sparkle ${duration}s infinite ease-out`, // ease-out for a nicer fade
                        animationDelay: `${delay}s`,
                    }}
                />
            );
        });
    }, [isLoading]);

    return (
        <div
            style={{ position: 'relative', width: '100%', height: '100%' }}>
            {children}

            {isLoading && (
                <div>
                    <style>{keyframes}</style>
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            bottom: 0,
                            left: 0,
                            backdropFilter: 'blur(1.5px)', // Slightly less blur to see sparks more clearly
                            WebkitBackdropFilter: 'blur(1.5px)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 50,
                            overflow: 'hidden',
                            animation: 'pulseOverlay 2s infinite ease-in-out', // Faster pulse
                        }}
                        aria-live="assertive"
                        aria-busy="true"
                    >
                        {sparkElements}

                        <div
                            style={{
                                position: 'absolute',
                                top: 0,
                                right: 0,
                                bottom: 0,
                                left: 0,
                            }}
                        >
                            <div
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    height: '100%',
                                    width: '200%',
                                    backgroundImage: `linear-gradient(to right, transparent, rgba(${white_rgb}, 0.35), transparent)`, // Shimmer opacity
                                    animation: 'shimmer 2s infinite linear', // Faster shimmer
                                }}
                            />
                        </div>

                        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <p
                                className="solve-it-all-text"
                                style={{
                                    fontSize: '1.25rem',
                                    lineHeight: '1.75rem',
                                    fontWeight: 600,
                                    color: slate700_hex,
                                    animation: 'pulseText 2.5s infinite ease-in-out',
                                    textAlign: 'center',
                                    margin: 0,
                                    padding: '0 1rem',
                                }}
                            >
                                Solving your work...
                            </p>
                            <p
                                style={{
                                    fontSize: '0.875rem',
                                    lineHeight: '1.25rem',
                                    color: slate500_hex,
                                    marginTop: '0.25rem',
                                    textAlign: 'center',
                                    margin: 0,
                                    padding: '0 1rem',
                                }}
                            >
                                Please wait a moment.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}