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
  CardHeader,
  Heading,
  Text,
  useToast,
} from "@chakra-ui/react";

function Settings({ settings, onUpdate }) {
  const [localSettings, setLocalSettings] = useState(settings);
  const toast = useToast();

  const handleInputChange = (field, value) => {
    setLocalSettings({ ...localSettings, [field]: value });
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
    <Box maxW="5xl" mx="auto" px={4}>
      <VStack spacing={8} align="stretch">
        <Box textAlign="center" mb={6}>
          <Heading size="xl" mb={4} color="gray.700">
            🔧 Configuration Settings
          </Heading>
          <Text color="gray.600" fontSize="lg" maxW="2xl" mx="auto">
            Configure your Google Sheets connection and AI provider settings
          </Text>
        </Box>

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
                      <option value="openai">🚀 OpenAI (GPT-4)</option>
                      <option value="anthropic">🧠 Anthropic (Claude)</option>
                    </Select>
                  </FormControl>
                  <Text fontSize="md" color="gray.500" mt={3} pl={2}>
                    🔒 API keys are configured securely on the server
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
