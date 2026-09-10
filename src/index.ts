import dotenv from "dotenv";
dotenv.config();

import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import { connectDB } from "./config/dp";
import { protect } from "./middleware/protect";

//routes
import authRoute from "./router/userAuthRoute";
import CreateRoute from "./router/createRoute";
import {
  publicPostsRouter,
  protectedPostsRouter,
} from "./router/getPosts";
import {
  publicPostDetRouter,
  protectedPostDetRouter,
} from "./router/getPostDetRouter";
import { publicAdminRouter, protectedAdminRouter } from "./router/adminControlRoute";
import {
  publicAppConfigRouter,
  protectedAppConfigRouter,
} from "./router/appConfigRoute";
import {
  publicSupportRouter,
  protectedSupportRouter,
} from "./router/supportRoute";
import deviceRoute from "./router/deviceRoute";

const PORT = process.env.PORT || 3000;

const DEFAULT_CORS_ORIGINS = [
  "https://ousulqatar.com",
  "https://www.ousulqatar.com",
  "https://osoulqatar.com",
  "https://www.osoulqatar.com",
  "https://amctag-admin-osoul.38f0fz.easypanel.host",
  "http://localhost:8082",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

function getAllowedCorsOrigins(): string[] {
  const fromEnv = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return [...new Set([...DEFAULT_CORS_ORIGINS, ...fromEnv])];
}

function isAllowedCorsOrigin(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  return (
    /^http:\/\/localhost:\d+$/.test(origin) ||
    /^http:\/\/127\.0\.0\.1:\d+$/.test(origin) ||
    /^http:\/\/192\.168\.\d+\.\d+:\d+$/.test(origin) ||
    /^https:\/\/.*\.easypanel\.host$/.test(origin)
  );
}

/* Configeration */
const app = express();
const allowedCorsOrigins = getAllowedCorsOrigins();
connectDB();
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(morgan("common"));
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: false, limit: "25mb" }));
app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedCorsOrigin(origin, allowedCorsOrigins)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

app.get("/", (_req, res) => {
  res.json({ message: "Server is running" });
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Public routes (no auth required)
app.use("/auth", authRoute);
app.use("/devices", deviceRoute);
app.use("/", publicPostsRouter);
app.use("/", publicPostDetRouter);
app.use("/", publicAdminRouter);
app.use("/", publicAppConfigRouter);
app.use("/", publicSupportRouter);

// Protected routes (auth required)
app.use("/", protect, CreateRoute);
app.use("/", protect, protectedPostsRouter);
app.use("/", protect, protectedPostDetRouter);
app.use("/", protect, protectedAdminRouter);
app.use("/", protect, protectedAppConfigRouter);
app.use("/", protect, protectedSupportRouter);

const HOST = "0.0.0.0";

const server = app.listen(Number(PORT), HOST, () => {
  console.log(`Server is running on ${HOST}:${PORT}`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  console.error("Server error:", err);
  process.exit(1);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => process.exit(0));
});
