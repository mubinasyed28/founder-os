/**
 * MongoDB client singleton for Cofoundr OS.
 *
 * Uses lazy initialization and connection pooling.
 * The client is created once and reused across all server functions.
 */
import { MongoClient, type Db } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;

function getMongoUri(): string {
  const uri = process.env["MONGODB_URI"];
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Copy .env.example to .env and add your MongoDB Atlas connection string.",
    );
  }
  return uri;
}

function getDbName(): string {
  return process.env["MONGODB_DB_NAME"] || "cofoundr_os";
}

/**
 * Returns a connected MongoDB client singleton.
 * Creates the connection on first call, reuses on subsequent calls.
 */
export async function getMongoClient(): Promise<MongoClient> {
  if (client) return client;

  client = new MongoClient(getMongoUri(), {
    maxPoolSize: 10,
    minPoolSize: 1,
    maxIdleTimeMS: 30_000,
    serverSelectionTimeoutMS: 5_000,
    connectTimeoutMS: 10_000,
  });

  await client.connect();
  console.log("[db] Connected to MongoDB Atlas");
  return client;
}

/**
 * Returns the default database instance.
 */
export async function getDb(): Promise<Db> {
  if (db) return db;
  const c = await getMongoClient();
  db = c.db(getDbName());
  return db;
}

/**
 * Collection accessors for type-safe access to each collection.
 */
export async function companiesCollection() {
  return (await getDb()).collection("companies");
}

export async function conversationsCollection() {
  return (await getDb()).collection("conversations");
}

export async function documentsCollection() {
  return (await getDb()).collection("documents");
}

export async function chunksCollection() {
  return (await getDb()).collection("chunks");
}

/**
 * Ensure required indexes exist.
 * Call once during app startup or first request.
 */
let indexesCreated = false;
export async function ensureIndexes(): Promise<void> {
  if (indexesCreated) return;

  const d = await getDb();

  // Companies: unique-ish lookup, but no strict unique since we might have multiple
  await d.collection("companies").createIndex({ createdAt: -1 });

  // Conversations: query by company
  await d
    .collection("conversations")
    .createIndex({ companyId: 1, createdAt: -1 });

  // Documents: query by company
  await d
    .collection("documents")
    .createIndex({ companyId: 1, uploadedAt: -1 });

  // Chunks: query by company + document
  await d.collection("chunks").createIndex({ companyId: 1, documentId: 1 });

  // NOTE: The vector search index on `chunks.embedding` must be created
  // manually in Atlas UI (see mongodb_atlas_setup.md Step 7).

  indexesCreated = true;
  console.log("[db] Indexes ensured");
}
