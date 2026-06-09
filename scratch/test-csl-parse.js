function parseBibliographyEntry(entryHtml) {
  const leftMarginMatch = entryHtml.match(/<div\b[^>]*class="[^"]*csl-left-margin[^"]*"[^>]*>(.*?)<\/div>/i);
  const rightInlineMatch = entryHtml.match(/<div\b[^>]*class="[^"]*csl-right-inline[^"]*"[^>]*>(.*?)<\/div>/i);

  let stripped = entryHtml;
  if (leftMarginMatch && rightInlineMatch) {
    const label = leftMarginMatch[1].trim();
    const content = rightInlineMatch[1];
    stripped = `${label} ${content}`;
  } else {
    stripped = entryHtml.replace(/^<div\b[^>]*>/i, '').replace(/<\/div>$/i, '');
  }

  // Remove URL links (including prefix), except DOI links
  stripped = stripped.replace(/[,.;\s]*(?:Available from:|Available at:|Available:|URL:|url:|Retrieved from:)?\s*<a\b[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, (match, href, text) => {
    const isDoi = href.includes('doi.org') || href.includes('10.') || text.toLowerCase().includes('doi');
    if (isDoi) {
      return match; // Keep DOI links
    }
    return ''; // Remove normal URL links
  });

  // Cleanup punctuation and spacing leftovers
  stripped = stripped
    .replace(/\s+/g, ' ')
    .replace(/\s*\.\s*\./g, '.')
    .replace(/,\s*\./g, '.')
    .replace(/;\s*\./g, '.')
    .replace(/\s+([,.;])/g, '$1')
    .trim();

  // Ensure it ends with a period if there's text and it doesn't end with punctuation
  if (stripped && !stripped.endsWith('.') && !stripped.endsWith('?') && !stripped.endsWith('!')) {
    stripped += '.';
  }

  return stripped;
}

// Let's test with a mock entry that ends with a div and a newline
const entry1 = '<div class="csl-entry">刘思达. 2024. ‘破除数字迷信——论社科法学的“伪科学性”’. 法律和社会科学 21 (1): 375–93.</div>\n';
console.log("Result 1:", JSON.stringify(parseBibliographyEntry(entry1)));

const entry2 = '<div class="csl-entry">刘思达. 2024. ‘破除数字迷信——论社科法学的“伪科学性”’. 法律和社会科学 21 (1): 375–93.</div>';
console.log("Result 2:", JSON.stringify(parseBibliographyEntry(entry2)));
