# InstaLite — Express + Prisma Relations Backend

A modular Node.js Express backend using Prisma ORM with SQLite, built strictly following the MVC architectural pattern.

## Project Structure

```
├── .env
├── .env.example
├── .gitignore
├── package.json
├── prisma
│   ├── migrations/
│   │   ├── 20261026120341_init/
│   │   ├── 20261026120404_add_post_author/
│   │   └── 20261026120434_add_likes/
│   ├── schema.prisma
│   ├── seed-data.js
│   └── seed.js
├── prisma7.config.js
├── src
│   ├── app.js
│   ├── db.js
│   ├── index.js
│   ├── server.js
│   ├── controllers
│   │   ├── likes.controller.js
│   │   ├── posts.controller.js
│   │   └── users.controller.js
│   ├── routes
│   │   ├── posts.routes.js
│   │   └── users.routes.js
│   ├── services
│   │   ├── likes.service.js
│   │   ├── posts.service.js
│   │   └── users.service.js
│   └── utils
│       └── pagination.js
├── tests
│   └── api.test.js
└── README.md
```

## Setup & Running

### 1. Install Dependencies
```bash
npm install
```

### 2. Database Migrations & Client Generation
```bash
npx prisma migrate dev
npx prisma generate
```

### 3. Seed Database
```bash
npm run seed
```
Seeds 12 users, 24 posts with author relations, and 29 likes.

### 4. Start the Server
```bash
npm start
# or
node src/index.js
```
The server starts on port `3000` (or `PORT` from `.env`) and outputs:
```
Server started on port 3000
```

### 5. Run Automated Tests
```bash
npm test
```
Runs the full 52-test automated suite covering all CRUD, relations, filters, cascades, pagination, and edge cases.

---

## API Endpoints Reference

### Health & Root
- `GET /` — API welcome guide and endpoints overview
- `GET /health` — Returns 200 with `{ "status": "OK" }`

### Users (`/users`)
| Method | Endpoint | Description | Status Codes |
|---|---|---|---|
| `POST` | `/users` | Create a user (`username`, `email`, `fullname` required, `bio` optional). Disallowed fields ignored. | `201`, `400`, `409` |
| `GET` | `/users` | List users (paginated `{ data, meta }`, filters: `search`, `isPrivate`, `hasPosts`) | `200`, `400` |
| `GET` | `/users/:id` | Get user by ID (includes `_count: { posts, likes }`) | `200`, `404` |
| `PATCH` | `/users/:id` | Partial update (`fullname`, `bio`, `isPrivate`). `username` and `email` ignored. | `200`, `404` |
| `DELETE` | `/users/:id` | Delete user (cascades to their posts and likes) | `204`, `404` |
| `GET` | `/users/:id/posts` | Paginated posts written by user (newest first, includes `_count: { likes }`) | `200`, `400`, `404` |
| `GET` | `/users/:id/liked-posts` | Paginated posts liked by user (newest first, includes `author` summary & `_count: { likes }`) | `200`, `400`, `404` |

### Posts (`/posts`)
| Method | Endpoint | Description | Status Codes |
|---|---|---|---|
| `POST` | `/posts` | Create a post (`imageUrl`, `authorId` required; `caption`, `location` optional). | `201`, `400`, `404` |
| `GET` | `/posts` | List posts (paginated `{ data, meta }`, `search`, `location`, `sortBy=createdAt\|updatedAt\|likes`, `order=asc\|desc`) | `200`, `400` |
| `GET` | `/posts/:id` | Get post by ID (includes `author` user summary and `_count: { likes }`) | `200`, `404` |
| `PATCH` | `/posts/:id` | Partial update (`caption`, `location`). `imageUrl` & `authorId` ignored. | `200`, `404` |
| `DELETE` | `/posts/:id` | Delete post (cascades to likes on that post) | `204`, `404` |
| `GET` | `/posts/:id/likes` | List user summaries who liked this post (sorted by `username` asc) | `200`, `404` |
| `POST` | `/posts/:id/likes` | Like a post (body: `{ "userId": <id> }`) | `201`, `400`, `404`, `409` |
| `DELETE` | `/posts/:id/likes/:userId` | Unlike a post | `204`, `404` |

---

## Viva Questions & Answers

1. **Why did the first `migrate dev` in Step 01 fail?**  
   Because the `Post` table already had rows from previous labs, and `authorId` was added as a non-nullable (`required`) column without a default value. Existing posts would have no valid `authorId` to populate.

2. **Why does `Like` have no `id` column? What stops a user from liking the same post twice?**  
   A composite primary key `@@id([userId, postId])` uniquely identifies each record. The database itself enforces uniqueness at the storage engine level, rejecting duplicate likes with a constraint violation without needing synthetic IDs.

3. **Why did we make the join table explicit instead of letting Prisma create an implicit one?**  
   An explicit model allows us to store metadata about the relation, specifically `createdAt` (timestamp when the like occurred).

4. **`include` vs `select` — when do you use which? Why did we use `select` for `author`?**  
   `include` brings back all model fields plus related models. `select` picks specific fields. We used `select` for `author` to omit sensitive fields like `email` so users scrolling feeds don't expose other users' emails.

5. **What is the N+1 problem, and how did `include` / `_count` avoid it?**  
   Fetching $N$ posts and then performing individual queries in a loop for each author and like count results in $1 + N + N = 2N+1$ queries. Prisma's `include` and `_count` aggregate and join the data in a single optimized database query.

6. **Why catch P2002 instead of checking "does it exist?" before inserting?**  
   "Check-then-insert" creates a race condition (time-of-check to time-of-use bug) if two like requests arrive concurrently. Inserting and catching `P2002` relies on atomic database constraints.

7. **In Step 11, why did Arjun's like count change when Riya was deleted?**  
   Arjun liked two of Riya's posts (`insta01` and `insta08`). When Riya was deleted, `onDelete: Cascade` deleted her posts, which cascaded to delete the likes associated with those posts.

8. **Cascade vs Restrict — which one would you choose for posts? For bank transactions?**  
   - **Social posts**: `Cascade` is appropriate because orphaned posts or likes without a user make no sense.
   - **Bank transactions**: `Restrict` is essential because deleting a user must never silently wipe historical financial audit logs or transaction ledgers.
