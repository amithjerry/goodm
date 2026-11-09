const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const inquiryFile = path.resolve(process.env.PORTFOLIO_INQUIRY_FILE || path.join(root, ".portfolio-data", "server-enquiries.json"));
const adminPassword = "admin";
const sessions = new Map();
const sessionLifetime = 8 * 60 * 60 * 1000;
const maxRequestBytes = 16 * 1024;
let writeQueue = Promise.resolve();
const privateFiles = new Set(["README.md", "server.js", "start-mobile-server.bat"]);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a whole number between 1 and 65535.");
}

function isWithinRoot(filePath) {
  const relativePath = path.relative(root, filePath);
  return relativePath === "" || (!relativePath.startsWith(`..${path.sep}`) && relativePath !== ".." && !path.isAbsolute(relativePath));
}

function sendText(response, statusCode, message, method) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store"
  });
  response.end(method === "HEAD" ? undefined : message);
}

function sendJson(response, statusCode, data, headers = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
    ...headers
  });
  response.end(JSON.stringify(data));
}

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function readJsonBody(request) {
  if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
    throw new ApiError(415, "Send data as JSON.");
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > maxRequestBytes) throw new ApiError(413, "Request is too large.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "Request body must be valid JSON.");
  }
}

function validateInquiry(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ApiError(400, "Provide your name, email, and message.");
  }
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !message || message.length > 10000) {
    throw new ApiError(400, "Enter a valid name, email, and message (up to 10,000 characters).");
  }
  return { name, email, message };
}

