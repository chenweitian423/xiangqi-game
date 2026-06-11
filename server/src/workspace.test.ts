import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';

function resolveServerWorkspacePath(...segments: string[]): string {
  const cwd = process.cwd();
  const serverRoot = basename(cwd).toLowerCase() === 'server' ? cwd : join(cwd, 'server');
  return join(serverRoot, ...segments);
}

function resolveRepoPath(...segments: string[]): string {
  const cwd = process.cwd();
  const repoRoot = basename(cwd).toLowerCase() === 'server' ? join(cwd, '..') : cwd;
  return join(repoRoot, ...segments);
}

describe('server workspace setup', () => {
  it('points the default test command at the whole server test suite', async () => {
    const packageJson = JSON.parse(await readFile(resolveServerWorkspacePath('package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.test).toContain('run');
    expect(packageJson.scripts?.test).not.toContain('src/index.test.ts');
    expect(packageJson.scripts?.build).toContain('tsconfig.build.json');
  });

  it('has a dedicated build tsconfig that emits runtime files', async () => {
    const tsconfigBuild = JSON.parse(await readFile(resolveServerWorkspacePath('tsconfig.build.json'), 'utf8')) as {
      compilerOptions?: {
        noEmit?: boolean;
        outDir?: string;
      };
    };

    expect(tsconfigBuild.compilerOptions?.noEmit).toBe(false);
    expect(tsconfigBuild.compilerOptions?.outDir).toBe('./dist');
  });

  it('uses the shared contract surface instead of importing frontend types from server internals', async () => {
    const frontendTypesSource = await readFile(resolveRepoPath('src', 'online', 'types.ts'), 'utf8');

    expect(frontendTypesSource).not.toContain('../../server/src/types.js');
    expect(frontendTypesSource).toContain('../../server/src/contracts.js');
  });
});
