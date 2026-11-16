import * as fs from 'fs';
import * as path from 'path';

const MODEL_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _.-]*$/;
const OBJECT_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function isSafeModelName(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value === value.trim()
    && value !== '.'
    && value !== '..'
    && !value.endsWith('.')
    && MODEL_NAME_PATTERN.test(value);
}

export function assertSafeModelName(modelName: string): void {
  if (!isSafeModelName(modelName)) {
    throw new Error(`Invalid model name: "${modelName}"`);
  }
}

export function assertSafeObjectName(objectName: string): void {
  if (!isSafeObjectName(objectName)) {
    throw new Error(`Invalid object name: "${objectName}"`);
  }
}

export function isSafeObjectName(value: unknown): value is string {
  return typeof value === 'string' && OBJECT_NAME_PATTERN.test(value);
}

export function resolveContainedPath(rootPath: string, ...segments: string[]): string {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedPath = path.resolve(resolvedRoot, ...segments);
  assertContained(resolvedRoot, resolvedPath);

  const realRoot = fs.realpathSync(resolvedRoot);
  let existingAncestor = resolvedPath;
  while (true) {
    try {
      fs.lstatSync(existingAncestor);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const parent = path.dirname(existingAncestor);
      if (parent === existingAncestor) throw error;
      existingAncestor = parent;
    }
  }

  assertContained(realRoot, fs.realpathSync(existingAncestor));
  return resolvedPath;
}

function assertContained(rootPath: string, candidatePath: string): void {
  const relativePath = path.relative(rootPath, candidatePath);
  if (
    relativePath === '..'
    || relativePath.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativePath)
  ) {
    throw new Error(`Resolved path is outside the allowed root: ${candidatePath}`);
  }
}
