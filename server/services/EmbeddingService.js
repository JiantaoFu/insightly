import { pipeline } from '@xenova/transformers'
import { supabase } from '../supabaseClient.js'

export class EmbeddingService {
  pipe = null

  async initialize() {
    if (!this.pipe) {
      console.log('Initializing embedding model...')
      this.pipe = await pipeline('feature-extraction', 'Supabase/gte-small')
    }
  }

  async generateEmbedding(text) {
    await this.initialize()

    // Trim if text is too long (typical transformer limits)
    const maxLength = 2048;
    const trimmedText = text.length > maxLength
      ? text.slice(-maxLength) // Take last maxLength chars as they're most recent/relevant
      : text;

    const output = await this.pipe(trimmedText, {
      pooling: 'mean',
      normalize: true,
    });
    return Array.from(output.data);
  }

  async searchSimilar(embedding, threshold = 0.7, limit = 5) {
    const { data: matches, error } = await supabase.rpc('match_report_sections', {
      query_embedding: embedding,
      similarity_threshold: threshold,
      match_count: limit
    })

    if (error) throw error
    return matches
  }

  // Add method to handle conversation context weighting
  async searchSimilarWithContext(embedding, threshold = 0.7, limit = 5) {
    const { data: matches, error } = await supabase.rpc('match_report_sections', {
      query_embedding: embedding,
      similarity_threshold: threshold,
      match_count: limit
    });

    if (error) throw error;

    // Weight results based on recency and relevance
    return matches.map(match => ({
      ...match,
      // Combine base similarity with recency boost
      similarity: match.similarity * (1 + Math.log1p(1 / (1 + match.age || 0)) * 0.1)
    })).sort((a, b) => b.similarity - a.similarity);
  }
}

export const embeddingService = new EmbeddingService()
