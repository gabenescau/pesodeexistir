import { getRequiredCookieSession } from "./auth.js";
import {
  createSignedStorageUrlMap,
  enforceRateLimit,
  supabaseRequest,
  supabaseUserRequest,
} from "./supabase.js";

const POST_SELECT = "id,user_id,text,tag,book_id,image,image_paths,images,created_at";
const POST_PAGE_SIZE = 20;
const MAX_OFFSET = 5000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMMUNITY_OPERATIONS = new Set([
  "create_post", "delete_post", "sign_post_media", "ensure_entity_thread",
  "list_reactions_batch", "toggle_like", "toggle_save", "toggle_follow",
  "list_replies", "list_reactions", "create_reply", "delete_reply",
  "list_page_comments", "create_page_comment", "delete_page_comment",
  "toggle_poll_vote", "toggle_reaction",
]);

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  error.userSafe = true;
  return error;
}

function uuid(value, field) {
  const normalized = String(value || "").trim();
  if (!UUID.test(normalized)) throw invalid(`${field} invalido.`);
  return normalized;
}

function boundedText(value, field, max, required = true) {
  const normalized = String(value ?? "").trim();
  if (required && !normalized) throw invalid(`${field} obrigatorio.`);
  if (normalized.length > max) throw invalid(`${field} excede o limite permitido.`);
  return normalized;
}

function imagePaths(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 4) throw invalid("Imagens invalidas.");
  return value.map((item) => {
    const path = String(item || "").trim();
    if (!path || path.length > 500 || path.includes("..") || path.startsWith("/") || /[\\\u0000-\u001f]/.test(path)) {
      throw invalid("Caminho de imagem invalido.");
    }
    return path;
  });
}

function parseCommunityInput(operation, body = {}, userId) {
  switch (operation) {
    case "create_post": {
      const text = boundedText(body.text, "Texto", 5000, false);
      const bookId = body.bookId ? uuid(body.bookId, "Livro") : null;
      const tag = boundedText(body.tag, "Tag", 80, false) || null;
      const paths = imagePaths(body.imagePaths);
      const poll = body.poll && typeof body.poll === "object" ? body.poll : null;
      let parsedPoll = null;
      if (poll) {
        const question = boundedText(poll.question, "Pergunta", 180);
        const options = Array.isArray(poll.options)
          ? poll.options.map((option) => boundedText(option, "Opcao", 120)).filter(Boolean).slice(0, 6)
          : [];
        if (options.length < 2 || options.length > 6) throw invalid("A enquete precisa de 2 a 6 opcoes.");
        parsedPoll = { question, options };
      }
      if (!text && !parsedPoll) throw invalid("Escreva algo antes de publicar.");
      return { userId, text: text || parsedPoll.question, bookId, tag, paths, poll: parsedPoll };
    }
    case "delete_post":
      return { postId: uuid(body.postId, "Post") };
    case "sign_post_media":
      return { paths: imagePaths(body.paths) };
    case "ensure_entity_thread": {
      const targetType = boundedText(body.targetType, "Tipo", 20);
      if (!new Set(["book", "author"]).has(targetType)) throw invalid("Tipo de entidade invalido.");
      return { targetType, targetId: uuid(body.targetId, "Entidade") };
    }
    case "list_reactions_batch": {
      const targetIds = Array.isArray(body.targetIds) ? body.targetIds : [];
      if (targetIds.length > 200) throw invalid("Muitos alvos para uma consulta.");
      return { targetType: "post", targetIds: targetIds.map((id) => uuid(id, "Post")) };
    }
    case "toggle_like":
    case "toggle_save":
      return { postId: uuid(body.postId, "Post"), enabled: body.enabled === true };
    case "toggle_follow":
      return { targetId: uuid(body.targetId, "Perfil"), enabled: body.enabled === true };
    case "list_replies":
      return { postId: uuid(body.postId, "Post") };
    case "list_reactions": {
      const allowedTargets = new Set(["post", "post_reply", "book_comment"]);
      const targetType = boundedText(body.targetType, "Tipo", 20);
      if (!allowedTargets.has(targetType)) throw invalid("Tipo de reacao invalido.");
      return { targetType, targetId: uuid(body.targetId, "Alvo") };
    }
    case "create_reply":
      return {
        postId: uuid(body.postId, "Post"),
        parentId: body.parentId ? uuid(body.parentId, "Resposta") : null,
        text: boundedText(body.text, "Comentario", 2000),
      };
    case "delete_reply":
      return { replyId: uuid(body.replyId, "Comentario") };
    case "list_page_comments":
      return { bookId: uuid(body.bookId, "Livro"), pageNumber: Number(body.pageNumber) };
    case "create_page_comment":
      return {
        bookId: uuid(body.bookId, "Livro"),
        pageNumber: Number(body.pageNumber),
        text: boundedText(body.text, "Comentario", 2000),
      };
    case "delete_page_comment":
      return { commentId: uuid(body.commentId, "Comentario") };
    case "toggle_poll_vote":
      return { pollId: uuid(body.pollId, "Enquete"), optionId: uuid(body.optionId, "Opcao") };
    case "toggle_reaction": {
      const allowedTargets = new Set(["post", "post_reply", "book_comment"]);
      const allowedEmojis = new Set(["❤️", "🔥", "😂", "😮", "😢", "👏", "🤔", "📖"]);
      const targetType = boundedText(body.targetType, "Tipo", 20);
      const emoji = boundedText(body.emoji, "Reacao", 8);
      if (!allowedTargets.has(targetType) || !allowedEmojis.has(emoji)) throw invalid("Reacao invalida.");
      return { targetType, targetId: uuid(body.targetId, "Alvo"), emoji, enabled: body.enabled === true };
    }
    default:
      throw invalid("Operacao da comunidade invalida.");
  }
}

