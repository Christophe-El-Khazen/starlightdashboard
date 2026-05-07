import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // API Route: Proxy Shotgun Events
  app.get("/api/shotgun/events", async (req, res) => {
    const apiKey = process.env.SHOTGUN_API_KEY;
    const defaultOrganizerId = process.env.SHOTGUN_ORGANIZER_ID;
    const requestedId = req.query.organizerId as string;
    
    const organizerId = requestedId || defaultOrganizerId;

    console.log(`[Shotgun Proxy] Request received. OrganizerID: ${organizerId || 'NONE'}, Has API Key: ${!!apiKey}`);

    if (!apiKey) {
      return res.status(400).json({ 
        error: "Configuration Shotgun manquante",
        details: "Assurez-vous d'avoir configuré SHOTGUN_API_KEY dans les Secrets de l'application." 
      });
    }

    try {
      const hosts = [
        "partner-api.shotgun.live",
        "api.shotgun.live", 
        "public-api.shotgun.live"
      ];
      
      const variations: string[] = [];

      // If we have an ID, try ID-based endpoints first
      if (organizerId) {
        const idPaths = [
          (host: string, id: string) => `https://${host}/v2/organizers/${id}/events`,
          (host: string, id: string) => `https://${host}/v2/organisers/${id}/events`,
          (host: string, id: string) => `https://${host}/v2/events?organizer_id=${id}`,
          (host: string, id: string) => `https://${host}/v2/events?organiser_id=${id}`,
          (host: string, id: string) => `https://${host}/partner/v1/organizers/${id}/events`,
          (host: string, id: string) => `https://${host}/partner/v1/organisers/${id}/events`,
          (host: string, id: string) => `https://${host}/v1/organizers/${id}/events`,
          (host: string, id: string) => `https://${host}/v1/organisers/${id}/events`,
          (host: string, id: string) => `https://${host}/v2/venues/${id}/events`
        ];

        hosts.forEach(host => {
          idPaths.forEach(pathFn => variations.push(pathFn(host, organizerId)));
        });
      }

      // Always try ID-less endpoints (they might use the token context)
      const generalPaths = [
        (host: string) => `https://${host}/v2/events`,
        (host: string) => `https://${host}/partner/v1/events`,
        (host: string) => `https://${host}/v1/events`
      ];

      hosts.forEach(host => {
        generalPaths.forEach(pathFn => variations.push(pathFn(host)));
      });

      const errors: any[] = [];
      
      for (const url of variations) {
        try {
          console.log(`[Shotgun Proxy] Trying URL: ${url}`);
          const headers: Record<string, string> = {
            "Accept": "application/json",
            "User-Agent": "Starlight-Dashboard/1.0"
          };

          // Try different auth headers
          headers["Authorization"] = `Bearer ${apiKey}`;
          headers["X-Partner-Token"] = apiKey; // Common in Partner APIs
          headers["X-Shotgun-Api-Key"] = apiKey;
          headers["X-Api-Key"] = apiKey;

          const response = await fetch(url, { headers });

          if (response.ok) {
            const data = await response.json();
            console.log(`[Shotgun Proxy] Success with URL: ${url}`);
            return res.json(data);
          }

          const status = response.status;
          let details = "Error";
          try {
            const text = await response.text();
            details = text.slice(0, 500); 
          } catch (e) {
            details = "Could not read error body";
          }

          console.warn(`[Shotgun Proxy] Failed URL ${url}: ${status} - ${details}`);
          errors.push({ url, status, details });

          if (status === 401 || status === 403) {
            // If auth fails on the partner-api host with a specific token, it's likely the key is wrong.
          }
        } catch (fetchErr: any) {
          console.error(`[Shotgun Proxy] Fetch error for ${url}:`, fetchErr.message);
          errors.push({ url, status: "FETCH_ERROR", details: fetchErr.message });
        }
      }

      return res.status(502).json({ 
        error: "Échec de la synchronisation Shotgun",
        details: "L'API Shotgun a refusé toutes les tentatives de connexion. Vérifiez que votre API KEY est bien un 'Partner Token' et que votre ID est correct.",
        debug: errors.map(e => ({ url: e.url, status: e.status, details: e.details }))
      });

    } catch (error: any) {
      console.error("[Shotgun Proxy] Global Error:", error);
      res.status(500).json({ error: "Erreur interne du proxy", details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
