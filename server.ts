import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json());

  // Auth Middleware (very simple for this demo)
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

  app.get("/api/data", async (req, res) => {
    const { data, error } = await supabase
      .from('app_data')
      .select('data')
      .eq('id', 1)
      .single();
      
    if (error && error.code !== 'PGRST116') { // PGRST116 is 'not found'
      console.error("Error fetching data:", error);
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }
    
    res.json(data ? data.data : null);
  });

  app.post("/api/data", auth, async (req, res) => {
    const payload = req.body;
    const { error } = await supabase
      .from('app_data')
      .upsert({ id: 1, data: payload }, { onConflict: 'id' });
      
    if (error) {
      console.error("Error saving data:", error);
      res.status(500).json({ error: "Failed to save data" });
      return;
    }
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
