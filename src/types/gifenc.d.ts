declare module 'gifenc' {
  /** GIFエンコーダのフレーム書き込みオプション。 */
  export type WriteFrameOptions = {
    palette?: number[][] | Uint8Array[];
    delay?: number;
    repeat?: number;
    transparent?: boolean;
    dispose?: number;
  };

  /** gifenc のエンコーダインスタンス。 */
  export type GIFEncoderInstance = {
    writeFrame: (index: Uint8Array, width: number, height: number, options?: WriteFrameOptions) => void;
    finish: () => void;
    bytes: () => Uint8Array;
    bytesView: () => Uint8Array;
  };

  export function GIFEncoder(options?: { auto?: boolean; initialCapacity?: number }): GIFEncoderInstance;

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: string; oneBitAlpha?: boolean | number; clearAlpha?: boolean; clearAlphaThreshold?: number; clearAlphaColor?: number },
  ): number[][];

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][] | Uint8Array[],
    format?: string,
  ): Uint8Array;
}
