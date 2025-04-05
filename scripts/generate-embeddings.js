import { createHash } from 'crypto'
import dotenv from 'dotenv'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { toMarkdown } from 'mdast-util-to-markdown'
import { toString } from 'mdast-util-to-string'
import GithubSlugger from 'github-slugger'
import { pipeline } from '@xenova/transformers'
import { u } from 'unist-builder'
import yargs from 'yargs'
import { supabase } from '../server/supabaseClient.js'

dotenv.config()

function splitTreeBy(tree, predicate) {
  return tree.children.reduce((trees, node) => {
    const [lastTree] = trees.slice(-1)

    if (!lastTree || predicate(node)) {
      const tree = u('root', [node])
      return trees.concat(tree)
    }

    lastTree.children.push(node)
    return trees
  }, [])
}

function processMarkdownForSearch(content) {
  if (typeof content !== 'string') {
    throw new Error(`Invalid content type: ${typeof content}. Expected string.`)
  }
  
  console.log('Processing content:', content.substring(0, 100) + '...')
  
  const checksum = createHash('sha256').update(content).digest('base64')
  const mdTree = fromMarkdown(content)
  
  console.log('Markdown tree structure:', {
    type: mdTree.type,
    childCount: mdTree.children.length,
    firstChild: mdTree.children[0]?.type
  })
  
  const sectionTrees = splitTreeBy(mdTree, (node) => node.type === 'heading')
  console.log(`Split into ${sectionTrees.length} sections`)
  
  const slugger = new GithubSlugger()
  const sections = sectionTrees.map((tree) => {
    const [firstNode] = tree.children
    const heading = firstNode.type === 'heading' ? toString(firstNode) : undefined
    const slug = heading ? slugger.slug(heading) : undefined

    // Skip sections with "Original App Link" heading
    if (heading?.toLowerCase() === 'original app link') {
      return null
    }

    return {
      content: toMarkdown(tree),
      heading,
      slug,
    }
  }).filter(Boolean) // Remove null entries

  console.log('Processed sections:', sections.map(s => ({
    heading: s.heading,
    slug: s.slug,
    contentLength: s.content.length
  })))

  return {
    checksum,
    sections,
  }
}

async function generateEmbeddings() {
  const argv = await yargs()
    .option('refresh', {
      alias: 'r',
      description: 'Refresh data',
      type: 'boolean',
    })
    .argv

  const shouldRefresh = argv.refresh

  console.log('Initializing embedding model (will download if not cached)...')
  const pipe = await pipeline(
    'feature-extraction',
    'Supabase/gte-small',
    {
      progress_callback: (progress) => {
        if (progress.status === 'downloading') {
          console.log(`Downloading model... ${progress.progress}%`)
        }
      }
    }
  )
  console.log('Model loaded successfully')

  const { data: reports, error: fetchError } = await supabase
    .from('analysis_reports')
    .select('id, full_report, embedding_checksum')

  if (fetchError) {
    throw fetchError
  }

  console.log(`Processing ${reports?.length ?? 0} analysis reports`)

  for (const report of reports ?? []) {
    if (!report.full_report) continue

    try {
      // Extract finalReport from the JSONB full_report object
      const markdownContent = report.full_report.finalReport
      if (!markdownContent) {
        console.error(`No finalReport found in report ${report.id}`)
        console.error('full_report structure:', Object.keys(report.full_report))
        process.exit(1)
      }

      const { checksum, sections } = processMarkdownForSearch(markdownContent)

      // Skip if checksum matches and refresh not forced
      if (!shouldRefresh && report.embedding_checksum === checksum) {
        continue
      }

      const { error: deleteError } = await supabase
        .from('report_section_embeddings')
        .delete()
        .match({ report_id: report.id })

      if (deleteError) throw deleteError

      console.log(`[Report ${report.id}] Adding ${sections.length} sections with embeddings`)

      for (const { slug, heading, content } of sections) {
        const input = content.replace(/\n/g, ' ')
        console.log(`Generating embedding for section: ${slug}`)

        try {
          const output = await pipe(input, {
            pooling: 'mean',
            normalize: true,
          })

          const embedding = Array.from(output.data)

          const { error: insertError } = await supabase
            .from('report_section_embeddings')
            .insert({
              report_id: report.id,
              content,
              embedding,
            })

          if (insertError) throw insertError
        } catch (err) {
          console.error(`Failed to generate embeddings for report ${report.id} section: ${heading}`)
          throw err
        }
      }

      const { error: updateError } = await supabase
        .from('analysis_reports')
        .update({ embedding_checksum: checksum })
        .match({ id: report.id })

      if (updateError) throw updateError
    } catch (err) {
      console.error(`Failed to process report ${report.id}`)
      console.error(err)
      process.exit(1) // Exit on error
    }
  }

  console.log('Embedding generation complete')
}

async function main() {
  await generateEmbeddings()
}

main().catch((err) => console.error(err))
