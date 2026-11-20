import React from 'react';
import { Composition } from 'remotion';
import { Reel, ReelProps, reelDuration } from './Reel';
import beispiel from './beispiel.json';

export const Root: React.FC = () => (
  <Composition
    id="Reel"
    component={Reel as any}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={reelDuration(beispiel as ReelProps)}
    defaultProps={beispiel as ReelProps}
    calculateMetadata={({ props }) => ({ durationInFrames: reelDuration(props as ReelProps) })}
  />
);
