import { cp, mkdir } from 'node:fs/promises';

export type CopySchemaOptions = {
  destinationDir?: URL;
  source?: URL;
};

export async function copySchemaFile(
  options: CopySchemaOptions = {},
): Promise<URL> {
  const source = options.source ?? new URL('../src/schema.sql', import.meta.url);
  const destinationDir = options.destinationDir ?? new URL('../dist/', import.meta.url);
  const destination = new URL('./schema.sql', destinationDir);

  await mkdir(destinationDir, { recursive: true });
  await cp(source, destination);

  return destination;
}
