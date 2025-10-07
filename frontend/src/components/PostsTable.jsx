import {
  Box,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Text,
  HStack,
  VStack,
  Link,
  Spinner,
  Alert,
  AlertIcon,
  AlertDescription,
} from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';
import { useEffect } from 'react';

function PostsTable({
  posts,
  onFetchPostsWithTwitterAPI,
  onAutoReplyAll,
  loading,
  hasSettings,
  scheduledState,
  onStartScheduled,
  onStopScheduled,
  browserStatus,
  onOpenBrowser,
  onCheckBrowserStatus,
}) {
  const getStatusColor = status => {
    switch (status) {
      case 'pending':
        return 'gray';
      case 'commented':
        return 'yellow';
      case 'replied':
        return 'green';
      default:
        return 'gray';
    }
  };

  const getStatusText = status => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'commented':
        return 'Comment Ready';
      case 'replied':
        return 'Replied';
      default:
        return 'Unknown';
    }
  };

  // Check browser status on component mount
  useEffect(() => {
    if (onCheckBrowserStatus) {
      onCheckBrowserStatus();
    }
  }, [onCheckBrowserStatus]);

  if (!hasSettings) {
    return (
      <Card>
        <CardBody>
          <Alert status="info">
            <AlertIcon />
            <AlertDescription>
              Please configure your settings first before managing posts.
            </AlertDescription>
          </Alert>
        </CardBody>
      </Card>
    );
  }

  return (
    <Box maxW="7xl" mx="auto">
      <VStack spacing={6} align="stretch">
        <Card shadow="md" rounded="xl" border="1px" borderColor="gray.200">
          <CardHeader p={8}>
            <VStack justify="space-between">
              <Box>
                <Heading textAlign="center" size="lg" color="gray.700" mb={2}>
                  📝 Posts Management
                </Heading>
                <Text textAlign="center" color="gray.600" fontSize="md">
                  Fetch posts from Google Sheets and manage comment generation
                </Text>
              </Box>
              <VStack spacing={8}>
                {/* Scheduled Automation Status */}
                {scheduledState.isActive && (
                  <Box
                    bg="green.50"
                    border="2px"
                    borderColor="green.200"
                    rounded="xl"
                    p={4}
                    w="full"
                    textAlign="center"
                  >
                    <HStack justify="center" spacing={4}>
                      <Badge colorScheme="green" variant="solid" px={3} py={1} rounded="full">
                        🟢 Scheduled Automation Active
                      </Badge>
                      <Text fontSize="sm" color="green.700" fontFamily="mono">
                        Next run in: {Math.floor(scheduledState.timeRemaining / 60000)}:
                        {String(Math.floor((scheduledState.timeRemaining % 60000) / 1000)).padStart(
                          2,
                          '0',
                        )}
                      </Text>
                      <Button
                        size="sm"
                        colorScheme="red"
                        variant="outline"
                        onClick={onStopScheduled}
                        leftIcon={<Box as="span">⏹️</Box>}
                      >
                        Stop
                      </Button>
                    </HStack>
                  </Box>
                )}

                <HStack spacing={4} wrap="wrap">
                  {/* Browser Status and Control */}
                  {!browserStatus?.isOpen && (
                    <Button
                      colorScheme="purple"
                      onClick={onOpenBrowser}
                      isLoading={loading}
                      loadingText="Opening Browser..."
                      size="lg"
                      rounded="xl"
                      shadow="md"
                      _hover={{ transform: 'translateY(-1px)', shadow: 'lg' }}
                      leftIcon={<Box as="span">🌐</Box>}
                      px={8}
                    >
                      Open Browser
                    </Button>
                  )}
                  {browserStatus?.isOpen && (
                    <Badge
                      colorScheme="green"
                      variant="solid"
                      px={4}
                      py={2}
                      rounded="full"
                      fontSize="md"
                    >
                      🟢 Browser Active ({browserStatus.activeTabs} tabs)
                    </Badge>
                  )}

                  <Button
                    colorScheme="teal"
                    onClick={onFetchPostsWithTwitterAPI}
                    isLoading={loading}
                    loadingText="Fetching & Generating..."
                    size="lg"
                    rounded="xl"
                    shadow="md"
                    _hover={{ transform: 'translateY(-1px)', shadow: 'lg' }}
                    px={8}
                  >
                    Fetch & Generate All
                  </Button>
                  {posts && posts.length > 0 && (
                    <>
                      <Button
                        colorScheme="red"
                        onClick={onAutoReplyAll}
                        isLoading={loading}
                        loadingText="Auto-Replying..."
                        size="lg"
                        rounded="xl"
                        shadow="md"
                        _hover={{ transform: 'translateY(-1px)', shadow: 'lg' }}
                        leftIcon={<Box as="span">🤖</Box>}
                        px={8}
                      >
                        Auto Reply All
                      </Button>

                      {!scheduledState.isActive && (
                        <Button
                          colorScheme="teal"
                          onClick={onStartScheduled}
                          isLoading={loading}
                          loadingText="Starting Schedule..."
                          size="lg"
                          rounded="xl"
                          shadow="md"
                          _hover={{
                            transform: 'translateY(-1px)',
                            shadow: 'lg',
                          }}
                          leftIcon={<Box as="span">🕐</Box>}
                          px={8}
                        >
                          Start Scheduler
                        </Button>
                      )}
                    </>
                  )}
                </HStack>
              </VStack>
            </VStack>
          </CardHeader>
        </Card>

        {posts.length === 0 && !loading ? (
          <Card shadow="md" rounded="xl" border="1px" borderColor="gray.200">
            <CardBody p={12}>
              <VStack spacing={4}>
                <Box fontSize="4xl">📋</Box>
                <Text textAlign="center" color="gray.500" fontSize="lg">
                  No posts loaded yet
                </Text>
                <Text textAlign="center" color="gray.400" fontSize="md">
                  Click "Fetch Posts" to load posts from your Google Sheet
                </Text>
              </VStack>
            </CardBody>
          </Card>
        ) : (
          <>
            {/* Statistics Card */}
            <Card shadow="md" rounded="xl" border="1px" borderColor="blue.200" bg="blue.50">
              <CardBody p={6}>
                <HStack justify="space-around" wrap="wrap">
                  <VStack>
                    <Text fontSize="2xl" fontWeight="bold" color="blue.600">
                      {posts.length}
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      Total Posts
                    </Text>
                  </VStack>
                  <VStack>
                    <Text fontSize="2xl" fontWeight="bold" color="yellow.600">
                      {posts.filter(p => p?.status === 'pending').length}
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      Pending
                    </Text>
                  </VStack>
                  <VStack>
                    <Text fontSize="2xl" fontWeight="bold" color="orange.600">
                      {posts.filter(p => p?.status === 'commented').length}
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      Comments Ready
                    </Text>
                  </VStack>
                  <VStack>
                    <Text fontSize="2xl" fontWeight="bold" color="green.600">
                      {posts.filter(p => p?.status === 'replied').length}
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      Replied
                    </Text>
                  </VStack>
                  <VStack>
                    <Text fontSize="2xl" fontWeight="bold" color="purple.600">
                      {Math.round(
                        (posts.filter(p => p?.status === 'replied').length / posts.length) * 100,
                      ) || 0}
                      %
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      Completion
                    </Text>
                  </VStack>
                </HStack>
              </CardBody>
            </Card>

            <Card shadow="md" rounded="xl" border="1px" borderColor="gray.200">
              <CardBody p={0}>
                <Box overflowX="auto">
                  <Table variant="simple" size="lg">
                    <Thead bg="gray.50">
                      <Tr>
                        <Th
                          width="40%"
                          color="gray.700"
                          fontWeight="bold"
                          fontSize="md"
                          py={6}
                          px={6}
                        >
                          🐦 Twitter Post
                        </Th>
                        <Th
                          width="35%"
                          color="gray.700"
                          fontWeight="bold"
                          fontSize="md"
                          py={6}
                          px={6}
                        >
                          💬 Generated Comment
                        </Th>
                        <Th
                          width="10%"
                          color="gray.700"
                          fontWeight="bold"
                          fontSize="md"
                          py={6}
                          px={6}
                        >
                          📊 Status
                        </Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {posts &&
                        posts.length > 0 &&
                        posts.map(post => (
                          <Tr key={post?.id || Math.random()} _hover={{ bg: 'gray.50' }}>
                            <Td py={6} px={6}>
                              <VStack align="start" spacing={3}>
                                <Link
                                  href={post?.url || '#'}
                                  isExternal
                                  color="blue.600"
                                  fontSize="md"
                                  fontWeight="medium"
                                  _hover={{
                                    color: 'blue.700',
                                    textDecoration: 'underline',
                                  }}
                                >
                                  {post?.url && post.url.length > 60
                                    ? `${post.url.substring(0, 60)}...`
                                    : post?.url || 'No URL'}
                                  <ExternalLinkIcon ml={2} />
                                </Link>
                                {post?.content && (
                                  <Text
                                    fontSize="sm"
                                    color="gray.600"
                                    noOfLines={2}
                                    lineHeight="1.4"
                                  >
                                    {post.content}
                                  </Text>
                                )}
                              </VStack>
                            </Td>
                            <Td py={6} px={6}>
                              {post?.comment ? (
                                <Box
                                  bg="blue.50"
                                  p={4}
                                  rounded="lg"
                                  border="1px"
                                  borderColor="blue.200"
                                >
                                  <Text fontSize="sm" noOfLines={4} lineHeight="1.5">
                                    {post?.comment}
                                  </Text>
                                </Box>
                              ) : (
                                <Box
                                  bg="gray.50"
                                  p={4}
                                  rounded="lg"
                                  border="1px"
                                  borderColor="gray.200"
                                  textAlign="center"
                                >
                                  <Text fontSize="sm" color="gray.500" fontStyle="italic">
                                    💭 No comment generated yet
                                  </Text>
                                </Box>
                              )}
                            </Td>
                            <Td py={6} px={6}>
                              <Badge
                                colorScheme={getStatusColor(post?.status)}
                                variant="solid"
                                px={3}
                                py={1}
                                rounded="full"
                                fontSize="sm"
                              >
                                {getStatusText(post?.status)}
                              </Badge>
                            </Td>
                          </Tr>
                        ))}

                      {loading && (
                        <Tr>
                          <Td colSpan={4} py={12}>
                            <HStack justify="center" spacing={4}>
                              <Spinner size="lg" color="blue.500" />
                              <Text color="gray.600" fontSize="lg">
                                Loading posts...
                              </Text>
                            </HStack>
                          </Td>
                        </Tr>
                      )}
                    </Tbody>
                  </Table>
                </Box>
              </CardBody>
            </Card>
          </>
        )}
      </VStack>
    </Box>
  );
}

export default PostsTable;
