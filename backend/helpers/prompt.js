// Helper function to build prompt with retry instructions
export function buildPrompt(post, charLimit, customInstructions, retryCount) {
  const retryInstructions =
    retryCount > 0
      ? `\n- EXTREMELY IMPORTANT: Keep response very brief and concise\n- Use shorter sentences and fewer words\n- Aim for ${Math.max(charLimit - 20, 20)} characters or less`
      : '';

  return `Generate a thoughtful, engaging Twitter reply to this post. The reply should be:
- Professional and respectful
- Add value to the conversation
- Be authentic and human-like
- 🚨 CRITICAL: MUST be under ${charLimit} characters total (count carefully!)
- Include relevant insights or questions
- Avoid generic responses${customInstructions}${retryInstructions}

Original post by ${post.author || post.authorName || 'Unknown'}:
"${post.content}"

Generate only the reply text, no quotes, no emoji or extra formatting. MUST be under ${charLimit} characters:`;
}

// Helper function to build bulk prompt for multiple posts
export function buildBulkPrompt(posts, charLimit, customInstructions) {
  const postsText = posts
    .map(
      (post, index) =>
        `[POST_${index + 1}] ID: ${post.id}\nAuthor: ${post.author || post.authorName || 'Unknown'}\nContent: "${post.content}"`,
    )
    .join('\n\n');

  return `Generate thoughtful, engaging Twitter replies for the following ${posts.length} posts. Each reply should be:
- Professional and respectful
- Add value to the conversation
- Be authentic and human-like
- 🚨 CRITICAL: MUST be under ${charLimit} characters total (count carefully!)
- Include relevant insights or questions
- Avoid generic responses${customInstructions}

Posts to reply to:
${postsText}

IMPORTANT: Return your response as a valid JSON array with this exact format:
[
  {"postId": "post-id-1", "comment": "your reply here"},
  {"postId": "post-id-2", "comment": "your reply here"}
]

Generate ONLY the JSON array, no additional text, no markdown code blocks, no explanations. Each comment MUST be under ${charLimit} characters.`;
}