async function toggleUserRow(session, table, filters, row, enabled) {
  const filter = Object.entries(filters).map(([key, value]) => `${key}=eq.${encodeURIComponent(value)}`).join("&");
  if (enabled) {
    await supabaseUserRequest(session.accessToken, `${table}?on_conflict=${Object.keys(row).join(",")}`, {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(row),
    });
  } else {
    await supabaseUserRequest(session.accessToken, `${table}?${filter}`, { method: "DELETE" });
  }
  return { enabled };
}

function aggregateReactions(rows, { targetId = null, userId = null } = {}) {
  const grouped = new Map();
  for (const row of rows || []) {
    const key = `${row.target_id || targetId || ""}:${row.emoji || ""}`;
    const current = grouped.get(key) || {
      ...(row.target_id || targetId ? { target_id: row.target_id || targetId } : {}),
      emoji: row.emoji,
      total: 0,
      mine: false,
    };
    current.total += 1;
    if (userId && row.user_id === userId) current.mine = true;
    grouped.set(key, current);
  }
  return [...grouped.values()];
}

export async function handleCommunityWrite(req, res) {
  const session = await getRequiredCookieSession(req, res);
  const operation = boundedText(req.body?.operation, "Operacao", 40);
  if (!COMMUNITY_OPERATIONS.has(operation)) throw invalid("Operacao da comunidade invalida.");
  if (!await enforceRateLimit(req, res, {
    scope: `community_${operation}`,
    limit: operation.startsWith("list_") ? 60 : 30,
    windowSeconds: 60,
    userId: session.user.id,
  })) return null;
  const input = parseCommunityInput(operation, req.body, session.user.id);

  if (operation === "create_post") {
    const ownerPrefix = `${session.user.id}/`;
    if (input.paths.some((path) => !path.startsWith(ownerPrefix))) {
      throw invalid("Arquivo de post nao pertence a sua conta.");
    }
    const rows = await supabaseUserRequest(session.accessToken, "posts?select=*&limit=1", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ user_id: session.user.id, text: input.text, tag: input.tag, book_id: input.bookId, image_paths: input.paths, images: [] }),
    });
    const post = rows?.[0];
    if (!post) throw new Error("Post nao criado.");
    if (input.poll) {
      try {
        const pollRows = await supabaseUserRequest(session.accessToken, "post_polls?select=*&limit=1", {
          method: "POST", headers: { Prefer: "return=representation" },
          body: JSON.stringify({ post_id: post.id, question: input.poll.question }),
        });
        const poll = pollRows?.[0];
        if (!poll) throw new Error("Enquete nao criada.");
        await supabaseUserRequest(session.accessToken, "post_poll_options?select=*", {
          method: "POST", headers: { Prefer: "return=representation" },
          body: JSON.stringify(input.poll.options.map((label, sort_order) => ({ poll_id: poll.id, label, sort_order }))),
        });
      } catch (error) {
        await supabaseUserRequest(session.accessToken, `posts?id=eq.${encodeURIComponent(post.id)}`, { method: "DELETE" }).catch(() => {});
        throw error;
      }
    }
    return post;
  }
  if (operation === "delete_post") {
    await supabaseUserRequest(session.accessToken, `posts?id=eq.${encodeURIComponent(input.postId)}&user_id=eq.${encodeURIComponent(session.user.id)}`, { method: "DELETE" });
    return { id: input.postId };
  }
  if (operation === "sign_post_media") {
    const ownerPrefix = `${session.user.id}/`;
    if (input.paths.some((path) => !path.startsWith(ownerPrefix))) throw invalid("Arquivo de post nao pertence a sua conta.");
    return createSignedStorageUrlMap("post-media", input.paths, 900);
  }
  if (operation === "ensure_entity_thread") {
    const tag = `entity-thread:${input.targetType}:${input.targetId}`;
    const existing = await supabaseUserRequest(
      session.accessToken,
      `posts?select=id&tag=eq.${encodeURIComponent(tag)}&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`,
    );
    if (existing?.[0]?.id) return { id: existing[0].id };
    const rows = await supabaseUserRequest(session.accessToken, "posts?select=id&limit=1", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: session.user.id,
        text: `[thread] Discussao sobre ${input.targetType === "book" ? "este livro" : "este autor"}`,
        tag,
      }),
    });
    if (!rows?.[0]?.id) throw new Error("Discussao nao criada.");
    return { id: rows[0].id };
  }
  if (operation === "list_reactions_batch") {
    if (input.targetIds.length === 0) return [];
    const rows = await supabaseUserRequest(
      session.accessToken,
      `reactions?select=target_id,user_id,emoji&target_type=eq.post&target_id=in.(${input.targetIds.join(",")})&limit=5000`,
    );
    return aggregateReactions(rows, { userId: session.user.id });
  }
  if (operation === "toggle_like") return toggleUserRow(session, "post_likes", { user_id: session.user.id, post_id: input.postId }, { user_id: session.user.id, post_id: input.postId }, input.enabled);
  if (operation === "toggle_save") return toggleUserRow(session, "saved_posts", { user_id: session.user.id, post_id: input.postId }, { user_id: session.user.id, post_id: input.postId }, input.enabled);
  if (operation === "toggle_follow") {
    if (input.targetId === session.user.id) throw invalid("Voce nao pode seguir a si mesmo.");
    return toggleUserRow(session, "follows", { follower_id: session.user.id, following_id: input.targetId }, { follower_id: session.user.id, following_id: input.targetId }, input.enabled);
  }
  if (operation === "list_replies") return supabaseUserRequest(session.accessToken, `post_replies?select=id,post_id,user_id,text,created_at,parent_id&post_id=eq.${encodeURIComponent(input.postId)}&order=created_at.asc&limit=100`);
  if (operation === "list_reactions") {
    const rows = await supabaseUserRequest(session.accessToken, `reactions?select=user_id,emoji&target_type=eq.${encodeURIComponent(input.targetType)}&target_id=eq.${encodeURIComponent(input.targetId)}&limit=100`);
    return aggregateReactions(rows, { targetId: input.targetId, userId: session.user.id });
  }
  if (operation === "create_reply") {
    const rows = await supabaseUserRequest(session.accessToken, "post_replies?select=*&limit=1", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ post_id: input.postId, user_id: session.user.id, text: input.text, parent_id: input.parentId }) });
    return rows?.[0] || null;
  }
  if (operation === "delete_reply") {
    await supabaseUserRequest(session.accessToken, `post_replies?id=eq.${encodeURIComponent(input.replyId)}&user_id=eq.${encodeURIComponent(session.user.id)}`, { method: "DELETE" });
    return { id: input.replyId };
  }
  if (operation === "list_page_comments") {
    if (!Number.isInteger(input.pageNumber) || input.pageNumber < 1 || input.pageNumber > 100000) throw invalid("Pagina invalida.");
    return supabaseUserRequest(session.accessToken, `book_page_comments?select=id,book_id,page_number,user_id,text,created_at,updated_at&book_id=eq.${encodeURIComponent(input.bookId)}&page_number=eq.${input.pageNumber}&order=created_at.asc&limit=100`);
  }
  if (operation === "create_page_comment") {
    if (!Number.isInteger(input.pageNumber) || input.pageNumber < 1 || input.pageNumber > 100000) throw invalid("Pagina invalida.");
    const rows = await supabaseUserRequest(session.accessToken, "book_page_comments?select=*&limit=1", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ book_id: input.bookId, page_number: input.pageNumber, user_id: session.user.id, text: input.text }) });
    return rows?.[0] || null;
  }
  if (operation === "delete_page_comment") {
    await supabaseUserRequest(session.accessToken, `book_page_comments?id=eq.${encodeURIComponent(input.commentId)}&user_id=eq.${encodeURIComponent(session.user.id)}`, { method: "DELETE" });
    return { id: input.commentId };
  }
  if (operation === "toggle_reaction") {
    const filters = { user_id: session.user.id, target_type: input.targetType, target_id: input.targetId, emoji: input.emoji };
    return toggleUserRow(session, "reactions", filters, filters, input.enabled);
  }
  if (operation === "toggle_poll_vote") {
    if (!input.optionId || !input.pollId) throw invalid("Voto invalido.");
    const option = await supabaseUserRequest(
      session.accessToken,
      `post_poll_options?select=id&poll_id=eq.${encodeURIComponent(input.pollId)}&id=eq.${encodeURIComponent(input.optionId)}&limit=1`,
    );
    if (!option?.[0]) throw invalid("Opcao de enquete invalida.");
    await supabaseUserRequest(session.accessToken, "rpc/set_poll_vote", {
      method: "POST",
      body: JSON.stringify({ p_poll_id: input.pollId, p_option_id: input.optionId }),
    });
    return { optionId: input.optionId };
  }
  throw invalid("Operacao da comunidade invalida.");
}

