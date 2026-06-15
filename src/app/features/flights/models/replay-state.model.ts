export type ReplayDirection = 1 | -1;

export type ReplayState = {
  active: boolean;
  paused: boolean;
  index: number | null;
  speed: number;
  direction: ReplayDirection;
  cameraFollowEnabled: boolean;
};