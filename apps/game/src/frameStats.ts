/** Bounded, time-weighted frame measurements for one uninterrupted visible view. */
export class FrameWindow {
  private frames: number[] = [];
  private needsWarmup = true;
  reset() {
    this.frames = [];
    this.needsWarmup = true;
  }
  record(milliseconds: number, visible: boolean) {
    if (!visible) {
      this.reset();
      return;
    }
    if (this.needsWarmup) {
      this.needsWarmup = false;
      return;
    }
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) return;
    this.frames.push(milliseconds);
    if (this.frames.length > 600) this.frames.shift();
  }
  summary() {
    const duration = this.frames.reduce((sum, ms) => sum + ms, 0);
    return {
      fpsAverage: duration ? (this.frames.length * 1000) / duration : 0,
      fpsSampleCount: this.frames.length,
      fpsSampleDurationMs: duration,
      fpsMethod: "visible frame count / elapsed frame time",
    };
  }
}
