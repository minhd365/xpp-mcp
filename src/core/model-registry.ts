import * as fs   from 'fs';
import * as path from 'path';
import { ModelInfo } from '../schemas/types';
import { canonicalFolder } from '../schemas/namespaces';
import { assertSafeModelName, assertSafeObjectName, resolveContainedPath } from './path-security';

/**
 * ModelRegistry — scans ALL Descriptor XMLs under PackagesLocalDirectory.
 *
 * Key facts confirmed from live filesystem scan:
 *  - Descriptor XML files are UTF-16 LE encoded (NOT UTF-8)
 *  - The model name tag is <Name> (PascalCase), NOT <Name>
 *    (<Name> is only used inside AOT objects like AxTable, AxClass etc.)
 *  - packageFolder !== modelName in multi-model packages
 *    e.g. ApplicationSuite/Foundation.xml → Name="Foundation", ModelModule="ApplicationSuite"
 *
 * AOT path formula (the ONLY correct one):
 *   packagesRoot / packageFolder / modelName / AxType / ObjectName.xml
 */
export class ModelRegistry {
  private models = new Map<string, ModelInfo>();

  constructor(readonly packagesRoot: string) {}

  async load(): Promise<void> {
    this.models.clear();

    if (!fs.existsSync(this.packagesRoot)) {
      throw new Error(`PackagesRoot not found: ${this.packagesRoot}`);
    }

    const entries = fs.readdirSync(this.packagesRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const pkgFolder    = entry.name;
      const descriptorDir = path.join(this.packagesRoot, pkgFolder, 'Descriptor');
      if (!fs.existsSync(descriptorDir)) continue;

      const xmlFiles = fs.readdirSync(descriptorDir).filter(f => f.endsWith('.xml'));
      for (const xmlFile of xmlFiles) {
        try {
          const info = this.parseDescriptor(
            path.join(descriptorDir, xmlFile), pkgFolder,
          );
          if (info) this.models.set(info.name, info);
        } catch {
          // skip malformed descriptors silently
        }
      }
    }
  }

  /**
   * Read a descriptor file, handling UTF-16 LE encoding used by D365.
   * All standard D365 descriptor XMLs are encoded as UTF-16 LE.
   * Custom model descriptors created by VS2022 are also UTF-16 LE.
   */
  private readDescriptor(filePath: string): string {
    const buf = fs.readFileSync(filePath);
    // UTF-16 LE BOM = FF FE
    if (buf[0] === 0xff && buf[1] === 0xfe) {
      return buf.toString('utf16le');
    }
    // UTF-16 LE without BOM: odd bytes are 0x00 for ASCII-range characters
    // Detect by checking first 4 bytes — XML starts with '<' (0x3C)
    if (buf.length > 4 && buf[1] === 0x00 && buf[3] === 0x00) {
      return buf.toString('utf16le');
    }
    // UTF-8 fallback (non-standard but safe)
    return buf.toString('utf-8');
  }

  /**
   * Parse a single descriptor XML using lightweight regex extraction.
   * No external XML dependencies required.
   *
   * IMPORTANT: Descriptors use <Name> (PascalCase) for the model name,
   * not <Name> which is only used in AOT object XML files.
   */
  private parseDescriptor(xmlPath: string, pkgFolder: string): ModelInfo | null {
    const content = this.readDescriptor(xmlPath);

    // <Name> is the model display name / inner AOT folder name in descriptors
    const name     = this.tag(content, 'Name') ?? this.tag(content, 'n');
    if (!name) return null;

    const moduleFolder = this.tag(content, 'ModelModule') ?? pkgFolder;
    const publisher    = this.tag(content, 'Publisher')   ?? '';
    const id           = parseInt(this.tag(content, 'Id')    ?? '0', 10);
    const layer        = parseInt(this.tag(content, 'Layer') ?? '0', 10);

    // Parse <ModuleReferences><d2p1:string>...</d2p1:string></ModuleReferences>
    const deps: string[] = [];
    const depsBlock = content.match(/<ModuleReferences[^>]*>([\s\S]*?)<\/ModuleReferences>/);
    if (depsBlock) {
      const matches = [...depsBlock[1].matchAll(/<d2p1:string>([^<]+)<\/d2p1:string>/g)];
      for (const m of matches) deps.push(m[1].trim());
    }

    return {
      name,
      packageFolder: moduleFolder,
      id,
      layer,
      publisher,
      dependencies: deps,
      isCustom: publisher !== 'Microsoft Corporation' && publisher !== 'Microsoft',
      descriptorPath: xmlPath,
    };
  }

  /** Extract the first occurrence of a tag value, handles attributes on tag. */
  private tag(content: string, name: string): string | undefined {
    const m = content.match(new RegExp(`<${name}(?:\\s[^>]*)?>(.*?)<\\/${name}>`, 's'));
    return m?.[1]?.trim();
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  getModel(name: string): ModelInfo {
    const m = this.models.get(name);
    if (!m) {
      const customs = this.listCustom().map(c => c.name).join(', ') || '(none)';
      throw new Error(
        `Model "${name}" not found. Available custom models: ${customs}.\n` +
        `Use d365_explore {action:"list_models"} to see all models.`
      );
    }
    return m;
  }

  getModelPath(modelName: string): string {
    assertSafeModelName(modelName);
    const model = this.getModel(modelName);
    assertSafeModelName(model.packageFolder);
    assertSafeModelName(model.name);
    return resolveContainedPath(this.packagesRoot, model.packageFolder, model.name);
  }

  list(customOnly = false): ModelInfo[] {
    const all = Array.from(this.models.values());
    return customOnly ? all.filter(m => m.isCustom) : all;
  }

  listCustom(): ModelInfo[] { return this.list(true); }

  /**
   * Compute the canonical AOT file path.
   * packagesRoot / packageFolder / modelName / objectType / objectName.xml
   */
  getAotPath(modelName: string, objectType: string, objectName: string): string {
    assertSafeObjectName(objectName);
    const model = this.getModel(modelName);
    this.getModelPath(modelName);
    return resolveContainedPath(
      this.packagesRoot,
      model.packageFolder,
      model.name,
      canonicalFolder(objectType),
      `${objectName}.xml`,
    );
  }

  getAotFolder(modelName: string, objectType: string): string {
    const model = this.getModel(modelName);
    this.getModelPath(modelName);
    return resolveContainedPath(
      this.packagesRoot,
      model.packageFolder,
      model.name,
      canonicalFolder(objectType),
    );
  }
}
