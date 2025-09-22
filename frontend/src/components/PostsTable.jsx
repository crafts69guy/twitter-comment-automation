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
  IconButton,
  Tooltip,
  Spinner,
  Alert,
  AlertIcon,
  AlertDescription,
} from "@chakra-ui/react";
import {
  ExternalLinkIcon,
  ChatIcon,
  CheckIcon,
  RepeatIcon,
} from "@chakra-ui/icons";

function PostsTable({
  posts,
  onFetchPosts,
  onScrapeContent,
  onGenerateComment,
  onGenerateAllComments,
  onReply,
  // onReplyAll,
  onAutoReply,
  onAutoReplyAll,
  loading,
  hasSettings,
}) {
  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "gray";
      case "commented":
        return "yellow";
      case "replied":
        return "green";
      default:
        return "gray";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "pending":
        return "Pending";
      case "commented":
        return "Comment Ready";
      case "replied":
        return "Replied";
      default:
        return "Unknown";
    }
  };

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
              <HStack spacing={4} wrap="wrap">
                <Button
                  colorScheme="blue"
                  onClick={onFetchPosts}
                  isLoading={loading}
                  loadingText="Fetching..."
                  size="lg"
                  rounded="xl"
                  shadow="md"
                  _hover={{ transform: "translateY(-1px)", shadow: "lg" }}
                  leftIcon={<Box as="span">🔄</Box>}
                  px={8}
                >
                  Fetch Posts
                </Button>
                {posts && posts.length > 0 && (
                  <>
                    <Button
                      colorScheme="purple"
                      onClick={onScrapeContent}
                      isLoading={loading}
                      loadingText="Scraping..."
                      size="lg"
                      rounded="xl"
                      shadow="md"
                      _hover={{ transform: "translateY(-1px)", shadow: "lg" }}
                      leftIcon={<Box as="span">🕷️</Box>}
                      px={8}
                    >
                      Scrape Content
                    </Button>
                    <Button
                      colorScheme="green"
                      onClick={onGenerateAllComments}
                      isLoading={loading}
                      loadingText="Generating..."
                      size="lg"
                      rounded="xl"
                      shadow="md"
                      _hover={{ transform: "translateY(-1px)", shadow: "lg" }}
                      leftIcon={<Box as="span">🤖</Box>}
                      px={8}
                    >
                      Generate All Comments
                    </Button>

                    {/* <Button */}
                    {/*   colorScheme="orange" */}
                    {/*   onClick={onReplyAll} */}
                    {/*   isLoading={loading} */}
                    {/*   loadingText="Replying..." */}
                    {/*   size="lg" */}
                    {/*   rounded="xl" */}
                    {/*   shadow="md" */}
                    {/*   _hover={{ transform: "translateY(-1px)", shadow: "lg" }} */}
                    {/*   leftIcon={<Box as="span">📤</Box>} */}
                    {/*   px={8} */}
                    {/* > */}
                    {/*   Reply All */}
                    {/* </Button> */}

                    <Button
                      colorScheme="red"
                      onClick={onAutoReplyAll}
                      isLoading={loading}
                      loadingText="Auto-Replying..."
                      size="lg"
                      rounded="xl"
                      shadow="md"
                      _hover={{ transform: "translateY(-1px)", shadow: "lg" }}
                      leftIcon={<Box as="span">🤖</Box>}
                      px={8}
                    >
                      Auto Reply All
                    </Button>
                  </>
                )}
              </HStack>
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
            <Card
              shadow="md"
              rounded="xl"
              border="1px"
              borderColor="blue.200"
              bg="blue.50"
            >
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
                      {posts.filter((p) => p?.status === "pending").length}
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      Pending
                    </Text>
                  </VStack>
                  <VStack>
                    <Text fontSize="2xl" fontWeight="bold" color="orange.600">
                      {posts.filter((p) => p?.status === "commented").length}
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      Comments Ready
                    </Text>
                  </VStack>
                  <VStack>
                    <Text fontSize="2xl" fontWeight="bold" color="green.600">
                      {posts.filter((p) => p?.status === "replied").length}
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      Replied
                    </Text>
                  </VStack>
                  <VStack>
                    <Text fontSize="2xl" fontWeight="bold" color="purple.600">
                      {Math.round(
                        (posts.filter((p) => p?.status === "replied").length /
                          posts.length) *
                          100,
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
                        <Th
                          width="15%"
                          color="gray.700"
                          fontWeight="bold"
                          fontSize="md"
                          py={6}
                          px={6}
                        >
                          ⚡ Actions
                        </Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {posts &&
                        posts.length > 0 &&
                        posts.map((post) => (
                          <Tr
                            key={post?.id || Math.random()}
                            _hover={{ bg: "gray.50" }}
                          >
                            <Td py={6} px={6}>
                              <VStack align="start" spacing={3}>
                                <Link
                                  href={post?.url || "#"}
                                  isExternal
                                  color="blue.600"
                                  fontSize="md"
                                  fontWeight="medium"
                                  _hover={{
                                    color: "blue.700",
                                    textDecoration: "underline",
                                  }}
                                >
                                  {post?.url && post.url.length > 60
                                    ? `${post.url.substring(0, 60)}...`
                                    : post?.url || "No URL"}
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
                                  <Text
                                    fontSize="sm"
                                    noOfLines={4}
                                    lineHeight="1.5"
                                  >
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
                                  <Text
                                    fontSize="sm"
                                    color="gray.500"
                                    fontStyle="italic"
                                  >
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
                            <Td py={6} px={6}>
                              <VStack spacing={2}>
                                {!post?.comment && (
                                  <Tooltip label="Generate AI comment" hasArrow>
                                    <IconButton
                                      aria-label="Generate comment"
                                      icon={<ChatIcon />}
                                      size="md"
                                      colorScheme="blue"
                                      variant="solid"
                                      rounded="lg"
                                      onClick={() =>
                                        onGenerateComment(post?.id)
                                      }
                                      _hover={{ transform: "scale(1.05)" }}
                                    />
                                  </Tooltip>
                                )}

                                {post?.comment &&
                                  post?.status !== "replied" && (
                                    <>
                                      <Tooltip
                                        label="Manual reply (copy to clipboard)"
                                        hasArrow
                                      >
                                        <IconButton
                                          aria-label="Reply to post"
                                          icon={<CheckIcon />}
                                          size="md"
                                          colorScheme="green"
                                          variant="solid"
                                          rounded="lg"
                                          onClick={() => onReply(post?.id)}
                                          _hover={{ transform: "scale(1.05)" }}
                                        />
                                      </Tooltip>
                                      <Tooltip
                                        label="Auto-reply (automated posting)"
                                        hasArrow
                                      >
                                        <IconButton
                                          aria-label="Auto-reply to post"
                                          icon={<Box as="span">🤖</Box>}
                                          size="md"
                                          colorScheme="red"
                                          variant="solid"
                                          rounded="lg"
                                          onClick={() => onAutoReply(post?.id)}
                                          _hover={{ transform: "scale(1.05)" }}
                                        />
                                      </Tooltip>
                                    </>
                                  )}
                              </VStack>
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
