import React from 'react';
import { Composition } from 'remotion';
import { Reel, ReelProps, reelDuration } from './Reel';
import { REEL_FPS, REEL_HEIGHT, REEL_WIDTH } from './reel/types';
import beispiel from './beispiel.json';

const defaultProps: ReelProps = {
  ...(beispiel as ReelProps),
  sfx: true,
  musik: true,
  safeZone: false,
};

export const Root: React.FC = () => (
  <Composition
    id="Reel"
    component={Reel as any}
    width={REEL_WIDTH}
    height={REEL_HEIGHT}
    fps={REEL_FPS}
    durationInFrames={reelDuration(defaultProps, REEL_FPS)}
    defaultProps={defaultProps}
    calculateMetadata={({ props }) => ({
      durationInFrames: reelDuration(props as ReelProps, REEL_FPS),
    })}
  />
);
