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
    const output = await this.pipe(text, {
      pooling: 'mean',
      normalize: true,
    })
    return Array.from(output.data)
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
}

export const embeddingService = new EmbeddingService()
