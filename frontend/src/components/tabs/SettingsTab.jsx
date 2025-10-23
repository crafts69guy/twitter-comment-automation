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
  HStack,
  Icon,
} from '@chakra-ui/react';
import { CheckCircleIcon, WarningIcon } from '@chakra-ui/icons';

function SettingsTab({
  settings,
  onUpdateSettings,
  onSyncSheets,
  isSynced = false,
  automationStatus,
}) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  useEffect(() => {
    setLocalSettings(settings);
    setHasUnsavedChanges(false);
  }, [settings]);

  const handleChange = (field, value) => {
    setLocalSettings(prev => ({
      ...prev,
      [field]: value,
    }));
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    const result = await onUpdateSettings(localSettings);
    if (result && result.success) {
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
    }
  };

  const handleReset = () => {
    setLocalSettings(settings);
    setHasUnsavedChanges(false);
  };

  // Check if required fields are filled
  const isRequiredFieldsFilled = () => {
    return (
      localSettings.twitterUsername?.trim() !== '' &&
      localSettings.twitterPassword?.trim() !== '' &&
      localSettings.twitterVerificationHandle?.trim() !== ''
    );
  };

  return (
    <Box bg="white" p={6} borderRadius="lg" shadow="sm">
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Box>
          <HStack justify="space-between" mb={2}>
            <Heading size="md">Automation Settings</Heading>
            <HStack spacing={2}>
              {isSynced ? (
                <Badge colorScheme="green" display="flex" alignItems="center" gap={1}>
                  <Icon as={CheckCircleIcon} />
                  Synced
                </Badge>
              ) : (
                <Badge colorScheme="yellow" display="flex" alignItems="center" gap={1}>
                  <Icon as={WarningIcon} />
                  Using Cache
                </Badge>
              )}
              {hasUnsavedChanges && <Badge colorScheme="orange">Unsaved Changes</Badge>}
            </HStack>
          </HStack>
          <Text color="gray.600" fontSize="sm">
            Configure your automation workflow and AI settings
          </Text>
          {lastSaved && (
            <Text color="gray.500" fontSize="xs" mt={1}>
              Last saved: {lastSaved.toLocaleTimeString()}
            </Text>
          )}
          <Text color="blue.600" fontSize="xs" mt={1}>
            💾 Settings are automatically cached in your browser
          </Text>
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
              Column A: Twitter URLs | Column B: Content (fetched automatically via Twitter API)
            </Text>
            <Text fontSize="xs" color="blue.600" mt={1}>
              💡 Column B content is now automatically fetched using Twitter API. You don't need to
              fill it manually.
            </Text>
          </FormControl>
          <Button
            mt={3}
            size="sm"
            colorScheme="green"
            onClick={onSyncSheets}
            isDisabled={
              !localSettings.googleSheetUrl ||
              (automationStatus?.isActive &&
                !automationStatus?.isPaused &&
                automationStatus?.currentBatch)
            }
          >
            Sync Links Now
          </Button>
          {automationStatus?.isActive &&
            !automationStatus?.isPaused &&
            automationStatus?.currentBatch && (
              <Text fontSize="xs" color="orange.600" mt={2}>
                ⚠️ Sync is disabled while batch is processing. Pause or stop automation to sync.
              </Text>
            )}
          {automationStatus?.isPaused && (
            <Text fontSize="xs" color="blue.600" mt={2}>
              ✅ Automation is paused. You can sync now to add new links to the queue.
            </Text>
          )}
        </Box>

        <Divider />

        {/* Batch Processing Configuration */}
        <Box>
          <Heading size="sm" mb={4}>
            Batch Processing
          </Heading>

          <VStack spacing={4} align="stretch" mb={4}>
            <FormControl>
              <FormLabel>Retry Failure Rate Threshold (%)</FormLabel>
              <NumberInput
                value={localSettings.retryFailureThreshold || 30}
                onChange={value => handleChange('retryFailureThreshold', parseInt(value))}
                min={0}
                max={100}
                step={5}
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
              <Text fontSize="sm" color="gray.500" mt={1}>
                If failure rate is below this threshold, retry delay is shorter (default: 30%)
              </Text>
            </FormControl>

            <HStack spacing={4} align="flex-start">
              <FormControl>
                <FormLabel>Low Failure Retry Delay (minutes)</FormLabel>
                <NumberInput
                  value={localSettings.retryDelayLow || 5}
                  onChange={value => handleChange('retryDelayLow', parseInt(value))}
                  min={1}
                  max={60}
                  step={1}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
                <Text fontSize="xs" color="gray.500" mt={1}>
                  When failure rate {'<'} threshold
                </Text>
              </FormControl>

              <FormControl>
                <FormLabel>High Failure Retry Delay (minutes)</FormLabel>
                <NumberInput
                  value={localSettings.retryDelayHigh || 10}
                  onChange={value => handleChange('retryDelayHigh', parseInt(value))}
                  min={1}
                  max={60}
                  step={1}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
                <Text fontSize="xs" color="gray.500" mt={1}>
                  When failure rate ≥ threshold
                </Text>
              </FormControl>
            </HStack>
          </VStack>

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

        {/* Twitter Authentication Configuration */}
        <Box>
          <Heading size="sm" mb={2}>
            Twitter Authentication
          </Heading>
          <Box
            bg="blue.50"
            border="1px solid"
            borderColor="blue.200"
            borderRadius="md"
            p={3}
            mb={4}
          >
            <Text fontSize="sm" color="blue.800" fontWeight="medium">
              🔐 Auto-Login with Username & Password
            </Text>
            <Text fontSize="sm" color="blue.700" mt={1}>
              Browser will automatically login before starting automation. Bearer token and cookies
              are still needed for content fetching.
            </Text>
          </Box>

          <VStack spacing={4} align="stretch">
            <FormControl isRequired>
              <FormLabel>Twitter Username</FormLabel>
              <Input
                value={localSettings.twitterUsername}
                onChange={e => handleChange('twitterUsername', e.target.value)}
                placeholder="@username or email"
              />
              <Text fontSize="xs" color="gray.600" mt={1}>
                Your Twitter/X username or email
              </Text>
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Twitter Password</FormLabel>
              <Input
                type="password"
                value={localSettings.twitterPassword}
                onChange={e => handleChange('twitterPassword', e.target.value)}
                placeholder="Enter your Twitter password"
              />
              <Text fontSize="xs" color="gray.600" mt={1}>
                Password is stored locally in browser cache only
              </Text>
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Phone Number or Username (for verification)</FormLabel>
              <Input
                value={localSettings.twitterVerificationHandle}
                onChange={e => handleChange('twitterVerificationHandle', e.target.value)}
                placeholder="@insideee_dev013 or +1234567890"
              />
              <Text fontSize="xs" color="gray.600" mt={1}>
                Used when Twitter detects unusual activity and asks for additional verification
              </Text>
            </FormControl>

            <Box
              bg="green.50"
              border="1px solid"
              borderColor="green.200"
              borderRadius="md"
              p={3}
              mt={2}
            >
              <Text fontSize="sm" color="green.800" fontWeight="medium">
                ✨ Bearer Token & Cookies are auto-extracted after login
              </Text>
              <Text fontSize="sm" color="green.700" mt={1}>
                When you start automation, the browser will login and automatically extract all
                required credentials. No manual setup needed!
              </Text>
            </Box>
          </VStack>
        </Box>

        <Divider />

        {/* Required Fields Warning */}
        {!isRequiredFieldsFilled() && (
          <Box bg="orange.50" border="1px solid" borderColor="orange.200" borderRadius="md" p={3}>
            <Text fontSize="sm" color="orange.800" fontWeight="medium">
              ⚠️ Required fields missing
            </Text>
            <Text fontSize="sm" color="orange.700" mt={1}>
              Please fill in Twitter Username, Password, and Phone Number/Username (for
              verification) to save settings.
            </Text>
          </Box>
        )}

        {/* Action Buttons */}
        <Box display="flex" gap={3}>
          <Button
            colorScheme="blue"
            onClick={handleSave}
            isDisabled={!hasUnsavedChanges || !isRequiredFieldsFilled()}
            flex={1}
          >
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
