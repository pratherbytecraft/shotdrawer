// window.shotdrawer, given to every page by src/preload.ts.
import type { ShotdrawerApi } from '../shared/types';

declare global {
  interface Window {
    shotdrawer: ShotdrawerApi;
  }
}
