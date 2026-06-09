import { App, TFile, Notice } from 'obsidian';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Bookmark, InternalHyperlink } from 'docx';
import { marked } from 'marked';
import { RenderedCitation } from './parser/parser';

// Define fonts: Times New Roman for English, SimSun (宋体) for Chinese
const DEFAULT_FONT = {
  ascii: 'Times New Roman',
  hAnsi: 'Times New Roman',
  eastAsia: 'SimSun',
};

const CODE_FONT = {
  ascii: 'Courier New',
  hAnsi: 'Courier New',
  eastAsia: 'SimSun',
};

// Replace any non-alphanumeric character with an underscore to create a safe Word Bookmark ID
function sanitizeBookmarkId(citekey: string): string {
  return 'ref_' + citekey.replace(/[^a-zA-Z0-9]/g, '_');
}

// Helper to extract label and citation text from CSL bibliography entry HTML
function parseBibliographyEntry(entryHtml: string, includeUrls = false): string {
  const trimmed = entryHtml.trim();
  const leftMarginMatch = trimmed.match(/<div\b[^>]*class="[^"]*csl-left-margin[^"]*"[^>]*>(.*?)<\/div>/i);
  const rightInlineMatch = trimmed.match(/<div\b[^>]*class="[^"]*csl-right-inline[^"]*"[^>]*>(.*?)<\/div>/i);

  let stripped = trimmed;
  if (leftMarginMatch && rightInlineMatch) {
    const label = leftMarginMatch[1].trim();
    const content = rightInlineMatch[1];
    // Return with a space separating the label and bibliography content
    stripped = `${label} ${content}`;
  } else {
    stripped = trimmed.replace(/^<div\b[^>]*>/i, '').replace(/<\/div>$/i, '');
  }

  if (!includeUrls) {
    // Remove URL links (including prefix), except DOI links
    stripped = stripped.replace(/[,.;\s]*(?:Available from:|Available at:|Available:|URL:|url:|Retrieved from:)?\s*<a\b[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, (match, href, text) => {
      const isDoi = href.includes('doi.org') || href.includes('10.') || text.toLowerCase().includes('doi');
      if (isDoi) {
        return match; // Keep DOI links
      }
      return ''; // Remove normal URL links
    });
  }

  // Cleanup punctuation and spacing leftovers
  stripped = stripped
    .replace(/\s+/g, ' ')
    .replace(/\s*\.\s*\./g, '.')
    .replace(/,\s*\./g, '.')
    .replace(/;\s*\./g, '.')
    .replace(/\s+([,.;])/g, '$1')
    .trim();

  // Ensure it ends with a period if there's text and it doesn't end with punctuation
  const plainText = stripped.replace(/<[^>]*>/g, '').trim();
  if (plainText && !plainText.endsWith('.') && !plainText.endsWith('?') && !plainText.endsWith('!')) {
    stripped += '.';
  }

  // Clean up any trailing duplicate periods
  stripped = stripped.replace(/\.+$/, '.');

  return stripped;
}

// Decodes named, decimal, and hexadecimal HTML entities
function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#38;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// Format inline HTML in citation strings (e.g. <i>, <b>, <sup>, <sub>) into TextRun objects
function parseTextToRuns(htmlText: string, size: number | undefined = 24, defaultBold = false, defaultItalics = false): TextRun[] {
  const runs: TextRun[] = [];
  if (!htmlText) return runs;

  const parts = htmlText.split(/(<\/?[a-zA-Z0-9]+[^>]*>)/g);
  
  let bold = defaultBold;
  let italics = defaultItalics;
  let superScript = false;
  let subScript = false;

  for (const part of parts) {
    if (part.startsWith('<') && part.endsWith('>')) {
      const tagName = part.replace(/[<\/>]/g, '').toLowerCase().split(' ')[0];
      const isClosing = part.startsWith('</');
      if (tagName === 'i' || tagName === 'em') {
        italics = isClosing ? defaultItalics : true;
      } else if (tagName === 'b' || tagName === 'strong') {
        bold = isClosing ? defaultBold : true;
      } else if (tagName === 'sup') {
        superScript = !isClosing;
      } else if (tagName === 'sub') {
        subScript = !isClosing;
      }
    } else if (part) {
      // Decode HTML entities
      const text = decodeHtmlEntities(part);

      const runOptions: any = {
        text,
        bold,
        italics,
        superScript,
        subScript,
        font: DEFAULT_FONT,
      };
      if (size !== undefined) {
        runOptions.size = size;
      }
      runs.push(new TextRun(runOptions));
    }
  }
  return runs;
}

// Parse text containing citation placeholders into a mix of normal TextRuns and InternalHyperlinks
// Format: LIVECITEINDEX{idx}
function parseTextToRunsWithLinks(
  htmlText: string,
  size: number | undefined = 24,
  defaultBold = false,
  defaultItalics = false,
  citations?: RenderedCitation[],
  linkedCitations = true
): any[] {
  const result: any[] = [];
  if (!htmlText) return result;

  const parts = htmlText.split(/(LIVECITEINDEX\d+)/g);

  // Pre-process parts to remove spaces surrounding full-width citations
  for (let i = 0; i < parts.length; i++) {
    const match = parts[i].match(/^LIVECITEINDEX(\d+)$/);
    if (match) {
      const idx = parseInt(match[1], 10);
      if (citations && citations[idx]) {
        const citation = citations[idx];
        const cleanVal = citation.val.replace(/<[^>]*>/g, '').trim();
        const hasFullWidthStart = cleanVal.startsWith('（') || cleanVal.startsWith('［');
        const hasFullWidthEnd = cleanVal.endsWith('）') || cleanVal.endsWith('］');
        
        if (hasFullWidthStart && i > 0) {
          parts[i - 1] = parts[i - 1].replace(/\s+$/, '');
        }
        if (hasFullWidthEnd && i < parts.length - 1) {
          parts[i + 1] = parts[i + 1].replace(/^\s+/, '');
        }
      }
    }
  }

  for (const part of parts) {
    const match = part.match(/^LIVECITEINDEX(\d+)$/);
    if (match) {
      const idx = parseInt(match[1], 10);
      if (citations && citations[idx]) {
        const citation = citations[idx];
        const anchor = linkedCitations && citation.citations && citation.citations.length > 0
          ? sanitizeBookmarkId(citation.citations[0].id)
          : '';
        const runs = parseTextToRuns(citation.val, size, defaultBold, defaultItalics);
        if (anchor) {
          result.push(new InternalHyperlink({
            children: runs,
            anchor: anchor,
          }));
        } else {
          result.push(...runs);
        }
      }
    } else if (part) {
      result.push(...parseTextToRuns(part, size, defaultBold, defaultItalics));
    }
  }
  return result;
}

function mapInlineTokens(
  tokens: any[],
  state = { bold: false, italics: false, size: 24 as number | undefined },
  citations?: RenderedCitation[],
  linkedCitations = true
): any[] {
  const result: any[] = [];
  if (!tokens) return result;

  for (const token of tokens) {
    if (token.type === 'text') {
      result.push(...parseTextToRunsWithLinks(token.text, state.size, state.bold, state.italics, citations, linkedCitations));
    } else if (token.type === 'strong') {
      result.push(...mapInlineTokens(token.tokens, { ...state, bold: true }, citations, linkedCitations));
    } else if (token.type === 'em') {
      result.push(...mapInlineTokens(token.tokens, { ...state, italics: true }, citations, linkedCitations));
    } else if (token.type === 'codespan') {
      result.push(new TextRun({
        text: token.text,
        font: CODE_FONT,
        size: 20,
      }));
    } else if (token.type === 'br') {
      result.push(new TextRun({
        text: '\n',
        font: DEFAULT_FONT,
        size: state.size,
      }));
    } else if (token.type === 'link') {
      // Direct text mapping of links for simpler Word rendering
      result.push(...mapInlineTokens(token.tokens, state, citations, linkedCitations));
    } else if (token.type === 'html') {
      result.push(...parseTextToRunsWithLinks(token.text, state.size, state.bold, state.italics, citations, linkedCitations));
    }
  }
  return result;
}

function mapListItem(item: any, prefixText: string, citations?: RenderedCitation[], fontSize = 24, lineSpacing = 276, linkedCitations = true): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  if (!item.tokens) return paragraphs;

  const subParagraphs = item.tokens.filter((t: any) => t.type === 'paragraph');
  if (subParagraphs.length > 0) {
    subParagraphs.forEach((subPara: any, i: number) => {
      const children = subPara.tokens
        ? mapInlineTokens(subPara.tokens, { bold: false, italics: false, size: fontSize }, citations, linkedCitations)
        : [new TextRun({ text: subPara.text, font: DEFAULT_FONT, size: fontSize })];
      if (i === 0) {
        children.unshift(new TextRun({ text: prefixText, font: DEFAULT_FONT, size: fontSize }));
      }
      paragraphs.push(new Paragraph({
        children,
        indent: { left: 540, hanging: 360 },
        spacing: { after: 60, line: lineSpacing, lineRule: 'auto' },
      }));
    });
  } else {
    const children = item.tokens
      ? mapInlineTokens(item.tokens, { bold: false, italics: false, size: fontSize }, citations, linkedCitations)
      : [new TextRun({ text: item.text, font: DEFAULT_FONT, size: fontSize })];
    children.unshift(new TextRun({ text: prefixText, font: DEFAULT_FONT, size: fontSize }));
    paragraphs.push(new Paragraph({
      children,
      indent: { left: 540, hanging: 360 },
      spacing: { after: 60, line: lineSpacing, lineRule: 'auto' },
    }));
  }
  return paragraphs;
}

