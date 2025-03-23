// Simple test file for batch-scraper.js
import { strict as assert } from 'assert';
import { 
  getCollectionsForPlatform, 
  getCategoriesForPlatform,
  getAppsFromCollection 
} from './batch-scraper.js';

// Setup global variables needed by the functions
global.results = { categoryMappings: {} };
global.verbose = false;

// Capture console output for testing
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

const consoleOutput = {
  logs: [],
  warnings: [],
  errors: []
};

function setupConsoleCapture() {
  console.log = (...args) => {
    consoleOutput.logs.push(args.join(' '));
    originalConsoleLog(...args);
  };
  
  console.warn = (...args) => {
    consoleOutput.warnings.push(args.join(' '));
    originalConsoleWarn(...args);
  };
  
  console.error = (...args) => {
    consoleOutput.errors.push(args.join(' '));
    originalConsoleError(...args);
  };
}

function restoreConsole() {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
}

function clearConsoleOutput() {
  consoleOutput.logs = [];
  consoleOutput.warnings = [];
  consoleOutput.errors = [];
}

// Helper function to check if console output contains a string
function outputContains(outputArray, text) {
  return outputArray.some(line => line.includes(text));
}

describe('Batch Scraper Tests', function() {
  // Increase timeout for API calls
  this.timeout(30000);
  
  before(function() {
    setupConsoleCapture();
  });
  
  after(function() {
    restoreConsole();
  });
  
  beforeEach(function() {
    clearConsoleOutput();
    global.results = { categoryMappings: {} };
  });
  
  describe('getCollectionsForPlatform', function() {
    it('returns valid iOS collections', function() {
      const result = getCollectionsForPlatform('ios', ['topfreeapplications', 'toppaidapplications', 'INVALID']);
      assert.deepEqual(result, ['topfreeapplications', 'toppaidapplications']);
    });
    
    it('returns valid Android collections', function() {
      const result = getCollectionsForPlatform('android', ['TOP_FREE', 'TOP_PAID', 'invalid']);
      assert.deepEqual(result, ['TOP_FREE', 'TOP_PAID']);
    });
    
    it('returns default iOS collection when no valid collections provided', function() {
      const result = getCollectionsForPlatform('ios', ['INVALID']);
      assert.deepEqual(result, ['topfreeapplications']);
      assert(outputContains(consoleOutput.logs, 'Using default iOS collection'));
    });
    
    it('returns default Android collection when no valid collections provided', function() {
      const result = getCollectionsForPlatform('android', ['invalid']);
      assert.deepEqual(result, ['TOP_FREE']);
      assert(outputContains(consoleOutput.logs, 'Using default Android collection'));
    });
    
    it('logs warning for invalid collections when verbose is true', function() {
      global.verbose = true;
      
      getCollectionsForPlatform('ios', ['topfreeapplications', 'INVALID']);
      assert(outputContains(consoleOutput.warnings, 'Skipping invalid ios collections'));
      
      global.verbose = false;
    });
  });
  
  describe('getCategoriesForPlatform', function() {
    it('maps generic category names to iOS category IDs', function() {
      const result = getCategoriesForPlatform('ios', ['productivity', 'business']);
      assert(result.includes('6007')); // Productivity
      assert(result.includes('6000')); // Business
    });
    
    it('maps generic category names to Android category IDs', function() {
      const result = getCategoriesForPlatform('android', ['productivity', 'business']);
      assert(result.includes('PRODUCTIVITY'));
      assert(result.includes('BUSINESS'));
    });
    
    it('handles similar category names via similarity mapping', function() {
      global.verbose = true;
      
      const result = getCategoriesForPlatform('ios', ['productive', 'work']);
      assert(result.includes('6007')); // Both should map to Productivity
      assert.equal(result.length, 2);
      assert(outputContains(consoleOutput.logs, "Mapped 'productive' to 'productivity'"));
      
      global.verbose = false;
    });
    
    it('accepts direct platform-specific category IDs for iOS', function() {
      const result = getCategoriesForPlatform('ios', ['6007', '6000']);
      assert(result.includes('6007'));
      assert(result.includes('6000'));
    });
    
    it('accepts direct platform-specific category IDs for Android', function() {
      const result = getCategoriesForPlatform('android', ['PRODUCTIVITY', 'BUSINESS']);
      assert(result.includes('PRODUCTIVITY'));
      assert(result.includes('BUSINESS'));
    });
    
    it('skips categories with no platform equivalent', function() {
      getCategoriesForPlatform('ios', ['personalization']); // Android-only category
      assert(outputContains(consoleOutput.warnings, 'Skipping categories with no ios equivalent'));
    });
    
    it('returns default category when no valid categories provided', function() {
      const result = getCategoriesForPlatform('ios', ['invalid_category']);
      assert.deepEqual(result, ['6007']); // Default to Productivity
      assert(outputContains(consoleOutput.logs, 'Using default iOS category'));
    });
  });
  
  // Optional: Only run these tests if you have the actual API packages installed
  // Comment out this section if you don't want to make real API calls
  describe('getAppsFromCollection', function() {
    it('fetches iOS apps from a collection', async function() {
      try {
        global.verbose = true;
        
        const result = await getAppsFromCollection('ios', 'topfreeapplications', '6007', 3);
        
        assert(Array.isArray(result));
        assert(result.length > 0);
        assert(result[0].title);
        assert(result[0].url);
        assert(result[0].appId);
        assert(outputContains(consoleOutput.logs, "Fetching iOS apps"));
        
        global.verbose = false;
      } catch (error) {
        if (error.message.includes('Cannot find package')) {
          this.skip(); // Skip this test if the package is not installed
        } else {
          throw error;
        }
      }
    });
    
    it('fetches Android apps from a collection', async function() {
      try {
        global.verbose = true;
        
        const result = await getAppsFromCollection('android', 'TOP_FREE', 'PRODUCTIVITY', 3);
        
        assert(Array.isArray(result));
        assert(result.length > 0);
        assert(result[0].title);
        assert(result[0].url);
        assert(result[0].appId);
        assert(outputContains(consoleOutput.logs, "Fetching Android apps"));
        
        global.verbose = false;
      } catch (error) {
        if (error.message.includes('Cannot find package')) {
          this.skip(); // Skip this test if the package is not installed
        } else {
          throw error;
        }
      }
    });
    
    it('throws error for unsupported platform', async function() {
      try {
        await getAppsFromCollection('windows', 'top', 'productivity', 10);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert(error.message.includes('Unsupported platform: windows'));
      }
    });
  });
});