const likesService = require("../services/likes.service");
const postsService = require("../services/posts.service");
const usersService = require("../services/users.service");

async function likePost(req, res) {
  try {
    const { userId } = req.body || {};

    // 1. userId missing → 400
    if (userId === undefined || userId === null || userId === "") {
      return res.status(400).json({ error: "userId is required" });
    }

    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedUserId)) {
      return res.status(400).json({ error: "userId is required" });
    }

    // 2. Post not found → 404
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) {
      return res.status(404).json({ error: "Post not found" });
    }

    const post = await postsService.getPostById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // 3. User not found → 404
    const user = await usersService.getUserById(parsedUserId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // 4. Insert like; duplicate → 409
    try {
      const like = await likesService.createLike(parsedUserId, postId);
      return res.status(201).json({
        userId:    like.userId,
        postId:    like.postId,
        createdAt: like.createdAt,
      });
    } catch (innerErr) {
      if (innerErr.code === "P2002") {
        return res.status(409).json({ error: "Already liked" });
      }
      throw innerErr;
    }
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function unlikePost(req, res) {
  try {
    const postId = parseInt(req.params.id, 10);
    const userId = parseInt(req.params.userId, 10);

    if (isNaN(postId) || isNaN(userId)) {
      return res.status(404).json({ error: "Like not found" });
    }

    try {
      await likesService.deleteLike(userId, postId);
      return res.status(204).send();
    } catch (innerErr) {
      if (innerErr.code === "P2025") {
        return res.status(404).json({ error: "Like not found" });
      }
      throw innerErr;
    }
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = {
  likePost,
  unlikePost,
};
