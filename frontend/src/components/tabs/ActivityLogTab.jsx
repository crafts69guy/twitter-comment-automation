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
} from '@chakra-ui/react';
import {
  FaCheckCircle,
  FaTimesCircle,
  FaInfoCircle,
  FaExclamationTriangle,
  FaDownload,
  FaTrash,
  FaArrowDown,
} from 'react-icons/fa';

function ActivityLogTab({ logs, onClearLogs }) {
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
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
      ...logs.map(log =>
        [log.timestamp, log.type, `"${log.title}"`, `"${log.message}"`].join(',')
      ),
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

          {/* Stats */}
          <HStack mt={4} spacing={4}>
            <Badge colorScheme="blue">Total: {logs.length}</Badge>
            <Badge colorScheme="purple">Filtered: {filteredLogs.length}</Badge>
            <Badge colorScheme="green">
              Success: {logs.filter(l => l.type === 'success').length}
            </Badge>
            <Badge colorScheme="red">
              Errors: {logs.filter(l => l.type === 'error').length}
            </Badge>
          </HStack>
        </CardBody>
      </Card>

      {/* Log Entries */}
      <Card>
        <CardBody p={0}>
          <Box
            ref={logContainerRef}
            maxH="600px"
            overflowY="auto"
            position="relative"
            bg="gray.50"
          >
            {filteredLogs.length === 0 ? (
              <Box p={8} textAlign="center">
                <Icon as={FaInfoCircle} boxSize={12} color="gray.400" mb={4} />
                <Text color="gray.500" fontSize="lg">
                  {logs.length === 0
                    ? 'No activity logs yet'
                    : 'No logs match your filters'}
                </Text>
                <Text color="gray.400" fontSize="sm" mt={2}>
                  {logs.length === 0
                    ? 'Start automation to see activity logs here'
                    : 'Try adjusting your filter or search query'}
                </Text>
              </Box>
            ) : (
              <VStack spacing={0} align="stretch" p={4}>
                {filteredLogs.map((log, index) => {
                  const { icon: LogIcon, color } = getLogIcon(log.type);
                  const isLastLog = index === filteredLogs.length - 1;

                  return (
                    <Box key={log.id}>
                      <HStack
                        align="start"
                        spacing={3}
                        p={3}
                        bg={isLastLog ? 'blue.50' : 'white'}
                        borderRadius="md"
                        transition="all 0.2s"
                        _hover={{ bg: 'gray.100' }}
                      >
                        {/* Icon */}
                        <Icon as={LogIcon} color={color} boxSize={5} mt={0.5} />

                        {/* Content */}
                        <VStack align="start" spacing={1} flex={1}>
                          <HStack spacing={2}>
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
                          </HStack>

                          <Text fontWeight="medium" fontSize="sm">
                            {log.title}
                          </Text>

                          {log.message && (
                            <Text fontSize="sm" color="gray.600">
                              {log.message}
                            </Text>
                          )}

                          {log.details && (
                            <Box
                              p={2}
                              bg="gray.100"
                              borderRadius="md"
                              fontSize="xs"
                              fontFamily="mono"
                              width="100%"
                            >
                              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </Box>
                          )}
                        </VStack>
                      </HStack>

                      {index < filteredLogs.length - 1 && <Divider />}
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
