import { useState, useRef, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Badge,
  Input,
  Select,
  Card,
  CardBody,
  Icon,
  IconButton,
  Divider,
  useToast,
  Tooltip,
  Collapse,
  Switch,
  FormControl,
  FormLabel,
} from '@chakra-ui/react';
import {
  FaCheckCircle,
  FaTimesCircle,
  FaInfoCircle,
  FaExclamationTriangle,
  FaDownload,
  FaTrash,
  FaArrowDown,
  FaChevronDown,
  FaChevronRight,
  FaClock,
  FaLink,
  FaLayerGroup,
} from 'react-icons/fa';

function ActivityLogTab({ logs, onClearLogs }) {
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [timelineView, setTimelineView] = useState(true);
  const [groupByBatch, setGroupByBatch] = useState(true); // Enable by default
  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedDetails, setExpandedDetails] = useState({});
  const logContainerRef = useRef(null);
  const toast = useToast();

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Filter logs by type
  const filteredLogs = logs.filter(log => {
    // Filter by type
    if (filterType !== 'all' && log.type !== filterType) {
      return false;
    }

    // Filter by search query
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      return (
        log.title.toLowerCase().includes(searchLower) ||
        log.message.toLowerCase().includes(searchLower)
      );
    }

    return true;
  });

  // Group logs by batch number if enabled
  const groupedLogs = groupByBatch
    ? filteredLogs.reduce((groups, log) => {
        // Extract batch number from log title
        const batchMatch = log.title.match(/Batch (\d+)/);
        const groupKey = batchMatch ? `Batch ${batchMatch[1]}` : 'General';

        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }
        groups[groupKey].push(log);
        return groups;
      }, {})
    : { All: filteredLogs };

  // Calculate time elapsed between logs
  const getTimeElapsed = (currentLog, prevLog) => {
    if (!prevLog) return null;
    const current = new Date(currentLog.timestamp);
    const prev = new Date(prevLog.timestamp);
    const diff = current - prev;

    if (diff < 1000) return `${diff}ms`;
    if (diff < 60000) return `${Math.round(diff / 1000)}s`;
    return `${Math.round(diff / 60000)}m`;
  };

  // Toggle group expansion
  const toggleGroup = groupKey => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  // Toggle details expansion
  const toggleDetails = logId => {
    setExpandedDetails(prev => ({
      ...prev,
      [logId]: !prev[logId],
    }));
  };

  // Export logs to JSON
  const handleExportJSON = () => {
    const dataStr = JSON.stringify(logs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `activity-log-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Logs Exported',
      description: 'Activity log exported to JSON file',
      status: 'success',
      duration: 2000,
    });
  };

  // Export logs to CSV
  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Type', 'Title', 'Message'];
    const csvRows = [
      headers.join(','),
      ...logs.map(log => [log.timestamp, log.type, `"${log.title}"`, `"${log.message}"`].join(',')),
    ];
    const csvStr = csvRows.join('\n');
    const dataBlob = new Blob([csvStr], { type: 'text/csv' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `activity-log-${new Date().toISOString()}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Logs Exported',
      description: 'Activity log exported to CSV file',
      status: 'success',
      duration: 2000,
    });
  };

  // Get icon and color based on log type
  const getLogIcon = type => {
    switch (type) {
      case 'success':
        return { icon: FaCheckCircle, color: 'green.500' };
      case 'error':
        return { icon: FaTimesCircle, color: 'red.500' };
      case 'warning':
        return { icon: FaExclamationTriangle, color: 'orange.500' };
      case 'info':
      default:
        return { icon: FaInfoCircle, color: 'blue.500' };
    }
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  };

  return (
    <VStack spacing={4} align="stretch">
      {/* Header Controls */}
      <Card>
        <CardBody>
          <HStack spacing={4} wrap="wrap">
            {/* Filter by Type */}
            <Box>
              <Text fontSize="sm" mb={1} fontWeight="medium">
                Filter
              </Text>
              <Select
                size="sm"
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                width="150px"
              >
                <option value="all">All Types</option>
                <option value="success">Success</option>
                <option value="error">Error</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </Select>
            </Box>

            {/* Search */}
            <Box flex={1} minW="200px">
              <Text fontSize="sm" mb={1} fontWeight="medium">
                Search
              </Text>
              <Input
                size="sm"
                placeholder="Search logs..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </Box>

            {/* Export Buttons */}
            <Box>
              <Text fontSize="sm" mb={1} fontWeight="medium">
                Export
              </Text>
              <HStack>
                <Tooltip label="Export to JSON">
                  <Button
                    size="sm"
                    leftIcon={<Icon as={FaDownload} />}
                    onClick={handleExportJSON}
                    isDisabled={logs.length === 0}
                  >
                    JSON
                  </Button>
                </Tooltip>
                <Tooltip label="Export to CSV">
                  <Button
                    size="sm"
                    leftIcon={<Icon as={FaDownload} />}
                    onClick={handleExportCSV}
                    isDisabled={logs.length === 0}
                  >
                    CSV
                  </Button>
                </Tooltip>
              </HStack>
            </Box>

            {/* Clear Button */}
            <Box>
              <Text fontSize="sm" mb={1} fontWeight="medium">
                Actions
              </Text>
              <Button
                size="sm"
                colorScheme="red"
                leftIcon={<Icon as={FaTrash} />}
                onClick={onClearLogs}
                isDisabled={logs.length === 0}
              >
                Clear
              </Button>
            </Box>
          </HStack>

          {/* View Options */}
          <HStack mt={4} spacing={6} flexWrap="wrap">
            <FormControl display="flex" alignItems="center" width="auto">
              <FormLabel htmlFor="timeline-view" mb="0" fontSize="sm">
                Timeline View
              </FormLabel>
              <Switch
                id="timeline-view"
                isChecked={timelineView}
                onChange={e => setTimelineView(e.target.checked)}
                colorScheme="blue"
              />
            </FormControl>

            <FormControl display="flex" alignItems="center" width="auto">
              <FormLabel htmlFor="group-batch" mb="0" fontSize="sm">
                Group by Batch
              </FormLabel>
              <Switch
                id="group-batch"
                isChecked={groupByBatch}
                onChange={e => setGroupByBatch(e.target.checked)}
                colorScheme="purple"
              />
            </FormControl>

            <FormControl display="flex" alignItems="center" width="auto">
              <FormLabel htmlFor="auto-scroll" mb="0" fontSize="sm">
                Auto Scroll
              </FormLabel>
              <Switch
                id="auto-scroll"
                isChecked={autoScroll}
                onChange={e => setAutoScroll(e.target.checked)}
                colorScheme="green"
              />
            </FormControl>
          </HStack>

          {/* Stats */}
          <HStack mt={4} spacing={4}>
            <Badge colorScheme="blue">Total: {logs.length}</Badge>
            <Badge colorScheme="purple">Filtered: {filteredLogs.length}</Badge>
            <Badge colorScheme="green">
              Success: {logs.filter(l => l.type === 'success').length}
            </Badge>
            <Badge colorScheme="red">Errors: {logs.filter(l => l.type === 'error').length}</Badge>
          </HStack>
        </CardBody>
      </Card>

      {/* Log Entries */}
      <Card>
        <CardBody p={0}>
          <Box ref={logContainerRef} maxH="600px" overflowY="auto" position="relative" bg="gray.50">
            {filteredLogs.length === 0 ? (
              <Box p={8} textAlign="center">
                <Icon as={FaInfoCircle} boxSize={12} color="gray.400" mb={4} />
                <Text color="gray.500" fontSize="lg">
                  {logs.length === 0 ? 'No activity logs yet' : 'No logs match your filters'}
                </Text>
                <Text color="gray.400" fontSize="sm" mt={2}>
                  {logs.length === 0
                    ? 'Start automation to see activity logs here'
                    : 'Try adjusting your filter or search query'}
                </Text>
              </Box>
            ) : (
              <VStack spacing={0} align="stretch" p={4}>
                {Object.entries(groupedLogs).map(([groupKey, groupLogs]) => {
                  const isExpanded = expandedGroups[groupKey] !== false; // Default expanded

                  return (
                    <Box key={groupKey} mb={groupByBatch ? 4 : 0}>
                      {/* Group Header (only show if grouping by batch) */}
                      {groupByBatch && groupKey !== 'All' && (
                        <HStack
                          p={3}
                          bg="purple.100"
                          borderRadius="md"
                          cursor="pointer"
                          onClick={() => toggleGroup(groupKey)}
                          _hover={{ bg: 'purple.200' }}
                          mb={2}
                        >
                          <Icon
                            as={isExpanded ? FaChevronDown : FaChevronRight}
                            color="purple.700"
                          />
                          <Icon as={FaLayerGroup} color="purple.700" />
                          <Text fontWeight="bold" color="purple.700">
                            {groupKey}
                          </Text>
                          <Badge colorScheme="purple">{groupLogs.length} logs</Badge>
                        </HStack>
                      )}

                      {/* Log Entries */}
                      <Collapse in={isExpanded} animateOpacity>
                        <VStack spacing={0} align="stretch">
                          {groupLogs.map((log, index) => {
                            const { icon: LogIcon, color } = getLogIcon(log.type);
                            const isLastLog = index === groupLogs.length - 1;
                            const prevLog = index > 0 ? groupLogs[index - 1] : null;
                            const timeElapsed = getTimeElapsed(log, prevLog);
                            const hasDetails = log.details && Object.keys(log.details).length > 0;
                            const isDetailsExpanded = expandedDetails[log.id];

                            return (
                              <Box key={log.id}>
                                {/* Timeline Connector */}
                                {timelineView && index > 0 && (
                                  <HStack spacing={3} pl={3}>
                                    <Box width="20px" textAlign="center">
                                      <Box width="2px" height="20px" bg="gray.300" mx="auto" />
                                    </Box>
                                    {timeElapsed && (
                                      <HStack spacing={1}>
                                        <Icon as={FaClock} color="gray.400" boxSize={3} />
                                        <Text fontSize="xs" color="gray.500">
                                          +{timeElapsed}
                                        </Text>
                                      </HStack>
                                    )}
                                  </HStack>
                                )}

                                {/* Log Entry */}
                                <HStack
                                  align="start"
                                  spacing={3}
                                  p={3}
                                  bg={isLastLog && !groupByBatch ? 'blue.50' : 'white'}
                                  borderRadius="md"
                                  transition="all 0.2s"
                                  _hover={{ bg: 'gray.100' }}
                                  borderLeft={timelineView ? '4px solid' : 'none'}
                                  borderLeftColor={color}
                                >
                                  {/* Icon/Timeline Dot */}
                                  {timelineView ? (
                                    <Box
                                      width="20px"
                                      height="20px"
                                      borderRadius="full"
                                      bg={color}
                                      display="flex"
                                      alignItems="center"
                                      justifyContent="center"
                                      flexShrink={0}
                                    >
                                      <Icon as={LogIcon} color="white" boxSize={3} />
                                    </Box>
                                  ) : (
                                    <Icon as={LogIcon} color={color} boxSize={5} mt={0.5} />
                                  )}

                                  {/* Content */}
                                  <VStack align="start" spacing={1} flex={1}>
                                    <HStack spacing={2} wrap="wrap">
                                      <Text fontSize="xs" color="gray.500" fontFamily="mono">
                                        {log.timestamp}
                                      </Text>
                                      <Badge
                                        colorScheme={
                                          log.type === 'success'
                                            ? 'green'
                                            : log.type === 'error'
                                              ? 'red'
                                              : log.type === 'warning'
                                                ? 'orange'
                                                : 'blue'
                                        }
                                        size="sm"
                                      >
                                        {log.type}
                                      </Badge>
                                      {/* Show URL icon if log has URL in details */}
                                      {log.details?.url && (
                                        <Tooltip label={log.details.url}>
                                          <Icon as={FaLink} color="blue.500" boxSize={3} />
                                        </Tooltip>
                                      )}
                                    </HStack>

                                    <Text fontWeight="medium" fontSize="sm">
                                      {log.title}
                                    </Text>

                                    {log.message && (
                                      <Text fontSize="sm" color="gray.600">
                                        {log.message}
                                      </Text>
                                    )}

                                    {/* Collapsible Details */}
                                    {hasDetails && (
                                      <>
                                        <Button
                                          size="xs"
                                          variant="ghost"
                                          leftIcon={
                                            <Icon
                                              as={
                                                isDetailsExpanded ? FaChevronDown : FaChevronRight
                                              }
                                            />
                                          }
                                          onClick={() => toggleDetails(log.id)}
                                          colorScheme="blue"
                                        >
                                          {isDetailsExpanded ? 'Hide' : 'Show'} Details
                                        </Button>

                                        <Collapse in={isDetailsExpanded} animateOpacity>
                                          <Box
                                            p={2}
                                            bg="gray.100"
                                            borderRadius="md"
                                            fontSize="xs"
                                            fontFamily="mono"
                                            width="100%"
                                            mt={2}
                                          >
                                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                                              {JSON.stringify(log.details, null, 2)}
                                            </pre>
                                          </Box>
                                        </Collapse>
                                      </>
                                    )}
                                  </VStack>
                                </HStack>

                                {!timelineView && index < groupLogs.length - 1 && <Divider />}
                              </Box>
                            );
                          })}
                        </VStack>
                      </Collapse>
                    </Box>
                  );
                })}
              </VStack>
            )}

            {/* Scroll to Bottom Button */}
            {filteredLogs.length > 5 && (
              <Box position="sticky" bottom={4} textAlign="center" pointerEvents="none">
                <IconButton
                  icon={<Icon as={FaArrowDown} />}
                  size="sm"
                  colorScheme="blue"
                  borderRadius="full"
                  onClick={scrollToBottom}
                  pointerEvents="auto"
                  aria-label="Scroll to bottom"
                  boxShadow="lg"
                />
              </Box>
            )}
          </Box>
        </CardBody>
      </Card>
    </VStack>
  );
}

export default ActivityLogTab;
