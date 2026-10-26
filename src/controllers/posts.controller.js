const postsService = require("../services/posts.service");
const usersService = require("../services/users.service");
const { parsePagination, buildMeta } = require("../utils/pagination");

async function create(req, res) {
  try {
    const { imageUrl, authorId, caption, location } = req.body || {};

    if (
      !imageUrl ||
      authorId === undefined ||
      authorId === null ||
      typeof imageUrl !== "string" ||
      !imageUrl.trim()
    ) {
      return res.status(400).json({ error: "imageUrl and authorId are required" });
    }

    const parsedAuthorId = parseInt(authorId, 10);
    if (isNaN(parsedAuthorId)) {
      return res.status(400).json({ error: "imageUrl and authorId are required" });
    }

    const author = await usersService.getUserById(parsedAuthorId);
    if (!author) {
      return res.status(404).json({ error: "User not found" });
    }

    const newPost = {
      imageUrl: imageUrl.trim(),
      authorId: parsedAuthorId,
    };

    if (caption  !== undefined) newPost.caption  = caption;
    if (location !== undefined) newPost.location = location;

    const createdPost = await postsService.createPost(newPost);
    return res.status(201).json(createdPost);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function list(req, res) {
  try {
    const pagination = parsePagination(req.query);
    if (pagination.error) {
      return res.status(400).json({ error: pagination.error });
    }

    const filter = {};

    // Search filter
    if (req.query.search && typeof req.query.search === "string" && req.query.search.trim()) {
      const searchTerm = req.query.search.trim();
      filter.OR = [
        { caption:  { contains: searchTerm } },
        { location: { contains: searchTerm } },
      ];
    }

    // Location filter
    if (req.query.location && typeof req.query.location === "string" && req.query.location.trim()) {
      filter.location = { contains: req.query.location.trim() };
    }

    // sortBy & order
    const sortBy        = req.query.sortBy || "createdAt";
    const allowedSortBy = ["createdAt", "updatedAt", "likes"];
    if (!allowedSortBy.includes(sortBy)) {
      return res.status(400).json({
        error: "sortBy must be one of: createdAt, updatedAt, likes",
      });
    }

    const sortOrder = req.query.order?.toLowerCase() === "asc" ? "asc" : "desc";

    let orderBy;
    if (sortBy === "likes") {
      orderBy = [{ likes: { _count: sortOrder } }, { createdAt: "desc" }];
    } else {
      orderBy = [{ [sortBy]: sortOrder }];
    }

    const { total, data } = await postsService.listPosts({
      where:  filter,
      skip:   pagination.skip,
      take:   pagination.take,
      orderBy,
    });

    const meta = buildMeta(pagination.page, pagination.limit, total);
    return res.status(200).json({ data, meta });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function getOne(req, res) {
  try {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) {
      return res.status(404).json({ error: "Post not found" });
    }

    const post = await postsService.getPostById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    return res.status(200).json(post);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function update(req, res) {
  try {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) {
      return res.status(404).json({ error: "Post not found" });
    }

    const existingPost = await postsService.getPostById(postId);
    if (!existingPost) {
      return res.status(404).json({ error: "Post not found" });
    }

    const changes = {};
    if (req.body.caption  !== undefined) changes.caption  = req.body.caption;
    if (req.body.location !== undefined) changes.location = req.body.location;

    const updatedPost = await postsService.updatePost(postId, changes);
    return res.status(200).json(updatedPost);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function remove(req, res) {
  try {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) {
      return res.status(404).json({ error: "Post not found" });
    }

    const existingPost = await postsService.getPostById(postId);
    if (!existingPost) {
      return res.status(404).json({ error: "Post not found" });
    }

    await postsService.deletePost(postId);
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function getLikes(req, res) {
  try {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) {
      return res.status(404).json({ error: "Post not found" });
    }

    const post = await postsService.getPostById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const likers = await postsService.getPostLikes(postId);
    return res.status(200).json(likers);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = {
  create,
  list,
  getOne,
  update,
  remove,
  getLikes,
};
