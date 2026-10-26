const app = require("../src/app");
const prisma = require("../src/db");
const { execSync } = require("child_process");

const TEST_PORT = 3002;
const BASE_URL = `http://localhost:${TEST_PORT}`;

let server;

async function startServer() {
  return new Promise((resolve) => {
    server = app.listen(TEST_PORT, () => {
      resolve();
    });
  });
}

async function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(async () => {
        await prisma.$disconnect();
        resolve();
      });
    } else {
      resolve();
    }
  });
}

function runSeed() {
  execSync("npm run seed", { stdio: "ignore" });
}

let passedTests = 0;
let totalTests = 0;

function reportTest(name, passed, detail = "") {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`  ✓ ${name}`);
  } else {
    console.error(`  ✗ ${name}: ${detail}`);
  }
}

async function runTests() {
  console.log("\n=== Starting InstaLite Relations Test Suite ===\n");
  runSeed();
  await startServer();

  try {
    // Helper to find user ID by username
    async function getUserId(username) {
      const res = await fetch(`${BASE_URL}/users?search=${encodeURIComponent(username)}`);
      const body = await res.json();
      const user = body.data.find((u) => u.username === username);
      if (!user) throw new Error(`User not found: ${username}`);
      return user.id;
    }

    // Helper to find post ID by insta## string
    async function getPostId(instaKey) {
      const res = await fetch(`${BASE_URL}/posts?limit=100`);
      const body = await res.json();
      const post = body.data.find((p) => p.imageUrl.includes(instaKey));
      if (!post) throw new Error(`Post not found with key: ${instaKey}`);
      return post.id;
    }

    const riyaId = await getUserId("riya_travels");
    const arjunId = await getUserId("arjun_clicks");
    const devId = await getUserId("dev_shoots");
    const adityaId = await getUserId("aditya_codes");
    const nehaId = await getUserId("neha_designs");

    const insta01Id = await getPostId("insta01");
    const insta05Id = await getPostId("insta05");
    const insta10Id = await getPostId("insta10");
    const insta24Id = await getPostId("insta24");

    // --- STEP 04: POST /posts needs an author & PATCH authorId ignored ---
    console.log("\n--- Step 04 Tests ---");
    {
      // 1. Valid post creation with authorId
      const res1 = await fetch(`${BASE_URL}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: "https://picsum.photos/seed/new01/600/600",
          caption: "First post!",
          authorId: riyaId,
        }),
      });
      const data1 = await res1.json();
      reportTest(
        "POST /posts creates post with authorId equal to riya's id (201)",
        res1.status === 201 && data1.authorId === riyaId
      );

      // 2. Missing authorId
      const res2 = await fetch(`${BASE_URL}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: "https://picsum.photos/seed/new02/600/600",
        }),
      });
      const data2 = await res2.json();
      reportTest(
        "POST /posts without authorId returns 400 { error: 'imageUrl and authorId are required' }",
        res2.status === 400 && data2.error === "imageUrl and authorId are required"
      );

      // 3. Non-existing authorId
      const res3 = await fetch(`${BASE_URL}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: "https://picsum.photos/seed/new03/600/600",
          authorId: 999999,
        }),
      });
      const data3 = await res3.json();
      reportTest(
        "POST /posts with invalid authorId returns 404 { error: 'User not found' }",
        res3.status === 404 && data3.error === "User not found"
      );

      // 4. PATCH /posts/:id silently ignores authorId
      const res4 = await fetch(`${BASE_URL}/posts/${insta01Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption: "Baga, again 🌅",
          authorId: arjunId,
        }),
      });
      const data4 = await res4.json();
      reportTest(
        "PATCH /posts/:id ignores authorId and retains original authorId (200)",
        res4.status === 200 &&
          data4.caption === "Baga, again 🌅" &&
          data4.authorId === riyaId
      );
    }

    // --- STEP 05: GET /posts/:id with author and like count ---
    console.log("\n--- Step 05 Tests ---");
    runSeed();
    const s5_insta01Id = await getPostId("insta01");
    const s5_insta05Id = await getPostId("insta05");
    const s5_insta24Id = await getPostId("insta24");
    {
      const res1 = await fetch(`${BASE_URL}/posts/${s5_insta01Id}`);
      const data1 = await res1.json();
      reportTest(
        "GET /posts/<INSTA01_ID> includes author riya_travels and 5 likes (200)",
        res1.status === 200 &&
          data1.author.username === "riya_travels" &&
          data1.author.email === undefined &&
          data1._count.likes === 5
      );

      const res2 = await fetch(`${BASE_URL}/posts/${s5_insta24Id}`);
      const data2 = await res2.json();
      reportTest(
        "GET /posts/<INSTA24_ID> includes author dev_shoots and 6 likes (200)",
        res2.status === 200 &&
          data2.author.username === "dev_shoots" &&
          data2._count.likes === 6
      );

      const res3 = await fetch(`${BASE_URL}/posts/${s5_insta05Id}`);
      const data3 = await res3.json();
      reportTest(
        "GET /posts/<INSTA05_ID> includes author arjun_clicks and 0 likes (200)",
        res3.status === 200 &&
          data3.author.username === "arjun_clicks" &&
          data3._count.likes === 0
      );

      const res4 = await fetch(`${BASE_URL}/posts/999999`);
      const data4 = await res4.json();
      reportTest(
        "GET /posts/999999 returns 404 { error: 'Post not found' }",
        res4.status === 404 && data4.error === "Post not found"
      );
    }

    // --- STEP 06: GET /posts with authors, like counts and sortBy=likes ---
    console.log("\n--- Step 06 Tests ---");
    runSeed();
    {
      // 1. limit=2
      const res1 = await fetch(`${BASE_URL}/posts?limit=2`);
      const body1 = await res1.json();
      const keys1 = body1.data.map((p) => p.imageUrl.match(/insta\d+/)?.[0]);
      reportTest(
        "GET /posts?limit=2 returns newest posts [insta24, insta23] with author and _count",
        res1.status === 200 &&
          keys1[0] === "insta24" &&
          keys1[1] === "insta23" &&
          body1.data[0].author.username === "dev_shoots" &&
          body1.data[0]._count.likes === 6
      );

      // 2. sortBy=likes&limit=5
      const res2 = await fetch(`${BASE_URL}/posts?sortBy=likes&limit=5`);
      const body2 = await res2.json();
      const keys2 = body2.data.map((p) => p.imageUrl.match(/insta\d+/)?.[0]);
      reportTest(
        "GET /posts?sortBy=likes&limit=5 returns [insta24, insta01, insta15, insta10, insta08]",
        res2.status === 200 &&
          keys2.slice(0, 5).join(",") === "insta24,insta01,insta15,insta10,insta08"
      );

      // 3. sortBy=likes&order=asc&limit=3
      const res3 = await fetch(`${BASE_URL}/posts?sortBy=likes&order=asc&limit=3`);
      const body3 = await res3.json();
      const keys3 = body3.data.map((p) => p.imageUrl.match(/insta\d+/)?.[0]);
      reportTest(
        "GET /posts?sortBy=likes&order=asc&limit=3 returns 0 likes newest first [insta23, insta21, insta19]",
        res3.status === 200 &&
          keys3.join(",") === "insta23,insta21,insta19"
      );

      // 4. location=goa&sortBy=likes
      const res4 = await fetch(`${BASE_URL}/posts?location=goa&sortBy=likes`);
      const body4 = await res4.json();
      reportTest(
        "GET /posts?location=goa&sortBy=likes returns meta.total = 4",
        res4.status === 200 && body4.meta.total === 4
      );

      // 5. invalid sortBy
      const res5 = await fetch(`${BASE_URL}/posts?sortBy=comments`);
      const body5 = await res5.json();
      reportTest(
        "GET /posts?sortBy=comments returns 400 { error: 'sortBy must be one of: createdAt, updatedAt, likes' }",
        res5.status === 400 &&
          body5.error === "sortBy must be one of: createdAt, updatedAt, likes"
      );
    }

    // --- STEP 07: GET /users/:id with counts & hasPosts filter ---
    console.log("\n--- Step 07 Tests ---");
    runSeed();
    const s7_riyaId = await getUserId("riya_travels");
    const s7_devId = await getUserId("dev_shoots");
    const s7_adityaId = await getUserId("aditya_codes");
    {
      const res1 = await fetch(`${BASE_URL}/users/${s7_riyaId}`);
      const data1 = await res1.json();
      reportTest(
        "GET /users/<RIYA_ID> returns _count: { posts: 7, likes: 4 }",
        res1.status === 200 &&
          data1._count.posts === 7 &&
          data1._count.likes === 4
      );

      const res2 = await fetch(`${BASE_URL}/users/${s7_devId}`);
      const data2 = await res2.json();
      reportTest(
        "GET /users/<DEV_ID> returns _count: { posts: 2, likes: 1 }",
        res2.status === 200 &&
          data2._count.posts === 2 &&
          data2._count.likes === 1
      );

      const res3 = await fetch(`${BASE_URL}/users/${s7_adityaId}`);
      const data3 = await res3.json();
      reportTest(
        "GET /users/<ADITYA_ID> returns _count: { posts: 0, likes: 2 }",
        res3.status === 200 &&
          data3._count.posts === 0 &&
          data3._count.likes === 2
      );

      const res4 = await fetch(`${BASE_URL}/users?hasPosts=false`);
      const body4 = await res4.json();
      reportTest(
        "GET /users?hasPosts=false returns total 2 users (aditya_codes, neha_designs)",
        res4.status === 200 && body4.meta.total === 2
      );

      const res5 = await fetch(`${BASE_URL}/users?hasPosts=true`);
      const body5 = await res5.json();
      reportTest(
        "GET /users?hasPosts=true returns total 10 users",
        res5.status === 200 && body5.meta.total === 10
      );

      const res6 = await fetch(`${BASE_URL}/users?hasPosts=true&isPrivate=true`);
      const body6 = await res6.json();
      reportTest(
        "GET /users?hasPosts=true&isPrivate=true returns total 3 users",
        res6.status === 200 && body6.meta.total === 3
      );

      const res7 = await fetch(`${BASE_URL}/users?hasPosts=yes`);
      const body7 = await res7.json();
      reportTest(
        "GET /users?hasPosts=yes returns 400 { error: 'hasPosts must be true or false' }",
        res7.status === 400 && body7.error === "hasPosts must be true or false"
      );
    }

    // --- STEP 08: GET /users/:id/posts ---
    console.log("\n--- Step 08 Tests ---");
    runSeed();
    const s8_riyaId = await getUserId("riya_travels");
    const s8_adityaId = await getUserId("aditya_codes");
    {
      const res1 = await fetch(`${BASE_URL}/users/${s8_riyaId}/posts?limit=3`);
      const body1 = await res1.json();
      const keys1 = body1.data.map((p) => p.imageUrl.match(/insta\d+/)?.[0]);
      reportTest(
        "GET /users/<RIYA_ID>/posts?limit=3 returns [insta23, insta19, insta16] and meta",
        res1.status === 200 &&
          keys1.join(",") === "insta23,insta19,insta16" &&
          body1.meta.total === 7 &&
          body1.meta.totalPages === 3 &&
          body1.data[0]._count.likes !== undefined &&
          body1.data[0].author === undefined
      );

      const res2 = await fetch(`${BASE_URL}/users/${s8_riyaId}/posts?limit=3&page=3`);
      const body2 = await res2.json();
      const keys2 = body2.data.map((p) => p.imageUrl.match(/insta\d+/)?.[0]);
      reportTest(
        "GET /users/<RIYA_ID>/posts?limit=3&page=3 returns [insta01]",
        res2.status === 200 && keys2.join(",") === "insta01"
      );

      const res3 = await fetch(`${BASE_URL}/users/${s8_adityaId}/posts`);
      const body3 = await res3.json();
      reportTest(
        "GET /users/<ADITYA_ID>/posts returns [] and total: 0, totalPages: 0",
        res3.status === 200 &&
          body3.data.length === 0 &&
          body3.meta.total === 0 &&
          body3.meta.totalPages === 0
      );

      const res4 = await fetch(`${BASE_URL}/users/999999/posts`);
      const body4 = await res4.json();
      reportTest(
        "GET /users/999999/posts returns 404 { error: 'User not found' }",
        res4.status === 404 && body4.error === "User not found"
      );

      const res5 = await fetch(`${BASE_URL}/users/${s8_riyaId}/posts?page=0`);
      const body5 = await res5.json();
      reportTest(
        "GET /users/:id/posts?page=0 returns 400 { error: 'page and limit must be positive integers' }",
        res5.status === 400 && body5.error === "page and limit must be positive integers"
      );
    }

    // --- STEP 09: GET /posts/:id/likes ---
    console.log("\n--- Step 09 Tests ---");
    runSeed();
    const s9_insta01Id = await getPostId("insta01");
    const s9_insta05Id = await getPostId("insta05");
    const s9_insta24Id = await getPostId("insta24");
    {
      const res1 = await fetch(`${BASE_URL}/posts/${s9_insta01Id}/likes`);
      const data1 = await res1.json();
      const usernames1 = data1.map((u) => u.username);
      reportTest(
        "GET /posts/<INSTA01_ID>/likes returns 5 users sorted ascending",
        res1.status === 200 &&
          usernames1.join(",") === "arjun_clicks,isha_dances,meera.eats,neha_designs,vikram.trek" &&
          data1[0].email === undefined
      );

      const res2 = await fetch(`${BASE_URL}/posts/${s9_insta24Id}/likes`);
      const data2 = await res2.json();
      const usernames2 = data2.map((u) => u.username);
      reportTest(
        "GET /posts/<INSTA24_ID>/likes returns 6 users sorted ascending",
        res2.status === 200 &&
          usernames2.join(",") === "aditya_codes,arjun_clicks,riya_travels,rohan_runs,sara_sketches,vikram.trek"
      );

      const res3 = await fetch(`${BASE_URL}/posts/${s9_insta05Id}/likes`);
      const data3 = await res3.json();
      reportTest(
        "GET /posts/<INSTA05_ID>/likes returns []",
        res3.status === 200 && Array.isArray(data3) && data3.length === 0
      );

      const res4 = await fetch(`${BASE_URL}/posts/999999/likes`);
      const data4 = await res4.json();
      reportTest(
        "GET /posts/999999/likes returns 404 { error: 'Post not found' }",
        res4.status === 404 && data4.error === "Post not found"
      );
    }

    // --- STEP 10: Like and Unlike ---
    console.log("\n--- Step 10 Tests ---");
    runSeed();
    const s10_riyaId = await getUserId("riya_travels");
    const s10_insta05Id = await getPostId("insta05");
    {
      // 1. Like a post
      const res1 = await fetch(`${BASE_URL}/posts/${s10_insta05Id}/likes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: s10_riyaId }),
      });
      const data1 = await res1.json();
      reportTest(
        "POST /posts/<INSTA05_ID>/likes returns 201 with like object",
        res1.status === 201 && data1.userId === s10_riyaId && data1.postId === s10_insta05Id
      );

      // 2. Duplicate like
      const res2 = await fetch(`${BASE_URL}/posts/${s10_insta05Id}/likes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: s10_riyaId }),
      });
      const data2 = await res2.json();
      reportTest(
        "POST /posts/<INSTA05_ID>/likes duplicate returns 409 { error: 'Already liked' }",
        res2.status === 409 && data2.error === "Already liked"
      );

      // 3. Missing userId
      const res3 = await fetch(`${BASE_URL}/posts/${s10_insta05Id}/likes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data3 = await res3.json();
      reportTest(
        "POST /posts/<INSTA05_ID>/likes without userId returns 400 { error: 'userId is required' }",
        res3.status === 400 && data3.error === "userId is required"
      );

      // 4. Post not found
      const res4 = await fetch(`${BASE_URL}/posts/999999/likes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: s10_riyaId }),
      });
      const data4 = await res4.json();
      reportTest(
        "POST /posts/999999/likes returns 404 { error: 'Post not found' }",
        res4.status === 404 && data4.error === "Post not found"
      );

      // 5. User not found
      const res5 = await fetch(`${BASE_URL}/posts/${s10_insta05Id}/likes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: 999999 }),
      });
      const data5 = await res5.json();
      reportTest(
        "POST /posts/<INSTA05_ID>/likes with invalid userId returns 404 { error: 'User not found' }",
        res5.status === 404 && data5.error === "User not found"
      );

      // 6. Check post count is now 1
      const res6 = await fetch(`${BASE_URL}/posts/${s10_insta05Id}`);
      const data6 = await res6.json();
      reportTest(
        "GET /posts/<INSTA05_ID> reflects 1 like",
        res6.status === 200 && data6._count.likes === 1
      );

      // 7. Check likes endpoint contains riya_travels
      const res7 = await fetch(`${BASE_URL}/posts/${s10_insta05Id}/likes`);
      const data7 = await res7.json();
      reportTest(
        "GET /posts/<INSTA05_ID>/likes includes riya_travels",
        res7.status === 200 && data7.some((u) => u.username === "riya_travels")
      );

      // 8. DELETE like
      const res8 = await fetch(`${BASE_URL}/posts/${s10_insta05Id}/likes/${s10_riyaId}`, {
        method: "DELETE",
      });
      const text8 = await res8.text();
      reportTest(
        "DELETE /posts/<INSTA05_ID>/likes/<RIYA_ID> returns 204 empty",
        res8.status === 204 && text8 === ""
      );

      // 9. DELETE like again -> 404
      const res9 = await fetch(`${BASE_URL}/posts/${s10_insta05Id}/likes/${s10_riyaId}`, {
        method: "DELETE",
      });
      const data9 = await res9.json();
      reportTest(
        "DELETE /posts/<INSTA05_ID>/likes/<RIYA_ID> already unliked returns 404 { error: 'Like not found' }",
        res9.status === 404 && data9.error === "Like not found"
      );
    }

    // --- STEP 11: Cascading Deletes ---
    console.log("\n--- Step 11 Tests ---");
    {
      // Re-seed first to ensure fresh state
      runSeed();
      const freshRiyaId = await getUserId("riya_travels");
      const freshArjunId = await getUserId("arjun_clicks");
      const freshInsta10Id = await getPostId("insta10");
      const freshInsta24Id = await getPostId("insta24");

      // Delete riya
      const delRes = await fetch(`${BASE_URL}/users/${freshRiyaId}`, {
        method: "DELETE",
      });
      reportTest("DELETE riya returns 204", delRes.status === 204);

      // 1. users total = 11
      const res1 = await fetch(`${BASE_URL}/users?limit=1`);
      const body1 = await res1.json();
      reportTest(
        "GET /users?limit=1 has meta.total = 11",
        res1.status === 200 && body1.meta.total === 11
      );

      // 2. posts total = 17 (24 - 7 = 17)
      const res2 = await fetch(`${BASE_URL}/posts?limit=1`);
      const body2 = await res2.json();
      reportTest(
        "GET /posts?limit=1 has meta.total = 17",
        res2.status === 200 && body2.meta.total === 17
      );

      // 3. location=goa only has insta10 (insta01, insta16, insta23 were riya's)
      const res3 = await fetch(`${BASE_URL}/posts?location=goa`);
      const body3 = await res3.json();
      const keys3 = body3.data.map((p) => p.imageUrl.match(/insta\d+/)?.[0]);
      reportTest(
        "GET /posts?location=goa returns only insta10",
        res3.status === 200 && keys3.length === 1 && keys3[0] === "insta10"
      );

      // 4. sortBy=likes&limit=3 -> insta24 (5), insta15 (3), insta17 (2)
      const res4 = await fetch(`${BASE_URL}/posts?sortBy=likes&limit=3`);
      const body4 = await res4.json();
      const keys4 = body4.data.map((p) => p.imageUrl.match(/insta\d+/)?.[0]);
      reportTest(
        "GET /posts?sortBy=likes&limit=3 returns [insta24, insta15, insta17]",
        res4.status === 200 &&
          keys4.join(",") === "insta24,insta15,insta17" &&
          body4.data[0]._count.likes === 5
      );

      // 5. insta10 likes: ananya_reads, kabir_sings (riya's like gone)
      const res5 = await fetch(`${BASE_URL}/posts/${freshInsta10Id}/likes`);
      const data5 = await res5.json();
      const users5 = data5.map((u) => u.username);
      reportTest(
        "GET /posts/<INSTA10_ID>/likes has [ananya_reads, kabir_sings]",
        res5.status === 200 && users5.join(",") === "ananya_reads,kabir_sings"
      );

      // 6. insta24 likes: riya gone
      const res6 = await fetch(`${BASE_URL}/posts/${freshInsta24Id}/likes`);
      const data6 = await res6.json();
      const users6 = data6.map((u) => u.username);
      reportTest(
        "GET /posts/<INSTA24_ID>/likes has [aditya_codes, arjun_clicks, rohan_runs, sara_sketches, vikram.trek]",
        res6.status === 200 &&
          users6.join(",") === "aditya_codes,arjun_clicks,rohan_runs,sara_sketches,vikram.trek"
      );

      // 7. arjun's likes count dropped from 4 to 2
      const res7 = await fetch(`${BASE_URL}/users/${freshArjunId}`);
      const data7 = await res7.json();
      reportTest(
        "GET /users/<ARJUN_ID> _count: { posts: 4, likes: 2 }",
        res7.status === 200 && data7._count.posts === 4 && data7._count.likes === 2
      );

      // 8. GET /users/<RIYA_ID>/posts returns 404
      const res8 = await fetch(`${BASE_URL}/users/${freshRiyaId}/posts`);
      const data8 = await res8.json();
      reportTest(
        "GET /users/<RIYA_ID>/posts returns 404 { error: 'User not found' }",
        res8.status === 404 && data8.error === "User not found"
      );
    }

    // --- STEP 12: GET /users/:id/liked-posts (Bonus) ---
    console.log("\n--- Step 12 Tests ---");
    {
      // Re-seed for fresh state
      runSeed();
      const freshRiyaId = await getUserId("riya_travels");
      const freshArjunId = await getUserId("arjun_clicks");
      const freshNehaId = await getUserId("neha_designs");

      // 1. Riya's liked posts
      const res1 = await fetch(`${BASE_URL}/users/${freshRiyaId}/liked-posts`);
      const body1 = await res1.json();
      const keys1 = body1.data.map((p) => p.imageUrl.match(/insta\d+/)?.[0]);
      reportTest(
        "GET /users/<RIYA_ID>/liked-posts returns [insta24, insta20, insta10, insta03] (total 4 / 1)",
        res1.status === 200 &&
          keys1.join(",") === "insta24,insta20,insta10,insta03" &&
          body1.meta.total === 4 &&
          body1.meta.totalPages === 1 &&
          body1.data[0].author.username !== undefined &&
          body1.data[0]._count.likes !== undefined
      );

      // 2. Arjun's liked posts with limit=2
      const res2 = await fetch(`${BASE_URL}/users/${freshArjunId}/liked-posts?limit=2`);
      const body2 = await res2.json();
      const keys2 = body2.data.map((p) => p.imageUrl.match(/insta\d+/)?.[0]);
      reportTest(
        "GET /users/<ARJUN_ID>/liked-posts?limit=2 returns [insta24, insta14] (total 4 / 2)",
        res2.status === 200 &&
          keys2.join(",") === "insta24,insta14" &&
          body2.meta.total === 4 &&
          body2.meta.totalPages === 2
      );

      // 3. Neha's liked posts
      const res3 = await fetch(`${BASE_URL}/users/${freshNehaId}/liked-posts`);
      const body3 = await res3.json();
      const keys3 = body3.data.map((p) => p.imageUrl.match(/insta\d+/)?.[0]);
      reportTest(
        "GET /users/<NEHA_ID>/liked-posts returns [insta22, insta15, insta01] (total 3 / 1)",
        res3.status === 200 &&
          keys3.join(",") === "insta22,insta15,insta01" &&
          body3.meta.total === 3 &&
          body3.meta.totalPages === 1
      );

      // 4. Brand new user has 0 liked posts
      const newUserRes = await fetch(`${BASE_URL}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "brand_new_user",
          email: "brandnew@example.com",
          fullname: "Brand New",
        }),
      });
      const newUserData = await newUserRes.json();
      const res4 = await fetch(`${BASE_URL}/users/${newUserData.id}/liked-posts`);
      const body4 = await res4.json();
      reportTest(
        "GET /users/<NEW_USER_ID>/liked-posts returns [] (total 0 / 0)",
        res4.status === 200 &&
          body4.data.length === 0 &&
          body4.meta.total === 0 &&
          body4.meta.totalPages === 0
      );

      // 5. Non-existing user returns 404
      const res5 = await fetch(`${BASE_URL}/users/999999/liked-posts`);
      const body5 = await res5.json();
      reportTest(
        "GET /users/999999/liked-posts returns 404 { error: 'User not found' }",
        res5.status === 404 && body5.error === "User not found"
      );
    }

    console.log(`\nResults: ${passedTests}/${totalTests} tests passed.\n`);
    if (passedTests !== totalTests) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Test error:", err);
    process.exit(1);
  } finally {
    await stopServer();
  }
}

runTests();
