import mongoose, { Schema, model, models, type InferSchemaType } from "mongoose";

export const SALLE_KIND_VALUES = ["classique", "specifique"] as const;
export type SalleKind = (typeof SALLE_KIND_VALUES)[number];

const SalleSchema = new Schema(
  {
    /** Libellé affiché (ex. « Salle A101 »). */
    nom: { type: String, required: true, trim: true },
    /** Identifiant technique unique, dérivé du nom (slug). */
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    /** Classique ou équipement pédagogique (salle spécifique). */
    kind: {
      type: String,
      required: true,
      enum: [...SALLE_KIND_VALUES],
    },
    description: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

export type SalleDoc = InferSchemaType<typeof SalleSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Salle = models.Salle ?? model("Salle", SalleSchema);
