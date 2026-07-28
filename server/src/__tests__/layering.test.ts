import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Guardrail #11 was the one invariant with no test behind it, and it had
// already been violated (routes/users.ts imported the store directly) before
// anyone noticed. Reading the imports is crude, but it is the only thing that
// actually fails when the layering does.
const SRC = join(__dirname, '..');

function importsOf(dir: string): Array<{ file: string; from: string }> {
  return readdirSync(join(SRC, dir))
    .filter((file) => file.endsWith('.ts'))
    .flatMap((file) => {
      const source = readFileSync(join(SRC, dir, file), 'utf8');
      return [...source.matchAll(/^\s*import\s[^;]*?from\s+'([^']+)'/gm)].map((match) => ({
        file: `${dir}/${file}`,
        from: match[1],
      }));
    });
}

describe('layering is one-directional', () => {
  it('routes/ never imports the store or logic/ directly', () => {
    const offenders = importsOf('routes').filter(
      ({ from }) =>
        from.includes('/store') || from.endsWith('../store') || from.includes('/logic/'),
    );
    expect(offenders).toEqual([]);
  });

  it('logic/ imports neither express nor the store', () => {
    const offenders = importsOf('logic').filter(
      ({ from }) => from === 'express' || from.includes('store'),
    );
    expect(offenders).toEqual([]);
  });

  it('services/ never imports express', () => {
    const offenders = importsOf('services').filter(({ from }) => from === 'express');
    expect(offenders).toEqual([]);
  });
});
