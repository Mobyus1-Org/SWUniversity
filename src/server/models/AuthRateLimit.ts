import { Schema, model, models, type Model } from "mongoose";

export type AuthRateLimitDocument = {
  scope: string;
  key: string;
  count: number;
  windowStartedAt: Date;
  blockedUntil?: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const authRateLimitSchema = new Schema<AuthRateLimitDocument>(
  {
    scope: {
      type: String,
      required: true,
      trim: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
    },
    count: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    windowStartedAt: {
      type: Date,
      required: true,
    },
    blockedUntil: {
      type: Date,
      required: false,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

authRateLimitSchema.index({ scope: 1, key: 1 }, { unique: true });
authRateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthRateLimitModel =
  (models.AuthRateLimit as Model<AuthRateLimitDocument>)
  || model<AuthRateLimitDocument>("AuthRateLimit", authRateLimitSchema);