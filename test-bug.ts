import { getCitationSegments, getCitations } from './src/parser/parser';

const str = "[@Liu2024p; @sand2004r]";
const segments = getCitationSegments(str);
const citations = segments.map(s => getCitations(s));

console.log("Citations:", JSON.stringify(citations, null, 2));
