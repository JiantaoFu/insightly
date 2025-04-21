import { supabase } from '../server/supabaseClient.js';
import fs from 'fs/promises';
import path from 'path';

const LOCAL_BACKUP_DIR = path.join(process.cwd(), 'supabase/storage');
let totalFiles = 0;
let totalSize = 0;

async function listFilesRecursive(prefix = '') {
  try {
    console.log(`📂 Processing prefix: ${prefix}`);
    const { data, error } = await supabase.storage
      .from('reports')
      .list(prefix);

    if (error) {
      console.error('Error listing files:', error);
      return [];
    }

    console.log(`🔍 Found ${data.length} items under prefix: ${prefix}`);

    const files = [];
    for (const item of data) {
      if (item.metadata?.size) {
        const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
        files.push(fullPath);
      } else {
        const newPrefix = prefix ? `${prefix}/${item.name}` : item.name;
        const nestedFiles = await listFilesRecursive(newPrefix);
        files.push(...nestedFiles);
      }
    }
    return files;
  } catch (error) {
    console.error('Failed to list files:', error);
    return [];
  }
}

async function downloadFile(filePath) {
  try {
    const { data, error } = await supabase.storage
      .from('reports')
      .download(filePath);

    if (error) {
      console.error(`Error downloading file ${filePath}:`, error);
      return;
    }

    const localFilePath = path.join(LOCAL_BACKUP_DIR, filePath);
    await fs.mkdir(path.dirname(localFilePath), { recursive: true });
    await fs.writeFile(localFilePath, Buffer.from(await data.arrayBuffer()));

    const fileSize = Buffer.byteLength(await data.arrayBuffer());
    totalFiles++;
    totalSize += fileSize;

    console.log(`✅ Downloaded ${filePath} (${fileSize} bytes)`);
  } catch (error) {
    console.error(`Failed to download file ${filePath}:`, error);
  }
}

async function backupStorage() {
  console.log('Starting storage backup...');
  console.log(`Backing up files to: ${LOCAL_BACKUP_DIR}`);

  const files = await listFilesRecursive();
  console.log(`Found ${files.length} files to back up.`);

  for (const file of files) {
    await downloadFile(file);
  }

  console.log('\n📦 Backup Summary:');
  console.log(`Total Files: ${totalFiles}`);
  console.log(`Total Size: ${totalSize} bytes`);
  console.log(`Backup completed successfully!`);
}

backupStorage().catch(err => {
  console.error('Failed to back up storage:', err);
  process.exit(1);
});