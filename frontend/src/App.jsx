/* eslint-disable no-unused-vars */
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
// const mockPosts = [
//   {
//     id: 1,
//     url: "https://twitter.com/elonmusk/status/1234567890",
//     content:
//       "The future of AI is incredibly exciting! We're making great progress with neural networks and machine learning algorithms.",
//     comment:
//       "Absolutely agree! The advancements in AI technology are truly remarkable. Looking forward to seeing how this transforms various industries.",
//     status: "commented",
//   },
//   {
//     id: 2,
//     url: "https://twitter.com/sundarpichai/status/1234567891",
//     content:
//       "Google's latest breakthrough in quantum computing represents a major milestone in computational science.",
//     comment: "",
//     status: "pending",
//   },
//   {
//     id: 3,
//     url: "https://twitter.com/satyanadella/status/1234567892",
//     content:
//       "Microsoft Azure's new AI capabilities are empowering developers worldwide to build more intelligent applications.",
//     comment:
//       "This is fantastic news! Azure's AI tools have been incredibly helpful for our development team. Excited to try the new features.",
//     status: "replied",
//   },
//   {
//     id: 4,
//     url: "https://twitter.com/jeffbezos/status/1234567893",
//     content:
//       "Blue Origin's latest mission was a success! Space exploration continues to push the boundaries of human achievement.",
//     comment:
//       "Congratulations on another successful mission! Space exploration is truly inspiring and opens up so many possibilities for humanity.",
//     status: "commented",
//   },
//   {
//     id: 5,
//     url: "https://twitter.com/tim_cook/status/1234567894",
//     content:
//       "Apple's commitment to privacy and user security remains our top priority as we innovate with new technologies.",
//     comment: "",
//     status: "pending",
//   },
// ];

