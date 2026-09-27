import { env } from "@/lib/env";
import { localStorageAdapter } from "./local";
import { s3StorageAdapter } from "./s3";
export interface StorageAdapter {
  putObject(buffer: Uint8Array, key: string): Promise<string>;
  deleteObject(key: string): Promise<void>;
}
export function getStorage(): StorageAdapter {
  return env.STORAGE_ADAPTER === "s3" ? s3StorageAdapter : localStorageAdapter;
}
