const prisma = require("../db");

async function createPost(data) {
  return await prisma.post.create({
    data,
  });
}

async function listPosts({ where = {}, skip = 0, take = 10, orderBy = [{ createdAt: "desc" }] } = {}) {
  const [total, data] = await prisma.$transaction([
    prisma.post.count({ where }),
    prisma.post.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        author: {
          select: {
            id: true,
            username: true,
            fullname: true,
          },
        },
        _count: {
          select: { likes: true },
        },
      },
    }),
  ]);
  return { total, data };
}

async function getPostById(id) {
  return await prisma.post.findUnique({
    where: { id },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          fullname: true,
        },
      },
      _count: {
        select: { likes: true },
      },
    },
  });
}

async function updatePost(id, data) {
  return await prisma.post.update({
    where: { id },
    data,
  });
}

async function deletePost(id) {
  return await prisma.post.delete({
    where: { id },
  });
}

async function getPostLikes(postId) {
  return await prisma.user.findMany({
    where: {
      likes: {
        some: {
          postId,
        },
      },
    },
    orderBy: {
      username: "asc",
    },
    select: {
      id: true,
      username: true,
      fullname: true,
    },
  });
}

module.exports = {
  createPost,
  listPosts,
  getPostById,
  updatePost,
  deletePost,
  getPostLikes,
};