function App() {
  const [posts, setPosts] = useState([]);
  const [settings, setSettings] = useState({
    googleSheetUrl:
      "https://docs.google.com/spreadsheets/d/1QxgUDfj8muLeEusj4s8AM0si0PH0ldmUwTK4R09kUfo/edit?usp=sharing",
    aiProvider: "gemini",
    maxTabs: 5,
    commentMaxLength: 50,
    additionalPrompt: "",
  });
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    checkHealth();
    loadSavedSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSavedSettings = () => {
    const savedSettings = localStorage.getItem("twitterAutomationSettings");
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(parsedSettings);
      } catch (error) {
        console.error("Error loading saved settings:", error);
      }
    }
  };

  const checkHealth = async () => {
    try {
      const response = await axios.get(`${API_URL}/health`);
      console.log("Server health:", response.data);
    } catch (_error) {
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
        description:
          response.data.message ||
          `Loaded ${response.data.posts.length} posts from Google Sheets`,
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
      const postIds = posts.map((post) => post.id);

      // Use real scraping endpoint with Puppeteer
      const response = await axios.post(`${API_URL}/scraper/scrape-posts`, {
        postIds,
        maxTabs: settings.maxTabs || 5,
      });

      // Refresh posts from the session
      const postsResponse = await axios.get(`${API_URL}/posts/current`);
      setPosts(postsResponse.data.posts);

      toast({
        title: "Content Scraped",
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
      // Use real AI endpoint
      const response = await axios.post(`${API_URL}/ai/generate`, {
        postId,
        provider: settings.aiProvider,
        maxLength: settings.commentMaxLength || 50,
        additionalPrompt: settings.additionalPrompt || "",
      });

      // Update the specific post with the generated comment
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === postId
            ? { ...post, comment: response.data.comment, status: "commented" }
            : post,
        ),
      );

      toast({
        title: "Comment Generated",
        description: `Generated using ${settings.aiProvider.toUpperCase()}`,
        status: "success",
        duration: 2000,
      });

      return response.data.comment; // Return the comment for use in generateAllComments
    } catch (error) {
      toast({
        title: "Error Generating Comment",
        description:
          error.response?.data?.message || "Failed to generate comment",
        status: "error",
        duration: 5000,
      });
      return null;
    }
  };

  const generateAllComments = async () => {
    const postsWithoutComments = posts.filter(
      (post) => !post.comment || post.comment.trim() === "",
    );

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
      // Use bulk generation endpoint - single AI request for all posts
      const postIds = postsWithoutComments.map((post) => post.id);
      const response = await axios.post(`${API_URL}/ai/generate-bulk`, {
        postIds,
        provider: settings.aiProvider,
        maxLength: settings.commentMaxLength || 50,
        additionalPrompt: settings.additionalPrompt || "",
      });

      // Update posts with the bulk generated comments
      setPosts((prevPosts) =>
        prevPosts.map((post) => {
          const generated = response.data.comments.find(
            (c) => c.postId === post.id,
          );
          if (generated) {
            return {
              ...post,
              comment: generated.comment,
              status: "commented",
              commentGeneratedAt: new Date().toISOString(),
            };
          }
          return post;
        }),
      );

      toast({
        title: "Bulk Generation Complete",
        description: `${response.data.message} (${response.data.stats.generated} comments generated)`,
        status: "success",
        duration: 4000,
      });
    } catch (error) {
      toast({
        title: "Bulk Generation Error",
        description:
          error.response?.data?.message ||
          "Failed to generate comments in bulk.",
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

    try {
      // Copy comment to clipboard
      await navigator.clipboard.writeText(post.comment);

      // Open Twitter post in new tab
      window.open(post.url, "_blank");

      // Update post status in backend
      await axios.patch(`${API_URL}/posts/${postId}`, {
        status: "replied",
        repliedAt: new Date().toISOString(),
      });

      // Update local state
      setPosts(
        posts.map((p) =>
          p.id === postId
            ? { ...p, status: "replied", repliedAt: new Date().toISOString() }
            : p,
        ),
      );

      toast({
        title: "Ready to Reply!",
        description:
          "Comment copied to clipboard. Paste it as a reply on Twitter/X.",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      // Fallback if clipboard access fails
      window.open(post.url, "_blank");

      setPosts(
        posts.map((p) =>
          p.id === postId
            ? { ...p, status: "replied", repliedAt: new Date().toISOString() }
            : p,
        ),
      );

      toast({
        title: "Reply Window Opened",
        description: `Comment: "${post.comment.substring(0, 100)}${
          post.comment.length > 100 ? "..." : ""
        }"`,
        status: "info",
        duration: 8000,
        isClosable: true,
      });
    }
  };

  const autoReplyToPost = async (postId) => {
    const post = posts.find((p) => p.id === postId);
    if (!post?.comment) {
      toast({
        title: "No Comment",
        description: "Generate a comment first before auto-replying",
        status: "warning",
        duration: 3000,
      });
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`${API_URL}/auto-reply/single`, {
        postId,
      });

      if (response.data.success) {
        // Refresh posts from session
        const postsResponse = await axios.get(`${API_URL}/posts/current`);
        setPosts(postsResponse.data.posts);

        toast({
          title: "Auto-Reply Successful!",
          description: "Comment posted automatically to Twitter/X.",
          status: "success",
          duration: 5000,
          isClosable: true,
        });
      } else {
        throw new Error(response.data.message || "Auto-reply failed");
      }
    } catch (error) {
      toast({
        title: "Auto-Reply Failed",
        description:
          error.response?.data?.message || "Failed to post reply automatically",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const autoReplyToAllPosts = async () => {
    const postsWithComments = posts.filter(
      (post) =>
        post.comment && post.comment.trim() !== "" && post.status !== "replied",
    );

    if (postsWithComments.length === 0) {
      toast({
        title: "No Posts to Auto-Reply",
        description: "All posts with comments have already been replied to.",
        status: "info",
        duration: 3000,
      });
      return;
    }

    setLoading(true);

    try {
      const postIds = postsWithComments.map((post) => post.id);
      const response = await axios.post(`${API_URL}/auto-reply/batch`, {
        postIds,
      });

      // Refresh posts from session
      const postsResponse = await axios.get(`${API_URL}/posts/current`);
      setPosts(postsResponse.data.posts);

      toast({
        title: "Auto-Reply All Complete",
        description: `${response.data.message} (${response.data.stats.successful} successful)`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: "Auto-Reply All Failed",
        description:
          error.response?.data?.message || "Failed to auto-reply to posts",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const enjoyAutomationAll = async () => {
    setLoading(true);

    try {
      // Step 1: Fetch posts from Google Sheets
      toast({
        title: "Step 1/4: Fetching Posts",
        description: "Loading posts from Google Sheets...",
        status: "info",
        duration: 3000,
      });

      const fetchResponse = await axios.post(`${API_URL}/google-sheets/fetch`, {
        sheetUrl: settings.googleSheetUrl,
      });
      setPosts(fetchResponse.data.posts);

      if (fetchResponse.data.posts.length === 0) {
        toast({
          title: "No Posts Found",
          description: "No posts were found in the Google Sheet.",
          status: "warning",
          duration: 3000,
        });
        return;
      }

      // Step 2: Scrape content from Twitter
      toast({
        title: "Step 2/4: Scraping Content",
        description: "Extracting content from Twitter posts...",
        status: "info",
        duration: 3000,
      });

      const postIds = fetchResponse.data.posts.map((post) => post.id);
      await axios.post(`${API_URL}/scraper/scrape-posts`, {
        postIds,
        maxTabs: settings.maxTabs || 5,
      });

      // Step 3: Generate comments for all posts
      toast({
        title: "Step 3/4: Generating Comments",
        description: "Creating AI-powered comments for all posts...",
        status: "info",
        duration: 3000,
      });

      const bulkResponse = await axios.post(`${API_URL}/ai/generate-bulk`, {
        postIds,
        provider: settings.aiProvider,
        maxLength: settings.commentMaxLength || 50,
        additionalPrompt: settings.additionalPrompt || "",
      });

      // Step 4: Auto-reply to all posts
      toast({
        title: "Step 4/4: Auto-Replying",
        description: "Posting comments to Twitter...",
        status: "info",
        duration: 3000,
      });

      const replyResponse = await axios.post(`${API_URL}/auto-reply/batch`, {
        postIds,
      });

      // Refresh posts from session to get final status
      const postsResponse = await axios.get(`${API_URL}/posts/current`);
      setPosts(postsResponse.data.posts);

      // Show final success message
      toast({
        title: "🎉 Full Automation Complete!",
        description: `Successfully processed ${replyResponse.data.stats.successful} posts from fetching to auto-replying!`,
        status: "success",
        duration: 8000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: "Automation Failed",
        description:
          error.response?.data?.message ||
          "An error occurred during the automation process",
        status: "error",
        duration: 5000,
        isClosable: true,
      });

      // Try to refresh posts to show current status
      try {
        const postsResponse = await axios.get(`${API_URL}/posts/current`);
        setPosts(postsResponse.data.posts);
      } catch (refreshError) {
        console.error("Failed to refresh posts:", refreshError);
      }
    } finally {
      setLoading(false);
    }
  };

  // const replyToAllPosts = async () => {
  //   const postsWithComments = posts.filter(
  //     (post) =>
  //       post.comment && post.comment.trim() !== "" && post.status !== "replied",
  //   );
  //
  //   if (postsWithComments.length === 0) {
  //     toast({
  //       title: "No Posts to Reply",
  //       description: "All posts with comments have already been replied to.",
  //       status: "info",
  //       duration: 3000,
  //     });
  //     return;
  //   }
  //
  //   setLoading(true);
  //
  //   try {
  //     // Process each post
  //     for (const post of postsWithComments) {
  //       await replyToPost(post.id);
  //       // Add delay between replies to avoid overwhelming
  //       await new Promise((resolve) => setTimeout(resolve, 1000));
  //     }
  //
  //     toast({
  //       title: "Bulk Reply Complete",
  //       description: `Opened ${postsWithComments.length} posts for replying!`,
  //       status: "success",
  //       duration: 4000,
  //     });
  //   } catch (error) {
  //     toast({
  //       title: "Bulk Reply Error",
  //       description:
  //         "Some posts may not have been processed. Please try individual replies.",
  //       status: "error",
  //       duration: 5000,
  //     });
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  return (
    <Box bg="gray.50" minH="100vh" minW="100vw">
      <Container width="100%" maxW="100%" py={8}>
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
                  // onReplyAll={replyToAllPosts}
                  onAutoReply={autoReplyToPost}
                  onAutoReplyAll={autoReplyToAllPosts}
                  onEnjoyAutomationAll={enjoyAutomationAll}
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
