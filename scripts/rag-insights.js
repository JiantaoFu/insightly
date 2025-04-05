import { pipeline } from '@xenova/transformers'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabase } from '../server/supabaseClient.js'
import dotenv from 'dotenv'
import yargs from 'yargs'

dotenv.config()

const PROMPT_TEMPLATES = {
  competitive: `Analyze these insights about competitive research and market gaps. For each insight:
1. State the finding
2. Support it with specific quotes and examples from the source data
3. Cite the specific apps where this evidence comes from

Context:
{context}

Question: {query}

Format your response like this:
Key Finding 1:
- Finding: [state the insight]
- Evidence:
  * "[exact quote]" - [App Name]
  * "[exact quote]" - [App Name]
- Analysis: [your interpretation]

Key Finding 2:
[etc...]

Focus on competitive differentiation, feature gaps, pricing models, and market positioning.
Only include findings that you can support with direct evidence from the context.`,

  sentiment: `Analyze these insights about user sentiment and feedback. For each insight:
1. State the finding
2. Support it with specific quotes and examples from the source data
3. Cite the specific apps where this evidence comes from

Context:
{context}

Question: {query}

Format your response like this:
Key Finding 1:
- Finding: [state the insight about user sentiment]
- Evidence:
  * "[exact quote]" - [App Name]
  * "[exact quote]" - [App Name]
- Analysis: [your interpretation]

Key Finding 2:
[etc...]

Focus on user needs, complaints vs. feature requests, pain points, and expectations.
Only include findings that you can support with direct evidence from the context.`,

  trends: `Analyze these insights about market trends and patterns. For each insight:
1. State the finding
2. Support it with specific quotes and examples from the source data
3. Cite the specific apps where this evidence comes from

Context:
{context}

Question: {query}

Format your response like this:
Key Finding 1:
- Finding: [state the trend or pattern]
- Evidence:
  * "[exact quote]" - [App Name]
  * "[exact quote]" - [App Name]
- Analysis: [your interpretation]

Key Finding 2:
[etc...]

Focus on emerging patterns, user expectation shifts, and industry trends.
Only include findings that you can support with direct evidence from the context.`,

  business: `Analyze these insights about business opportunities. For each insight:
1. State the finding
2. Support it with specific quotes and examples from the source data
3. Cite the specific apps where this evidence comes from

Context:
{context}

Question: {query}

Format your response like this:
Key Finding 1:
- Finding: [state the business opportunity]
- Evidence:
  * "[exact quote]" - [App Name]
  * "[exact quote]" - [App Name]
- Analysis: [your interpretation]

Key Finding 2:
[etc...]

Focus on product opportunities, business models, and revenue strategies.
Only include findings that you can support with direct evidence from the context.`,

  pmf: `You are a Product Market Fit analyst. You will analyze the provided evidence to evaluate opportunities ONLY IF there is relevant data. 

Context:
{context}

Query Topic: {query}

Instructions:
1. First, evaluate if the provided evidence contains DIRECTLY relevant information for the query topic.
2. If NO relevant evidence is found, respond with:
   "Insufficient relevant data found for {query}. Consider exploring:"
   - [List 2-3 related search terms that might yield better results]

3. If relevant evidence IS found, analyze using this structure:

Market Analysis:
- Target Market Evidence:
  * "[ONLY include quotes that explicitly describe users or needs]" – [App Name]
- Current Solutions:
  * "[ONLY include quotes about existing solutions]" – [App Name]

User Pain Points:
- Validated Problems:
  * "[ONLY include quotes showing clear user frustrations or needs]" – [App Name]
- Feature Requests:
  * "[ONLY include explicit feature requests or wishes]" – [App Name]

Business Model Insights:
- Pricing Evidence:
  * "[ONLY include quotes about pricing/monetization]" – [App Name]
- User Willingness to Pay:
  * "[ONLY include quotes about value perception]" – [App Name]

Opportunity Summary:
- Gap Analysis: [ONLY mention gaps with direct evidence]
- Differentiation: [ONLY suggest differentiators based on user quotes]
- Risks: [ONLY list risks mentioned in the evidence]

DO NOT make assumptions or include insights without direct supporting evidence.
DO NOT try to force insights if the evidence is not clearly relevant to the query topic.
If certain sections lack supporting evidence, mark them as "No direct evidence found."
`
}

