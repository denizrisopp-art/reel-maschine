import React from 'react';
import { C, FORTSCHRITT_Y, SPALTE } from '../types';
import { klemme } from '../planner';

type FortschrittProps = {
  frame: number;
  gesamt: number;
  szenenGrenzen: number[];
};

/**
 * Razor-thin segmented chapter bar inside Instagram's top safe zone.
 * Communicates crisp structure & short runtime at a glance without clutter.
 */
export const Fortschritt: React.FC<FortschrittProps> = ({ frame, gesamt, szenenGrenzen }) => {
  const n = Math.max(1, szenenGrenzen.length);
  const breite = SPALTE.rechts - SPALTE.links;

  return (
    <div
      style={{
        position: 'absolute',
        top: FORTSCHRITT_Y,
        left: SPALTE.links,
        width: breite,
        display: 'flex',
        gap: 10,
        alignItems: 'center',
      }}
    >
      {szenenGrenzen.map((start, i) => {
        const ende = i < n - 1 ? szenenGrenzen[i + 1] : gesamt;
        const span = Math.max(1, ende - start);
        const fill = klemme((frame - start) / span, 0, 1);
        const aktiv = frame >= start && frame < ende;

        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: 'rgba(255,255,255,0.13)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 2,
                background: aktiv ? C.ink : 'rgba(247,247,248,0.68)',
                transformOrigin: '0 50%',
                transform: `scaleX(${fill})`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
};
