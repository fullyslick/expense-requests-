import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// RTL only auto-registers its own cleanup when vitest runs with globals: true.
// This project imports test helpers explicitly, so without this every render
// stacks up in the same jsdom and queries start finding duplicates.
afterEach(cleanup);
