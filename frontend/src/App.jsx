/* eslint-disable no-unused-vars */
import { useState, useEffect, useCallback } from "react";
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

// When running with Docker, use relative path for API calls (nginx will proxy to backend)
// When running locally without Docker, use localhost:3001
const API_URL =
  window.location.hostname === "localhost" &&
  window.location.port !== "80" &&
  window.location.port !== ""
    ? "http://localhost:3001/api" // Development mode (npm run dev)
    : "/api"; // Production/Docker mode (nginx proxy)

axios.defaults.withCredentials = true;

function App() {
  const [posts, setPosts] = useState([]);
  const [settings, setSettings] = useState({
    googleSheetUrl:
      "https://docs.google.com/spreadsheets/d/1QxgUDfj8muLeEusj4s8AM0si0PH0ldmUwTK4R09kUfo/edit?usp=sharing",
    aiProvider: "gemini",
    maxTabs: 5,
    commentMaxLength: 50,
    additionalPrompt: "",
    twitterCookies: "",
    twitterBearerToken: "",
    scheduledAutomation: {
      enabled: false,
      intervalMinutes: 20,
      batchSize: 10,
      startImmediately: true,
    },
  });
  const [loading, setLoading] = useState(false);
  const [scheduledState, setScheduledState] = useState({
    isActive: false,
    nextRunTime: null,
    timeRemaining: 0,
    currentCycle: 0,
    totalProcessed: 0,
  });
  const toast = useToast();

  useEffect(() => {
    checkHealth();
    loadSavedSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load scheduled automation state from localStorage
  useEffect(() => {
    const savedScheduledState = localStorage.getItem(
      "scheduledAutomationState",
    );
    if (savedScheduledState) {
      try {
        const parsed = JSON.parse(savedScheduledState);
        if (parsed.isActive && parsed.nextRunTime > new Date().getTime()) {
          setScheduledState(parsed);
        }
      } catch (error) {
        console.error("Error loading scheduled state:", error);
      }
    }
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

  const fetchPostsWithTwitterAPI = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/automation/fetch-and-generate`,
        {
          sheetUrl: settings.googleSheetUrl,
          cookies: settings.twitterCookies,
          bearerToken: settings.twitterBearerToken,
          aiProvider: settings.aiProvider,
          maxLength: settings.commentMaxLength,
          additionalPrompt: settings.additionalPrompt,
        },
      );
      setPosts(response.data.posts);

      const { stats } = response.data;
      const hasErrors = stats.twitterApiErrors > 0;

      toast({
        title: hasErrors ? "Posts Fetched with Warnings" : "Posts Fetched Successfully",
        description: response.data.message,
        status: hasErrors ? "warning" : "success",
        duration: 6000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: "Error Fetching Posts",
        description:
          error.response?.data?.message ||
          "Failed to fetch posts with Twitter API",
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

  const scheduleNextRun = useCallback(() => {
    const intervalMs =
      (settings.scheduledAutomation.intervalMinutes || 20) * 60 * 1000;
    const nextRunTime = new Date().getTime() + intervalMs;

    const newState = {
      ...scheduledState,
      nextRunTime,
      timeRemaining: intervalMs,
    };

    setScheduledState(newState);
    localStorage.setItem("scheduledAutomationState", JSON.stringify(newState));
  }, [scheduledState, settings.scheduledAutomation.intervalMinutes]);

  const runScheduledAutomation = useCallback(
    async (isImmediateRun = false) => {
      try {
        const batchSize = settings.scheduledAutomation.batchSize || 10;

        // Fetch current posts to work with
        let currentPosts = posts;
        if (currentPosts.length === 0) {
          const fetchResponse = await axios.post(
            `${API_URL}/google-sheets/fetch`,
            {
              sheetUrl: settings.googleSheetUrl,
            },
          );
          currentPosts = fetchResponse.data.posts;
          setPosts(currentPosts);
        }

        // Find posts that need processing (pending or have content but no comments)
        const postsToProcess = currentPosts
          .filter(
            (post) =>
              post.status === "pending" ||
              (post.content && (!post.comment || post.comment.trim() === "")),
          )
          .slice(0, batchSize);

        if (postsToProcess.length === 0) {
          if (!isImmediateRun) {
            toast({
              title: "Scheduled Run Complete",
              description: "No posts require processing at this time.",
              status: "info",
              duration: 3000,
            });
            scheduleNextRun();
          }
          return;
        }

        toast({
          title: `🤖 Scheduled Automation Running`,
          description: `Processing ${postsToProcess.length} posts...`,
          status: "info",
          duration: 3000,
        });

        const postIds = postsToProcess.map((post) => post.id);

        // Step 1: Scrape content if needed
        const postsNeedingScraping = postsToProcess.filter(
          (post) => !post.content,
        );
        if (postsNeedingScraping.length > 0) {
          await axios.post(`${API_URL}/scraper/scrape-posts`, {
            postIds: postsNeedingScraping.map((p) => p.id),
            maxTabs: settings.maxTabs || 5,
          });
        }

        // Step 2: Generate comments
        const postsNeedingComments = postsToProcess.filter(
          (post) => !post.comment || post.comment.trim() === "",
        );
        if (postsNeedingComments.length > 0) {
          await axios.post(`${API_URL}/ai/generate-bulk`, {
            postIds: postsNeedingComments.map((p) => p.id),
            provider: settings.aiProvider,
            maxLength: settings.commentMaxLength || 50,
            additionalPrompt: settings.additionalPrompt || "",
          });
        }

        // Step 3: Auto-reply
        await axios.post(`${API_URL}/auto-reply/batch`, {
          postIds,
        });

        // Refresh posts
        const postsResponse = await axios.get(`${API_URL}/posts/current`);
        setPosts(postsResponse.data.posts);

        // Update scheduled state
        setScheduledState((prev) => ({
          ...prev,
          currentCycle: prev.currentCycle + 1,
          totalProcessed: prev.totalProcessed + postsToProcess.length,
        }));

        if (!isImmediateRun) {
          toast({
            title: "✅ Scheduled Run Complete",
            description: `Processed ${postsToProcess.length} posts successfully!`,
            status: "success",
            duration: 5000,
            isClosable: true,
          });

          scheduleNextRun();
        }
      } catch (error) {
        if (!isImmediateRun) {
          toast({
            title: "Scheduled Automation Error",
            description:
              error.response?.data?.message || "Error during scheduled run",
            status: "error",
            duration: 5000,
            isClosable: true,
          });
          scheduleNextRun();
        } else {
          // For immediate runs, just throw the error to be handled by the caller
          throw error;
        }
      }
    },
    [
      posts,
      scheduleNextRun,
      settings.additionalPrompt,
      settings.aiProvider,
      settings.commentMaxLength,
      settings.googleSheetUrl,
      settings.maxTabs,
      settings.scheduledAutomation.batchSize,
      toast,
    ],
  );

  // Timer effect for scheduled automation
  useEffect(() => {
    let interval;

    if (scheduledState.isActive && scheduledState.nextRunTime) {
      interval = setInterval(() => {
        const now = new Date().getTime();
        const timeLeft = scheduledState.nextRunTime - now;

        if (timeLeft <= 0) {
          // Time to run automation
          runScheduledAutomation();
        } else {
          // Update countdown
          setScheduledState((prev) => ({
            ...prev,
            timeRemaining: timeLeft,
          }));
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [
    runScheduledAutomation,
    scheduledState.isActive,
    scheduledState.nextRunTime,
  ]);

  const startScheduledAutomation = async () => {
    const shouldStartImmediately =
      settings.scheduledAutomation.startImmediately;
    const intervalMs =
      (settings.scheduledAutomation.intervalMinutes || 20) * 60 * 1000;

    if (shouldStartImmediately) {
      // Run automation immediately first
      toast({
        title: "🚀 Starting Immediate Run",
        description:
          "Running first automation cycle now, then scheduling future runs...",
        status: "info",
        duration: 3000,
      });

      try {
        // Run the automation immediately
        await runScheduledAutomation(true);

        // After immediate run, set up the regular schedule
        const newState = {
          isActive: true,
          nextRunTime: new Date().getTime() + intervalMs,
          timeRemaining: intervalMs,
          currentCycle: 1, // Already completed one cycle
          totalProcessed: 0, // Will be updated by runScheduledAutomation
        };

        setScheduledState(newState);
        localStorage.setItem(
          "scheduledAutomationState",
          JSON.stringify(newState),
        );

        toast({
          title: "✅ Immediate Run Complete + Scheduler Active",
          description: `First cycle complete! Now running every ${settings.scheduledAutomation.intervalMinutes} minutes with ${settings.scheduledAutomation.batchSize} posts per batch`,
          status: "success",
          duration: 5000,
          isClosable: true,
        });
      } catch (error) {
        toast({
          title: "Immediate Run Failed",
          description:
            "Failed to run immediate automation, but scheduler will still start",
          status: "warning",
          duration: 5000,
        });

        // Still start the scheduler even if immediate run fails
        const newState = {
          isActive: true,
          nextRunTime: new Date().getTime() + intervalMs,
          timeRemaining: intervalMs,
          currentCycle: 0,
          totalProcessed: 0,
        };

        setScheduledState(newState);
        localStorage.setItem(
          "scheduledAutomationState",
          JSON.stringify(newState),
        );
      }
    } else {
      // Standard behavior - wait for first interval
      const newState = {
        isActive: true,
        nextRunTime: new Date().getTime() + intervalMs,
        timeRemaining: intervalMs,
        currentCycle: 0,
        totalProcessed: 0,
      };

      setScheduledState(newState);
      localStorage.setItem(
        "scheduledAutomationState",
        JSON.stringify(newState),
      );

      toast({
        title: "🕐 Scheduled Automation Started",
        description: `Will run every ${settings.scheduledAutomation.intervalMinutes} minutes with ${settings.scheduledAutomation.batchSize} posts per batch`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const stopScheduledAutomation = () => {
    setScheduledState({
      isActive: false,
      nextRunTime: null,
      timeRemaining: 0,
      currentCycle: 0,
      totalProcessed: 0,
    });
    localStorage.removeItem("scheduledAutomationState");

    toast({
      title: "⏹️ Scheduled Automation Stopped",
      description: "Automatic processing has been disabled",
      status: "info",
      duration: 3000,
    });
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
                <Settings
                  settings={settings}
                  onUpdate={handleSettingsUpdate}
                  scheduledState={scheduledState}
                  onStartScheduled={startScheduledAutomation}
                  onStopScheduled={stopScheduledAutomation}
                />
              </TabPanel>
              <TabPanel px={0}>
                <PostsTable
                  posts={posts}
                  onFetchPosts={fetchPosts}
                  onFetchPostsWithTwitterAPI={fetchPostsWithTwitterAPI}
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
                  scheduledState={scheduledState}
                  onStartScheduled={startScheduledAutomation}
                  onStopScheduled={stopScheduledAutomation}
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
