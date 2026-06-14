export type ReplayState = {
  active: boolean;
  paused: boolean;
  index: number | null;
  speed: number;
};