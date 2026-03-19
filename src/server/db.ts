import mongoose from "mongoose";

import { getRequiredEnv } from "@/server/env";

const globalWithMongoose = globalThis as typeof globalThis & {
  mongooseConnectionPromise?: Promise<typeof mongoose>;
};

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (!globalWithMongoose.mongooseConnectionPromise) {
    const mongoUri = getRequiredEnv("MONGO_CONNECTION_STRING");
    globalWithMongoose.mongooseConnectionPromise = mongoose.connect(mongoUri, {
      bufferCommands: false,
    });
  }

  return globalWithMongoose.mongooseConnectionPromise;
}
