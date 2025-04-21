// BM25 parameters
const K1 = 1.2;  // Term frequency saturation parameter
const B = 0.75;  // Length normalization parameter

function calculateBM25Score(doc, query, avgLength, idf) {
  const words = query.toLowerCase().split(/\W+/).filter(Boolean);
  const docWords = doc.toLowerCase().split(/\W+/).filter(Boolean);
  const docLength = docWords.length;

  return words.reduce((score, word) => {
    const tf = docWords.filter(w => w === word).length;
    return score + (
      idf[word] * (tf * (K1 + 1)) /
      (tf + K1 * (1 - B + B * (docLength / avgLength)))
    );
  }, 0);
}

function calculateIDF(documents, terms) {
  const N = documents.length;
  const idf = {};

  terms.forEach(term => {
    const docsWithTerm = documents.filter(doc =>
      doc.toLowerCase().includes(term.toLowerCase())
    ).length;
    idf[term] = Math.log((N - docsWithTerm + 0.5) / (docsWithTerm + 0.5) + 1);
  });

  return idf;
}

export function rankSearchResults(results, searchTerm) {
  if (!searchTerm || !results.length) return results;

  const searchTerms = searchTerm.toLowerCase().split(/\W+/).filter(Boolean);

  // Combine relevant fields for BM25 scoring
  const documents = results.map(result =>
    `${result.app_title} ${result.description} ${result.developer}`
  );

  // Calculate average document length
  const avgLength = documents.reduce((sum, doc) =>
    sum + doc.split(/\W+/).filter(Boolean).length, 0
  ) / documents.length;

  // Calculate IDF for search terms
  const idf = calculateIDF(documents, searchTerms);

  // Calculate BM25 scores
  const scoredResults = results.map(result => {
    const combinedText = `${result.app_title} ${result.description} ${result.developer}`;
    const score = calculateBM25Score(combinedText, searchTerm, avgLength, idf);
    return { ...result, searchScore: score };
  });

  // Sort by BM25 score
  return scoredResults.sort((a, b) => b.searchScore - a.searchScore);
}
