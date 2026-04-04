import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

export const ConfigSchema = z.object({
  packagesRoot:  z.string().min(1),
  defaultModel:  z.string().min(1),
  binPath:       z.string().min(1),
  defaultLocale: z.string().default('en-US'),
  useLabels:     z.boolean().default(true),
  indexPath:     z.string().default('cache/object-lookup.db'),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(configPath?: string): Config {
  // Resolve relative to the project root (one level up from build/)
  // so the server finds config.json regardless of the working directory
  // Claude Desktop uses when launching the process.
  const projectRoot = path.join(__dirname, '..');
  const resolved = configPath ?? path.join(projectRoot, 'config.json');
  if (!fs.existsSync(resolved)) {
    throw new Error(
      `Config not found: ${resolved}\n` +
      `Make sure config.json exists in the project root (copy config.example.json → config.json)`
    );
  }
  const raw = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid config: ${result.error.message}`);
  }
  return result.data;
}
