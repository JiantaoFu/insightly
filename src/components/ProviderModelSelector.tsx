import React, { useState, useEffect } from 'react';

// Configuration for providers and models
const PROVIDERS_CONFIG = {
  ollama: {
    defaultModel: 'deepseek-r1:7b',
    models: ['llama2', 'mistral', 'deepseek-r1:7b']
  },
  openai: {
    defaultModel: 'gpt-3.5-turbo',
    models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo']
  },
  gemini: {
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-pro', 'gemini-pro-vision']
  }
};

export const useProviderModel = () => {
  const [provider, setProvider] = useState<keyof typeof PROVIDERS_CONFIG>(
    (import.meta.env.VITE_LLM_PROVIDER as keyof typeof PROVIDERS_CONFIG) || 'gemini'
  );

  const [model, setModel] = useState(
    import.meta.env[`VITE_${provider.toUpperCase()}_DEFAULT_MODEL`] || 
    PROVIDERS_CONFIG[provider].defaultModel
  );

  // Update model when provider changes
  useEffect(() => {
    setModel(PROVIDERS_CONFIG[provider].defaultModel);
  }, [provider]);

  return { 
    provider, 
    setProvider, 
    model, 
    setModel 
  };
};

export const ProviderModelSelector: React.FC = () => {
  const { provider, setProvider, model, setModel } = useProviderModel();

  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-4">
      <select
        value={provider}
        onChange={(e) => setProvider(e.target.value as keyof typeof PROVIDERS_CONFIG)}
        className="w-full sm:w-auto px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
      >
        {Object.keys(PROVIDERS_CONFIG).map(providerKey => (
          <option key={providerKey} value={providerKey}>
            {providerKey.charAt(0).toUpperCase() + providerKey.slice(1)}
          </option>
        ))}
      </select>
      <select
        value={model}
        onChange={(e) => setModel(e.target.value)}
        className="w-full sm:w-auto flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
      >
        {PROVIDERS_CONFIG[provider].models.map(modelName => (
          <option key={modelName} value={modelName}>
            {modelName}
          </option>
        ))}
      </select>
    </div>
  );
};
