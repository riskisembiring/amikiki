const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT) || 3000;
const rootDir = __dirname;
const acceptedFile = path.join(rootDir, "accepted.json");

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(data, null, 2));
}

function sendFile(response, filePath, contentType) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("File not found");
      return;
    }

    response.writeHead(200, { "Content-Type": contentType });
    response.end(content);
  });
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10_000) {
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });

    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    sendFile(response, path.join(rootDir, "index.html"), "text/html; charset=utf-8");
    return;
  }

  if (request.method === "GET" && url.pathname === "/amikiki.JPG") {
    sendFile(response, path.join(rootDir, "amikiki.JPG"), "image/jpeg");
    return;
  }

  if (request.method === "GET" && url.pathname === "/accepted.json") {
    if (!fs.existsSync(acceptedFile)) {
      sendJson(response, 200, { accepted: false });
      return;
    }

    sendFile(response, acceptedFile, "application/json; charset=utf-8");
    return;
  }

  if (request.method === "POST" && url.pathname === "/accept") {
    try {
      const body = await readBody(request);
      const incoming = body ? JSON.parse(body) : {};
      const acceptedData = {
        accepted: true,
        acceptedAt: incoming.acceptedAt || new Date().toISOString(),
        language: incoming.language || "id",
        userAgent: request.headers["user-agent"] || ""
      };

      fs.writeFileSync(acceptedFile, JSON.stringify(acceptedData, null, 2));
      sendJson(response, 200, { ok: true, data: acceptedData });
    } catch (error) {
      sendJson(response, 400, { ok: false, error: "Could not save acceptance data" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/reset") {
    const resetData = { accepted: false };
    fs.writeFileSync(acceptedFile, JSON.stringify(resetData, null, 2));
    sendJson(response, 200, { ok: true, data: resetData });
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