function boundedOffset(value) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.min(Math.max(number, 0), MAX_OFFSET) : 0;
}

function idFilter(ids) {
  return ids.filter((id) => UUID.test(id)).join(",");
}

function safeProfiles(rows) {
  return (rows || []).map((profile) => ({
    id: profile.id,
    name: profile.name || null,
    avatar: profile.avatar || null,
    avatar_url: profile.avatar_url || null,
    username: profile.username || null,
    bio: profile.bio || null,
    private_profile: profile.private_profile === true,
    reading_activity: profile.reading_activity !== false,
    show_online_status: profile.show_online_status !== false,
    verified: profile.verified === true || profile.is_verified === true,
  }));
}

export async function getCommunityFeed(req, res) {
  const session = await getRequiredCookieSession(req, res);
  const url = new URL(req.url || "/api/auth?action=community", "https://app.pesodeexistir.online");
  const offset = boundedOffset(url.searchParams.get("offset"));
  const posts = await supabaseRequest(
    `posts?select=${POST_SELECT}&order=created_at.desc&offset=${offset}&limit=${POST_PAGE_SIZE + 1}`,
  );
  const postIds = posts.map((post) => post.id).filter((id) => UUID.test(id));

  if (postIds.length === 0) {
    const [follows, savedPosts] = await Promise.all([
      supabaseUserRequest(session.accessToken, `follows?select=follower_id,following_id&or=(follower_id.eq.${encodeURIComponent(session.user.id)},following_id.eq.${encodeURIComponent(session.user.id)})&limit=5000`).catch(() => []),
      supabaseUserRequest(session.accessToken, `saved_posts?select=post_id&user_id=eq.${encodeURIComponent(session.user.id)}&limit=5000`).catch(() => []),
    ]);
    return {
      posts: [],
      profiles: [],
      likes: [],
      polls: [],
      votes: [],
      imageUrls: {},
      follows,
      savedPosts,
      pageSize: POST_PAGE_SIZE,
    };
  }

  const filter = idFilter(postIds);
  const [profiles, likes, polls, follows, savedPosts] = await Promise.all([
    supabaseRequest("rpc/list_public_profiles", {
      method: "POST",
      body: JSON.stringify({ p_ids: null }),
    }),
    supabaseRequest(`post_likes?select=post_id,user_id&post_id=in.(${filter})&limit=5000`),
    supabaseRequest(`post_polls?select=id,post_id,question,created_at,post_poll_options(id,poll_id,label,sort_order)&post_id=in.(${filter})&limit=200`),
    supabaseUserRequest(session.accessToken, `follows?select=follower_id,following_id&or=(follower_id.eq.${encodeURIComponent(session.user.id)},following_id.eq.${encodeURIComponent(session.user.id)})&limit=5000`).catch(() => []),
    supabaseUserRequest(session.accessToken, `saved_posts?select=post_id&user_id=eq.${encodeURIComponent(session.user.id)}&limit=5000`).catch(() => []),
  ]);
  const pollIds = polls.map((poll) => poll.id).filter((id) => UUID.test(id));
  const votes = pollIds.length > 0
    ? await supabaseRequest(`post_poll_votes?select=poll_id,option_id,user_id&poll_id=in.(${idFilter(pollIds)})&limit=10000`)
    : [];
  const imagePaths = posts.flatMap((post) => Array.isArray(post.image_paths) ? post.image_paths : []);
  let imageUrls = {};
  try {
    imageUrls = await createSignedStorageUrlMap("post-media", imagePaths, 3600);
  } catch {
    // Media is optional; keep the feed usable when an old object is missing.
  }

  return {
    posts,
    profiles: safeProfiles(profiles),
    // Keep counts and the current user's state without exposing other user IDs.
    likes: likes.map((like) => ({
      post_id: like.post_id,
      user_id: like.user_id === session.user.id ? session.user.id : null,
    })),
    polls,
    votes: votes.map((vote) => ({
      poll_id: vote.poll_id,
      option_id: vote.option_id,
      user_id: vote.user_id === session.user.id ? session.user.id : null,
    })),
    follows,
    savedPosts,
    imageUrls,
    pageSize: POST_PAGE_SIZE,
  };
}
