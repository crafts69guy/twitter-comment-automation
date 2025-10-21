import { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Button,
  Badge,
  Card,
  CardBody,
  Link,
  Icon,
  IconButton,
  Divider,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Checkbox,
  useToast,
  Tooltip,
  Code
} from '@chakra-ui/react';
import { FaExternalLinkAlt, FaCopy, FaRedo, FaTrash } from 'react-icons/fa';
import { BiRefresh } from 'react-icons/bi';
import axios from 'axios';

const API_URL =
  window.location.hostname === 'localhost' &&
  window.location.port !== '80' &&
  window.location.port !== ''
    ? 'http://localhost:3001'
    : '';

const API_BASE = `${API_URL}/api/v2`;

function FailedLinksTab({ failedLinks, onRefresh }) {
  const [selectedLinks, setSelectedLinks] = useState(new Set());
  const [isRetrying, setIsRetrying] = useState(false);
  const toast = useToast();

  const groupedByBatch = failedLinks.reduce((acc, link) => {
    const batchNum = link.batchNumber;
    if (!acc[batchNum]) {
      acc[batchNum] = [];
    }
    acc[batchNum].push(link);
    return acc;
  }, {});

  const batchNumbers = Object.keys(groupedByBatch).sort((a, b) => parseInt(b) - parseInt(a));

  const handleSelectLink = (linkId) => {
    const newSelected = new Set(selectedLinks);
    if (newSelected.has(linkId)) {
      newSelected.delete(linkId);
    } else {
      newSelected.add(linkId);
    }
    setSelectedLinks(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedLinks.size === failedLinks.length) {
      setSelectedLinks(new Set());
    } else {
      setSelectedLinks(new Set(failedLinks.map(l => l.linkId)));
    }
  };

  const handleCopyComment = (comment) => {
    navigator.clipboard.writeText(comment);
    toast({
      title: 'Comment Copied',
      status: 'success',
      duration: 1000
    });
  };

  const handleOpenLink = (url) => {
    window.open(url, '_blank');
  };

  const handleRetrySelected = async () => {
    if (selectedLinks.size === 0) {
      toast({
        title: 'No Links Selected',
        description: 'Please select links to retry',
        status: 'warning',
        duration: 2000
      });
      return;
    }

    setIsRetrying(true);

    try {
      const response = await axios.post(
        `${API_BASE}/failed-links/retry`,
        { linkIds: Array.from(selectedLinks) },
        { withCredentials: true }
      );

      if (response.data.success) {
        toast({
          title: 'Retry Completed',
          description: `${response.data.successCount} successful, ${response.data.failedCount} failed`,
          status: response.data.failedCount === 0 ? 'success' : 'warning',
          duration: 3000
        });

        // Clear selection
        setSelectedLinks(new Set());

        // Refresh failed links
        onRefresh();
      }
    } catch (error) {
      console.error('Error retrying links:', error);
      toast({
        title: 'Retry Failed',
        description: error.response?.data?.message || 'Failed to retry links',
        status: 'error',
        duration: 3000
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to clear all failed links?')) {
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE}/failed-links/clear`,
        {},
        { withCredentials: true }
      );

      if (response.data.success) {
        toast({
          title: 'Failed Links Cleared',
          description: `Cleared ${response.data.clearedCount} failed links`,
          status: 'success',
          duration: 2000
        });

        setSelectedLinks(new Set());
        onRefresh();
      }
    } catch (error) {
      console.error('Error clearing failed links:', error);
      toast({
        title: 'Error',
        description: 'Failed to clear links',
        status: 'error',
        duration: 3000
      });
    }
  };

  if (failedLinks.length === 0) {
    return (
      <Alert status="success" borderRadius="md">
        <AlertIcon />
        <Box>
          <AlertTitle>No Failed Links</AlertTitle>
          <AlertDescription>
            All links have been processed successfully! 🎉
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  return (
    <VStack spacing={6} align="stretch">

      {/* Header & Controls */}
      <Card>
        <CardBody>
          <HStack justify="space-between" mb={4}>
            <Box>
              <Heading size="md">Failed Links History</Heading>
              <Text fontSize="sm" color="gray.600" mt={1}>
                {failedLinks.length} failed links from {batchNumbers.length} batches
              </Text>
            </Box>
            <HStack>
              <Button
                size="sm"
                leftIcon={<Icon as={BiRefresh} />}
                onClick={onRefresh}
              >
                Refresh
              </Button>
              <Button
                size="sm"
                colorScheme="red"
                leftIcon={<Icon as={FaTrash} />}
                onClick={handleClearAll}
              >
                Clear All
              </Button>
            </HStack>
          </HStack>

          {/* Bulk Actions */}
          <HStack spacing={3}>
            <Checkbox
              isChecked={selectedLinks.size === failedLinks.length && failedLinks.length > 0}
              isIndeterminate={selectedLinks.size > 0 && selectedLinks.size < failedLinks.length}
              onChange={handleSelectAll}
            >
              Select All
            </Checkbox>
            <Badge colorScheme="blue">
              {selectedLinks.size} selected
            </Badge>
            <Button
              size="sm"
              colorScheme="green"
              leftIcon={<Icon as={FaRedo} />}
              onClick={handleRetrySelected}
              isDisabled={selectedLinks.size === 0}
              isLoading={isRetrying}
            >
              Retry Selected
            </Button>
          </HStack>
        </CardBody>
      </Card>

      {/* Grouped by Batch */}
      {batchNumbers.map(batchNum => (
        <Card key={batchNum}>
          <CardBody>
            <Heading size="sm" mb={4}>
              Batch #{batchNum}
              <Badge ml={2} colorScheme="red">
                {groupedByBatch[batchNum].length} failed
              </Badge>
            </Heading>

            <VStack spacing={3} align="stretch">
              {groupedByBatch[batchNum].map(link => (
                <Box
                  key={link.linkId}
                  p={4}
                  bg="gray.50"
                  borderRadius="md"
                  borderLeft="4px solid"
                  borderColor="red.400"
                >
                  <HStack spacing={3} mb={3} align="start">
                    <Checkbox
                      isChecked={selectedLinks.has(link.linkId)}
                      onChange={() => handleSelectLink(link.linkId)}
                      mt={1}
                    />

                    <VStack flex={1} align="stretch" spacing={2}>
                      {/* URL */}
                      <HStack>
                        <Text fontSize="sm" fontWeight="medium" color="gray.700">
                          URL:
                        </Text>
                        <Link
                          href={link.url}
                          isExternal
                          fontSize="sm"
                          color="blue.600"
                          isTruncated
                          maxW="600px"
                        >
                          {link.url}
                        </Link>
                      </HStack>

                      {/* Error */}
                      <HStack align="start">
                        <Text fontSize="sm" fontWeight="medium" color="gray.700" minW="50px">
                          Error:
                        </Text>
                        <Text fontSize="sm" color="red.600">
                          {link.error}
                        </Text>
                      </HStack>

                      {/* Comment */}
                      <Box>
                        <HStack mb={1}>
                          <Text fontSize="sm" fontWeight="medium" color="gray.700">
                            Generated Comment:
                          </Text>
                          <Badge size="sm" colorScheme="blue">
                            {link.comment?.length || 0} chars
                          </Badge>
                        </HStack>
                        <Code
                          p={2}
                          borderRadius="md"
                          display="block"
                          fontSize="sm"
                          whiteSpace="pre-wrap"
                          bg="white"
                        >
                          {link.comment}
                        </Code>
                      </Box>

                      {/* Timestamp */}
                      <Text fontSize="xs" color="gray.500">
                        Failed at: {new Date(link.failedAt).toLocaleString()}
                      </Text>
                    </VStack>

                    {/* Action Buttons */}
                    <VStack spacing={2}>
                      <Tooltip label="Copy Comment">
                        <IconButton
                          size="sm"
                          icon={<Icon as={FaCopy} />}
                          onClick={() => handleCopyComment(link.comment)}
                          aria-label="Copy comment"
                        />
                      </Tooltip>

                      <Tooltip label="Open in New Tab">
                        <IconButton
                          size="sm"
                          colorScheme="blue"
                          icon={<Icon as={FaExternalLinkAlt} />}
                          onClick={() => handleOpenLink(link.url)}
                          aria-label="Open link"
                        />
                      </Tooltip>

                      <Tooltip label="Retry This Link">
                        <IconButton
                          size="sm"
                          colorScheme="green"
                          icon={<Icon as={FaRedo} />}
                          onClick={async () => {
                            setIsRetrying(true);
                            try {
                              const response = await axios.post(
                                `${API_BASE}/failed-links/retry`,
                                { linkIds: [link.linkId] },
                                { withCredentials: true }
                              );

                              if (response.data.success) {
                                const result = response.data.results[0];
                                toast({
                                  title: result.status === 'success' ? 'Retry Successful' : 'Retry Failed',
                                  description: result.status === 'success'
                                    ? 'Link processed successfully'
                                    : result.error,
                                  status: result.status === 'success' ? 'success' : 'error',
                                  duration: 3000
                                });
                                onRefresh();
                              }
                            } catch (error) {
                              toast({
                                title: 'Error',
                                description: 'Failed to retry link',
                                status: 'error',
                                duration: 3000
                              });
                            } finally {
                              setIsRetrying(false);
                            }
                          }}
                          isLoading={isRetrying}
                          aria-label="Retry link"
                        />
                      </Tooltip>
                    </VStack>
                  </HStack>
                </Box>
              ))}
            </VStack>
          </CardBody>
        </Card>
      ))}
    </VStack>
  );
}

export default FailedLinksTab;
