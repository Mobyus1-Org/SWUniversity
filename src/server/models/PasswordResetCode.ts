import { Schema, model, models, type Model, Types } from "mongoose";

export type PasswordResetCodeDocument = {
  userId: Types.ObjectId;
  codeHash: string;
  expiresAt: Date;
  lastSentAt: Date;
  failedAttemptCount: number;
  createdAt: Date;
  updatedAt: Date;
};

const passwordResetCodeSchema = new Schema<PasswordResetCodeDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
      ref: "User",
    },
    codeHash: {
      type: String,
      required: true,
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    lastSentAt: {
      type: Date,
      required: true,
    },
    failedAttemptCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// TTL cleanup for expired reset codes.
passwordResetCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetCodeModel =
  (models.PasswordResetCode as Model<PasswordResetCodeDocument>)
  || model<PasswordResetCodeDocument>("PasswordResetCode", passwordResetCodeSchema);