async function readInquiries() {
  try {
    const saved = await fsp.readFile(inquiryFile, "utf8");
    const records = JSON.parse(saved);
    if (!Array.isArray(records)) throw new Error("Stored enquiries must be a list.");
    return records;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function serializeWrite(operation) {
  const result = writeQueue.then(operation);
  writeQueue = result.catch(() => {});
  return result;
}

async function saveInquiries(records) {
  await fsp.mkdir(path.dirname(inquiryFile), { recursive: true });
  const temporaryFile = `${inquiryFile}.${crypto.randomUUID()}.tmp`;
  try {
    await fsp.writeFile(temporaryFile, JSON.stringify(records, null, 2), { encoding: "utf8", mode: 0o600 });
    await fsp.rename(temporaryFile, inquiryFile);
  } catch (error) {
    await fsp.rm(temporaryFile, { force: true });
    throw error;
  }
}

function getSession(request) {
  const cookie = request.headers.cookie || "";
  const token = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("portfolio_admin="))?.slice("portfolio_admin=".length);
  if (!token) return false;
  const expiresAt = sessions.get(token);
  if (!expiresAt || expiresAt <= Date.now()) {
    sessions.delete(token);
    return false;
  }
  return token;
}

function requireAdmin(request) {
  if (!getSession(request)) throw new ApiError(401, "Sign in to manage enquiries.");
}

function sessionCookie(request, value, maxAge) {
  const secure = request.socket.encrypted || request.headers["x-forwarded-proto"] === "https";
  return `portfolio_admin=${value}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

async function handleApiRequest(request, response) {
  const { pathname } = new URL(request.url, "http://localhost");
  try {
    if (pathname === "/api/enquiries" && request.method === "POST") {
      const inquiry = validateInquiry(await readJsonBody(request));
      const record = { id: crypto.randomUUID(), ...inquiry, createdAt: new Date().toISOString() };
      await serializeWrite(async () => {
        const records = await readInquiries();
        records.unshift(record);
        await saveInquiries(records);
      });
      sendJson(response, 201, { saved: true });
      return;
    }

    if (pathname === "/api/admin/session" && request.method === "POST") {
      const body = await readJsonBody(request);
      const supplied = typeof body?.password === "string" ? body.password : "";
      const expectedHash = crypto.createHash("sha256").update(adminPassword).digest();
      const suppliedHash = crypto.createHash("sha256").update(supplied).digest();
      if (!crypto.timingSafeEqual(expectedHash, suppliedHash)) throw new ApiError(401, "That admin password is incorrect.");
      const token = crypto.randomBytes(32).toString("base64url");
      sessions.set(token, Date.now() + sessionLifetime);
      sendJson(response, 200, { signedIn: true }, { "Set-Cookie": sessionCookie(request, token, sessionLifetime / 1000) });
      return;
    }

    if (pathname === "/api/admin/session" && request.method === "DELETE") {
      const token = getSession(request);
      if (token) sessions.delete(token);
      sendJson(response, 200, { signedOut: true }, { "Set-Cookie": sessionCookie(request, "", 0) });
      return;
    }

    if (pathname === "/api/admin/enquiries" && request.method === "GET") {
      requireAdmin(request);
      sendJson(response, 200, { enquiries: await readInquiries() });
      return;
    }

    if (pathname === "/api/admin/enquiries/import" && request.method === "POST") {
      requireAdmin(request);
      const input = await readJsonBody(request);
      const inquiry = validateInquiry(input);
      const id = typeof input.id === "string" && /^[0-9a-f-]{36}$/i.test(input.id) ? input.id : crypto.randomUUID();
      const createdAt = typeof input.createdAt === "string" && Number.isFinite(Date.parse(input.createdAt))
        ? new Date(input.createdAt).toISOString()
        : new Date().toISOString();
      const imported = await serializeWrite(async () => {
        const records = await readInquiries();
        if (records.some((record) => record.id === id)) return false;
        records.unshift({ id, ...inquiry, createdAt });
        await saveInquiries(records);
        return true;
      });
      sendJson(response, 200, { imported });
      return;
    }

    const deleteMatch = pathname.match(/^\/api\/admin\/enquiries\/([0-9a-f-]{36})$/i);
    if (deleteMatch && request.method === "DELETE") {
      requireAdmin(request);
      const id = deleteMatch[1];
      await serializeWrite(async () => {
        const records = await readInquiries();
        const remaining = records.filter((record) => record.id !== id);
        if (remaining.length === records.length) throw new ApiError(404, "Enquiry not found.");
        await saveInquiries(remaining);
      });
      sendJson(response, 200, { deleted: true });
      return;
    }

    sendJson(response, 404, { error: "API endpoint not found." });
  } catch (error) {
    if (error instanceof ApiError) {
      sendJson(response, error.status, { error: error.message });
      return;
    }
    console.error("Enquiry API error:", error);
    sendJson(response, 500, { error: "Unable to process the request. Check server storage and try again." });
  }
}

const server = http.createServer((request, response) => {
  const method = request.method;
  if (request.url.startsWith("/api/")) {
    void handleApiRequest(request, response);
    return;
  }
  if (method !== "GET" && method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    sendText(response, 405, "Method not allowed.", method);
    return;
  }

  let pathname;
  let decodedPathname;
  try {
    const rawPathname = request.url.split("?")[0];
    decodedPathname = decodeURIComponent(rawPathname);
    pathname = new URL(request.url, "http://localhost").pathname;
  } catch {
    sendText(response, 400, "Invalid request path.", method);
    return;
  }

  const pathSegments = decodedPathname.split(/[\\/]+/);
  if (decodedPathname.includes("\0")
    || decodedPathname.includes("\\")
    || pathSegments.some((segment) => segment === "." || segment === ".." || segment.startsWith("."))) {
    sendText(response, 403, "Forbidden.", method);
    return;
  }
  if (privateFiles.has(path.basename(decodedPathname))) {
    sendText(response, 404, "Not found.", method);
    return;
  }

  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(root, `.${requestedPath}`);
  if (!isWithinRoot(filePath)) {
    sendText(response, 403, "Forbidden.", method);
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      sendText(response, 404, "Not found.", method);
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Content-Length": stats.size,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache"
    });
    if (method === "HEAD") {
      response.end();
      return;
    }
    const stream = fs.createReadStream(filePath);
    stream.on("error", () => {
      if (response.headersSent) response.destroy();
      else sendText(response, 500, "Unable to read requested file.", method);
    });
    stream.pipe(response);
  });
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Close the other server or run with PORT=4174.`);
    process.exitCode = 1;
    return;
  }
  console.error(error);
  process.exitCode = 1;
});

server.listen(port, "0.0.0.0", () => {
  console.log("Portfolio server is running on your local network:");
  console.log(`  This computer: http://localhost:${port}`);

  const interfaces = Object.values(os.networkInterfaces()).flat();
  const localAddresses = interfaces
    .filter((network) => network && network.family === "IPv4" && !network.internal)
    .map((network) => network.address)
    .filter((address) => {
      const octets = address.split(".").map(Number);
      return octets[0] === 10
        || octets[0] === 192 && octets[1] === 168
        || octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31;
    });
  const uniqueAddresses = [...new Set(localAddresses)];
  if (uniqueAddresses.length === 0) {
    console.log("  No private network address found. Check that Wi-Fi is connected.");
  } else {
    uniqueAddresses.forEach((address) => console.log(`  Phone / tablet:  http://${address}:${port}`));
  }
  console.log("Enquiries are stored on this server until an admin deletes them.");
  console.log("Demo admin password: admin. Do not expose this server to the public internet.");
  console.log("Keep this window open while previewing. Press Ctrl+C to stop the server.");
});
