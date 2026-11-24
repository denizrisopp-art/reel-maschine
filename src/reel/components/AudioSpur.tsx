import React from 'react';
import { Audio, Sequence, staticFile, useVideoConfig } from 'remotion';
import { musikLautstaerke } from '../planner';
import { SfxCue, Wort } from '../types';

type AudioSpurProps = {
  cues: SfxCue[];
  woerter: Wort[];
  dauer: number;
  sfx?: boolean;
  musik?: boolean;
};

/**
 * Synchronized tactile studio SFX + subtle auto-ducked ambient pulse bed.
 * Uses locally generated WAVs under public/sfx/ (100% deterministic, zero external URLs).
 */
export const AudioSpur: React.FC<AudioSpurProps> = ({
  cues,
  woerter,
  dauer,
  sfx = true,
  musik = true,
}) => {
  const { fps } = useVideoConfig();

  return (
    <>
      {musik && (
        <Audio
          src={staticFile('sfx/bed.wav')}
          loop
          volume={(f) => musikLautstaerke(f / fps, woerter, dauer, 0.08)}
        />
      )}
      {sfx &&
        cues.map((cue, idx) => (
          <Sequence key={`${cue.art}-${cue.frame}-${idx}`} from={cue.frame} durationInFrames={Math.round(fps * 0.5)}>
            <Audio src={staticFile(`sfx/${cue.art}.wav`)} volume={cue.volume} />
          </Sequence>
        ))}
    </>
  );
};
