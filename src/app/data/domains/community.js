import { handleDoPerfil } from "../../../lib/mentions.js";
import { firstFilled } from "./catalog.js";

export const POST_SELECT = "id,user_id,text,tag,book_id,image,image_paths,images,created_at";

export function buildPostViewModels(posts, {
  profiles = [],
  books = [],
  likes = [],
  polls = [],
  votes = [],
  imageUrlMap = new Map(),
  currentUserId = null,
} = {}) {
  const likesByPost = likes.reduce((acc, like) => {
    (acc[like.post_id] ||= []).push(like);
    return acc;
  }, {});
  const votesByPoll = votes.reduce((acc, vote) => {
    (acc[vote.poll_id] ||= []).push(vote);
    return acc;
  }, {});
  const pollsByPost = new Map(polls.map((poll) => {
    const pollVotes = votesByPoll[poll.id] || [];
    const options = (poll.post_poll_options || [])
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map((option) => ({
        ...option,
        votes: pollVotes.filter((vote) => vote.option_id === option.id).length,
      }));
    return [poll.post_id, {
      ...poll,
      options,
      totalVotes: pollVotes.length,
      myVote: pollVotes.find((vote) => vote.user_id === currentUserId)?.option_id || null,
    }];
  }));

  return (posts || []).map((post) => {
    const postProfile = profiles.find((profile) => profile.id === post.user_id);
    const postBook = books.find((book) => book.id === post.book_id);
    const postLikes = likesByPost[post.id] || [];
    return {
      ...post,
      images: [
        ...(post.image_paths || []).map((path) => imageUrlMap.get(path)).filter(Boolean),
        ...(post.images || (post.image ? [post.image] : [])),
      ],
      author: postProfile?.name || post.author || "Leitor",
      handle: handleDoPerfil(postProfile),
      avatar: firstFilled(postProfile?.avatar, postProfile?.avatar_url, post.avatar) || "L",
      authorProfile: postProfile || null,
      verified: Boolean(postProfile?.verified || postProfile?.is_verified || postProfile?.role === "admin"),
      book: postBook ? { ...postBook, author: postBook.authors?.name || "" } : null,
      likedByMe: postLikes.some((like) => like.user_id === currentUserId),
      likes: postLikes.length || post.likes || 0,
      replies: post.replies || 0,
      poll: pollsByPost.get(post.id) || null,
    };
  });
}
