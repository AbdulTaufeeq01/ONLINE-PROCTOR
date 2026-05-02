/**
 * Semantic Similarity: Compare answers using Google Gemini embeddings
 * 
 * Uses text-embedding-004 model for semantic similarity detection.
 * Implements cosine similarity for comparing embedding vectors.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GOOGLE_API_KEY!);

/**
 * Get embedding vector for text using Gemini embeddings API
 * @param text - Text to embed
 * @returns Embedding vector as number[]
 */
export async function getEmbedding(text: string): Promise<number[]> {
  try {
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });

    const result = await model.embedContent(text);
    const embedding = result.embedding;

    if (!embedding || !embedding.values) {
      throw new Error('No embedding returned from Gemini API');
    }

    return embedding.values;
  } catch (error) {
    console.error('Error getting embedding:', error);
    throw error;
  }
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

  // Compute dot product
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

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

export type SimilarityVerdict = 'unique' | 'similar' | 'highly_similar' | 'likely_copied';

export interface SimilarityResult {
  similarity: number; // 0-1 cosine similarity
  similarity_percent: number; // 0-100 for display
  verdict: SimilarityVerdict;
  explanation: string;
}

/**
 * Compare two answers for semantic similarity
 * @param answerA - First student's answer
 * @param answerB - Second student's answer
 * @returns Similarity analysis with verdict
 */
export async function compareAnswers(
  answerA: string,
  answerB: string
): Promise<SimilarityResult> {
  // Handle empty or very short answers
  const minLength = 5;
  if (answerA.trim().length < minLength || answerB.trim().length < minLength) {
    return {
      similarity: 0,
      similarity_percent: 0,
      verdict: 'unique',
      explanation:
        'One or both answers are too short to reliably compare for similarity.',
    };
  }

  try {
    // Get embeddings for both answers
    const [embeddingA, embeddingB] = await Promise.all([
      getEmbedding(answerA),
      getEmbedding(answerB),
    ]);

    // Compute cosine similarity
    const similarity = cosineSimilarity(embeddingA, embeddingB);
    const similarity_percent = Math.round(similarity * 100);

    // Determine verdict based on thresholds
    let verdict: SimilarityVerdict;
    let explanation: string;

    if (similarity >= 0.95) {
      verdict = 'likely_copied';
      explanation =
        'Answers are nearly identical semantically. Very high probability of answer sharing or copying.';
    } else if (similarity >= 0.85) {
      verdict = 'highly_similar';
      explanation =
        'Answers are very similar in meaning and structure. Possible answer sharing or independent derivation from same source.';
    } else if (similarity >= 0.7) {
      verdict = 'similar';
      explanation =
        'Answers show notable similarity but may represent legitimate similar approaches or understanding.';
    } else {
      verdict = 'unique';
      explanation = 'Answers are substantially different semantically.';
    }

    return {
      similarity,
      similarity_percent,
      verdict,
      explanation,
    };
  } catch (error) {
    console.error('Error comparing answers:', error);
    throw error;
  }
}

/**
 * Batch compare multiple pairs of answers efficiently
 * @param pairs - Array of answer pairs to compare
 * @returns Array of similarity results
 */
export async function compareAnswerBatch(
  pairs: Array<{ answerA: string; answerB: string }>
): Promise<SimilarityResult[]> {
  // Get all embeddings in parallel
  const answerTexts = new Set<string>();
  pairs.forEach((p) => {
    answerTexts.add(p.answerA);
    answerTexts.add(p.answerB);
  });

  const embeddingMap = new Map<string, number[]>();

  // Embed all unique answers to avoid redundant API calls
  for (const text of answerTexts) {
    try {
      const embedding = await getEmbedding(text);
      embeddingMap.set(text, embedding);
    } catch (error) {
      console.error(`Error embedding answer: ${error}`);
      // Skip this answer
    }
  }

  // Compare pairs using cached embeddings
  const results: SimilarityResult[] = [];
  for (const pair of pairs) {
    const embA = embeddingMap.get(pair.answerA);
    const embB = embeddingMap.get(pair.answerB);

    if (!embA || !embB) {
      results.push({
        similarity: 0,
        similarity_percent: 0,
        verdict: 'unique',
        explanation: 'Could not embed one or both answers.',
      });
      continue;
    }

    try {
      const similarity = cosineSimilarity(embA, embB);
      const similarity_percent = Math.round(similarity * 100);

      let verdict: SimilarityVerdict;
      if (similarity >= 0.95) verdict = 'likely_copied';
      else if (similarity >= 0.85) verdict = 'highly_similar';
      else if (similarity >= 0.7) verdict = 'similar';
      else verdict = 'unique';

      results.push({
        similarity,
        similarity_percent,
        verdict,
        explanation: `Semantic similarity: ${similarity_percent}%. ${verdict === 'likely_copied' ? 'Possible answer sharing detected.' : verdict === 'highly_similar' ? 'High similarity detected.' : verdict === 'similar' ? 'Moderate similarity detected.' : 'Answers appear distinct.'}`,
      });
    } catch (error) {
      console.error('Error computing similarity:', error);
      results.push({
        similarity: 0,
        similarity_percent: 0,
        verdict: 'unique',
        explanation: 'Error computing similarity.',
      });
    }
  }

  return results;
}
