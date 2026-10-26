const express = require("express");

const router          = express.Router();
const postsController = require("../controllers/posts.controller");
const likesController = require("../controllers/likes.controller");

router.post("/",    postsController.create);
router.get("/",     postsController.list);
router.get("/:id",  postsController.getOne);
router.patch("/:id", postsController.update);
router.delete("/:id", postsController.remove);

// Likes
router.get("/:id/likes",            postsController.getLikes);
router.post("/:id/likes",           likesController.likePost);
router.delete("/:id/likes/:userId", likesController.unlikePost);

module.exports = router;
