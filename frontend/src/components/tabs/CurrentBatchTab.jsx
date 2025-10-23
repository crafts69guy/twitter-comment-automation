import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Button,
  Badge,
  Progress,
  Divider,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Link,
  Icon,
  Card,
  CardBody,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Tooltip,
} from '@chakra-ui/react';
import {
  FaPlay,
  FaStop,
  FaPause,
  FaStepForward,
  FaChrome,
  FaExternalLinkAlt,
} from 'react-icons/fa';

function CountdownTimer({ countdown }) {
  if (!countdown.remainingMs || countdown.remainingMs <= 0) {
    return null;
  }

  const totalSeconds = Math.floor(countdown.remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const formatTime = (h, m, s) => {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <Box textAlign="center" p={4} bg="blue.50" borderRadius="md">
      <Text fontSize="sm" color="gray.600" mb={2}>
        Next Batch In
      </Text>
      <Text fontSize="3xl" fontWeight="bold" fontFamily="mono" color="blue.600">
        {formatTime(hours, minutes, seconds)}
      </Text>
      <Text fontSize="xs" color="gray.500" mt={1}>
        {countdown.nextBatchTime && new Date(countdown.nextBatchTime).toLocaleTimeString()}
      </Text>
    </Box>
  );
}

function CurrentBatchTab({
  automationStatus,
  currentBatchDetails,
  browserStatus,
  countdown,
  onStart,
  onStop,
  onPause,
  onResume,
  onForceNext,
  onOpenBrowser,
  onCloseBrowser,
}) {
  const hasActiveBatch = currentBatchDetails && currentBatchDetails.batch;
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const handleForceNext = useCallback(() => {
    onForceNext();
    setCooldownSeconds(10);
  }, [onForceNext]);

  useEffect(() => {
    if (cooldownSeconds > 0) {
      const timer = setTimeout(() => {
        setCooldownSeconds(cooldownSeconds - 1);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [cooldownSeconds]);

  return (
    <VStack spacing={6} align="stretch">
      {/* Browser Status & Controls */}
      <Card>
        <CardBody>
          <HStack justify="space-between" mb={4}>
            <Box>
              <Heading size="sm" mb={1}>
                Browser Status
              </Heading>
              <HStack>
                <Badge colorScheme={browserStatus.isOpen ? 'green' : 'gray'}>
                  {browserStatus.isOpen ? 'Open' : 'Closed'}
                </Badge>
                {browserStatus.currentUrl && (
                  <Text fontSize="xs" color="gray.500" isTruncated maxW="300px">
                    {browserStatus.currentUrl}
                  </Text>
                )}
              </HStack>
            </Box>
            <Button
              size="sm"
              leftIcon={<Icon as={FaChrome} />}
              colorScheme={browserStatus.isOpen ? 'red' : 'green'}
              onClick={browserStatus.isOpen ? onCloseBrowser : onOpenBrowser}
            >
              {browserStatus.isOpen ? 'Close Browser' : 'Open Browser'}
            </Button>
          </HStack>
        </CardBody>
      </Card>

      {/* Main Controls */}
      <Card>
        <CardBody>
          <Heading size="sm" mb={4}>
            Automation Controls
          </Heading>

          <SimpleGrid columns={[1, 2, 4]} spacing={3}>
            {!automationStatus.isActive ? (
              <Tooltip
                label={
                  !browserStatus.isOpen
                    ? 'Please open browser first'
                    : !browserStatus.isLoggedIn
                      ? 'Please wait for login to complete'
                      : 'Start automation'
                }
                placement="top"
              >
                <span>
                  <Button
                    colorScheme="green"
                    leftIcon={<Icon as={FaPlay} />}
                    onClick={onStart}
                    isDisabled={!browserStatus.isOpen || !browserStatus.isLoggedIn}
                  >
                    Start Automation
                  </Button>
                </span>
              </Tooltip>
            ) : (
              <>
                <Button colorScheme="red" leftIcon={<Icon as={FaStop} />} onClick={onStop}>
                  Stop
                </Button>

                {!automationStatus.isPaused ? (
                  <Button colorScheme="orange" leftIcon={<Icon as={FaPause} />} onClick={onPause}>
                    Pause
                  </Button>
                ) : (
                  <Button colorScheme="blue" leftIcon={<Icon as={FaPlay} />} onClick={onResume}>
                    Resume
                  </Button>
                )}

                <Tooltip
                  label={
                    cooldownSeconds > 0
                      ? `Wait ${cooldownSeconds}s before next force`
                      : 'Skip countdown and start next batch immediately'
                  }
                  placement="top"
                >
                  <span>
                    <Button
                      colorScheme="purple"
                      leftIcon={<Icon as={FaStepForward} />}
                      onClick={handleForceNext}
                      isDisabled={!hasActiveBatch || cooldownSeconds > 0}
                    >
                      {cooldownSeconds > 0 ? `Force Next (${cooldownSeconds}s)` : 'Force Next'}
                    </Button>
                  </span>
                </Tooltip>
              </>
            )}
          </SimpleGrid>

          {!browserStatus.isOpen && !automationStatus.isActive && (
            <Alert status="info" mt={4} borderRadius="md">
              <AlertIcon />
              <Box>
                <AlertTitle>Ready to Start</AlertTitle>
                <AlertDescription>
                  Click "Open Browser" to begin. Settings will be automatically synced before
                  opening.
                </AlertDescription>
              </Box>
            </Alert>
          )}
        </CardBody>
      </Card>

      {/* Current Batch Progress */}
      {hasActiveBatch ? (
        <Card>
          <CardBody>
            <Heading size="sm" mb={4}>
              Batch #{currentBatchDetails.batch.batchNumber} - Processing
            </Heading>

            {/* Progress Bar */}
            <Box mb={4}>
              <HStack justify="space-between" mb={2}>
                <Text fontSize="sm" fontWeight="medium">
                  Progress
                </Text>
                <Text fontSize="sm" color="gray.600">
                  {currentBatchDetails.progress?.current || 0} /{' '}
                  {currentBatchDetails.batch.links.length}
                </Text>
              </HStack>
              <Progress
                value={currentBatchDetails.progress?.percentage || 0}
                size="lg"
                colorScheme="blue"
                borderRadius="md"
                hasStripe
                isAnimated
              />
              <Text fontSize="xs" color="gray.500" mt={1} textAlign="right">
                {currentBatchDetails.progress?.percentage || 0}%
              </Text>
            </Box>

            {/* Current Link Processing */}
            {currentBatchDetails.currentLink && (
              <Box p={4} bg="blue.50" borderRadius="md" mb={4}>
                <HStack justify="space-between" mb={2}>
                  <Text fontSize="sm" fontWeight="medium" color="blue.700">
                    Currently Processing:
                  </Text>
                  {currentBatchDetails.currentLinkStatus?.step && (
                    <Badge colorScheme="purple" fontSize="xs">
                      {currentBatchDetails.currentLinkStatus.step}
                    </Badge>
                  )}
                </HStack>

                {/* Status Message */}
                {currentBatchDetails.currentLinkStatus && (
                  <HStack mb={2} spacing={2}>
                    <Badge
                      colorScheme={
                        currentBatchDetails.currentLinkStatus.status === 'completed'
                          ? 'green'
                          : currentBatchDetails.currentLinkStatus.status === 'failed'
                            ? 'red'
                            : 'blue'
                      }
                      fontSize="xs"
                    >
                      {currentBatchDetails.currentLinkStatus.status.replace(/_/g, ' ')}
                    </Badge>
                    <Text fontSize="xs" color="gray.600">
                      {currentBatchDetails.currentLinkStatus.message}
                    </Text>
                  </HStack>
                )}

                {/* URL */}
                <Link
                  href={currentBatchDetails.currentLink.url}
                  isExternal
                  fontSize="sm"
                  color="blue.600"
                  display="flex"
                  alignItems="center"
                  gap={1}
                >
                  {currentBatchDetails.currentLink.url}
                  <Icon as={FaExternalLinkAlt} boxSize={3} />
                </Link>
              </Box>
            )}

            {/* Batch Stats */}
            <SimpleGrid columns={[2, 3]} spacing={4}>
              <Stat>
                <StatLabel>Total Links</StatLabel>
                <StatNumber>{currentBatchDetails.batch.links.length}</StatNumber>
              </Stat>
              <Stat>
                <StatLabel>Success</StatLabel>
                <StatNumber color="green.500">
                  {currentBatchDetails.batch.successCount || 0}
                </StatNumber>
              </Stat>
              <Stat>
                <StatLabel>Failed</StatLabel>
                <StatNumber color="red.500">
                  {currentBatchDetails.batch.failedCount || 0}
                </StatNumber>
              </Stat>
            </SimpleGrid>

            <Divider my={4} />

            {/* Links List */}
            <Box maxH="300px" overflowY="auto">
              <Text fontSize="sm" fontWeight="medium" mb={3}>
                Links in this Batch:
              </Text>
              <VStack spacing={2} align="stretch">
                {currentBatchDetails.batch.links.map((link, index) => {
                  const isProcessing = index === currentBatchDetails.currentLinkIndex;
                  const isCompleted = index < (currentBatchDetails.currentLinkIndex || 0);
                  const result = currentBatchDetails.batch.results?.find(r => r.linkId === link.id);
                  const isSuccess = result?.status === 'success';
                  const isFailed = result?.status === 'failed';

                  // Determine status color and label
                  let statusColor = 'gray';
                  let statusLabel = '⏸ Pending';

                  if (isSuccess) {
                    statusColor = 'green';
                    statusLabel = '✓ Success';
                  } else if (isFailed) {
                    statusColor = 'red';
                    statusLabel = '✗ Failed';
                  } else if (isProcessing) {
                    statusColor = 'blue';
                    statusLabel = '⏳ Processing';
                  } else if (isCompleted) {
                    // Link was processed but no clear result
                    statusColor = 'purple';
                    statusLabel = '✓ Completed';
                  }

                  return (
                    <HStack
                      key={link.id}
                      p={3}
                      bg={isProcessing ? 'blue.50' : isCompleted ? 'gray.100' : 'gray.50'}
                      borderRadius="md"
                      justify="space-between"
                      borderLeft={isProcessing ? '4px solid' : 'none'}
                      borderColor="blue.500"
                    >
                      <HStack flex={1} spacing={3}>
                        <Badge colorScheme={statusColor}>{statusLabel}</Badge>
                        <Link href={link.url} isExternal fontSize="sm" isTruncated maxW="500px">
                          Link {index + 1}
                        </Link>
                      </HStack>
                    </HStack>
                  );
                })}
              </VStack>
            </Box>
          </CardBody>
        </Card>
      ) : automationStatus.isActive && countdown.remainingMs > 0 ? (
        // Countdown to next batch
        <Card>
          <CardBody>
            <CountdownTimer countdown={countdown} />
            <Text textAlign="center" mt={4} fontSize="sm" color="gray.600">
              Waiting for next batch to start...
            </Text>
          </CardBody>
        </Card>
      ) : (
        // No active batch
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          <Box>
            <AlertTitle>No Active Batch</AlertTitle>
            <AlertDescription>
              {automationStatus.isActive
                ? 'Automation is active but no batch is currently processing'
                : 'Click "Start Automation" to begin processing batches'}
            </AlertDescription>
          </Box>
        </Alert>
      )}

      {/* Overall Stats Summary */}
      <Card>
        <CardBody>
          <Heading size="sm" mb={4}>
            Overall Progress
          </Heading>
          <SimpleGrid columns={[2, 4]} spacing={4}>
            <Stat>
              <StatLabel>Batches Completed</StatLabel>
              <StatNumber>{automationStatus.stats.totalBatchesCompleted}</StatNumber>
              <StatHelpText>of {automationStatus.stats.totalBatches} total</StatHelpText>
            </Stat>
            <Stat>
              <StatLabel>Links Processed</StatLabel>
              <StatNumber>{automationStatus.stats.totalLinksProcessed}</StatNumber>
            </Stat>
            <Stat>
              <StatLabel>Success</StatLabel>
              <StatNumber color="green.500">{automationStatus.stats.totalSuccessful}</StatNumber>
            </Stat>
            <Stat>
              <StatLabel>Failed</StatLabel>
              <StatNumber color="red.500">{automationStatus.stats.totalFailed}</StatNumber>
            </Stat>
          </SimpleGrid>
        </CardBody>
      </Card>
    </VStack>
  );
}

export default CurrentBatchTab;
