// Helper function to validate and retry comment
export async function validateComment(comment, charLimit, retryCount, retryFn) {
  if (comment.length > charLimit && retryCount < 2) {
    console.log(
      `⚠️ Comment too long (${comment.length} chars), retrying attempt ${retryCount + 1}/2...`,
    );
    return await retryFn(retryCount + 1);
  }

  if (comment.length > charLimit) {
    console.error(
      `❌ Generated comment (${comment.length} chars) exceeds limit of ${charLimit} characters after ${retryCount + 1} attempts.`,
    );
    // throw new Error(
    //   `Generated comment (${comment.length} chars) exceeds limit of ${charLimit} characters after ${retryCount + 1} attempts.`,
    // );
  }

  if (comment.length > 280) {
    console.error(
      `Generated comment (${comment.length} chars) exceeds Twitter's 280 character limit.`,
    );
    // throw new Error(
    //   `Generated comment (${comment.length} chars) exceeds Twitter's 280 character limit.`,
    // );
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
      console.warn(`⚠️ Could not find exact postId match for ${post.id}, using index-based fallback`);
      generated = parsedComments[index];
      // Override the postId with the correct one
      generated.postId = post.id;
    }

    // Fallback 2: Try to match by partial ID (in case AI truncated the UUID)
    if (!generated) {
      const partialMatch = parsedComments.find(c =>
        c.postId && (
          post.id.startsWith(c.postId) ||
          c.postId.startsWith(post.id.substring(0, 15))
        )
      );
      if (partialMatch) {
        console.warn(`⚠️ Found partial match for ${post.id}, AI returned truncated ID: ${partialMatch.postId}`);
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

    const comment = generated.comment.trim();

    // Validate character limit
    if (comment.length > charLimit) {
      return {
        postId: post.id,
        error: `Generated comment (${comment.length} chars) exceeds limit of ${charLimit} characters`,
        comment,
        success: true,
      };
    }

    if (comment.length > 280) {
      return {
        postId: post.id,
        error: `Generated comment (${comment.length} chars) exceeds Twitter's 280 character limit`,
        comment,
        success: true,
      };
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
