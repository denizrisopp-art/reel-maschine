import React from 'react';
import { AbsoluteFill } from 'remotion';
import { monoFontFamily } from '../../fonts';
import { UT_UNTERKANTE } from '../types';

/**
 * Optional Instagram UI safe-zone audit overlay (disabled by default in renders;
 * toggle safeZone: true in Remotion Studio props to inspect caption & rail clearance).
 */
export const SafeZoneOverlay: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 50, fontFamily: monoFontFamily }}>
    {/* Top Instagram header zone */}
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 170,
        background: 'rgba(239,68,68,0.14)',
        borderBottom: '2px dashed rgba(239,68,68,0.65)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingBottom: 10,
        fontSize: 20,
        color: 'rgba(252,165,165,0.9)',
      }}
    >
      IG TOP UNSAFE (0..170)
    </div>

    {/* Right engagement icon rail */}
    <div
      style={{
        position: 'absolute',
        top: 170,
        right: 0,
        width: 140,
        bottom: 1920 - UT_UNTERKANTE,
        background: 'rgba(239,68,68,0.12)',
        borderLeft: '2px dashed rgba(239,68,68,0.6)',
      }}
    />

    {/* Bottom caption & audio rail */}
    <div
      style={{
        position: 'absolute',
        top: UT_UNTERKANTE,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(239,68,68,0.14)',
        borderTop: '2px dashed rgba(239,68,68,0.65)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 14,
        fontSize: 20,
        color: 'rgba(252,165,165,0.9)',
      }}
    >
      IG CAPTION &amp; AUDIO UNSAFE ({UT_UNTERKANTE}..1920)
    </div>
  </AbsoluteFill>
);
