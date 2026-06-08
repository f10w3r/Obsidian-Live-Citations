import { getCitationSegments, getCitations } from './src/parser/parser';

const str = "@sach2001t [@Liu2024p; @sand2004r]";
const segments = getCitationSegments(str);
console.log("Segments:", JSON.stringify(segments, null, 2));

const citations = segments.map(s => getCitations(s));
console.log("Citations:", JSON.stringify(citations, null, 2));
