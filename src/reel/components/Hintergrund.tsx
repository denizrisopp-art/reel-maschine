import React from 'react';
import { AbsoluteFill } from 'remotion';
import { C } from '../types';

/**
 * Calibrated obsidian studio canvas:
 * - Whisper-quiet overhead warm-neutral studio key light (no neon, no purple gradients)
 * - Ultra-fine architectural drafting grid at 2.4% opacity for tactile editorial depth
 * - Subtle edge vignette so the central stage holds focus naturally
 */
export const Hintergrund: React.FC = () => (
  <AbsoluteFill style={{ background: C.ground, overflow: 'hidden' }}>
    {/* Soft overhead studio key light (neutral warm graphite, subtle 4.5% luminance lift) */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background:
          'radial-gradient(ellipse 92% 48% at 46% 12%, rgba(255,255,255,0.048) 0%, rgba(255,255,255,0.015) 42%, rgba(11,11,13,0) 76%)',
      }}
    />

    {/* Subtle architectural hairline grid (editorial mat, completely non-intrusive) */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage:
          'linear-gradient(to right, rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.022) 1px, transparent 1px)',
        backgroundSize: '72px 72px',
        maskImage:
          'radial-gradient(ellipse 78% 64% at 47% 46%, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.22) 65%, transparent 100%)',
        WebkitMaskImage:
          'radial-gradient(ellipse 78% 64% at 47% 46%, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.22) 65%, transparent 100%)',
      }}
    />

    {/* Soft edge vignette */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background:
          'radial-gradient(ellipse 90% 85% at 48% 48%, rgba(0,0,0,0) 58%, rgba(0,0,0,0.44) 100%)',
      }}
    />
  </AbsoluteFill>
);
