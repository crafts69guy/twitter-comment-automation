import { useState, useEffect } from "react";
import {
  Box,
  Container,
  Heading,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  useToast,
  VStack,
  Text,
} from "@chakra-ui/react";
import Settings from "./components/Settings";
import PostsTable from "./components/PostsTable";
import axios from "axios";

const API_URL = "http://localhost:3001/api";

axios.defaults.withCredentials = true;

// Mock data for demonstration
const mockPosts = [
  {
    id: 1,
    url: "https://twitter.com/elonmusk/status/1234567890",
    content: "The future of AI is incredibly exciting! We're making great progress with neural networks and machine learning algorithms.",
    comment: "Absolutely agree! The advancements in AI technology are truly remarkable. Looking forward to seeing how this transforms various industries.",
    status: "commented"
  },
  {
    id: 2,
    url: "https://twitter.com/sundarpichai/status/1234567891",
    content: "Google's latest breakthrough in quantum computing represents a major milestone in computational science.",
    comment: "",
    status: "pending"
  },
  {
    id: 3,
    url: "https://twitter.com/satyanadella/status/1234567892",
    content: "Microsoft Azure's new AI capabilities are empowering developers worldwide to build more intelligent applications.",
    comment: "This is fantastic news! Azure's AI tools have been incredibly helpful for our development team. Excited to try the new features.",
    status: "replied"
  },
  {
    id: 4,
    url: "https://twitter.com/jeffbezos/status/1234567893",
    content: "Blue Origin's latest mission was a success! Space exploration continues to push the boundaries of human achievement.",
    comment: "Congratulations on another successful mission! Space exploration is truly inspiring and opens up so many possibilities for humanity.",
    status: "commented"
  },
  {
    id: 5,
    url: "https://twitter.com/tim_cook/status/1234567894",
    content: "Apple's commitment to privacy and user security remains our top priority as we innovate with new technologies.",
    comment: "",
    status: "pending"
  }
];

