// ============================================================
// AotReader — read and lightly parse existing AOT XML files
// ============================================================
import * as fs from 'fs';
import * as path from 'path';

export interface AotReadResult {
  exists: boolean;
  path: string;
  content?: string;
  /** Extracted <Name> value */
  name?: string;
  objectType?: string;
  error?: string;
}

export class AotReader {
  /** Read an AOT XML file */
  read(filePath: string): AotReadResult {
    if (!fs.existsSync(filePath)) {
      return { exists: false, path: filePath };
    }
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const name = this.extractTag(content, 'Name');  // Bug fix: was 'n' (lowercase) — always returned undefined
      const objectType = this.detectType(content);
      return { exists: true, path: filePath, content, name, objectType };
    } catch (e: unknown) {
      return { exists: true, path: filePath, error: String(e) };
    }
  }

  /** List all XML files in an AOT type folder */
  listObjects(aotTypeDir: string): string[] {
    if (!fs.existsSync(aotTypeDir)) return [];
    return fs.readdirSync(aotTypeDir)
      .filter(f => f.endsWith('.xml') && !f.endsWith('.bak'))
      .map(f => f.replace('.xml', ''));
  }

  /** List all object type folders under a model's AOT dir */
  listObjectTypes(modelAotDir: string): string[] {
    if (!fs.existsSync(modelAotDir)) return [];
    return fs.readdirSync(modelAotDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => e.name);
  }

  private extractTag(content: string, tag: string): string | undefined {
    const m = content.match(new RegExp(`<${tag}[^>]*>(.*?)<\\/${tag}>`, 's'));
    return m?.[1]?.trim();
  }

  private detectType(content: string): string | undefined {
    const m = content.match(/<(Ax[A-Za-z]+)\s/);
    return m?.[1];
  }
}
