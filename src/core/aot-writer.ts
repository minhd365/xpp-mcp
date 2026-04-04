import * as fs from 'fs';
import * as path from 'path';
import { WriteResult } from '../schemas/types';
import { canonicalFolder } from '../schemas/namespaces';

/**
 * AotWriter — atomic XML write to the correct AOT path.
 * Uses temp-file → rename for atomicity (never leaves a corrupt file).
 * Never writes to XppMetadata — AOT only.
 */
export class AotWriter {

  /**
   * Write XML content to the given path atomically.
   * Creates intermediate directories as needed.
   */
  write(targetPath: string, xml: string): void {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // D365 XML deserializer requires CRLF line endings (Windows-native tool).
    // LF-only files cause "element '' already exists" deserialization errors.
    const xmlCrlf = xml.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');

    const tmpPath = targetPath + '.tmp';
    fs.writeFileSync(tmpPath, xmlCrlf, 'utf-8');
    // Atomic rename — prevents partial-write corruption.
    // Note: we overwrite directly (no .bak) because .bak files are picked up
    // by the D365 metadata scanner and cause duplicate-element errors.
    fs.renameSync(tmpPath, targetPath);
  }

  /**
   * Write an object XML and return a structured result.
   */
  writeObject(
    targetPath: string,
    xml: string,
    objectType: string,
    objectName: string,
  ): WriteResult {
    const existed = fs.existsSync(targetPath);
    this.write(targetPath, xml);
    return {
      path: targetPath,
      objectType,
      objectName,
      created: !existed,
    };
  }

  /**
   * Ensure AOT type folder exists with canonical casing.
   * e.g. "axtable" → creates "AxTable" folder.
   */
  ensureAotFolder(modelAotRoot: string, objectType: string): string {
    const canonical = canonicalFolder(objectType);
    const folderPath = path.join(modelAotRoot, canonical);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    return folderPath;
  }

  /** Check if an object file already exists */
  exists(targetPath: string): boolean {
    return fs.existsSync(targetPath);
  }

  /** Read raw XML from an existing AOT file */
  readRaw(targetPath: string): string {
    if (!fs.existsSync(targetPath)) {
      throw new Error(`File not found: ${targetPath}`);
    }
    return fs.readFileSync(targetPath, 'utf-8');
  }
}
