import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Text,
  HStack,
  VStack,
  Badge,
  Progress,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Grid,
  GridItem,
  Divider,
} from "@chakra-ui/react";

function ScheduledAutomation({
  scheduledState,
  settings,
  onStartScheduled,
  onStopScheduled,
}) {
  const formatTimeRemaining = (milliseconds) => {
    if (!milliseconds || milliseconds <= 0) return "00:00:00";

    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const getProgressPercentage = () => {
    if (!scheduledState.isActive || !scheduledState.timeRemaining) return 0;

    const totalInterval =
      (settings.scheduledAutomation.intervalMinutes || 20) * 60 * 1000;
    const elapsed = totalInterval - scheduledState.timeRemaining;
    return Math.min(100, Math.max(0, (elapsed / totalInterval) * 100));
  };

  const getNextRunTime = () => {
    if (!scheduledState.nextRunTime) return "Not scheduled";

    const nextRun = new Date(scheduledState.nextRunTime);
    return nextRun.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <Card
      shadow="lg"
      rounded="xl"
      border="2px"
      borderColor={scheduledState.isActive ? "green.200" : "gray.200"}
      bg={scheduledState.isActive ? "green.50" : "white"}
    >
      <CardHeader pb={3}>
        <HStack justify="space-between" align="center">
          <VStack align="start" spacing={1}>
            <Heading size="md" color="gray.700">
              🕐 Scheduled Automation
            </Heading>
            <Text fontSize="sm" color="gray.600">
              Automated processing every{" "}
              {settings.scheduledAutomation.intervalMinutes} minutes
            </Text>
          </VStack>
          <Badge
            colorScheme={scheduledState.isActive ? "green" : "gray"}
            variant="solid"
            px={3}
            py={1}
            rounded="full"
            fontSize="sm"
          >
            {scheduledState.isActive ? "🟢 Active" : "⚫ Inactive"}
          </Badge>
        </HStack>
      </CardHeader>

      <CardBody pt={0}>
        <VStack spacing={6}>
          {scheduledState.isActive && (
            <Box w="full">
              <VStack spacing={4}>
                {/* Countdown Timer */}
                <Box
                  bg="white"
                  p={6}
                  rounded="xl"
                  border="2px"
                  borderColor="green.200"
                  w="full"
                  textAlign="center"
                >
                  <Text fontSize="sm" color="gray.600" mb={2}>
                    Next Run In
                  </Text>
                  <Text
                    fontSize="4xl"
                    fontWeight="bold"
                    color="green.600"
                    fontFamily="mono"
                    letterSpacing="wider"
                  >
                    {formatTimeRemaining(scheduledState.timeRemaining)}
                  </Text>
                  <Progress
                    value={getProgressPercentage()}
                    colorScheme="green"
                    size="lg"
                    rounded="full"
                    mt={4}
                    bg="green.100"
                  />
                  <Text fontSize="xs" color="gray.500" mt={2}>
                    Next run at {getNextRunTime()}
                  </Text>
                </Box>

                {/* Statistics */}
                <Grid templateColumns="repeat(3, 1fr)" gap={4} w="full">
                  <GridItem>
                    <Stat textAlign="center" bg="white" p={4} rounded="lg">
                      <StatLabel fontSize="xs" color="gray.600">
                        Cycles Run
                      </StatLabel>
                      <StatNumber color="blue.600" fontSize="2xl">
                        {scheduledState.currentCycle}
                      </StatNumber>
                    </Stat>
                  </GridItem>
                  <GridItem>
                    <Stat textAlign="center" bg="white" p={4} rounded="lg">
                      <StatLabel fontSize="xs" color="gray.600">
                        Posts Processed
                      </StatLabel>
                      <StatNumber color="purple.600" fontSize="2xl">
                        {scheduledState.totalProcessed}
                      </StatNumber>
                    </Stat>
                  </GridItem>
                  <GridItem>
                    <Stat textAlign="center" bg="white" p={4} rounded="lg">
                      <StatLabel fontSize="xs" color="gray.600">
                        Batch Size
                      </StatLabel>
                      <StatNumber color="orange.600" fontSize="2xl">
                        {settings.scheduledAutomation.batchSize}
                      </StatNumber>
                    </Stat>
                  </GridItem>
                </Grid>
              </VStack>
            </Box>
          )}

          <Divider />

          {/* Control Buttons */}
          <HStack spacing={4} w="full" justify="center">
            {!scheduledState.isActive ? (
              <Button
                colorScheme="green"
                size="lg"
                onClick={onStartScheduled}
                rounded="xl"
                px={8}
                leftIcon={<Box as="span">▶️</Box>}
                _hover={{ transform: "translateY(-1px)", shadow: "lg" }}
                shadow="md"
              >
                Start Scheduled Automation
              </Button>
            ) : (
              <Button
                colorScheme="red"
                size="lg"
                onClick={onStopScheduled}
                rounded="xl"
                px={8}
                leftIcon={<Box as="span">⏹️</Box>}
                _hover={{ transform: "translateY(-1px)", shadow: "lg" }}
                shadow="md"
              >
                Stop Automation
              </Button>
            )}
          </HStack>

          {/* Configuration Summary */}
          <Box
            bg="blue.50"
            p={4}
            rounded="lg"
            border="1px"
            borderColor="blue.200"
            w="full"
          >
            <Text fontSize="sm" color="blue.800" fontWeight="medium" mb={2}>
              📋 Current Configuration:
            </Text>
            <VStack align="start" spacing={1}>
              <Text fontSize="xs" color="blue.700">
                • Interval: Every {settings.scheduledAutomation.intervalMinutes}{" "}
                minutes
              </Text>
              <Text fontSize="xs" color="blue.700">
                • Batch Size: {settings.scheduledAutomation.batchSize} posts per
                run
              </Text>
              <Text fontSize="xs" color="blue.700">
                • AI Provider: {settings.aiProvider.toUpperCase()}
              </Text>
              <Text fontSize="xs" color="blue.700">
                • Comment Length: Max {settings.commentMaxLength} characters
              </Text>
              <Text fontSize="xs" color="green.700" fontWeight="bold">
                • Start Mode:{" "}
                {settings.scheduledAutomation.startImmediately
                  ? "Run immediately on start"
                  : "Wait for first interval"}
              </Text>
            </VStack>
          </Box>
        </VStack>
      </CardBody>
    </Card>
  );
}

export default ScheduledAutomation;
