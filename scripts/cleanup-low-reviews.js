import { supabase } from '../server/supabaseClient.js';
import path from 'path';
import prettyBytes from 'pretty-bytes';
import fs from 'fs';
import readline from 'readline';

// | review_range | count |
// | ------------ | ----- |
// | 0-99         | 140   |
// | 100-199      | 2392  |
// | 200-299      | 304   |
// | 300-399      | 233   |
// | 400-499      | 167   |
// | 500+         | 2781  |

// NODE_ENV=production RATING_THRESHOLD=3 node scripts/cleanup-low-reviews.js  --by-rating

const REVIEW_RANGE = [100, 150];
let totalFound = 0;
let totalRemoved = 0;
let totalStorageCleanupErrors = 0;
let totalSpaceSaved = 0;

// Get command line arguments
const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');
const isFromCsv = process.argv.includes('--from-csv') || process.argv.includes('--csv');
const CSV_PATH = path.join(process.cwd(), 'low_review.csv');

// Support cleaning by average_rating as well
const RATING_THRESHOLD = process.env.RATING_THRESHOLD ? parseFloat(process.env.RATING_THRESHOLD) : null;
const isRatingMode = process.argv.includes('--by-rating');

async function getFileSize(hashUrl) {
    try {
        const folderStructure = `${hashUrl.slice(0, 2)}/${hashUrl.slice(2, 4)}/`;
        const fileName = `${folderStructure}${hashUrl}.zip`;

        const { data, error } = await supabase.storage
            .from('reports')
            .list(folderStructure, {
                search: `${hashUrl}.zip`
            });

        if (error || !data || data.length === 0) {
            console.log(`⚠️ Could not find file size for: ${fileName}`);
            return 0;
        }

        const file = data.find(f => f.name === `${hashUrl}.zip`);
        return file?.metadata?.size || 0;
    } catch (error) {
        console.error(`❌ Failed to get file size for ${hashUrl}:`, error);
        return 0;
    }
}

