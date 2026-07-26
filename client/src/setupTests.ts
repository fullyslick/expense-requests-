import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// RTL only auto-registers its own cleanup when vitest runs with globals: true.
// This project imports test helpers explicitly, so without this every render
// stacks up in the same jsdom and queries start finding duplicates.
afterEach(cleanup);

// jsdom ships none of the pointer APIs Base UI's checkbox and select reach for
// on click, so without these any interaction with those primitives throws
// (`PointerEvent is not a constructor`) instead of toggling.
if (!globalThis.PointerEvent) {
  globalThis.PointerEvent = class extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.pointerType = params.pointerType ?? '';
    }
  } as unknown as typeof PointerEvent;
}

Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
