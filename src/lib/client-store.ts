"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { LocalDebateSession } from "@/types/debate";

const DB_NAME = "aidiss2026el-pet-debate";
const CURRENT_SESSION_KEY = "aidiss2026el:v1:current-session";

interface DebateDb extends DBSchema {
  sessions: {
    key: string;
    value: LocalDebateSession;
    indexes: { "by-expires": string };
  };
}
let databasePromise: Promise<IDBPDatabase<DebateDb>> | null = null;

function database() {
  databasePromise ??= openDB<DebateDb>(DB_NAME, 1, {
    upgrade(db) {
      const sessions = db.createObjectStore("sessions", { keyPath: "id" });
      sessions.createIndex("by-expires", "expiresAt");
    },
  });
  return databasePromise;
}

export async function saveLocalSession(session: LocalDebateSession): Promise<void> {
  await (await database()).put("sessions", session);
  localStorage.setItem(CURRENT_SESSION_KEY, session.id);
}

export async function loadCurrentSession(): Promise<LocalDebateSession | null> {
  const id = localStorage.getItem(CURRENT_SESSION_KEY);
  if (!id) return null;
  const db = await database();
  const session = await db.get("sessions", id);
  if (!session) {
    localStorage.removeItem(CURRENT_SESSION_KEY);
    return null;
  }
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await db.delete("sessions", id);
    localStorage.removeItem(CURRENT_SESSION_KEY);
    return null;
  }
  return session;
}

export async function deleteLocalSession(id: string): Promise<void> {
  await (await database()).delete("sessions", id);
  if (localStorage.getItem(CURRENT_SESSION_KEY) === id) {
    localStorage.removeItem(CURRENT_SESSION_KEY);
  }
}

export async function clearExpiredLocalSessions(): Promise<void> {
  const db = await database();
  const tx = db.transaction("sessions", "readwrite");
  let cursor = await tx.store.index("by-expires").openCursor();
  const now = new Date().toISOString();
  while (cursor) {
    if (cursor.value.expiresAt <= now) await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}
