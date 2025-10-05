// Helper function to validate and retry comment
export async function validateComment(comment, charLimit, retryCount, retryFn) {
  if (comment.length > charLimit && retryCount < 2) {
    console.log(
      `⚠️ Comment too long (${comment.length} chars), retrying attempt ${retryCount + 1}/2...`,
    );
    return await retryFn(retryCount + 1);
  }

  if (comment.length > charLimit) {
    throw new Error(
      `Generated comment (${comment.length} chars) exceeds limit of ${charLimit} characters after ${retryCount + 1} attempts.`,
    );
  }

  if (comment.length > 280) {
    throw new Error(
      `Generated comment (${comment.length} chars) exceeds Twitter's 280 character limit.`,
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

  const results = posts.map(post => {
    const generated = parsedComments.find(c => c.postId === post.id);

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
        success: false,
      };
    }

    if (comment.length > 280) {
      return {
        postId: post.id,
        error: `Generated comment (${comment.length} chars) exceeds Twitter's 280 character limit`,
        success: false,
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
