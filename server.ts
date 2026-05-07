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
    const organizerId = process.env.SHOTGUN_ORGANIZER_ID;

    if (!apiKey || !organizerId) {
      return res.status(400).json({ 
        error: "Configuration Shotgun manquante",
        details: "Assurez-vous d'avoir configuré SHOTGUN_API_KEY et SHOTGUN_ORGANIZER_ID dans les Secrets." 
      });
    }

    try {
      // Trying variations of the Shotgun API endpoint and hosts
      const hosts = [
        "api.shotgun.live", 
        "public-api.shotgun.live",
        "partner-api.shotgun.live",
        "partner.shotgun.live",
        "public.shotgun.live"
      ];
      const paths = [
        (host: string, id: string) => `https://${host}/v2/organizers/${id}/events`,
        (host: string, id: string) => `https://${host}/partner/v1/organizers/${id}/events`,
        (host: string, id: string) => `https://${host}/v1/organizers/${id}/events`,
        (host: string, id: string) => `https://${host}/organizers/${id}/events`,
        (host: string, id: string) => `https://${host}/v2/venues/${id}/events`,
        (host: string, id: string) => `https://${host}/v2/events?organizer_id=${id}`,
        (host: string, id: string) => `https://${host}/v2/events?filter[organizer_id]=${id}`,
        (host: string, id: string) => `https://${host}/v2/events?filter[venue_id]=${id}`,
        (host: string, id: string) => `https://${host}/api/v2/organizers/${id}/events`,
        (host: string, id: string) => `https://${host}/api/v2/venues/${id}/events`,
        (host: string, id: string) => `https://${host}/api/partner/v1/organizers/${id}/events`,
        (host: string, id: string) => `https://${host}/api/v1/organizers/${id}/events`
      ];

      const variations: string[] = [];
      hosts.forEach(host => {
        paths.forEach(pathFn => variations.push(pathFn(host, organizerId)));
      });

      const errors: any[] = [];
      for (const url of variations) {
        console.log(`Calling Shotgun API: ${url}`);
        const response = await fetch(url, {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "X-Shotgun-Api-Key": apiKey,
            "Accept": "application/json"
          }
        });

        if (response.ok) {
          const data = await response.json();
          return res.json(data);
        }

        const contentType = response.headers.get("content-type") || "";
        let errorBody = "No body";
        if (contentType.includes("application/json")) {
          errorBody = await response.text();
        } else {
          errorBody = `Non-JSON response (Status: ${response.status})`;
        }

        errors.push({
          status: response.status,
          url: url,
          data: errorBody
        });
        
        if (response.status === 401 || response.status === 403) {
          break;
        }
      }

      console.error("Shotgun API Errors:", errors);
      return res.status(errors[errors.length - 1]?.status || 500).json({ 
        error: "Impossible de contacter l'API Shotgun",
        details: "Toutes les variations d'URL ont échoué.",
        errors: errors
      });
    } catch (error: any) {
      console.error("Server Error:", error);
      res.status(500).json({ error: "Erreur serveur interne", details: error.message });
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
