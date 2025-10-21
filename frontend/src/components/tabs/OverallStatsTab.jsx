import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Progress,
  Card,
  CardBody,
  Divider,
  Badge,
  Icon
} from '@chakra-ui/react';
import { FaCheckCircle, FaTimesCircle, FaLayerGroup, FaLink } from 'react-icons/fa';

function OverallStatsTab({ stats }) {
  const {
    totalBatchesCompleted = 0,
    totalLinksProcessed = 0,
    totalSuccessful = 0,
    totalFailed = 0,
    totalBatches = 0,
    pendingBatches = 0
  } = stats;

  const successRate = totalLinksProcessed > 0
    ? ((totalSuccessful / totalLinksProcessed) * 100).toFixed(1)
    : 0;

  const failureRate = totalLinksProcessed > 0
    ? ((totalFailed / totalLinksProcessed) * 100).toFixed(1)
    : 0;

  const batchCompletionRate = totalBatches > 0
    ? ((totalBatchesCompleted / totalBatches) * 100).toFixed(1)
    : 0;

  return (
    <VStack spacing={6} align="stretch">

      {/* Header */}
      <Box>
        <Heading size="md" mb={2}>Overall Statistics</Heading>
        <Text fontSize="sm" color="gray.600">
          Complete overview of your automation performance
        </Text>
      </Box>

      {/* Main Stats Cards */}
      <SimpleGrid columns={[1, 2, 4]} spacing={6}>
        <Card>
          <CardBody>
            <Stat>
              <HStack spacing={3} mb={2}>
                <Box p={2} bg="blue.100" borderRadius="md">
                  <Icon as={FaLayerGroup} color="blue.600" boxSize={5} />
                </Box>
                <StatLabel fontSize="md">Total Batches</StatLabel>
              </HStack>
              <StatNumber fontSize="3xl">{totalBatches}</StatNumber>
              <StatHelpText>
                {totalBatchesCompleted} completed, {pendingBatches} pending
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <Stat>
              <HStack spacing={3} mb={2}>
                <Box p={2} bg="purple.100" borderRadius="md">
                  <Icon as={FaLink} color="purple.600" boxSize={5} />
                </Box>
                <StatLabel fontSize="md">Links Processed</StatLabel>
              </HStack>
              <StatNumber fontSize="3xl">{totalLinksProcessed}</StatNumber>
              <StatHelpText>
                Total links handled
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <Stat>
              <HStack spacing={3} mb={2}>
                <Box p={2} bg="green.100" borderRadius="md">
                  <Icon as={FaCheckCircle} color="green.600" boxSize={5} />
                </Box>
                <StatLabel fontSize="md">Successful</StatLabel>
              </HStack>
              <StatNumber fontSize="3xl" color="green.600">
                {totalSuccessful}
              </StatNumber>
              <StatHelpText>
                <StatArrow type="increase" />
                {successRate}% success rate
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <Stat>
              <HStack spacing={3} mb={2}>
                <Box p={2} bg="red.100" borderRadius="md">
                  <Icon as={FaTimesCircle} color="red.600" boxSize={5} />
                </Box>
                <StatLabel fontSize="md">Failed</StatLabel>
              </HStack>
              <StatNumber fontSize="3xl" color="red.600">
                {totalFailed}
              </StatNumber>
              <StatHelpText>
                <StatArrow type="decrease" />
                {failureRate}% failure rate
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Progress Visualization */}
      <Card>
        <CardBody>
          <Heading size="sm" mb={4}>Processing Overview</Heading>

          {/* Batch Progress */}
          <Box mb={6}>
            <HStack justify="space-between" mb={2}>
              <Text fontSize="sm" fontWeight="medium">Batch Completion</Text>
              <Badge colorScheme="blue">{batchCompletionRate}%</Badge>
            </HStack>
            <Progress
              value={parseFloat(batchCompletionRate)}
              size="lg"
              colorScheme="blue"
              borderRadius="md"
            />
            <HStack justify="space-between" mt={2} fontSize="sm" color="gray.600">
              <Text>{totalBatchesCompleted} batches completed</Text>
              <Text>{totalBatches} total batches</Text>
            </HStack>
          </Box>

          <Divider my={4} />

          {/* Success/Failure Breakdown */}
          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={3}>Link Success Rate</Text>

            <VStack spacing={3} align="stretch">
              {/* Success Bar */}
              <Box>
                <HStack justify="space-between" mb={1}>
                  <HStack>
                    <Badge colorScheme="green">Success</Badge>
                    <Text fontSize="sm" color="gray.600">{totalSuccessful} links</Text>
                  </HStack>
                  <Text fontSize="sm" fontWeight="medium">{successRate}%</Text>
                </HStack>
                <Progress
                  value={parseFloat(successRate)}
                  size="md"
                  colorScheme="green"
                  borderRadius="md"
                />
              </Box>

              {/* Failure Bar */}
              <Box>
                <HStack justify="space-between" mb={1}>
                  <HStack>
                    <Badge colorScheme="red">Failed</Badge>
                    <Text fontSize="sm" color="gray.600">{totalFailed} links</Text>
                  </HStack>
                  <Text fontSize="sm" fontWeight="medium">{failureRate}%</Text>
                </HStack>
                <Progress
                  value={parseFloat(failureRate)}
                  size="md"
                  colorScheme="red"
                  borderRadius="md"
                />
              </Box>
            </VStack>
          </Box>
        </CardBody>
      </Card>

      {/* Performance Metrics */}
      <Card>
        <CardBody>
          <Heading size="sm" mb={4}>Performance Metrics</Heading>

          <SimpleGrid columns={[1, 3]} spacing={4}>
            <Box p={4} bg="gray.50" borderRadius="md">
              <Text fontSize="sm" color="gray.600" mb={1}>Avg Success per Batch</Text>
              <Text fontSize="2xl" fontWeight="bold">
                {totalBatchesCompleted > 0
                  ? (totalSuccessful / totalBatchesCompleted).toFixed(1)
                  : 0}
              </Text>
            </Box>

            <Box p={4} bg="gray.50" borderRadius="md">
              <Text fontSize="sm" color="gray.600" mb={1}>Avg Failures per Batch</Text>
              <Text fontSize="2xl" fontWeight="bold">
                {totalBatchesCompleted > 0
                  ? (totalFailed / totalBatchesCompleted).toFixed(1)
                  : 0}
              </Text>
            </Box>

            <Box p={4} bg="gray.50" borderRadius="md">
              <Text fontSize="sm" color="gray.600" mb={1}>Links per Batch</Text>
              <Text fontSize="2xl" fontWeight="bold">
                {totalBatchesCompleted > 0
                  ? (totalLinksProcessed / totalBatchesCompleted).toFixed(1)
                  : 0}
              </Text>
            </Box>
          </SimpleGrid>
        </CardBody>
      </Card>

      {/* Summary Card */}
      {totalLinksProcessed > 0 && (
        <Card bg={parseFloat(successRate) >= 80 ? 'green.50' : parseFloat(successRate) >= 50 ? 'yellow.50' : 'red.50'}>
          <CardBody>
            <HStack spacing={4}>
              <Icon
                as={parseFloat(successRate) >= 80 ? FaCheckCircle : FaTimesCircle}
                boxSize={8}
                color={parseFloat(successRate) >= 80 ? 'green.500' : parseFloat(successRate) >= 50 ? 'yellow.600' : 'red.500'}
              />
              <Box>
                <Heading size="sm" mb={1}>
                  {parseFloat(successRate) >= 80
                    ? 'Excellent Performance! 🎉'
                    : parseFloat(successRate) >= 50
                    ? 'Good Progress'
                    : 'Needs Attention'}
                </Heading>
                <Text fontSize="sm" color="gray.700">
                  {parseFloat(successRate) >= 80
                    ? 'Your automation is running smoothly with high success rate.'
                    : parseFloat(successRate) >= 50
                    ? 'Automation is working but could be improved.'
                    : 'Consider reviewing failed links to improve success rate.'}
                </Text>
              </Box>
            </HStack>
          </CardBody>
        </Card>
      )}
    </VStack>
  );
}

export default OverallStatsTab;
