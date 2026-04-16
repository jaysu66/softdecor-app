import { Hono } from "hono";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export const uploadRoute = new Hono();

uploadRoute.post("/upload", async (c) => {
  try {
    const body = await c.req.parseBody({ all: true });
    const file = body["file"] as File | undefined;

    if (!file || !(file instanceof File)) {
      return c.json({ error: "No file uploaded" }, 400);
    }

    const ext = path.extname(file.name) || ".jpg";
    const filename = `${randomUUID()}${ext}`;
    const uploadDir = path.resolve(__dirname, "../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, buffer);

    // Also create base64 for AI analysis
    const base64 = buffer.toString("base64");
    const mimeType = file.type || "image/jpeg";

    return c.json({
      success: true,
      filename,
      url: `/uploads/${filename}`,
      base64: `data:${mimeType};base64,${base64}`,
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    return c.json({ error: err.message }, 500);
  }
});