// Convert citation keys in raw Markdown text to citation placeholders
function resolveCitationsInText(content: string, citations: RenderedCitation[]): string {
  if (!citations || citations.length === 0) return content;
  const sortedCitations = [...citations].sort((a, b) => b.from - a.from);
  let resolvedText = content;
  for (const citation of sortedCitations) {
    const originalIdx = citations.indexOf(citation);
    if (citation.citations && citation.citations.length > 0) {
      const placeholder = `LIVECITEINDEX${originalIdx}`;
      resolvedText = resolvedText.substring(0, citation.from) + placeholder + resolvedText.substring(citation.to);
    } else {
      resolvedText = resolvedText.substring(0, citation.from) + citation.val + resolvedText.substring(citation.to);
    }
  }
  return resolvedText;
}

export async function exportToDocx(app: App, file: TFile, plugin: any) {
  new Notice(t('Exporting to DOCX...'));

  try {
    const fileContent = await app.vault.read(file);
    
    // 1. Resolve citation list and cache
    await plugin.bibManager.getReferenceList(file, fileContent);
    const cache = plugin.bibManager.fileCache.get(file);
    
    // 2. Resolve citations in the document body text
    let resolvedMarkdown = fileContent;
    if (cache && cache.citations) {
      resolvedMarkdown = resolveCitationsInText(fileContent, cache.citations);
    }

    // 3. Parse markdown using marked AST
    const tokens = marked.lexer(resolvedMarkdown);
    const docChildren: Paragraph[] = [];

    // Retrieve settings dynamically
    const bodyFontSizePt = plugin.settings.exportFontSize ?? 12;
    const bodyFontSizeDxa = bodyFontSizePt * 2;
    const lineSpacingMultiplier = plugin.settings.exportLineSpacing ?? 1.15;
    const lineSpacingValue = Math.round(lineSpacingMultiplier * 240);
    const linkedCitations = plugin.settings.exportLinkedCitations ?? true;

    // 4. Map AST tokens to docx paragraphs
    for (const token of tokens) {
      if (token.type === 'heading') {
        const children = token.tokens
          ? mapInlineTokens(token.tokens, { bold: false, italics: false, size: undefined }, cache.citations, linkedCitations)
          : [new TextRun({ text: token.text, font: DEFAULT_FONT })];
        docChildren.push(new Paragraph({
          children,
          heading: token.depth === 1 ? HeadingLevel.HEADING_1 :
                   token.depth === 2 ? HeadingLevel.HEADING_2 :
                   token.depth === 3 ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_4,
          spacing: { before: 240, after: 120 },
        }));
      } else if (token.type === 'paragraph') {
        const children = token.tokens
          ? mapInlineTokens(token.tokens, { bold: false, italics: false, size: bodyFontSizeDxa }, cache.citations, linkedCitations)
          : [new TextRun({ text: token.text, font: DEFAULT_FONT, size: bodyFontSizeDxa })];
        docChildren.push(new Paragraph({
          children,
          spacing: { after: 120, line: lineSpacingValue, lineRule: 'auto' },
        }));
      } else if (token.type === 'list') {
        const isOrdered = token.ordered;
        token.items.forEach((item: any, idx: number) => {
          const prefix = isOrdered ? `${idx + 1}.  ` : '•  ';
          docChildren.push(...mapListItem(item, prefix, cache.citations, bodyFontSizeDxa, lineSpacingValue, linkedCitations));
        });
      } else if (token.type === 'blockquote') {
        const children = token.tokens
          ? mapInlineTokens(token.tokens, { bold: false, italics: true, size: bodyFontSizeDxa }, cache.citations, linkedCitations)
          : [new TextRun({ text: token.text, italics: true, font: DEFAULT_FONT, size: bodyFontSizeDxa })];
        docChildren.push(new Paragraph({
          children,
          indent: { left: 720, right: 720 },
          spacing: { before: 120, after: 120, line: lineSpacingValue, lineRule: 'auto' },
        }));
      } else if (token.type === 'code') {
        docChildren.push(new Paragraph({
          children: [new TextRun({
            text: token.text,
            font: CODE_FONT,
            size: 20,
          })],
          indent: { left: 360 },
          spacing: { before: 120, after: 120 },
        }));
      }
    }

    // 5. Append Bibliography if resolved references exist
    if (cache && cache.bib && cache.citeBibMap && cache.citeBibMap.size > 0) {
      // Add a separator space and standard References header
      docChildren.push(new Paragraph({
        children: [new TextRun({ text: '', font: DEFAULT_FONT, size: bodyFontSizeDxa })],
        spacing: { before: 240, after: 240 },
      }));
      docChildren.push(new Paragraph({
        children: [new TextRun({ text: t('References'), bold: true, font: DEFAULT_FONT })],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 },
      }));

      // Map each bibliography HTML entry to a formatted DOCX paragraph wrapped in a Bookmark
      for (const [citekey, entryHtml] of cache.citeBibMap.entries()) {
        const parsedEntry = parseBibliographyEntry(entryHtml, plugin.settings.exportIncludeUrls);
        const runs = parseTextToRuns(parsedEntry, bodyFontSizeDxa); // Use body font size
        const bookmarkId = sanitizeBookmarkId(citekey);

        docChildren.push(new Paragraph({
          children: [
            new Bookmark({
              id: bookmarkId,
              children: runs,
            })
          ],
          // 2ch hanging indentation: left = bodyFontSizePt * 40, hanging = bodyFontSizePt * 40 dxa
          indent: { left: bodyFontSizePt * 40, hanging: bodyFontSizePt * 40 },
          spacing: { after: 120, line: lineSpacingValue, lineRule: 'auto' },
        }));
      }
    }

    // 6. Build document and save with global document styling defaults
    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              font: DEFAULT_FONT,
              size: bodyFontSizeDxa, // default size
            },
            paragraph: {
              spacing: { after: 120, line: lineSpacingValue, lineRule: 'auto' }, // default spacing and line spacing
            }
          }
        }
      },
      sections: [{
        properties: {},
        children: docChildren,
      }],
    });

    const blob = await Packer.toBlob(doc);
    const buffer = await blob.arrayBuffer();

    // Determine output file path (same directory as active file)
    let outputFilename = file.basename + '.docx';
    let outputPath = outputFilename;
    if (file.parent && file.parent.path && file.parent.path !== '/') {
      outputPath = file.parent.path + '/' + outputFilename;
    }

    await app.vault.adapter.writeBinary(outputPath, new Uint8Array(buffer));
    new Notice(t('Successfully exported to ') + outputPath);
  } catch (e) {
    console.error('DOCX export failed:', e);
    new Notice(t('DOCX export failed: ') + e.message);
  }
}

// Local helper to map t()
function t(str: string): string {
  try {
    const { t } = require('./lang/helpers');
    return t(str);
  } catch {
    return str;
  }
}
