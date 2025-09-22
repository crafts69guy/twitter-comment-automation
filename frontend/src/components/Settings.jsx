import { useState } from "react";
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Select,
  VStack,
  Card,
  CardBody,
  Heading,
  Text,
  useToast,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Textarea,
  Grid,
  GridItem,
  Switch,
  HStack,
} from "@chakra-ui/react";
import ScheduledAutomation from "./ScheduledAutomation";

function Settings({
  settings,
  onUpdate,
  scheduledState,
  onStartScheduled,
  onStopScheduled,
}) {
  const [localSettings, setLocalSettings] = useState(settings);
  const toast = useToast();

  const handleInputChange = (field, value) => {
    setLocalSettings({ ...localSettings, [field]: value });
  };

  const handleScheduledSettingChange = (field, value) => {
    setLocalSettings({
      ...localSettings,
      scheduledAutomation: {
        enabled: false,
        intervalMinutes: 20,
        batchSize: 10,
        startImmediately: true,
        ...localSettings.scheduledAutomation,
        [field]: value,
      },
    });
  };

  const handleSave = () => {
    if (!localSettings.googleSheetUrl) {
      toast({
        title: "Missing Google Sheet URL",
        description: "Please enter a Google Sheet URL",
        status: "warning",
        duration: 3000,
      });
      return;
    }

    onUpdate(localSettings);
    toast({
      title: "Settings Saved",
      description: "Your settings have been saved successfully",
      status: "success",
      duration: 3000,
    });
  };

  return (
    <Box maxW="7xl" mx="auto" px={4}>
      <VStack spacing={8} align="stretch">
        <Box textAlign="center" mb={6}>
          <Heading size="xl" mb={4} color="gray.700">
            🔧 Configuration Settings
          </Heading>
          <Text color="gray.600" fontSize="lg" maxW="2xl" mx="auto">
            Configure your Google Sheets connection, AI provider settings, and
            scheduled automation
          </Text>
        </Box>

        {/* Scheduled Automation Component */}
        <ScheduledAutomation
          scheduledState={scheduledState}
          settings={localSettings}
          onStartScheduled={onStartScheduled}
          onStopScheduled={onStopScheduled}
        />

        <Card
          shadow="lg"
          rounded="2xl"
          border="1px"
          borderColor="gray.200"
          overflow="hidden"
        >
          <CardBody p={12}>
            <VStack spacing={10} align="stretch">
              <Box>
                <FormControl isRequired>
                  <FormLabel
                    fontSize="xl"
                    fontWeight="bold"
                    color="gray.700"
                    mb={4}
                  >
                    📊 Google Sheet URL
                  </FormLabel>
                  <Input
                    placeholder="https://docs.google.com/spreadsheets/d/your-sheet-id/edit"
                    value={localSettings.googleSheetUrl}
                    onChange={(e) =>
                      handleInputChange("googleSheetUrl", e.target.value)
                    }
                    size="lg"
                    rounded="xl"
                    bg="gray.50"
                    border="2px"
                    borderColor="gray.200"
                    _hover={{ bg: "white", borderColor: "blue.300" }}
                    _focus={{
                      bg: "white",
                      borderColor: "blue.400",
                      boxShadow: "0 0 0 3px rgba(66, 153, 225, 0.1)",
                    }}
                    py={6}
                    fontSize="md"
                  />
                  <Text fontSize="md" color="gray.500" mt={3} pl={2}>
                    💡 The Google Sheet should have Twitter post URLs in the
                    first column
                  </Text>
                </FormControl>
              </Box>

              <Box
                bg="blue.50"
                p={8}
                rounded="2xl"
                border="2px"
                borderColor="blue.100"
              >
                <VStack spacing={8}>
                  <FormControl isRequired>
                    <FormLabel
                      fontSize="xl"
                      fontWeight="bold"
                      color="gray.700"
                      mb={4}
                    >
                      🤖 AI Provider
                    </FormLabel>
                    <Select
                      value={localSettings.aiProvider}
                      onChange={(e) =>
                        handleInputChange("aiProvider", e.target.value)
                      }
                      size="lg"
                      rounded="xl"
                      bg="white"
                      border="2px"
                      borderColor="blue.200"
                      _hover={{ borderColor: "blue.300" }}
                      _focus={{
                        borderColor: "blue.400",
                        boxShadow: "0 0 0 3px rgba(66, 153, 225, 0.1)",
                      }}
                      py={6}
                      fontSize="md"
                      fontWeight="medium"
                    >
                      <option value="gemini">✨ Google Gemini</option>
                      {/* <option value="openai">🚀 OpenAI (GPT-4)</option> */}
                      {/* <option value="anthropic">🧠 Anthropic (Claude)</option> */}
                    </Select>
                  </FormControl>

                  <FormControl>
                    <FormLabel
                      fontSize="xl"
                      fontWeight="bold"
                      color="gray.700"
                      mb={4}
                    >
                      🚀 Max Parallel Tabs
                    </FormLabel>
                    <NumberInput
                      value={localSettings.maxTabs || 5}
                      onChange={(_valueString, valueNumber) =>
                        handleInputChange("maxTabs", valueNumber)
                      }
                      min={1}
                      max={20}
                      size="lg"
                    >
                      <NumberInputField
                        rounded="xl"
                        bg="white"
                        border="2px"
                        borderColor="blue.200"
                        _hover={{ borderColor: "blue.300" }}
                        _focus={{
                          borderColor: "blue.400",
                          boxShadow: "0 0 0 3px rgba(66, 153, 225, 0.1)",
                        }}
                        py={6}
                        fontSize="md"
                        fontWeight="medium"
                      />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                    <Text fontSize="md" color="gray.500" mt={3} pl={2}>
                      💡 Number of Puppeteer tabs to use for parallel scraping
                      (1-20)
                    </Text>
                  </FormControl>

                  <FormControl>
                    <FormLabel
                      fontSize="xl"
                      fontWeight="bold"
                      color="gray.700"
                      mb={4}
                    >
                      ✏️ Comment Character Limit
                    </FormLabel>
                    <NumberInput
                      value={localSettings.commentMaxLength || 50}
                      onChange={(_valueString, valueNumber) =>
                        handleInputChange("commentMaxLength", valueNumber)
                      }
                      max={1000}
                      size="lg"
                    >
                      <NumberInputField
                        rounded="xl"
                        bg="white"
                        border="2px"
                        borderColor="blue.200"
                        _hover={{ borderColor: "blue.300" }}
                        _focus={{
                          borderColor: "blue.400",
                          boxShadow: "0 0 0 3px rgba(66, 153, 225, 0.1)",
                        }}
                        py={6}
                        fontSize="md"
                        fontWeight="medium"
                      />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                    <Text fontSize="md" color="gray.500" mt={3} pl={2}>
                      💡 Maximum characters for AI-generated comments. Default:
                      280
                    </Text>
                  </FormControl>

                  <FormControl>
                    <FormLabel
                      fontSize="xl"
                      fontWeight="bold"
                      color="gray.700"
                      mb={4}
                    >
                      📝 Additional AI Instructions
                    </FormLabel>
                    <Textarea
                      placeholder="e.g., Be friendly and professional. Include emojis. Ask questions to encourage engagement."
                      value={localSettings.additionalPrompt || ""}
                      onChange={(e) =>
                        handleInputChange("additionalPrompt", e.target.value)
                      }
                      size="lg"
                      rounded="xl"
                      bg="white"
                      border="2px"
                      borderColor="blue.200"
                      _hover={{ borderColor: "blue.300" }}
                      _focus={{
                        borderColor: "blue.400",
                        boxShadow: "0 0 0 3px rgba(66, 153, 225, 0.1)",
                      }}
                      py={4}
                      fontSize="md"
                      rows={4}
                      resize="vertical"
                    />
                    <Text fontSize="md" color="gray.500" mt={3} pl={2}>
                      💡 Additional instructions for AI when generating comments
                      (optional)
                    </Text>
                  </FormControl>

                  <Text fontSize="md" color="gray.500" mt={3} pl={2}>
                    🔒 API keys are configured securely on the server
                  </Text>
                </VStack>
              </Box>

              {/* Scheduled Automation Settings */}
              <Box
                bg="purple.50"
                p={8}
                rounded="2xl"
                border="2px"
                borderColor="purple.100"
              >
                <Heading size="lg" mb={6} color="gray.700">
                  🕐 Scheduled Automation Settings
                </Heading>
                <VStack spacing={6}>
                  <Grid templateColumns="repeat(2, 1fr)" gap={6} w="full">
                    <GridItem>
                      <FormControl>
                        <FormLabel
                          fontSize="lg"
                          fontWeight="bold"
                          color="gray.700"
                          mb={3}
                        >
                          ⏱️ Interval (Minutes)
                        </FormLabel>
                        <NumberInput
                          value={
                            localSettings.scheduledAutomation
                              ?.intervalMinutes || 20
                          }
                          onChange={(_valueString, valueNumber) =>
                            handleScheduledSettingChange(
                              "intervalMinutes",
                              valueNumber,
                            )
                          }
                          min={5}
                          max={1440}
                          size="lg"
                        >
                          <NumberInputField
                            rounded="xl"
                            bg="white"
                            border="2px"
                            borderColor="purple.200"
                            _hover={{ borderColor: "purple.300" }}
                            _focus={{
                              borderColor: "purple.400",
                              boxShadow: "0 0 0 3px rgba(147, 51, 234, 0.1)",
                            }}
                            py={6}
                            fontSize="md"
                            fontWeight="medium"
                          />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                        <Text fontSize="sm" color="gray.500" mt={2}>
                          How often to run automation (5-1440 minutes)
                        </Text>
                      </FormControl>
                    </GridItem>

                    <GridItem>
                      <FormControl>
                        <FormLabel
                          fontSize="lg"
                          fontWeight="bold"
                          color="gray.700"
                          mb={3}
                        >
                          📦 Batch Size
                        </FormLabel>
                        <NumberInput
                          value={
                            localSettings.scheduledAutomation?.batchSize || 10
                          }
                          onChange={(_valueString, valueNumber) =>
                            handleScheduledSettingChange(
                              "batchSize",
                              valueNumber,
                            )
                          }
                          min={1}
                          max={50}
                          size="lg"
                        >
                          <NumberInputField
                            rounded="xl"
                            bg="white"
                            border="2px"
                            borderColor="purple.200"
                            _hover={{ borderColor: "purple.300" }}
                            _focus={{
                              borderColor: "purple.400",
                              boxShadow: "0 0 0 3px rgba(147, 51, 234, 0.1)",
                            }}
                            py={6}
                            fontSize="md"
                            fontWeight="medium"
                          />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                        <Text fontSize="sm" color="gray.500" mt={2}>
                          Posts to process per automation run (1-50)
                        </Text>
                      </FormControl>
                    </GridItem>
                  </Grid>

                  <FormControl>
                    <HStack justify="space-between" align="center">
                      <Box>
                        <FormLabel
                          fontSize="lg"
                          fontWeight="bold"
                          color="gray.700"
                          mb={1}
                        >
                          🚀 Start Immediately
                        </FormLabel>
                        <Text fontSize="sm" color="gray.500">
                          Run automation immediately when starting scheduler
                          (instead of waiting for first interval)
                        </Text>
                      </Box>
                      <Switch
                        size="lg"
                        colorScheme="purple"
                        isChecked={
                          localSettings.scheduledAutomation?.startImmediately ?? true
                        }
                        onChange={(e) =>
                          handleScheduledSettingChange(
                            "startImmediately",
                            e.target.checked,
                          )
                        }
                      />
                    </HStack>
                  </FormControl>

                  <Text
                    fontSize="sm"
                    color="purple.700"
                    textAlign="center"
                    mt={4}
                  >
                    💡 Scheduled automation will process posts in batches to
                    avoid overwhelming the system
                  </Text>
                </VStack>
              </Box>

              <Box pt={8}>
                <Button
                  colorScheme="blue"
                  onClick={handleSave}
                  size="xl"
                  width="full"
                  rounded="2xl"
                  shadow="lg"
                  py={8}
                  fontSize="lg"
                  fontWeight="bold"
                  _hover={{
                    transform: "translateY(-2px)",
                    shadow: "xl",
                    bg: "blue.600",
                  }}
                  _active={{ transform: "translateY(0)" }}
                  leftIcon={
                    <Box as="span" fontSize="xl">
                      💾
                    </Box>
                  }
                >
                  Save Configuration
                </Button>
              </Box>
            </VStack>
          </CardBody>
        </Card>
      </VStack>
    </Box>
  );
}

export default Settings;
