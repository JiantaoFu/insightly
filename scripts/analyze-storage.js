import { supabase } from '../server/supabaseClient.js'
import prettyBytes from 'pretty-bytes'
import { createObjectCsvWriter } from 'csv-writer'
import path from 'path'

const PAGE_SIZE = 100;
let totalSize = 0;
let totalFiles = 0;
const fileSizes = new Map();

async function processItem(item, prefix) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;

    if (item.metadata?.size) {
        const size = parseInt(item.metadata.size, 10);
        if (!isNaN(size)) {
            fileSizes.set(fullPath, size);
            totalSize += size;
            totalFiles++;

            // Log progress every 50 files
            if (totalFiles % 50 === 0) {
                console.log(`Processed ${totalFiles} files, Total size: ${prettyBytes(totalSize)}`);
            }
        } else {
            console.warn(`⚠️ Invalid size metadata for file: ${fullPath}`);
        }
    }
}

async function listFilesRecursive(prefix = '', offset = 0) {
  try {
      console.log(`Scanning directory: ${prefix || 'root'}`);
      let hasMore = true;

      while (hasMore) {
          const { data, error } = await supabase.storage
              .from('reports')
              .list(prefix, {
                  limit: PAGE_SIZE,
                  offset: offset,
                  sortBy: { column: 'name', order: 'asc' }
              });

          if (error) {
              console.error('Error listing files:', error);
              return; // Exit if there's an error
          }

          if (!data || data.length === 0) {
              hasMore = false; // No more data to process
              break;
          }

          console.log(`Processing ${data.length} items from offset ${offset} in ${prefix || 'root'}`);

          // Process all items in the current page
          for (const item of data) {
              await processItem(item, prefix);

              // If the item is a directory, call the function recursively
              if (!item.metadata?.size) {
                  await listFilesRecursive(`${prefix}${item.name}/`); // Ensure to append the correct path
              }
          }

          // Update the offset for the next batch
          offset += data.length;
      }

  } catch (error) {
      console.error(`Failed to list files in ${prefix}:`, error);
  }
}

async function generateReport() {
  console.log('Starting storage analysis...');

  await listFilesRecursive();

  // Sort files by size
  const sortedFiles = Array.from(fileSizes.entries())
    .sort((a, b) => b[1] - a[1]);

  // Generate summary
  console.log('\n📊 Storage Usage Summary:');
  console.log(`Total Files: ${totalFiles}`);
  console.log(`Total Size: ${prettyBytes(totalSize)}`);
  console.log('\nTop 10 Largest Files:');

  sortedFiles.slice(0, 10).forEach(([file, size]) => {
    console.log(`${file}: ${prettyBytes(size)}`);
  });

  // Export detailed report to CSV
  const csvWriter = createObjectCsvWriter({
    path: path.join(process.cwd(), 'storage-report.csv'),
    header: [
      { id: 'file', title: 'File Path' },
      { id: 'size', title: 'Size (bytes)' },
      { id: 'sizeFormatted', title: 'Size (human readable)' },
      { id: 'folder', title: 'Folder' }
    ]
  });

  const records = sortedFiles.map(([file, size]) => ({
    file,
    size,
    sizeFormatted: prettyBytes(size),
    folder: path.dirname(file)
  }));

  await csvWriter.writeRecords(records);
  console.log('\n✅ Detailed report exported to storage-report.csv');

  // Folder size summary
  const folderSizes = records.reduce((acc, { folder, size }) => {
    acc.set(folder, (acc.get(folder) || 0) + size);
    return acc;
  }, new Map());

  console.log('\n📁 Storage by Folder:');
  Array.from(folderSizes.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([folder, size]) => {
      console.log(`${folder}: ${prettyBytes(size)}`);
    });
}

generateReport().catch(err => {
  console.error('Failed to analyze storage:', err);
  process.exit(1);
});
