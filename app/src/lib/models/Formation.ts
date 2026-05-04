import mongoose, { Schema, model, models, type InferSchemaType } from "mongoose";

/** Garde le nom de collection MongoDB existant (`contenupedagogiques`). */
export const FORMATION_MONGODB_COLLECTION = "contenupedagogiques" as const;

const FormationLigneSchema = new Schema(
  {
    matiereId: { type: Schema.Types.ObjectId, ref: "Matiere", required: true },
    professeurIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Professeur" }],
      default: [],
    },
    /** Volume horaire prévu pour cette matière dans le bloc. */
    nombreHeuresPrevues: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { _id: false }
);

/**
 * Formation : nom, description du bloc ; **lignes** (chaque ligne = une
 * matière + les professeurs associés + **heures prévues** pour cette matière dans le
 * bloc). Une matière ne peut appartenir qu’à un seul document (index unique multi-clé
 * sur les `matiereId` des lignes).
 */
const FormationSchema = new Schema(
  {
    nom: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", trim: true, maxlength: 2000 },
    lignes: {
      type: [FormationLigneSchema],
      required: true,
      validate: {
        validator: (v: unknown) => Array.isArray(v) && v.length >= 1,
        message: "Au moins une ligne (matière) est requise.",
      },
    },
    /** Somme des heures prévues par ligne (dérivé à l’enregistrement). */
    nombreHeures: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

FormationSchema.index({ "lignes.matiereId": 1 }, { unique: true });

export type FormationDoc = InferSchemaType<typeof FormationSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Formation =
  models.Formation ??
  model("Formation", FormationSchema, FORMATION_MONGODB_COLLECTION);
