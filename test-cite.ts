import { getCiteprocCites, cite } from './src/parser/citeproc';
import { getCitationSegments, getCitations } from './src/parser/parser';

// Let's create a mock engine to see the output format
const engine = {
  opt: { xclass: 'in-text' },
  rebuildProcessorState: (cites) => {
    return cites.map((c, i) => [c.citationID, 1, `[BAKED: ${c.citationItems.map(item => item.id).join(', ')}]`]);
  },
  makeCitationCluster: (items) => {
    return `[CLUSTER: ${items.map(item => item.id).join(', ')}]`;
  }
};

const str1 = "@sach2001t [@Liu2024p; @sand2004r]";
const segments1 = getCitationSegments(str1);
const groups1 = segments1.map(s => getCitations(s));

console.log("Groups:", JSON.stringify(groups1, null, 2));

const { output, idToGroup } = getCiteprocCites(groups1, 'in-text');
console.log("\nCiteproc output:", JSON.stringify(output, null, 2));