async function searchAndAnalyze() {
  const argv = await yargs(process.argv.slice(2))
    .option('query', {
      alias: 'q',
      description: 'Your question about SaaS insights',
      type: 'string',
      demandOption: true
    })
    .option('type', {
      alias: 't',
      description: 'Analysis type: competitive, sentiment, trends, business, pmf',
      type: 'string',
      default: 'pmf'  // Change default to pmf
    })
    .option('limit', {
      alias: 'l',
      description: 'Number of relevant sections to consider',
      type: 'number',
      default: 50  // Increase default for PMF analysis
    })
    .option('debug', {
      alias: 'd',
      description: 'Show debug information',
      type: 'boolean',
      default: false
    })
    .strict()
    .help()
    .argv

  // Initialize Gemini with larger context model
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({
    model: process.env.VITE_GEMINI_DEFAULT_MODEL,
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
    }
  })

  // Initialize embedding model
  console.log('Loading embedding model...')
  const pipe = await pipeline('feature-extraction', 'Supabase/gte-small')
  
  // Generate embedding for query
  const output = await pipe(argv.query, {
    pooling: 'mean',
    normalize: true,
  })
  const queryEmbedding = Array.from(output.data)

  // Search for relevant sections
  const { data: matches, error } = await supabase
    .rpc('match_report_sections', {
      query_embedding: queryEmbedding,
      similarity_threshold: 0.75,
      match_count: argv.limit
    })

  if (error) {
    console.error('Search error:', error)
    return
  }

  // Fetch app details and calculate description similarity
  const reportIds = [...new Set(matches.map(m => m.report_id))]
  const { data: apps } = await supabase
    .from('analysis_reports')
    .select('id, app_title, description, app_url, platform, total_reviews, average_rating')
    .in('id', reportIds)

  // Calculate similarity between query and each app's description
  const appsWithSimilarity = await Promise.all(apps.map(async app => {
    if (!app.description) return { ...app, descriptionSimilarity: 0 }
    
    const descEmbed = await pipe(app.description, {
      pooling: 'mean',
      normalize: true,
    })
    
    // Calculate cosine similarity
    const similarity = calculateCosineSimilarity(queryEmbedding, Array.from(descEmbed.data))
    return { ...app, descriptionSimilarity: similarity }
  }))

  // Filter apps by description similarity
  const relevantApps = appsWithSimilarity.filter(app => app.descriptionSimilarity > 0.6)

  if (argv.debug) {
    console.log('\nApp Description Similarities:')
    appsWithSimilarity.forEach(app => {
      console.log(`${app.app_title}: ${(app.descriptionSimilarity * 100).toFixed(1)}%`)
    })
  }

  // Early exit if no relevant apps found
  if (relevantApps.length === 0) {
    console.log('\nNo relevant apps or insights found for this query.')
    console.log('Try a different search term or check if we have data for this market segment.')
    return
  }

  // Filter matches to only include relevant apps
  const relevantMatches = matches.filter(match => 
    relevantApps.some(app => app.id === match.report_id)
  )

  // Early exit if no relevant content after filtering
  if (relevantMatches.length === 0) {
    console.log('\nFound some related apps but no relevant insights for this specific query.')
    console.log('\nRelated apps found:')
    relevantApps.forEach(app => {
      console.log(`- ${app.app_title} (similarity: ${(app.descriptionSimilarity * 100).toFixed(1)}%)`)
      console.log(`  ${app.description?.substring(0, 150)}...`)
    })
    return
  }

  // If we have very few matches, warn about limited data
  if (relevantMatches.length < 3) {
    console.log('\nWARNING: Limited data available for analysis.')
    console.log('The following insights are based on a small number of matches.')
    console.log('Consider expanding your search or exploring related markets.\n')
  }

  // Prepare context from matches
  const context = relevantMatches.map(match => {
    const app = relevantApps.find(a => a.id === match.report_id)
    return `From ${app?.app_title || 'Unknown App'} analysis:\n${match.content}\n`
  }).join('\n')

  // Enhance context with source tracking
  const contextWithSources = relevantMatches.map(match => {
    const app = relevantApps.find(a => a.id === match.report_id)
    return {
      source: app?.app_title || 'Unknown App',
      content: match.content,
      similarity: match.similarity
    }
  })

  // Group evidence by topic/similarity
  const groupedEvidence = contextWithSources.reduce((acc, item) => {
    // Skip low confidence matches
    if (item.similarity < 0.65) return acc
    
    // Find the corresponding match to get report_id
    const match = relevantMatches.find(m => m.content === item.content)
    const app = match ? relevantApps.find(a => a.id === match.report_id) : null

    return acc + `
App: ${app?.app_title || 'Unknown App'}
Platform: ${app?.platform || 'Unknown'}
Description: ${app?.description || 'No description'}
Rating: ${app?.average_rating || 'N/A'} (${app?.total_reviews || 0} reviews)
URL: ${app?.app_url || 'N/A'}

Evidence: "${item.content.trim()}"
Confidence: ${(item.similarity * 100).toFixed(1)}%
---
  `
  }, '')

  // Select prompt template
  const promptTemplate = PROMPT_TEMPLATES[argv.type] || PROMPT_TEMPLATES.business
  const prompt = promptTemplate
    .replace('{context}', groupedEvidence)
    .replace('{query}', argv.query)

  // Debug: Show final prompt
  if (argv.debug) {
    console.log('\nGenerated Prompt:')
    console.log('================')
    console.log(prompt)
    console.log('\nGenerating Analysis...\n')
  }

  // Generate response with Gemini
  const result = await model.generateContent(prompt)
  const response = await result.response
  const text = response.text()

  // Display results
  console.log('\nAnalysis Results:')
  console.log('================')
  console.log(text)
  
  console.log('\nSource Statistics:')
  console.log('=================')
  const sourceStats = contextWithSources.reduce((stats, item) => {
    stats[item.source] = (stats[item.source] || 0) + 1
    return stats
  }, {})
  
  Object.entries(sourceStats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([source, count]) => {
      console.log(`${source}: ${count} relevant sections`)
    })

  console.log('\nConfidence Range:')
  console.log('================')
  const similarities = contextWithSources.map(x => x.similarity)
  console.log(`Min: ${(Math.min(...similarities) * 100).toFixed(1)}%`)
  console.log(`Max: ${(Math.max(...similarities) * 100).toFixed(1)}%`)
  console.log(`Avg: ${(similarities.reduce((a,b) => a+b, 0) / similarities.length * 100).toFixed(1)}%`)
}

// Add utility function for cosine similarity
function calculateCosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0)
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0))
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0))
  return dotProduct / (normA * normB)
}

searchAndAnalyze().catch(console.error)
