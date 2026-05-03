/**
 * Semantic Similarity: Compare answers using local TF-IDF + n-gram analysis
 *
 * No external API required. Combines TF-IDF cosine similarity with
 * character n-gram overlap for robust collusion detection.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type SimilarityVerdict = 'unique' | 'similar' | 'highly_similar' | 'likely_copied';

export interface SimilarityResult {
  similarity: number;         // 0-1 cosine similarity
  similarity_percent: number; // 0-100 for display
  verdict: SimilarityVerdict;
  explanation: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
}

function buildTFVector(tokens: string[], vocab: string[]): number[] {
  const freq: Record<string, number> = {};
  for (const t of tokens) freq[t] = (freq[t] ?? 0) + 1;
  const len = tokens.length || 1;
  return vocab.map(word => (freq[word] ?? 0) / len);
}

/**
 * Compute cosine similarity between two vectors
 * @param vecA - First vector
 * @param vecB - Second vector
 * @returns Cosine similarity score (0-1)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
}

/** Character n-gram Sørensen–Dice coefficient */
function ngramSimilarity(a: string, b: string, n = 3): number {
  const getNgrams = (s: string): Set<string> => {
    const ngrams = new Set<string>();
    for (let i = 0; i <= s.length - n; i++) ngrams.add(s.slice(i, i + n));
    return ngrams;
  };
  const nA = getNgrams(a);
  const nB = getNgrams(b);
  if (nA.size === 0 && nB.size === 0) return 1;
  if (nA.size === 0 || nB.size === 0) return 0;
  const intersection = [...nA].filter(x => nB.has(x)).length;
  return (2 * intersection) / (nA.size + nB.size);
}

/** TF-IDF cosine similarity over word tokens */
function tfidfSimilarity(textA: string, textB: string): number {
  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);
  if (tokensA.length === 0 && tokensB.length === 0) return 1;
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const vocab = [...new Set([...tokensA, ...tokensB])];
  return cosineSimilarity(buildTFVector(tokensA, vocab), buildTFVector(tokensB, vocab));
}

/** Longest Common Subsequence ratio */
function lcsRatio(a: string, b: string): number {
  const wa = tokenize(a);
  const wb = tokenize(b);
  if (wa.length === 0 || wb.length === 0) return 0;
  const dp: number[][] = Array.from({ length: wa.length + 1 }, () =>
    new Array(wb.length + 1).fill(0)
  );
  for (let i = 1; i <= wa.length; i++) {
    for (let j = 1; j <= wb.length; j++) {
      dp[i][j] = wa[i - 1] === wb[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return (2 * dp[wa.length][wb.length]) / (wa.length + wb.length);
}

/** Combine all three signals into a single 0-1 score */
function combinedSimilarity(textA: string, textB: string): number {
  const tfidf  = tfidfSimilarity(textA, textB);
  const ngram  = ngramSimilarity(textA.toLowerCase(), textB.toLowerCase());
  const lcs    = lcsRatio(textA, textB);
  // Weighted blend: TF-IDF 50%, n-gram 30%, LCS 20%
  return tfidf * 0.5 + ngram * 0.3 + lcs * 0.2;
}

function verdictFor(similarity: number): SimilarityVerdict {
  if (similarity >= 0.95) return 'likely_copied';
  if (similarity >= 0.85) return 'highly_similar';
  if (similarity >= 0.70) return 'similar';
  return 'unique';
}

function explanationFor(verdict: SimilarityVerdict, pct: number): string {
  switch (verdict) {
    case 'likely_copied':
      return `Answers are nearly identical (${pct}% similarity). Very high probability of answer sharing or copying.`;
    case 'highly_similar':
      return `Answers are very similar (${pct}% similarity). Possible answer sharing or independent derivation from the same source.`;
    case 'similar':
      return `Answers show notable similarity (${pct}%). May represent legitimate similar approaches or shared understanding.`;
    default:
      return `Answers are substantially different (${pct}% similarity).`;
  }
}

// ─── Public API (drop-in replacement) ────────────────────────────────────────

/**
 * Compare two answers for semantic similarity.
 * Previously used Gemini embeddings; now uses local TF-IDF + n-gram + LCS.
 */
export async function compareAnswers(
  answerA: string,
  answerB: string
): Promise<SimilarityResult> {
  const minLength = 5;
  if (answerA.trim().length < minLength || answerB.trim().length < minLength) {
    return {
      similarity: 0,
      similarity_percent: 0,
      verdict: 'unique',
      explanation: 'One or both answers are too short to reliably compare for similarity.',
    };
  }

  const similarity = combinedSimilarity(answerA, answerB);
  const similarity_percent = Math.round(similarity * 100);
  const verdict = verdictFor(similarity);

  return {
    similarity,
    similarity_percent,
    verdict,
    explanation: explanationFor(verdict, similarity_percent),
  };
}

/**
 * Batch compare multiple pairs of answers efficiently.
 * Previously used Gemini embeddings with caching; now fully synchronous locally.
 */
export async function compareAnswerBatch(
  pairs: Array<{ answerA: string; answerB: string }>
): Promise<SimilarityResult[]> {
  return Promise.all(pairs.map(({ answerA, answerB }) => compareAnswers(answerA, answerB)));
}