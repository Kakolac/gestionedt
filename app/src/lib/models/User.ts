import mongoose, { Schema, model, models, type InferSchemaType } from "mongoose";

const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    name: { type: String, default: "", trim: true },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
    /**
     * Slugs de rôles **de base** (`Role.slug`) ; **plusieurs valeurs autorisées**.
     * Peut être **combiné** avec `metierRoleSlugs` : l’union (après expansion des métiers)
     * donne les slugs effectifs pour les permissions.
     * Si vide côté document, la logique applicative replie sur le champ legacy `role`.
     */
    roleSlugs: { type: [String], default: [] },
    /**
     * Slugs de **rôles métier** (`MetierRole.slug`). Chacun s’expand en plusieurs
     * `Role.slug` via `baseRoleSlugs`. **Mix** possible avec `roleSlugs` (base directe).
     */
    metierRoleSlugs: { type: [String], default: [] },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof UserSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const User = models.User ?? model("User", UserSchema);
