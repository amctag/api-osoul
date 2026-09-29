import express from "express";
import {
  getSaved,
  getList,
  getFeatured,
  getCategoreyPosts,
  filterPosts,
  savePost,
  getAllPosts,
  getAdminPost,
  deletePost,
  getAllPostsPages,
} from "../controller/userPosts";

// Public routes (no auth required)
export const publicPostsRouter = express.Router();
publicPostsRouter.post("/featured", getFeatured);
publicPostsRouter.post("/all-posts-page", getAllPostsPages);
publicPostsRouter.post("/get-categorey", getCategoreyPosts);
publicPostsRouter.post("/filter", filterPosts);

// Protected routes (auth required - protect middleware applied in index.ts)
export const protectedPostsRouter = express.Router();
protectedPostsRouter.post("/saved", getSaved);
protectedPostsRouter.post("/listed", getList);
protectedPostsRouter.post("/save-post", savePost);
protectedPostsRouter.get("/get-posts", getAllPosts);
protectedPostsRouter.get("/get-admin-post", getAdminPost);
protectedPostsRouter.delete("/delete-post", deletePost);
