import { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Button,
  Heading,
  Text,
  Divider,
  Badge,
} from '@chakra-ui/react';

function SettingsTab({ settings, onUpdateSettings, onSyncSheets }) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleChange = (field, value) => {
    setLocalSettings(prev => ({
      ...prev,
      [field]: value,
    }));
    setHasUnsavedChanges(true);
  };

  const handleSave = () => {
    onUpdateSettings(localSettings);
    setHasUnsavedChanges(false);
  };

  const handleReset = () => {
    setLocalSettings(settings);
    setHasUnsavedChanges(false);
  };

  return (
    <Box bg="white" p={6} borderRadius="lg" shadow="sm">
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Box>
          <Heading size="md" mb={2}>
            Automation Settings
          </Heading>
          <Text color="gray.600" fontSize="sm">
            Configure your automation workflow and AI settings
          </Text>
          {hasUnsavedChanges && (
            <Badge colorScheme="orange" mt={2}>
              Unsaved Changes
            </Badge>
          )}
        </Box>

        <Divider />

        {/* Google Sheets Configuration */}
        <Box>
          <Heading size="sm" mb={4}>
            Google Sheets
          </Heading>
          <FormControl>
            <FormLabel>Spreadsheet URL</FormLabel>
            <Input
              value={localSettings.googleSheetUrl}
              onChange={e => handleChange('googleSheetUrl', e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
            />
            <Text fontSize="sm" color="gray.500" mt={1}>
              Column A: Twitter URLs | Column B: Optional pre-filled content
            </Text>
          </FormControl>
          <Button
            mt={3}
            size="sm"
            colorScheme="green"
            onClick={onSyncSheets}
            isDisabled={!localSettings.googleSheetUrl}
          >
            Sync Links Now
          </Button>
        </Box>

        <Divider />

        {/* Batch Processing Configuration */}
        <Box>
          <Heading size="sm" mb={4}>
            Batch Processing
          </Heading>

          <VStack spacing={4} align="stretch">
            <FormControl>
              <FormLabel>Batch Size (links per batch)</FormLabel>
              <NumberInput
                value={localSettings.batchSize}
                onChange={valueString => handleChange('batchSize', parseInt(valueString) || 15)}
                min={1}
                max={50}
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
              <Text fontSize="sm" color="gray.500" mt={1}>
                Number of links to process in each batch (1-50)
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Interval Between Batches (minutes)</FormLabel>
              <NumberInput
                value={localSettings.batchIntervalMinutes}
                onChange={valueString =>
                  handleChange('batchIntervalMinutes', parseInt(valueString) || 20)
                }
                min={5}
                max={1440}
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
              <Text fontSize="sm" color="gray.500" mt={1}>
                Wait time between batches (5-1440 minutes)
              </Text>
            </FormControl>
          </VStack>
        </Box>

        <Divider />

        {/* AI Provider Configuration */}
        <Box>
          <Heading size="sm" mb={4}>
            AI Provider
          </Heading>

          <VStack spacing={4} align="stretch">
            <FormControl>
              <FormLabel>Provider</FormLabel>
              <Select
                value={localSettings.aiProvider}
                onChange={e => handleChange('aiProvider', e.target.value)}
              >
                <option value="gemini">Google Gemini</option>
                <option value="openai">OpenAI (GPT-4)</option>
                <option value="anthropic">Anthropic (Claude)</option>
              </Select>
              <Text fontSize="sm" color="gray.500" mt={1}>
                API keys are configured in backend .env file
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Additional Instructions (optional)</FormLabel>
              <Textarea
                value={localSettings.additionalPrompt}
                onChange={e => handleChange('additionalPrompt', e.target.value)}
                placeholder="Add custom instructions for AI comment generation..."
                rows={3}
              />
              <Text fontSize="sm" color="gray.500" mt={1}>
                These instructions will be added to every AI prompt
              </Text>
            </FormControl>
          </VStack>
        </Box>

        <Divider />

        {/* Twitter API Configuration (Optional) */}
        <Box>
          <Heading size="sm" mb={4}>
            Twitter API (Optional)
          </Heading>
          <Text fontSize="sm" color="gray.600" mb={4}>
            These are optional. If not provided, Puppeteer will scrape content from Twitter pages.
          </Text>

          <VStack spacing={4} align="stretch">
            <FormControl>
              <FormLabel>Bearer Token</FormLabel>
              <Input
                type="password"
                value={localSettings.twitterBearerToken}
                onChange={e => handleChange('twitterBearerToken', e.target.value)}
                placeholder="Optional: Twitter API Bearer token"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Cookies (JSON or string)</FormLabel>
              <Textarea
                value={localSettings.twitterCookies}
                onChange={e => handleChange('twitterCookies', e.target.value)}
                placeholder='Optional: Twitter cookies {"auth_token": "...", "ct0": "..."}'
                rows={3}
              />
            </FormControl>
          </VStack>
        </Box>

        <Divider />

        {/* Action Buttons */}
        <Box display="flex" gap={3}>
          <Button colorScheme="blue" onClick={handleSave} isDisabled={!hasUnsavedChanges} flex={1}>
            Save Settings
          </Button>
          <Button variant="outline" onClick={handleReset} isDisabled={!hasUnsavedChanges}>
            Reset
          </Button>
        </Box>
      </VStack>
    </Box>
  );
}

export default SettingsTab;
