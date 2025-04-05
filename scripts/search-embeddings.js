import { pipeline } from '@xenova/transformers'
import { supabase } from '../server/supabaseClient.js'
import yargs from 'yargs'

async function searchReports() {
  const argv = await yargs(process.argv.slice(2))
    .option('query', {
      alias: 'q',
      description: 'Search query',
      type: 'string',
      demandOption: true
    })
    .option('threshold', {
      alias: 't',
      description: 'Similarity threshold',
      type: 'number',
      default: 0.7
    })
    .option('limit', {
      alias: 'l',
      description: 'Number of results',
      type: 'number',
      default: 5
    })
    .strict()
    .help()
    .argv

  console.log('Initializing embedding model...')
  const pipe = await pipeline(
    'feature-extraction',
    'Supabase/gte-small',
    {
      progress_callback: progress => {
        if (progress.status === 'downloading') {
          console.log(`Downloading model... ${progress.progress}%`)
        }
      }
    }
  )
  console.log('Model loaded successfully')

  // Generate embedding for search query
  const output = await pipe(argv.query, {
    pooling: 'mean',
    normalize: true,
  })
  const embedding = Array.from(output.data)

  // Search using match_report_sections with join
  const { data: matches, error } = await supabase
    .rpc('match_report_sections', {
      query_embedding: embedding,
      similarity_threshold: argv.threshold,
      match_count: argv.limit
    })

  if (error) {
    console.error('Search error:', error)
    return
  }

  // Fetch app details for the matched reports
  const reportIds = [...new Set(matches.map(m => m.report_id))]
  const { data: apps, error: appsError } = await supabase
    .from('analysis_reports')
    .select('id, app_title, description')
    .in('id', reportIds)

  if (appsError) {
    console.error('Error fetching app details:', appsError)
    return
  }

  // Group results by app
  const resultsByApp = {}
  for (const match of matches) {
    const app = apps.find(a => a.id === match.report_id)
    if (!app) continue

    if (!resultsByApp[app.id]) {
      resultsByApp[app.id] = {
        app_title: app.app_title,
        description: app.description,
        matches: []
      }
    }
    resultsByApp[app.id].matches.push({
      similarity: match.similarity,
      content: match.content
    })
  }

  // Display results grouped by app
  console.log('\nSearch results:')
  console.log('===============')
  for (const [appId, result] of Object.entries(resultsByApp)) {
    console.log(`\nApp: ${result.app_title}`)
    console.log(`Description: ${result.description?.substring(0, 150)}...`)
    console.log('\nMatching sections:')
    for (const match of result.matches) {
      console.log(`\n  Score: ${(match.similarity * 100).toFixed(1)}%`)
      console.log(`  Content: ${match.content.substring(0, 200)}...`)
    }
    console.log('---------------')
  }
}

searchReports().catch(console.error)
