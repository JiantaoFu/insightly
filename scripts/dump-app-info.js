import fs from 'fs/promises';
import path from 'path';
import JSZip from 'jszip';
import dotenv from 'dotenv'
import { GoogleGenerativeAI } from '@google/generative-ai';

const LOCAL_STORAGE_DIR = path.join(process.cwd(), 'supabase/storage');
const EXPORT_DIR = path.join(process.cwd(), 'supabase/export');

dotenv.config()

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const CATEGORIES = [
  'Entertainment', 'Productivity', 'Education', 'Health', 'Games', 'Business', 'Lifestyle',
  'Music', 'Photography', 'Shopping', 'Social', 'Sports', 'Travel', 'Utilities', 'Weather',
  'Books', 'News', 'Finance', 'Food & Drink', 'Medical', 'Navigation', 'Tools',
  'Action Games', 'Adventure Games', 'Puzzle Games', 'Simulation Games', 'Strategy Games',
  'Trivia Games', 'Word Games', 'Casual Games', 'Other'
];

async function fetchReports() {
  try {
    console.log('📂 Starting to fetch report file list from local directory...');
    const traverseDirectory = async (dir) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const files = [];

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          console.log(`📁 Entering directory: ${fullPath}`);
          files.push(...await traverseDirectory(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.zip')) {
          console.log(`📄 Found report file: ${fullPath}`);
          files.push(fullPath);
        }
      }

      return files;
    };

    const reportFiles = await traverseDirectory(LOCAL_STORAGE_DIR);
    console.log(`✅ Completed fetching report files. Total files found: ${reportFiles.length}`);
    return reportFiles;
  } catch (err) {
    console.error('❌ Unexpected error fetching report file list:', err);
    return [];
  }
}

async function fetchReportContent(filePath) {
  try {
    const zipData = await fs.readFile(filePath);
    const zip = await JSZip.loadAsync(zipData);
    const reportFile = zip.file('report.txt');

    if (!reportFile) {
      console.warn(`No report.txt found in zip file ${filePath}`);
      return null;
    }

    const content = await reportFile.async('string');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Unexpected error processing report file ${filePath}:`, err);
    return null;
  }
}

async function categorizeApp(description) {
  try {
    const prompt = `Categorize the following app description into one of the following categories:\n${CATEGORIES.join(', ')}.\n\n` +
                   `If the app fits into multiple categories, choose the most specific one. Avoid using "Other" unless absolutely necessary.\n\n` +
                   `Description:\n${description}`;
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const category = response.text().trim();
    return CATEGORIES.includes(category) ? category : 'Other';
  } catch (err) {
    console.error('Error categorizing app:', err);
    return 'Other';
  }
}

async function dumpAppInfo() {
  try {
    const reportFiles = await fetchReports();

    if (reportFiles.length === 0) {
      console.log('No report files found.');
      return;
    }

    const categorizedContent = {};

    for (const filePath of reportFiles) {
      console.log(`📄 Processing report: ${filePath}`);
      const report = await fetchReportContent(filePath);

      if (!report) continue;

      const { appDetails, reviewsSummary } = report;
      const reviews = appDetails.reviews || [];
      console.log(`📝 App Title: ${appDetails.title}`);
      console.log(`📝 App Description: ${appDetails.description}`);

      const category = await categorizeApp(appDetails.description || '');
      console.log(`📂 Categorized as: ${category}`);

      if (!categorizedContent[category]) {
        categorizedContent[category] = '';
      }

      categorizedContent[category] += `## ${appDetails.title}\n\n`;
      categorizedContent[category] += `**Description:** ${appDetails.description || 'N/A'}\n\n`;
      categorizedContent[category] += `**Platform:** ${appDetails.platform || 'N/A'}\n\n`;
      categorizedContent[category] += `**App URL:** [${appDetails.url}](${appDetails.url})\n\n`;
      categorizedContent[category] += `**Total Reviews:** ${reviewsSummary?.totalReviews || 'N/A'}\n\n`;
      categorizedContent[category] += `**Average Rating:** ${reviewsSummary?.averageRating || 'N/A'}\n\n`;
      categorizedContent[category] += `**User Reviews:**\n\n`;

      if (reviews.length > 0) {
        reviews.forEach((review, index) => {
          categorizedContent[category] += `${index + 1}. ${review.text} (Score: ${review.score}, User: ${review.userName || 'Anonymous'})\n`;
        });
      } else {
        categorizedContent[category] += 'No reviews available.\n';
      }

      categorizedContent[category] += '\n---\n\n';
    }

    console.log('📂 Writing categorized files to export directory...');
    await fs.mkdir(EXPORT_DIR, { recursive: true });

    for (const [category, content] of Object.entries(categorizedContent)) {
      const filePath = path.join(EXPORT_DIR, `${category}.md`);
      await fs.writeFile(filePath, content, 'utf-8');
      console.log(`✅ Saved category "${category}" to ${filePath}`);
    }

    console.log('🎉 App information successfully categorized and exported.');
  } catch (err) {
    console.error('Error dumping app information:', err);
  }
}

dumpAppInfo();
