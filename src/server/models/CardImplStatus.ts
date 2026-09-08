import { Schema, model, models, type Model } from "mongoose";
import type { CardImplLane } from "@/server/cards-impl/status-board";

/**
 * A card's position on the implementation board.
 *
 * Only cards that have been MOVED get a document — a card with no row is To Do. With ~2400 cards
 * in scope, seeding a row each would be a migration every time a set is added, and the collection
 * would be mostly noise. See `deriveLanes` for the read side.
 */
export type CardImplStatusDocument = {
  cardId: string;
  status: CardImplLane;
  /** Why the card needs work. Only meaningful on the needs-work lane. */
  note?: string;
  /** Ordering within the Priority lane; unset elsewhere. */
  priorityRank?: number;
  updatedBy: string;
};

const cardImplStatusSchema = new Schema<CardImplStatusDocument>(
  {
    cardId: { type: String, required: true, unique: true, index: true, trim: true },
    status: { type: String, enum: ["todo", "priority", "needs-work", "done"], required: true },
    note: { type: String, default: "" },
    priorityRank: { type: Number },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true },
);

export const CardImplStatusModel =
  (models.CardImplStatus as Model<CardImplStatusDocument>) ||
  model<CardImplStatusDocument>("CardImplStatus", cardImplStatusSchema);
