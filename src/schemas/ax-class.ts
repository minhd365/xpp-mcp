import { ClassSpec } from './types';
import { rootElement, closeElement } from './namespaces';

/**
 * Generate a complete AxClass XML string.
 * Confirmed correct from live D365 F&O 10.37 filesystem scan.
 */
export function generateClass(spec: ClassSpec): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="utf-8"?>');
  lines.push(rootElement('AxClass'));

  lines.push(`\t<Name>${spec.name}</Name>`);

  lines.push('\t<SourceCode>');

  // Declaration
  lines.push('\t\t<Declaration><![CDATA[');
  lines.push(spec.classDeclaration);
  lines.push(']]></Declaration>');

  // Methods
  if (spec.methods && spec.methods.length > 0) {
    lines.push('\t\t<Methods>');
    for (const m of spec.methods) {
      lines.push('\t\t\t<Method>');
      lines.push(`\t\t\t\t<Name>${m.name}</Name>`);
      lines.push('\t\t\t\t<Source><![CDATA[');
      lines.push(m.source);
      lines.push(']]></Source>');
      lines.push('\t\t\t</Method>');
    }
    lines.push('\t\t</Methods>');
  } else {
    lines.push('\t\t<Methods />');
  }

  lines.push('\t</SourceCode>');
  lines.push(closeElement('AxClass'));

  return lines.join('\n');
}
