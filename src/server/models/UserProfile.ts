import { Schema, model, models, type Model, Types } from "mongoose";

import type {
  DifficultyBreakdown,
  EndlessModeStats,
  GameCompletedEntry,
} from "@/util/profile-data";
import {
  createEmptyDifficultyBreakdown,
  createEmptyEndlessModeStats,
} from "@/util/profile-data";

export type UserProfileDocument = {
  userId: Types.ObjectId;
  gamesCompleted: Array<Omit<GameCompletedEntry, "date"> & { date: Date }>;
  endlessModeStats: EndlessModeStats;
  badges: string[];
  solvedPuzzleIds: string[];
  masteredQuizIds: string[];
  masteredDykswuIds: string[];
  createdAt: Date;
  updatedAt: Date;
};

const difficultyBreakdownSchema = new Schema<DifficultyBreakdown>(
  {
    padawan: {
      correct: { type: Number, required: true, default: 0, min: 0 },
      total: { type: Number, required: true, default: 0, min: 0 },
    },
    knight: {
      correct: { type: Number, required: true, default: 0, min: 0 },
      total: { type: Number, required: true, default: 0, min: 0 },
    },
    master: {
      correct: { type: Number, required: true, default: 0, min: 0 },
      total: { type: Number, required: true, default: 0, min: 0 },
    },
  },
  { _id: false },
);

const endlessAppStatsSchema = new Schema(
  {
    correct: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    difficultyBreakdown: {
      type: difficultyBreakdownSchema,
      required: true,
      default: createEmptyDifficultyBreakdown,
    },
  },
  { _id: false },
);

const gameCompletedSchema = new Schema<UserProfileDocument["gamesCompleted"][number]>(
  {
    date: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    app: {
      type: String,
      enum: ["quiz", "dykswu"],
      required: true,
    },
    mode: {
      type: String,
      enum: ["standard", "iron-man", "padawan", "knight", "master"],
      required: true,
    },
    correct: {
      type: Number,
      required: true,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    difficultyBreakdown: {
      type: difficultyBreakdownSchema,
      required: true,
      default: createEmptyDifficultyBreakdown,
    },
  },
  { _id: false },
);

const endlessModeStatsSchema = new Schema<EndlessModeStats>(
  {
    quiz: {
      type: endlessAppStatsSchema,
      required: true,
      default: () => createEmptyEndlessModeStats().quiz,
    },
    dykswu: {
      type: endlessAppStatsSchema,
      required: true,
      default: () => createEmptyEndlessModeStats().dykswu,
    },
  },
  { _id: false },
);

const userProfileSchema = new Schema<UserProfileDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
      ref: "User",
    },
    gamesCompleted: {
      type: [gameCompletedSchema],
      required: true,
      default: [],
    },
    endlessModeStats: {
      type: endlessModeStatsSchema,
      required: true,
      default: createEmptyEndlessModeStats,
    },
    badges: {
      type: [String],
      required: true,
      default: [],
    },
    solvedPuzzleIds: {
      type: [String],
      required: true,
      default: [],
    },
    masteredQuizIds: {
      type: [String],
      required: true,
      default: [],
    },
    masteredDykswuIds: {
      type: [String],
      required: true,
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

export const UserProfileModel =
  (models.UserProfile as Model<UserProfileDocument>) ||
  model<UserProfileDocument>("UserProfile", userProfileSchema);
