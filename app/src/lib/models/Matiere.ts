import mongoose, { Schema, model, models, type InferSchemaType } from "mongoose";
import { MATIERE_CONTRAINTE_KINDS } from "@/lib/matiereContraintes.shared";

/** Mode d’attachement des salles à la matière (référentiel). */
export const MATIERE_SALLE_MODE_VALUES = ["classique", "liste"] as const;
export type MatiereSalleMode = (typeof MATIERE_SALLE_MODE_VALUES)[number];

const MatiereContrainteSchema = new Schema(
  {
    kind: {
      type: String,
      enum: [...MATIERE_CONTRAINTE_KINDS],
      required: true,
    },
    priorite: { type: Number, required: true },
    actif: { type: Boolean, default: true },
    /** `plage_horaire` : matin ou après-midi (frontière configurable côté shared). */
    plage: {
      type: String,
      enum: ["matin", "apres_midi"],
      default: undefined,
    },
  },
  { _id: true }
);

const MatiereSchema = new Schema(
  {
    /** Libellé affiché (ex. « Mathématiques »). */
    nom: { type: String, required: true, trim: true },
    /** Identifiant technique unique, dérivé du nom (slug). */
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: "", trim: true },
    /**
     * `classique` : pas de liste de salles ; `liste` : salles explicites dans `salleIds`.
     */
    salleMode: {
      type: String,
      required: true,
      enum: [...MATIERE_SALLE_MODE_VALUES],
      default: "classique",
    },
    /** Références `Salle` lorsque `salleMode === "liste"` (sinon tableau vide). */
    salleIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Salle" }],
      default: [],
    },
    /** Contraintes de planification (référentiel ; placement glouton). */
    contraintes: {
      type: [MatiereContrainteSchema],
      default: [],
    },
  },
  { timestamps: true }
);

export type MatiereDoc = InferSchemaType<typeof MatiereSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Matiere = models.Matiere ?? model("Matiere", MatiereSchema);
