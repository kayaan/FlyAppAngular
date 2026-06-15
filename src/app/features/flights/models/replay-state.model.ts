export type ReplayDirection = 1 | -1;

export type ReplayRange = {
  startIndex: number;
  endIndex: number;
};


export type ReplayState = {
  active: boolean;
  paused: boolean;
  index: number | null;
  speed: number;
  direction: ReplayDirection;
  cameraFollowEnabled: boolean;
  range: ReplayRange | null;
  replayTrailDurationSec: number | null;
};