import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

export const LLM_PROVIDERS = {
  ollama: {
    url: process.env.OLLAMA_API_URL || 'http://localhost:11434/api/generate',
    defaultModel: process.env.OLLAMA_DEFAULT_MODEL || 'deepseek-r1:7b',
    async generateResponse(model, prompt, options = {}) {
      const selectedModel = model || this.defaultModel;
      
      const response = await axios.post(this.url, {
        model: selectedModel,
        prompt: prompt,
        options: {
          temperature: options.temperature || 0.7,
          max_tokens: options.max_tokens || 16384,
          num_ctx: options.num_ctx || 32768
        }
      }, {
        timeout: 300000  // 5-minute timeout
      });

      return response.data.response;
    },
    async streamResponse(model, prompt, onChunk, options = {}) {
      const selectedModel = model || this.defaultModel;

      return new Promise((resolve, reject) => {
        let fullResponse = '';

        try {
          const request = axios.post(this.url, {
            model: selectedModel,
            prompt: prompt,
            stream: true,
            options: {
              temperature: options.temperature || 0.7,
              max_tokens: options.max_tokens || 16384,
              num_ctx: options.num_ctx || 32768
            }
          }, {
            timeout: 300000,  // 5-minute timeout
            responseType: 'stream'
          });

          request.then(response => {
            response.data.on('data', (chunk) => {
              try {
                const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
                lines.forEach(line => {
                  try {
                    const parsedChunk = JSON.parse(line);
                    if (parsedChunk.response) {
                      fullResponse += parsedChunk.response;
                      onChunk(parsedChunk.response);
                    }
                    
                    if (parsedChunk.done) {
                      resolve(fullResponse);
                    }
                  } catch (parseError) {
                    console.error('Error parsing chunk:', parseError);
                  }
                });
              } catch (chunkError) {
                console.error('Error processing chunk:', chunkError);
              }
            });

            response.data.on('error', (error) => {
              console.error('Stream error:', error);
              reject(error);
            });

            response.data.on('end', () => {
              if (fullResponse) {
                resolve(fullResponse);
              } else {
                reject(new Error('No response generated'));
              }
            });
          }).catch(error => {
            console.error('Axios request error:', error);
            reject(error);
          });
        } catch (error) {
          console.error('Ollama API error:', {
            message: error.message,
            stack: error.stack
          });
          reject(error);
        }
      });
    }
  },
  openai: {
    url: process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
    apiKey: process.env.OPENAI_API_KEY,
    defaultModel: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    async generateResponse(model, prompt, options = {}) {
      const response = await axios.post(
        this.url, 
        {
          model: model || this.defaultModel,
          messages: [
            { role: "system", content: "You are an expert app review analyzer." },
            { role: "user", content: prompt }
          ],
          temperature: options.temperature || 0.7,
          max_tokens: options.max_tokens || 1000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data.choices[0].message.content;
    },
    async streamResponse(model, prompt, onChunk, options = {}) {
      const {
        maxTokens = 4096,  // Default max tokens
        contextLength = 8192,  // Default context length
        temperature = 0.7,  // Default temperature
        topP = 0.9,  // Default top-p sampling
        ...otherOptions
      } = options;

      const requestBody = {
        model: model || this.defaultModel,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        max_tokens: maxTokens,
        temperature: temperature,
        top_p: topP,
        ...otherOptions
      };

      const response = await axios.post(
        this.url, 
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'stream'
        }
      );

      return new Promise((resolve, reject) => {
        let fullResponse = '';
        response.data.on('data', (chunk) => {
          const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.replace('data: ', '');
                if (jsonStr !== '[DONE]') {
                  const parsedChunk = JSON.parse(jsonStr);
                  if (parsedChunk.choices && parsedChunk.choices[0].delta.content) {
                    const chunkText = parsedChunk.choices[0].delta.content;
                    onChunk(chunkText);
                    fullResponse += chunkText;
                  }
                }
              } catch (error) {
                console.error('Error parsing OpenAI stream chunk:', error);
              }
            }
          }
        });

        response.data.on('end', () => {
          resolve(fullResponse);
        });

        response.data.on('error', (error) => {
          reject(error);
        });
      });
    }
  },
  gemini: {
    url: process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models',
    apiKey: process.env.GEMINI_API_KEY,
    defaultModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    async generateResponse(model, prompt, options = {}) {
      const genAI = new GoogleGenerativeAI(this.apiKey);
      const generativeModel = genAI.getGenerativeModel({ model: model || this.defaultModel });
      
      try {
        const result = await generativeModel.generateContent(prompt);
        return result.response.text();
      } catch (error) {
        console.error('Gemini API Error:', error);
        throw error;
      }
    },
    async streamResponse(model, prompt, onChunk, options = {}) {
      const genAI = new GoogleGenerativeAI(this.apiKey);
      
      // Extract options with sensible defaults
      const {
        maxTokens = 16384,  // Default max tokens
        contextLength = 32768,  // Default context length
        temperature = 0.7,  // Default temperature
        topP = 0.9,  // Default top-p sampling
        ...otherOptions
      } = options;

      // Configure generation settings
      const generationConfig = {
        maxOutputTokens: maxTokens,
        temperature: temperature,
        topP: topP,
        ...otherOptions
      };

      const generativeModel = genAI.getGenerativeModel({ 
        model: model || this.defaultModel,
        generationConfig
      });
      
      try {
        const result = await generativeModel.generateContentStream(prompt);
        
        let fullResponse = '';
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          onChunk(chunkText);
          fullResponse += chunkText;
        }
        
        return fullResponse;
      } catch (error) {
        console.error('Gemini Streaming API Error:', error);
        throw error;
      }
    }
  }
};
