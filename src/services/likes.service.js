const prisma = require("../db");

async function createLike(userId, postId) {
  return await prisma.like.create({
    data: {
      userId,
      postId,
    },
  });
}

async function deleteLike(userId, postId) {
  return await prisma.like.delete({
    where: {
      userId_postId: {
        userId,
        postId,
      },
    },
  });
}

module.exports = {
  createLike,
  deleteLike,
};
