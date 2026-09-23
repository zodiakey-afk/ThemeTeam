declare module 'easystarjs' {
  interface PathPoint { x: number; y: number }
  class EasyStarEngine {
    setGrid(grid: number[][]): void;
    setAcceptableTiles(tiles: number[]): void;
    disableDiagonals(): void;
    setIterationsPerCalculation(iterations: number): void;
    findPath(startX: number, startY: number, endX: number, endY: number, callback: (path: PathPoint[] | null) => void): number;
    calculate(): void;
    cancelPath(instanceId: number): void;
  }
  const EasyStar: { js: typeof EasyStarEngine };
  export default EasyStar;
}
