import React, { useState } from 'react';
import {
  Box,
  FormControl,
  FormLabel,
  Select,
  MenuItem,
  Typography,
  Paper
} from '@mui/material';

interface ModelOption {
  id: string;
  name: string;
  description?: string;
}

interface ProviderModels {
  id: string;
  name: string;
  models: ModelOption[];
}

const providers: ProviderModels[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o-latest', name: 'GPT-4o (Latest)', description: 'The latest version of GPT-4o' },
      { id: 'gpt-4.5-preview', name: 'GPT-4.5 (Preview)', description: 'Preview version of GPT-4.5' },
      { id: 'gpt-4o-2024-05-13', name: 'GPT-4o (May 2024)', description: 'Specific version of GPT-4o' },
      { id: 'gpt-4o-mini-2024-07-18', name: 'GPT-4o Mini', description: 'Smaller, faster version of GPT-4o' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Latest)', description: 'Latest version of Claude 3.5 Sonnet' },
      { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet (June 2024)', description: 'Previous version of Claude 3.5 Sonnet' },
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', description: 'Claude 3 Sonnet model' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Fastest Claude 3 model' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most powerful Claude 3 model' },
    ],
  },
  {
    id: 'bedrock',
    name: 'Amazon Bedrock',
    models: [
      { 
        id: 'anthropic.claude-3-7-sonnet-20250219-v1:0', 
        name: 'Claude 3.7 Sonnet', 
        description: 'Claude 3.7 Sonnet via Amazon Bedrock' 
      },
    ],
  },
];

interface ModelSelectorProps {
  onModelChange?: (provider: string, model: string) => void;
  defaultProvider?: string;
  defaultModel?: string;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ 
  onModelChange, 
  defaultProvider = 'openai',
  defaultModel = 'gpt-4o-latest'
}) => {
  const [selectedProvider, setSelectedProvider] = useState(defaultProvider);
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  
  const currentProvider = providers.find(p => p.id === selectedProvider);
  const currentModel = currentProvider?.models.find(m => m.id === selectedModel);

  const handleProviderChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const newProvider = event.target.value as string;
    setSelectedProvider(newProvider);
    
    // Select the first model from the new provider
    const firstModel = providers.find(p => p.id === newProvider)?.models[0].id || '';
    setSelectedModel(firstModel);
    
    if (onModelChange) {
      onModelChange(newProvider, firstModel);
    }
  };

  const handleModelChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const newModel = event.target.value as string;
    setSelectedModel(newModel);
    
    if (onModelChange) {
      onModelChange(selectedProvider, newModel);
    }
  };

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        Model Selection
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
        <FormControl fullWidth>
          <FormLabel>Provider</FormLabel>
          <Select
            value={selectedProvider}
            onChange={handleProviderChange}
          >
            {providers.map((provider) => (
              <MenuItem key={provider.id} value={provider.id}>
                {provider.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <FormControl fullWidth>
          <FormLabel>Model</FormLabel>
          <Select
            value={selectedModel}
            onChange={handleModelChange}
          >
            {currentProvider?.models.map((model) => (
              <MenuItem key={model.id} value={model.id}>
                {model.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      
      {currentModel?.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {currentModel.description}
        </Typography>
      )}
    </Paper>
  );
};

export default ModelSelector; 