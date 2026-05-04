import mongoose, { Schema, model, models, type InferSchemaType } from "mongoose";

const MetierRoleSchema = new Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    label: { type: String, required: true, trim: true },
    /** Slugs des documents `Role` (rôles de base) agrégés par ce rôle métier. */
    baseRoleSlugs: { type: [String], default: [] },
  },
  { timestamps: true }
);

export type MetierRoleDoc = InferSchemaType<typeof MetierRoleSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const MetierRole =
  models.MetierRole ?? model("MetierRole", MetierRoleSchema);
