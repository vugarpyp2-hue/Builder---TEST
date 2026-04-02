/**
 * @file DottedGlowBackground.tsx
 * @description A background component with a dotted glow effect.
 * @exports DottedGlowBackground
 */

import React from 'react';

interface DottedGlowBackgroundProps {
    gap?: number;
    radius?: number;
    color?: string;
    glowColor?: string;
    speedScale?: number;
}

const DottedGlowBackground = ({
    gap = 32,
    radius = 1.2,
    color = "rgba(255, 255, 255, 0.02)",
    glowColor = "rgba(255, 255, 255, 0.12)",
    speedScale = 0.4
}: DottedGlowBackgroundProps) => {
    return (
        <div className="dotted-glow-background" style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: -1,
            pointerEvents: 'none',
            background: `radial-gradient(circle at 50% 50%, ${glowColor} 0%, transparent 70%), 
                         radial-gradient(circle at 20% 30%, ${glowColor} 0%, transparent 50%),
                         radial-gradient(circle at 80% 70%, ${glowColor} 0%, transparent 50%)`,
            backgroundSize: '100% 100%',
            backgroundRepeat: 'no-repeat',
            opacity: 0.5
        }}>
            <svg width="100%" height="100%" style={{ opacity: 0.3 }}>
                <defs>
                    <pattern id="dots" x="0" y="0" width={gap} height={gap} patternUnits="userSpaceOnUse">
                        <circle cx={gap / 2} cy={gap / 2} r={radius} fill={color} />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#dots)" />
            </svg>
        </div>
    );
};

export default DottedGlowBackground;
