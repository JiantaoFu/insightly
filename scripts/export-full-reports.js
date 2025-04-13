import { supabase } from '../server/supabaseClient.js'
import JSZip from 'jszip';

// Print Supabase settings
console.log('Supabase URL:', supabase.supabaseUrl);

async function compressData(jsonbData) {
    const zip = new JSZip();
    // JSONB data is already in JSON format, just stringify it with formatting
    const content = JSON.stringify(jsonbData, null, 2);
    zip.file('report.txt', content);
    return await zip.generateAsync({ type: "uint8array" });
}

async function uploadReport(hashUrl, compressedData) {
    const folderStructure = `${hashUrl.slice(0, 2)}/${hashUrl.slice(2, 4)}/`;
    const fileName = `${folderStructure}${hashUrl}.zip`;

    const { data, error } = await supabase.storage
        .from('reports')
        .upload(fileName, compressedData, {
            contentType: 'application/zip'
        });

    if (error) {
        console.error('Error uploading report:', error);
    } else {
        console.log('Report uploaded successfully:', data);
    }
}

async function checkFileExists(hashUrl) {
    const folderStructure = `${hashUrl.slice(0, 2)}/${hashUrl.slice(2, 4)}/`;
    const fileName = `${folderStructure}${hashUrl}.zip`;

    const { data, error } = await supabase.storage
        .from('reports')
        .list(folderStructure, {
            search: `${hashUrl}.zip`
        });

    if (error) {
        console.error('Error checking file:', error);
        return false;
    }

    return data && data.length > 0;
}

const PAGE_SIZE = 100; // Process reports in batches
let lastProcessedId = 0;

async function fetchReportsBatch() {
    return await supabase
        .from('analysis_reports')
        .select('hash_url, full_report, id')
        .order('id')
        .gt('id', lastProcessedId)
        .limit(PAGE_SIZE);
}

while (true) {
    const { data: reports, error: fetchError } = await fetchReportsBatch();

    if (fetchError) {
        console.error('Error fetching reports:', fetchError);
        process.exit(1);
    }

    if (!reports || reports.length === 0) {
        console.log('No more reports to process');
        break;
    }

    for (const report of reports) {
        if (report.full_report) {
            try {
                const exists = await checkFileExists(report.hash_url);
                if (!exists) {
                    console.log(`Processing ${report.hash_url} (ID: ${report.id})...`);
                    const compressedData = await compressData(report.full_report);
                    await uploadReport(report.hash_url, compressedData);
                } else {
                    console.log(`File for ${report.hash_url} already exists, skipping...`);
                }
            } catch (error) {
                console.error(`Failed to process report ${report.hash_url}:`, error);
                continue;
            }
        }
        lastProcessedId = report.id;
    }

    console.log(`Processed batch up to ID: ${lastProcessedId}`);
}