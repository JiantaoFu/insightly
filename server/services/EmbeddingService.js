import { pipeline } from '@xenova/transformers'
import { supabase } from '../supabaseClient.js'
import { LRUCache } from 'lru-cache';

export class EmbeddingService {
  constructor() {
    // Initialize RAG search cache
    this.searchCache = new LRUCache({
      max: 100, // Maximum number of cached search results
      ttl: 1000 * 60 * 60, // 1 hour TTL
    });
    this.pipe = null;
  }

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

  async searchSimilar(embedding, threshold = 0.7, initialLimit = 30) {
    const cacheKey = `${embedding.slice(0, 10).join(',')}_${threshold}`;
    const cached = this.searchCache.get(cacheKey);

    if (cached) {
      console.log('Using cached RAG search results');
      return cached;
    }

    const { data: matches, error } = await supabase.rpc('match_report_sections', {
      query_embedding: embedding,
      similarity_threshold: threshold,
      match_count: initialLimit
    });

    if (error) throw error;

    // Filter and sort matches
    const relevantMatches = matches
      .filter(match => match.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity);

    // Cache the results
    this.searchCache.set(cacheKey, relevantMatches);

    return relevantMatches;
  }

  async searchSimilarWithContext(embedding, threshold = 0.7, initialLimit = 30) {
    const matches = await this.searchSimilar(embedding, threshold, initialLimit);

    // Weight results based on recency and relevance
    return matches.map(match => ({
      ...match,
      similarity: match.similarity * (1 + Math.log1p(1 / (1 + match.age || 0)) * 0.1)
    })).sort((a, b) => b.similarity - a.similarity);
  }

  clearCache() {
    this.searchCache.clear();
  }
}

export const embeddingService = new EmbeddingService();
