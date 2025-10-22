// Simple and effective comment truncation that keeps as many complete sentences as possible
function smartTruncateComment(comment, charLimit) {
  if (comment.length <= charLimit) {
    return comment;
  }

  // Clean up the comment
  comment = comment.trim();

  // Strategy 1: Try to keep complete sentences
  const sentences = comment.split(/(?<=[.!?])\s+/);
  let result = '';

  for (const sentence of sentences) {
    const testLength = result.length + sentence.length + (result ? ' ' : '');
    if (testLength <= charLimit) {
      result += (result ? ' ' : '') + sentence;
    } else {
      break;
    }
  }

  // If we have a good result (at least 50% of original), return it
  if (result.length > 0 && result.length >= comment.length * 0.5) {
    return result;
  }

  // Strategy 2: Try to keep complete words
  const words = comment.split(/\s+/);
  result = '';

  for (const word of words) {
    const testLength = result.length + word.length + (result ? ' ' : '');
    if (testLength <= charLimit) {
      result += (result ? ' ' : '') + word;
    } else {
      break;
    }
  }

  // If we have a reasonable result, return it
  if (result.length > 0) {
    return result;
  }

  // Strategy 3: Last resort - truncate at character boundary
  return comment.substring(0, charLimit - 3).trim() + '...';
}

// Helper function to validate and retry comment
export async function validateComment(comment, charLimit, retryCount, retryFn) {
  if (comment.length > charLimit && retryCount < 2) {
    console.log(
      `⚠️ Comment too long (${comment.length} chars), retrying attempt ${retryCount + 1}/2...`,
    );
    return await retryFn(retryCount + 1);
  }

  // If comment is still too long after retries, smart truncate it
  if (comment.length > charLimit) {
    const originalLength = comment.length;
    comment = smartTruncateComment(comment, charLimit);
    console.log(
      `✂️ Comment truncated from ${originalLength} to ${comment.length} chars (${charLimit} limit)`,
    );
  }

  // Ensure it doesn't exceed Twitter's hard limit
  if (comment.length > 280) {
    const originalLength = comment.length;
    comment = smartTruncateComment(comment, 280);
    console.log(
      `✂️ Comment truncated from ${originalLength} to ${comment.length} chars (Twitter 280 limit)`,
    );
  }

  console.log(
    `✅ Comment generated successfully (${comment.length}/${charLimit} chars)${retryCount > 0 ? ` after ${retryCount + 1} attempts` : ''}`,
  );

  return comment;
}

// Helper function to validate bulk comments response
export function validateBulkComments(parsedComments, posts, charLimit) {
  if (!Array.isArray(parsedComments)) {
    throw new Error('AI response was not an array');
  }

  const results = posts.map((post, index) => {
    // Try exact match first
    let generated = parsedComments.find(c => c.postId === post.id);

    // Fallback: Try to match by index (if AI returned comments in same order)
    if (!generated && index < parsedComments.length) {
      console.warn(
        `⚠️ Could not find exact postId match for ${post.id}, using index-based fallback`,
      );
      generated = parsedComments[index];
      // Override the postId with the correct one
      generated.postId = post.id;
    }

    // Fallback 2: Try to match by partial ID (in case AI truncated the UUID)
    if (!generated) {
      const partialMatch = parsedComments.find(
        c =>
          c.postId &&
          (post.id.startsWith(c.postId) || c.postId.startsWith(post.id.substring(0, 15))),
      );
      if (partialMatch) {
        console.warn(
          `⚠️ Found partial match for ${post.id}, AI returned truncated ID: ${partialMatch.postId}`,
        );
        generated = partialMatch;
        // Override the postId with the correct one
        generated.postId = post.id;
      }
    }

    if (!generated || !generated.comment) {
      return {
        postId: post.id,
        error: 'No comment generated for this post',
        success: false,
      };
    }

    let comment = generated.comment.trim();

    // Smart truncate if comment exceeds limits
    if (comment.length > charLimit) {
      const originalLength = comment.length;
      comment = smartTruncateComment(comment, charLimit);
      console.log(
        `✂️ Comment for post ${post.id} truncated from ${originalLength} to ${comment.length} chars (${charLimit} limit)`,
      );
    }

    // Ensure it doesn't exceed Twitter's hard limit
    if (comment.length > 280) {
      const originalLength = comment.length;
      comment = smartTruncateComment(comment, 280);
      console.log(
        `✂️ Comment for post ${post.id} truncated from ${originalLength} to ${comment.length} chars (Twitter 280 limit)`,
      );
    }

    console.log(`✅ Comment generated for post ${post.id} (${comment.length}/${charLimit} chars)`);

    return {
      postId: post.id,
      comment,
      success: true,
    };
  });

  return results;
}
