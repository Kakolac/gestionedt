import mongoose, { Schema, model, models, type InferSchemaType } from "mongoose";
import { PROFESSEUR_CONTRAINTE_KINDS } from "@/lib/professeurContraintes.shared";

const CreneauInterditSchema = new Schema(
  {
    jour: { type: Number, required: true, min: 1, max: 7 },
    heureDebut: { type: Number, required: true },
    heureFin: { type: Number, required: true },
  },
  { _id: false }
);

const ProfesseurContrainteSchema = new Schema(
  {
    kind: {
      type: String,
      enum: [...PROFESSEUR_CONTRAINTE_KINDS],
      required: true,
    },
    priorite: { type: Number, required: true },
    actif: { type: Boolean, default: true },
    /** 1 = lundi … 7 = dimanche (ISO weekday). */
    joursSemaine: { type: [Number], default: undefined },
    /** Fenêtres interdites (`creneaux_interdits`) ; fin horaire exclusive. */
    creneaux: { type: [CreneauInterditSchema], default: undefined },
    matiereId: {
      type: Schema.Types.ObjectId,
      ref: "Matiere",
      default: undefined,
    },
    maxHeuresConsecutives: { type: Number, default: undefined },
    maxCoursParJour: { type: Number, default: undefined },
  },
  { _id: true }
);

const ProfesseurSchema = new Schema(
  {
    prenom: { type: String, default: "", trim: true },
    /** Nom de famille (obligatoire). */
    nom: { type: String, required: true, trim: true },
    /** Identifiant technique unique (slug « Prénom Nom » ou « Nom »). */
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: "", trim: true },
    /** Références `Matiere` ; affectation enseignant → matière(s). */
    matiereIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Matiere" }],
      default: [],
    },
    /** Contraintes de planification (référentiel ; arbitrage EDT ultérieur). */
    contraintes: {
      type: [ProfesseurContrainteSchema],
      default: [],
    },
  },
  { timestamps: true }
);

export type ProfesseurDoc = InferSchemaType<typeof ProfesseurSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Professeur =
  models.Professeur ?? model("Professeur", ProfesseurSchema);
