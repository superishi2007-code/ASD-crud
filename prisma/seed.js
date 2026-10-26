const prisma = require("../src/db");
const { users, posts, likes } = require("./seed-data");

async function main() {
  // 1. Delete all rows from all three tables: children first
  await prisma.like.deleteMany({});
  await prisma.post.deleteMany({});
  await prisma.user.deleteMany({});

  // 2. Create all users in one query and get created rows back
  const createdUsers = await prisma.user.createManyAndReturn({
    data: users.map((u) => ({
      username: u.username,
      email: u.email,
      fullname: u.fullname,
      bio: u.bio,
      isPrivate: u.isPrivate,
      createdAt: new Date(u.createdAt),
    })),
  });

  // 3. Build lookup: username -> id
  const userMap = new Map();
  for (const user of createdUsers) {
    userMap.set(user.username, user.id);
  }

  // 4. Create all posts in one query, replacing author with real authorId
  const createdPosts = await prisma.post.createManyAndReturn({
    data: posts.map((p) => ({
      imageUrl: p.imageUrl,
      caption: p.caption,
      location: p.location,
      createdAt: new Date(p.createdAt),
      authorId: userMap.get(p.author),
    })),
  });

  // 5. Build lookup: insta## -> post id
  const postMap = new Map();
  for (const post of createdPosts) {
    const match = post.imageUrl.match(/insta\d+/);
    if (match) {
      postMap.set(match[0], post.id);
    }
  }

  // 6. Create all likes in one query (real userId and postId)
  const likesToCreate = likes.map((l) => ({
    userId: userMap.get(l.user),
    postId: postMap.get(l.post),
  }));

  const createdLikes = await prisma.like.createManyAndReturn({
    data: likesToCreate,
  });

  // 7. Print seeded counts from query results
  console.log(
    `🌱 Seeded ${createdUsers.length} users, ${createdPosts.length} posts and ${createdLikes.length} likes`
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