async function removeStorageFile(hashUrl, dryRun = false) {
    try {
        const folderStructure = `${hashUrl.slice(0, 2)}/${hashUrl.slice(2, 4)}/`;
        const fileName = `${folderStructure}${hashUrl}.zip`;

        // Get file size before removal
        const fileSize = await getFileSize(hashUrl);

        if (dryRun) {
            console.log(`🔍 Would remove storage file: ${fileName} (${prettyBytes(fileSize)})`);
            totalSpaceSaved += fileSize;
            return true;
        }

        const { error } = await supabase.storage
            .from('reports')
            .remove([fileName]);

        if (error) {
            console.error(`❌ Error removing storage file for ${hashUrl}:`, error);
            totalStorageCleanupErrors++;
            return false;
        }

        totalSpaceSaved += fileSize;
        console.log(`✅ Removed storage file: ${fileName} (${prettyBytes(fileSize)})`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to remove storage file for ${hashUrl}:`, error);
        totalStorageCleanupErrors++;
        return false;
    }
}

// Helper to fetch all records matching the filter, paginated
async function fetchAllLowReviewRecords() {
    const pageSize = 50;
    let allRecords = [];
    let from = 0;
    let to = pageSize - 1;
    let done = false;

    while (!done) {
        console.log(`[Pagination] Fetching records from ${from} to ${to}...`);
        let query = supabase
            .from('analysis_reports')
            .select('id, hash_url, app_title, total_reviews, average_rating');
        if (isRatingMode && RATING_THRESHOLD !== null) {
            query = query.lt('average_rating', RATING_THRESHOLD);
        } else {
            query = query.gte('total_reviews', REVIEW_RANGE[0]).lte('total_reviews', REVIEW_RANGE[1]);
        }
        const { data, error } = await query.range(from, to);
        if (error) {
            return { data: allRecords, error };
        }
        if (data && data.length > 0) {
            console.log(`[Pagination] Received ${data.length} records.`);
            allRecords = allRecords.concat(data);
            if (data.length < pageSize) {
                done = true;
            } else {
                from += pageSize;
                to += pageSize;
            }
        } else {
            console.log('[Pagination] No more records returned.');
            done = true;
        }
    }
    return { data: allRecords, error: null };
}

async function cleanupLowReviewRecords() {
    const mode = isDryRun ? '🔍 DRY RUN -' : '🧹';
    const filterDesc = isRatingMode && RATING_THRESHOLD !== null
        ? `average_rating < ${RATING_THRESHOLD}`
        : `total_reviews in range [${REVIEW_RANGE[0]}, ${REVIEW_RANGE[1]}]`;
    console.log(`${mode} Starting cleanup of records with ${filterDesc}...`);

    try {
        // Fetch all records to be removed (paginated)
        const { data: recordsToRemove, error: fetchError } = await fetchAllLowReviewRecords();

        if (fetchError) {
            console.error('Error fetching records:', fetchError);
            return;
        }

        totalFound = recordsToRemove.length;
        console.log(`Found ${totalFound} records ${isDryRun ? 'that would be removed' : 'to remove'}`);

        for (const record of recordsToRemove) {
            console.log(`\nProcessing: ${record.app_title} (${record.total_reviews} reviews, rating: ${record.average_rating})`);

            // Remove storage file first
            await removeStorageFile(record.hash_url, isDryRun);

            if (!isDryRun) {
                // Remove from report_section_embeddings first, only if record.id exists
                if (record.id) {
                    const { error: embedError } = await supabase
                        .from('report_section_embeddings')
                        .delete()
                        .eq('report_id', record.id);
                    if (embedError) {
                        console.error(`❌ Error removing embeddings for report_id ${record.id}:`, embedError);
                    }
                } else {
                    console.warn(`⚠️ Skipping embeddings delete: no record.id for hash_url ${record.hash_url}`);
                }
                // Remove database record
                const { error: deleteError } = await supabase
                    .from('analysis_reports')
                    .delete()
                    .eq('hash_url', record.hash_url);

                if (deleteError) {
                    console.error(`❌ Error removing database record for ${record.hash_url}:`, deleteError);
                    continue;
                }

                console.log(`✅ Removed database record for: ${record.app_title}`);
                totalRemoved++;
            } else {
                console.log(`🔍 Would remove database record for: ${record.app_title}`);
            }
        }

        console.log('\n📊 Summary:');
        console.log(`Total records found: ${totalFound}`);
        console.log(`Total space that would be freed: ${prettyBytes(totalSpaceSaved)}`);
        if (!isDryRun) {
            console.log(`Total records removed: ${totalRemoved}`);
            console.log(`Storage cleanup errors: ${totalStorageCleanupErrors}`);
        }
        console.log(`\nRun without --dry-run flag to perform the actual cleanup.`);

    } catch (error) {
        console.error('Unexpected error during cleanup:', error);
    }
}

async function processCsvAndCleanup() {
    console.log('🧹 Starting cleanup using low_review.csv...');
    if (!fs.existsSync(CSV_PATH)) {
        console.error(`CSV file not found: ${CSV_PATH}`);
        return;
    }
    const hashUrls = [];
    const rl = readline.createInterface({
        input: fs.createReadStream(CSV_PATH),
        crlfDelay: Infinity
    });
    let header = true;
    let hashUrlIdx = -1;
    for await (const line of rl) {
        const cols = line.split(',');
        if (header) {
            hashUrlIdx = cols.findIndex(c => c.trim() === 'hash_url');
            header = false;
            continue;
        }
        if (hashUrlIdx >= 0 && cols[hashUrlIdx]) {
            hashUrls.push(cols[hashUrlIdx].trim());
        }
    }
    console.log(`Found ${hashUrls.length} hash_url entries in CSV.`);
    let processed = 0;
    for (const hashUrl of hashUrls) {
        if (!hashUrl) continue;
        processed++;
        console.log(`\n[CSV] Processing ${processed}/${hashUrls.length}: |${hashUrl}|`); // delimiters for debugging
        await removeStorageFile(hashUrl, isDryRun);
        if (!isDryRun) {
            const { data: delData, error: deleteError, count } = await supabase
                .from('analysis_reports')
                .delete({ count: 'exact' })
                .eq('hash_url', hashUrl);
            if (deleteError) {
                console.error(`❌ Error removing database record for |${hashUrl}|:`, deleteError);
                continue;
            }
            console.log(`Delete response:`, { delData, count });
            if (count === 0) {
                console.warn(`⚠️ No rows deleted for hash_url: |${hashUrl}|. Checking if record still exists...`);
                const { data: checkData, error: checkError } = await supabase
                    .from('analysis_reports')
                    .select('hash_url')
                    .eq('hash_url', hashUrl);
                if (checkError) {
                    console.error('Error checking for record:', checkError);
                } else if (checkData && checkData.length > 0) {
                    console.warn(`⚠️ Record still exists for hash_url: |${hashUrl}|`);
                } else {
                    console.log('Record not found after delete attempt.');
                }
            } else {
                console.log(`✅ Removed database record for: |${hashUrl}|`);
                totalRemoved++;
            }
        } else {
            console.log(`🔍 Would remove database record for: ${hashUrl}`);
        }
    }
    console.log('\n📊 CSV Cleanup Summary:');
    console.log(`Total records processed: ${processed}`);
    console.log(`Total space that would be freed: ${prettyBytes(totalSpaceSaved)}`);
    if (!isDryRun) {
        console.log(`Total records removed: ${totalRemoved}`);
        console.log(`Storage cleanup errors: ${totalStorageCleanupErrors}`);
    }
    console.log(`\nRun without --dry-run flag to perform the actual cleanup.`);
}

// Run the cleanup
if (isFromCsv) {
    processCsvAndCleanup().catch(err => {
        console.error('Failed to run CSV cleanup:', err);
        process.exit(1);
    });
} else {
    cleanupLowReviewRecords().catch(err => {
        console.error('Failed to run cleanup:', err);
        process.exit(1);
    });
}