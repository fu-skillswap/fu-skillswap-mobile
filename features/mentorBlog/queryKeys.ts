/** Khoá TanStack Query của blog mentor */
export const mentorBlogKeys = {
  all: ['mentorBlog'] as const,
  list: () => [...mentorBlogKeys.all, 'list'] as const,
  post: (postId: string) => [...mentorBlogKeys.all, 'post', postId] as const,
};
