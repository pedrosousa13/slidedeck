import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every package under `packages/` whose manifest does not set `private` --
 * what this repo publishes.
 * @param {string} repoRoot
 * @returns {{ name: string, version: string, path: string, manifest: Record<string, any> }[]}
 */
export const publishablePackages = (repoRoot) =>
  readdirSync(join(repoRoot, 'packages'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const path = join(repoRoot, 'packages', entry.name);
      const manifest = JSON.parse(
        readFileSync(join(path, 'package.json'), 'utf8')
      );
      return { name: manifest.name, version: manifest.version, path, manifest };
    })
    .filter((pkg) => !pkg.manifest.private);
