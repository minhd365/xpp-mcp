import { z } from 'zod';
import * as fs from 'fs';
import { ModelRegistry } from '../core/model-registry';
import { canonicalFolder, isSupportedAotFolder } from '../schemas/namespaces';
import { isSafeModelName, isSafeObjectName } from '../core/path-security';

export const ExploreToolInputSchema = z.object({
  action:          z.enum(['list_models', 'list_objects', 'search', 'read', 'list_types']),
  model:           z.string().refine(isSafeModelName, 'Model name must be a safe path segment.').optional(),
  type:            z.string().refine(isSupportedAotFolder, 'Unsupported AOT object type.').optional(),
  pattern:         z.string().optional(),
  name:            z.string().refine(isSafeObjectName, 'Object name must be a safe basename.').optional(),
  includeStandard: z.boolean().default(false),
  limit:           z.number().default(50),
});

export type ExploreToolInput = z.infer<typeof ExploreToolInputSchema>;

export async function handleExploreTool(
  input: ExploreToolInput,
  registry: ModelRegistry,
): Promise<string> {

  switch (input.action) {

    case 'list_models': {
      const models = registry.list(!input.includeStandard);
      if (models.length === 0) return 'No models found.';
      const lines = models.map(m =>
        `${m.name} | layer=${m.layer} | publisher=${m.publisher} | pkg=${m.packageFolder}`
      );
      return `Found ${models.length} model(s):\n` + lines.join('\n');
    }

    case 'list_types': {
      // List all AOT type folders found in a model
      if (!input.model) return 'list_types requires: model';
      const modelRoot = registry.getModelPath(input.model);
      if (!fs.existsSync(modelRoot)) return `Model root not found: ${modelRoot}`;
      const dirs = fs.readdirSync(modelRoot, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)
        .sort();
      return `Object types in ${input.model}:\n${dirs.join('\n')}`;
    }

    case 'list_objects': {
      if (!input.model) return 'list_objects requires: model';
      if (!input.type)  return 'list_objects requires: type';
      const folder = canonicalFolder(input.type);
      const folderPath = registry.getAotFolder(input.model, folder);
      if (!fs.existsSync(folderPath)) return `Folder not found: ${folderPath}`;
      const files = fs.readdirSync(folderPath)
        .filter(f => f.endsWith('.xml'))
        .map(f => f.replace('.xml', ''))
        .sort();
      return `${input.type} objects in ${input.model} (${files.length}):\n${files.join('\n')}`;
    }

    case 'search': {
      if (!input.model) return 'search requires: model';
      if (!input.pattern) return 'search requires: pattern';
      const modelRoot = registry.getModelPath(input.model);
      const typeFolders = input.type
        ? [canonicalFolder(input.type)]
        : fs.readdirSync(modelRoot, { withFileTypes: true })
            .filter(d => d.isDirectory() && isSupportedAotFolder(d.name))
            .map(d => canonicalFolder(d.name));

      const regex = new RegExp(
        '^' + input.pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i'
      );

      const results: string[] = [];
      for (const tf of typeFolders) {
        const tfPath = registry.getAotFolder(input.model, tf);
        if (!fs.existsSync(tfPath)) continue;
        const matches = fs.readdirSync(tfPath)
          .filter(f => f.endsWith('.xml'))
          .map(f => f.replace('.xml', ''))
          .filter(n => regex.test(n))
          .slice(0, input.limit);
        for (const m of matches) results.push(`${tf}\\${m}`);
        if (results.length >= input.limit) break;
      }

      if (results.length === 0) return `No objects matching "${input.pattern}" in ${input.model}`;
      return `Found ${results.length} match(es) in ${input.model}:\n${results.join('\n')}`;
    }

    case 'read': {
      if (!input.model || !input.type || !input.name) {
        return 'read requires: model, type, name';
      }
      const filePath = registry.getAotPath(
        input.model, canonicalFolder(input.type), input.name
      );
      if (!fs.existsSync(filePath)) return `Not found: ${filePath}`;
      const xml = fs.readFileSync(filePath, 'utf-8');
      return `File: ${filePath}\n\n${xml}`;
    }
  }
}
