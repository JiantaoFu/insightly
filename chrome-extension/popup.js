document.addEventListener('DOMContentLoaded', function() {
    // Get the current tab's URL
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentUrl = tabs[0].url;
        const urlDisplay = document.getElementById('currentUrl');
        
        // Validate if it's an app store or play store URL
        if (isValidAppUrl(currentUrl)) {
            urlDisplay.textContent = currentUrl;
            urlDisplay.classList.add('valid-url');
            enableButtons(true);
        } else {
            urlDisplay.textContent = 'Please navigate to an App Store or Google Play Store app page';
            urlDisplay.classList.add('invalid-url');
            enableButtons(false);
        }
    });
});

function isValidAppUrl(url) {
    return url.match(/^https:\/\/(play\.google\.com\/store\/apps|apps\.apple\.com)/);
}

function enableButtons(enable) {
    document.getElementById('analyzeBtn').disabled = !enable;
    document.getElementById('refreshBtn').disabled = !enable;
}

document.addEventListener('DOMContentLoaded', () => {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const appUrlInput = document.getElementById('currentUrl');
  const customPromptInput = document.getElementById('customPrompt');
  const resultDiv = document.getElementById('result');

  const handleAnalyze = async (force = false) => {
    const url = appUrlInput.textContent.trim();
    const customPrompt = customPromptInput.value.trim();
    console.log('Analyze button clicked. URL:', url, 'Force:', force);
    if (!url) {
      resultDiv.textContent = 'Please enter a valid URL.';
      return;
    }

    resultDiv.textContent = 'Analyzing...';

    try {
      // First, fetch the app data
      let processUrlEndpoint = '';
      if (url.includes('apps.apple.com')) {
        processUrlEndpoint = `${currentConfig.API_URL}/app-store/process-url`;
      } else if (url.includes('play.google.com')) {
        processUrlEndpoint = `${currentConfig.API_URL}/google-play/process-url`;
      } else {
        throw new Error('Unsupported app store URL');
      }

      const processResponse = await fetch(processUrlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
      });

      if (!processResponse.ok) {
        throw new Error(`Failed to process URL: ${processUrlEndpoint}`);
      }

      const appData = await processResponse.json();

      // Then, analyze with the app data
      const response = await fetch(`${currentConfig.API_URL}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          url,
          provider: 'gemini',
          model: 'gemini-2.0-flash',
          customPrompt, 
          force,
          appData 
        })
      });

      if (!response.ok) {
        throw new Error('Failed to analyze the app.');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullReport = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('Stream completed');
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        
        lines.forEach(line => {
          try {
            const parsedChunk = JSON.parse(line);
            
            if (parsedChunk.report) {
              fullReport += parsedChunk.report;
              resultDiv.innerHTML = marked.parse(fullReport);
            }
          } catch (parseError) {
            console.error('Error parsing chunk:', parseError, 'Raw line:', line);
          }
        });

        console.log('full report:', fullReport);
      }
    } catch (error) {
      console.error('Error:', error);
      resultDiv.textContent = `Error: ${error.message}`;
    }
  };

  analyzeBtn.addEventListener('click', () => handleAnalyze(false));
  refreshBtn.addEventListener('click', () => handleAnalyze(true));
});
