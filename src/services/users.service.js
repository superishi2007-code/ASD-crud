const prisma = require("../db");

async function createUser(data) {
  return await prisma.user.create({
    data,
  });
}

async function listUsers({ where = {}, skip = 0, take = 10, orderBy = { createdAt: "desc" } } = {}) {
  const [total, data] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy,
    }),
  ]);
  return { total, data };
}

async function getUserById(id) {
  return await prisma.user.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          posts: true,
          likes: true,
        },
      },
    },
  });
}

async function updateUser(id, data) {
  return await prisma.user.update({
    where: { id },
    data,
  });
}

async function deleteUser(id) {
  return await prisma.user.delete({
    where: { id },
  });
}

async function getUserPosts(userId, { skip = 0, take = 10 } = {}) {
  const where = { authorId: userId };
  const [total, data] = await prisma.$transaction([
    prisma.post.count({ where }),
    prisma.post.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { likes: true },
        },
      },
    }),
  ]);
  return { total, data };
}

async function getUserLikedPosts(userId, { skip = 0, take = 10 } = {}) {
  const where = {
    likes: {
      some: {
        userId,
      },
    },
  };
  const [total, data] = await prisma.$transaction([
    prisma.post.count({ where }),
    prisma.post.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
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

module.exports = {
  createUser,
  listUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserPosts,
  getUserLikedPosts,
};
