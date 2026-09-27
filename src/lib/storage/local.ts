import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
export function validateObjectKey(key: string) {
  if (!/^[a-zA-Z0-9_-]+\.webp$/.test(key))
    throw new Error("Invalid storage key.");
  return key;
}
/**
 * Uploads live outside public/: a production server only serves public files
 * that existed at build time. src/app/uploads/[key]/route.ts serves them, and
 * .data/ is the one directory a Docker deployment mounts as a volume.
 */
export const uploadsDirectory = () => join(process.cwd(), ".data/uploads");
export const localStorageAdapter = {
  async putObject(buffer: Uint8Array, key: string) {
    validateObjectKey(key);
    await mkdir(uploadsDirectory(), { recursive: true });
    await writeFile(join(uploadsDirectory(), key), buffer, { flag: "wx" });
    return `/uploads/${key}`;
  },
  async getObject(key: string) {
    validateObjectKey(key);
    return readFile(join(uploadsDirectory(), key));
  },
  async deleteObject(key: string) {
    validateObjectKey(key);
    await unlink(join(uploadsDirectory(), key)).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  },
};
