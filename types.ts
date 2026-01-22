export interface Window {
  Hands: any;
  Camera: any;
  drawConnectors: any;
  drawLandmarks: any;
  HAND_CONNECTIONS: any;
}

export interface Point {
  x: number;
  y: number;
}

export enum HandState {
  OPEN = 'OPEN',
  FIST = 'FIST',
  UNKNOWN = 'UNKNOWN'
}

export interface HandData {
  state: HandState;
  position: Point; // Normalized 0-1
  handedness: 'Left' | 'Right';
  charge: number; // 0 to 1
}