function App() {
  const [posts, setPosts] = useState(mockPosts);
  const [settings, setSettings] = useState({
    googleSheetUrl: "https://docs.google.com/spreadsheets/d/1ABC123-example-sheet-id/edit",
    aiProvider: "openai",
    apiKey: "sk-demo1234567890abcdef",
  });
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    checkHealth();
    loadSavedSettings();
  }, []);

  const loadSavedSettings = () => {
    const savedSettings = localStorage.getItem('twitterAutomationSettings');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(parsedSettings);
      } catch (error) {
        console.error('Error loading saved settings:', error);
      }
    }
  };

  const checkHealth = async () => {
    try {
      const response = await axios.get(`${API_URL}/health`);
      console.log("Server health:", response.data);
    } catch (error) {
      toast({
        title: "Server Connection Error",
        description:
          "Cannot connect to backend server. Make sure it's running on port 3001.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleSettingsUpdate = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem(
      "twitterAutomationSettings",
      JSON.stringify(newSettings),
    );
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/google-sheets/fetch`, {
        sheetUrl: settings.googleSheetUrl,
      });
      setPosts(response.data.posts);
      toast({
        title: "Posts Fetched",
        description: response.data.message || `Loaded ${response.data.posts.length} posts from Google Sheets`,
        status: "success",
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "Error Fetching Posts",
        description:
          error.response?.data?.message ||
          "Failed to fetch posts from Google Sheets",
        status: "error",
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const scrapeContent = async () => {
    setLoading(true);
    try {
      const postIds = posts.map(post => post.id);
      const response = await axios.post(`${API_URL}/scraper/scrape-demo`, {
        postIds
      });

      // Refresh posts from the session
      const postsResponse = await axios.get(`${API_URL}/posts/current`);
      setPosts(postsResponse.data.posts);

      toast({
        title: "Content Scraped (Demo Mode)",
        description: response.data.message,
        status: "success",
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "Error Scraping Content",
        description:
          error.response?.data?.message || "Failed to scrape post content",
        status: "error",
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const generateComment = async (postId) => {
    try {
      // Use demo endpoint for contextual comments
      const response = await axios.post(`${API_URL}/ai/generate-demo`, {
        postId
      });

      // Refresh posts from session to get updated data
      const postsResponse = await axios.get(`${API_URL}/posts/current`);
      setPosts(postsResponse.data.posts);

      toast({
        title: "Comment Generated (Demo Mode)",
        description: response.data.message || "AI-powered comment generated successfully!",
        status: "success",
        duration: 2000,
      });

      // Uncomment below for real AI integration with OpenAI/Claude:
      /*
      const response = await axios.post(`${API_URL}/ai/generate`, {
        postId,
        provider: settings.aiProvider,
        apiKey: settings.apiKey,
      });

      const postsResponse = await axios.get(`${API_URL}/posts/current`);
      setPosts(postsResponse.data.posts);

      toast({
        title: "Comment Generated",
        description: `Generated using ${settings.aiProvider.toUpperCase()}`,
        status: "success",
        duration: 2000,
      });
      */

    } catch (error) {
      toast({
        title: "Error Generating Comment",
        description:
          error.response?.data?.message || "Failed to generate comment",
        status: "error",
        duration: 5000,
      });
    }
  };

  const generateAllComments = async () => {
    const postsWithoutComments = posts.filter(post => !post.comment || post.comment.trim() === '');

    if (postsWithoutComments.length === 0) {
      toast({
        title: "All Comments Generated",
        description: "All posts already have comments generated!",
        status: "info",
        duration: 3000,
      });
      return;
    }

    setLoading(true);

    try {
      // Generate comments for all posts without comments
      for (const post of postsWithoutComments) {
        await generateComment(post.id);
        // Add small delay between requests to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      toast({
        title: "Bulk Generation Complete",
        description: `Generated comments for ${postsWithoutComments.length} posts!`,
        status: "success",
        duration: 4000,
      });
    } catch (error) {
      toast({
        title: "Bulk Generation Error",
        description: "Some comments may not have been generated. Please try individual generation.",
        status: "error",
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const replyToPost = async (postId) => {
    const post = posts.find((p) => p.id === postId);
    if (!post?.comment) {
      toast({
        title: "No Comment",
        description: "Generate a comment first before replying",
        status: "warning",
        duration: 3000,
      });
      return;
    }

    window.open(post.url, "_blank");

    setPosts(
      posts.map((p) => (p.id === postId ? { ...p, status: "replied" } : p)),
    );
  };

  return (
    <Box bg="gray.50" minH="100vh" minW="100vw">
      <Container maxW="container.xl" py={8}>
        <VStack spacing={8} align="stretch">
          <Box textAlign="center" mb={6}>
            <Heading size="2xl" mb={4} color="blue.600" fontWeight="bold">
              Twitter Comment Automation
            </Heading>
            <Text fontSize="lg" color="gray.600">
              Automate Twitter comment generation with AI-powered responses
            </Text>
          </Box>

          <Tabs
            colorScheme="blue"
            variant="enclosed"
            bg="white"
            rounded="xl"
            shadow="lg"
            p={6}
          >
            <TabList mb={6}>
              <Tab
                fontSize="lg"
                fontWeight="medium"
                _selected={{
                  color: "blue.600",
                  borderColor: "blue.500",
                  bg: "blue.50",
                }}
                px={8}
                py={4}
                mr={2}
              >
                ⚙️ Settings
              </Tab>
              <Tab
                fontSize="lg"
                fontWeight="medium"
                _selected={{
                  color: "blue.600",
                  borderColor: "blue.500",
                  bg: "blue.50",
                }}
                px={8}
                py={4}
              >
                📝 Posts Management
              </Tab>
            </TabList>

            <TabPanels>
              <TabPanel px={0}>
                <Settings settings={settings} onUpdate={handleSettingsUpdate} />
              </TabPanel>
              <TabPanel px={0}>
                <PostsTable
                  posts={posts}
                  onFetchPosts={fetchPosts}
                  onScrapeContent={scrapeContent}
                  onGenerateComment={generateComment}
                  onGenerateAllComments={generateAllComments}
                  onReply={replyToPost}
                  loading={loading}
                  hasSettings={!!settings.googleSheetUrl}
                />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </VStack>
      </Container>
    </Box>
  );
}

export default App;

