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
import JSZip from 'jszip'

dotenv.config()

const PAGE_SIZE = 100; // Process reports in batches
let lastProcessedId = 0;
let totalProcessed = 0;

async function getReportFromStorage(hashUrl) {
  const folderStructure = `${hashUrl.slice(0, 2)}/${hashUrl.slice(2, 4)}/`;
  const fileName = `${folderStructure}${hashUrl}.zip`;

  const { data, error } = await supabase.storage
    .from('reports')
    .download(fileName);

  if (error) throw error;

  const arrayBuffer = await data.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const reportFile = zip.file('report.txt');

  if (!reportFile) {
    throw new Error('Report file not found in zip');
  }

  const content = await reportFile.async('string');
  return JSON.parse(content);
}

async function fetchReportsBatch() {
  const { data, error } = await supabase
    .from('analysis_reports')
    .select('id, hash_url, embedding_checksum')  // Changed to get hash_url instead of full_report
    .order('id')
    .gt('id', lastProcessedId)
    .limit(PAGE_SIZE);

  if (error) throw error;
  return data;
}

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

  // console.log('Processing content:', content.substring(0, 100) + '...')

  const checksum = createHash('sha256').update(content).digest('base64')
  const mdTree = fromMarkdown(content)

  // console.log('Markdown tree structure:', {
  //   type: mdTree.type,
  //   childCount: mdTree.children.length,
  //   firstChild: mdTree.children[0]?.type
  // })

  const sectionTrees = splitTreeBy(mdTree, (node) => node.type === 'heading')
  // console.log(`Split into ${sectionTrees.length} sections`)

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

  // console.log('Processed sections:', sections.map(s => ({
  //   heading: s.heading,
  //   slug: s.slug,
  //   contentLength: s.content.length
  // })))

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

  const shouldRefresh = argv.refresh;
  let totalSkipped = 0;

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

  while (true) {
    console.log(`Fetching batch after ID ${lastProcessedId}...`)
    const reports = await fetchReportsBatch();

    if (!reports || reports.length === 0) {
      console.log('No more reports to process')
      break
    }

    for (const report of reports) {
      try {
        lastProcessedId = report.id;

        // Fetch report from storage
        let fullReport;
        try {
          fullReport = await getReportFromStorage(report.hash_url);
        } catch (storageError) {
          console.log(`⏭️ Skipping report ${report.id}: ${storageError.message}`);
          totalSkipped++;
          continue;
        }

        if (!fullReport?.finalReport) {
          console.log(`⏭️ Skipping report ${report.id}: No finalReport in storage`);
          totalSkipped++;
          continue;
        }

        const { checksum, sections } = processMarkdownForSearch(fullReport.finalReport);

        // Skip if checksum matches and refresh not forced
        if (!shouldRefresh && report.embedding_checksum === checksum) {
          console.log(`⏭️ Skipping report ${report.id}: Checksum unchanged`);
          totalSkipped++;
          continue;
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

        // After successful embedding generation, clear full_report with empty object
        const { error: cleanupError } = await supabase
          .from('analysis_reports')
          .update({ full_report: {} })
          .match({ id: report.id });

        if (cleanupError) {
          console.error(`Failed to clear full_report for ${report.id}:`, cleanupError);
        } else {
          console.log(`🧹 Cleared full_report for ${report.id} to save space`);
        }

        totalProcessed++;
        console.log(`✅ Processed report ${report.id}`)
      } catch (err) {
        console.error(`Failed to process report ${report.id}`)
        console.error(err)
        continue; // Skip failed reports instead of exiting
      }
    }

    console.log(`📊 Progress: Processed ${totalProcessed}, Skipped ${totalSkipped}, Last ID: ${lastProcessedId}`);
  }

  console.log(`🎉 Final summary:`)
  console.log(`- Total processed: ${totalProcessed}`)
  console.log(`- Total skipped: ${totalSkipped}`)
  console.log(`- Last processed ID: ${lastProcessedId}`)
}

async function main() {
  await generateEmbeddings()
}

main().catch((err) => console.error(err))
