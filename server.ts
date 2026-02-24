import express from "express";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment variables.");
  // Don't exit process in serverless, just log
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '');

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(express.json());

// Auth Middleware
const auth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader === "Bearer admin-token") {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
};

// API Routes
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .eq('password', password)
    .single();

  if (data) {
    res.json({ token: "admin-token", username: data.username });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});


// Vite middleware for local development ONLY
if (process.env.NODE_ENV !== "production" && process.env.VERCEL !== "1") {
  // We use dynamic import so Vite is strictly excluded from Vercel Serverless builds
  import('vite').then(async (viteModule) => {
    const vite = await viteModule.createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }).catch(err => {
    console.error("Failed to start Vite middleware", err);
  });
}

// Vercel Serverless Export
export default app;
