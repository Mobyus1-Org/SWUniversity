import { Schema, model, models, type Model } from "mongoose";
import type { CardImplLane } from "@/server/cards-impl/status-board";

/**
 * A card's position on the implementation board.
 *
 * Only cards that have been MOVED get a document — a card with no row is Not Implemented. With
 * ~2400 cards in scope, seeding a row each would be a migration every time a set is added, and the
 * collection would be mostly noise. See `deriveLanes` for the read side.
 */
export type CardImplStatusDocument = {
  cardId: string;
  status: CardImplLane;
  /** Free-text note, e.g. what is wrong with a card sent back to Priority. */
  note?: string;
  /** Ordering within the Priority lane; unset elsewhere. */
  priorityRank?: number;
  updatedBy: string;
};

const cardImplStatusSchema = new Schema<CardImplStatusDocument>(
  {
    cardId: { type: String, required: true, unique: true, index: true, trim: true },
    status: { type: String, enum: ["not-implemented", "todo", "priority", "done"], required: true },
    note: { type: String, default: "" },
    priorityRank: { type: Number },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true },
);

export const CardImplStatusModel =
  (models.CardImplStatus as Model<CardImplStatusDocument>) ||
  model<CardImplStatusDocument>("CardImplStatus", cardImplStatusSchema);
