const express = require("express");

const userRoutes = require("./routes/users.routes");
const postRoutes = require("./routes/posts.routes");

const app = express();

app.use(express.json());

// Root endpoint — API overview & status
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Welcome to InstaLite API",
    status: "running",
    endpoints: {
      health: "GET /health",
      users: {
        list:    "GET /users",
        getOne:  "GET /users/:id",
        create:  "POST /users",
        update:  "PATCH /users/:id",
        delete:  "DELETE /users/:id",
      },
      posts: {
        list:    "GET /posts",
        getOne:  "GET /posts/:id",
        create:  "POST /posts",
        update:  "PATCH /posts/:id",
        delete:  "DELETE /posts/:id",
      },
    },
  });
});

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

// Modular routes
app.use("/users", userRoutes);
app.use("/posts", postRoutes);

module.exports = app;
