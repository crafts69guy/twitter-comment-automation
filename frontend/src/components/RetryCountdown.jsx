import React, { useState, useEffect } from 'react';
import {
  Box,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Progress,
  Text,
  HStack,
  VStack,
  Badge,
  Icon,
  Flex,
  Divider,
  Button,
  useToast,
} from '@chakra-ui/react';
import { FiClock, FiAlertCircle, FiRefreshCw, FiZap, FiXCircle } from 'react-icons/fi';
import axios from 'axios';

// API URL
const API_URL =
  window.location.hostname === 'localhost' &&
  window.location.port !== '80' &&
  window.location.port !== ''
    ? 'http://localhost:3001'
    : '';
const API_BASE = `${API_URL}/api/v2`;

const RetryCountdown = ({ eventSource }) => {
  const [retryInfo, setRetryInfo] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isForceRetrying, setIsForceRetrying] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!eventSource) return;

    // Listen for retry scheduled
    const handleRetryScheduled = e => {
      const data = JSON.parse(e.data);
      console.log('🔄 Retry scheduled:', data);

      setRetryInfo({
        batchNumber: data.batchNumber,
        retryAt: new Date(data.retryAt),
        failedCount: data.failedCount,
        delayMinutes: data.delayMinutes,
        failureRate: data.failureRate,
        totalDelay: data.delayMinutes * 60 * 1000,
      });
      setIsRetrying(false);
    };

    // Listen for countdown updates
    const handleCountdown = e => {
      const data = JSON.parse(e.data);
      setCountdown({
        remainingMs: data.remainingMs,
        batchNumber: data.batchNumber,
      });
    };

    // Listen for retry started
    const handleRetryStarted = e => {
      const data = JSON.parse(e.data);
      console.log('🚀 Retry started:', data);
      setIsRetrying(true);
      setCountdown(null);
    };

    // Listen for retry completed
    const handleRetryCompleted = e => {
      const data = JSON.parse(e.data);
      console.log('✅ Retry completed:', data);

      // Show completion message for 5 seconds
      setRetryInfo(prev => ({
        ...prev,
        completed: true,
        successCount: data.successCount,
        failedCount: data.failedCount,
        totalRetried: data.totalRetried,
      }));

      setTimeout(() => {
        setRetryInfo(null);
        setIsRetrying(false);
      }, 5000);
    };

    // Listen for retry canceled
    const handleRetryCanceled = e => {
      const data = JSON.parse(e.data);
      console.log('🚫 Retry canceled:', data);

      // Clear UI immediately
      setRetryInfo(null);
      setCountdown(null);
      setIsRetrying(false);
      setIsCanceling(false);
    };

    // Listen for automation stopped (clear retry UI)
    const handleAutomationStopped = () => {
      console.log('🛑 Automation stopped - clearing retry UI');

      // Clear all retry states
      setRetryInfo(null);
      setCountdown(null);
      setIsRetrying(false);
      setIsForceRetrying(false);
      setIsCanceling(false);
    };

    eventSource.addEventListener('batch:retry_scheduled', handleRetryScheduled);
    eventSource.addEventListener('retry:countdown', handleCountdown);
    eventSource.addEventListener('batch:retry_started', handleRetryStarted);
    eventSource.addEventListener('batch:retry_completed', handleRetryCompleted);
    eventSource.addEventListener('batch:retry_canceled', handleRetryCanceled);
    eventSource.addEventListener('automation:stopped', handleAutomationStopped);

    return () => {
      eventSource.removeEventListener('batch:retry_scheduled', handleRetryScheduled);
      eventSource.removeEventListener('retry:countdown', handleCountdown);
      eventSource.removeEventListener('batch:retry_started', handleRetryStarted);
      eventSource.removeEventListener('batch:retry_completed', handleRetryCompleted);
      eventSource.removeEventListener('batch:retry_canceled', handleRetryCanceled);
      eventSource.removeEventListener('automation:stopped', handleAutomationStopped);
    };
  }, [eventSource]);

  // Handle force retry
  const handleForceRetry = async () => {
    if (isForceRetrying) return;

    try {
      setIsForceRetrying(true);

      const response = await axios.post(
        `${API_BASE}/automation/force-retry`,
        {},
        { withCredentials: true },
      );

      if (response.data.success) {
        toast({
          title: 'Force Retry Started',
          description: `Retrying ${response.data.linkCount} links immediately`,
          status: 'success',
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Error forcing retry:', error);
      toast({
        title: 'Force Retry Failed',
        description: error.response?.data?.message || 'Failed to force retry',
        status: 'error',
        duration: 5000,
      });
      setIsForceRetrying(false);
    }
  };

  // Handle cancel retry
  const handleCancelRetry = async () => {
    if (isCanceling) return;

    try {
      setIsCanceling(true);

      const response = await axios.post(
        `${API_BASE}/automation/cancel-retry`,
        {},
        { withCredentials: true },
      );

      if (response.data.success) {
        toast({
          title: 'Retry Canceled',
          description: `${response.data.canceledCount} failed links archived. Continuing to next batch.`,
          status: 'info',
          duration: 3000,
        });
        // Clear retry info immediately
        setRetryInfo(null);
        setCountdown(null);
      }
    } catch (error) {
      console.error('Error canceling retry:', error);
      toast({
        title: 'Cancel Failed',
        description: error.response?.data?.message || 'Failed to cancel retry',
        status: 'error',
        duration: 5000,
      });
      setIsCanceling(false);
    }
  };

  // Don't render if no retry info
  if (!retryInfo) return null;

  // Retry completed view
  if (retryInfo.completed) {
    return (
      <Alert
        status={retryInfo.successCount > 0 ? 'success' : 'warning'}
        variant="left-accent"
        borderRadius="lg"
        mb={4}
      >
        <AlertIcon />
        <Box flex="1">
          <AlertTitle>Retry Completed for Batch {retryInfo.batchNumber}</AlertTitle>
          <AlertDescription>
            <HStack spacing={4} mt={2}>
              <Badge colorScheme="green" fontSize="md" px={3} py={1}>
                ✓ {retryInfo.successCount} Succeeded
              </Badge>
              {retryInfo.failedCount > 0 && (
                <Badge colorScheme="red" fontSize="md" px={3} py={1}>
                  ✗ {retryInfo.failedCount} Failed
                </Badge>
              )}
              <Text fontSize="sm" color="gray.600">
                Total: {retryInfo.totalRetried} links
              </Text>
            </HStack>
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  // Retrying view
  if (isRetrying) {
    return (
      <Alert status="info" variant="left-accent" borderRadius="lg" mb={4}>
        <AlertIcon as={FiRefreshCw} animation="spin 2s linear infinite" />
        <Box flex="1">
          <AlertTitle>Retrying Batch {retryInfo.batchNumber}</AlertTitle>
          <AlertDescription>
            <Text fontSize="sm">Processing {retryInfo.failedCount} failed links...</Text>
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  // Countdown view
  if (countdown && countdown.remainingMs > 0) {
    const minutes = Math.floor(countdown.remainingMs / 60000);
    const seconds = Math.floor((countdown.remainingMs % 60000) / 1000);
    const progress = ((retryInfo.totalDelay - countdown.remainingMs) / retryInfo.totalDelay) * 100;

    return (
      <Alert
        status="warning"
        variant="subtle"
        borderRadius="lg"
        mb={4}
        bg="orange.50"
        borderWidth="1px"
        borderColor="orange.200"
      >
        <AlertIcon as={FiClock} color="orange.500" />
        <Box flex="1">
          <VStack align="stretch" spacing={3}>
            {/* Header */}
            <Flex justify="space-between" align="center">
              <AlertTitle color="orange.800" fontSize="lg">
                <HStack>
                  <Icon as={FiAlertCircle} />
                  <Text>Automatic Retry Scheduled</Text>
                </HStack>
              </AlertTitle>
              <Badge colorScheme="orange" fontSize="lg" px={4} py={2} borderRadius="full">
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </Badge>
            </Flex>

            <Divider />

            {/* Info */}
            <HStack spacing={6} fontSize="sm">
              <VStack align="start" spacing={1}>
                <Text color="gray.600" fontWeight="medium">
                  Batch Number
                </Text>
                <Badge colorScheme="blue" fontSize="md">
                  {retryInfo.batchNumber}
                </Badge>
              </VStack>

              <VStack align="start" spacing={1}>
                <Text color="gray.600" fontWeight="medium">
                  Failed Links
                </Text>
                <Badge colorScheme="red" fontSize="md">
                  {retryInfo.failedCount}
                </Badge>
              </VStack>

              <VStack align="start" spacing={1}>
                <Text color="gray.600" fontWeight="medium">
                  Failure Rate
                </Text>
                <Badge colorScheme="orange" fontSize="md">
                  {retryInfo.failureRate}%
                </Badge>
              </VStack>

              <VStack align="start" spacing={1}>
                <Text color="gray.600" fontWeight="medium">
                  Retry Delay
                </Text>
                <Badge colorScheme="purple" fontSize="md">
                  {retryInfo.delayMinutes} min
                </Badge>
              </VStack>
            </HStack>

            {/* Progress bar */}
            <Box>
              <Flex justify="space-between" mb={2}>
                <Text fontSize="xs" color="gray.600">
                  Time until retry
                </Text>
                <Text fontSize="xs" color="orange.600" fontWeight="medium">
                  {minutes}m {seconds}s remaining
                </Text>
              </Flex>
              <Progress
                value={progress}
                size="sm"
                colorScheme="orange"
                borderRadius="full"
                hasStripe
                isAnimated
              />
            </Box>

            {/* Additional info */}
            <AlertDescription fontSize="sm" color="gray.700">
              <HStack spacing={2}>
                <Icon as={FiRefreshCw} />
                <Text>
                  {retryInfo.failureRate < 30
                    ? 'Low failure rate - retrying failed links after 5 minutes'
                    : 'High failure rate - retrying failed links after 10 minutes'}
                </Text>
              </HStack>
              <Text mt={2} fontSize="xs" color="gray.500">
                ⚠️ New batches are paused until retry completes
              </Text>
            </AlertDescription>

            {/* Action Buttons */}
            <Divider />
            <Flex justify="space-between" align="center">
              <Button
                leftIcon={<FiXCircle />}
                colorScheme="red"
                variant="ghost"
                size="sm"
                onClick={handleCancelRetry}
                isLoading={isCanceling}
                isDisabled={isForceRetrying}
                loadingText="Canceling..."
              >
                Cancel Retry
              </Button>
              <Button
                leftIcon={<FiZap />}
                colorScheme="orange"
                size="sm"
                onClick={handleForceRetry}
                isLoading={isForceRetrying}
                isDisabled={isCanceling}
                loadingText="Starting retry..."
              >
                Force Retry Now
              </Button>
            </Flex>
          </VStack>
        </Box>
      </Alert>
    );
  }

  return null;
};

export default RetryCountdown;
