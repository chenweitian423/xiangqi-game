import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

import { copySchemaFile } from './copySchema.js';

describe('copySchemaFile', () => {
  it('copies schema.sql into the target directory', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'xiangqi-schema-copy-'));
    const sourcePath = join(tempRoot, 'schema.sql');
    const destinationDirPath = join(tempRoot, 'dist');

    await writeFile(sourcePath, 'create table demo ();', 'utf8');

    const copiedFileUrl = await copySchemaFile({
      source: pathToFileURL(sourcePath),
      destinationDir: new URL('./', pathToFileURL(join(destinationDirPath, 'schema.sql'))),
    });

    const copiedSchema = await readFile(copiedFileUrl, 'utf8');

    expect(copiedSchema).toBe('create table demo ();');
  });
});
