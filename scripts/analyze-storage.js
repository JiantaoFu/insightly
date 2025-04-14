import { supabase } from '../server/supabaseClient.js'
import prettyBytes from 'pretty-bytes'
import { createObjectCsvWriter } from 'csv-writer'
import path from 'path'

const PAGE_SIZE = 100;
let totalSize = 0;
let totalFiles = 0;
const fileSizes = new Map();

async function listFilesRecursive(prefix = '') {
  try {
    const { data, error } = await supabase.storage
      .from('reports')
      .list(prefix);

    if (error) {
      console.error('Error listing files:', error);
      return;
    }

    for (const item of data) {
      if (item.metadata?.size) {
        const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
        fileSizes.set(fullPath, item.metadata.size);
        totalSize += item.metadata.size;
        totalFiles++;

        // Log progress every 100 files
        if (totalFiles % 100 === 0) {
          console.log(`Processed ${totalFiles} files, Total size: ${prettyBytes(totalSize)}`);
        }
      }

      // If it's a folder, recurse
      if (!item.metadata?.size) {
        const newPrefix = prefix ? `${prefix}/${item.name}` : item.name;
        await listFilesRecursive(newPrefix);
      }
    }
  } catch (error) {
    console.error('Failed to list files:', error);
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
