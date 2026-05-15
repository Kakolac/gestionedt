import mongoose, { Schema, model, models, type InferSchemaType } from "mongoose";
import { defaultFormationContraintesMongo } from "@/lib/formationContraintes";
import { FORMATION_CONTRAINTE_KINDS } from "@/lib/formationContraintes.shared";

/** Garde le nom de collection MongoDB existant (`contenupedagogiques`). */
export const FORMATION_MONGODB_COLLECTION = "contenupedagogiques" as const;

const FormationContrainteSchema = new Schema(
  {
    kind: {
      type: String,
      required: true,
      enum: [...FORMATION_CONTRAINTE_KINDS],
    },
    heureDebut: Number,
    heureFin: Number,
    heureMin: Number,
    heureFinMax: Number,
    joursSemaine: [Number],
  },
  { _id: false }
);

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

const FormationVacancePeriodeSchema = new Schema(
  {
    debut: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10,
      validate: {
        validator: (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v),
        message: "Format de date invalide (attendu: YYYY-MM-DD)",
      },
    },
    fin: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10,
      validate: {
        validator: (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v),
        message: "Format de date invalide (attendu: YYYY-MM-DD)",
      },
    },
    nom: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
  },
  { _id: false }
);

/**
 * Formation : nom, description du bloc ; **lignes** (chaque ligne = une
 * matière + les professeurs associés + **heures prévues** pour cette matière dans le
 * bloc). Une même matière du référentiel peut figurer dans **plusieurs** formations ;
 * dans **un** document, chaque `matiereId` reste unique (validation applicative).
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
    /**
     * Contraintes planning obligatoires pour cette formation (pause midi, plage jour,
     * jours). Défaut à la création si absent ; les anciennes fiches peuvent être
     * complétées à l’enregistrement depuis l’administration.
     */
    contraintes: {
      type: [FormationContrainteSchema],
      default() {
        return defaultFormationContraintesMongo();
      },
    },
    /** ISO 3166-1 alpha-2 / alpha-3 — liste fermée côté app ; vide = pas de filtre jours fériés. */
    localisationPays: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 3,
      default: "",
    },
    /** Subdivision pour `date-holidays` (ex. WAL), optionnelle. */
    localisationRegion: {
      type: String,
      trim: true,
      maxlength: 32,
      default: "",
    },
    /**
     * Premier jour civil de la formation (`YYYY-MM-DD`, interprété en UTC date-only).
     * Obligatoire à la création / mise à jour via l’admin ; les anciennes fiches peuvent être vides jusqu’à édition.
     */
    dateDemarrageIso: {
      type: String,
      trim: true,
      maxlength: 10,
      default: "",
    },
    /**
     * Périodes de vacances pour cette formation (aucun cours ne sera planifié pendant ces périodes).
     * Optionnel ; peut être défini/modifié via l'administration.
     */
    datesVacances: {
      type: [FormationVacancePeriodeSchema],
      default: [],
      validate: {
        validator: function (periodes: Array<{ debut: string; fin: string; nom: string }>) {
          return periodes.every((p) => p.debut <= p.fin);
        },
        message: "La date de fin doit être postérieure ou égale à la date de début pour chaque période",
      },
    },
    /**
     * Références vers des périodes de vacances réutilisables depuis le référentiel.
     * Ces périodes sont centralisées et peuvent être partagées entre formations.
     */
    periodeVacancesIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "PeriodeVacances" }],
      default: [],
    },
  },
  { timestamps: true }
);

/** Index non unique : filtrer les formations par matière sans interdire la réutilisation entre fiches. */
FormationSchema.index({ "lignes.matiereId": 1 });

export type FormationDoc = InferSchemaType<typeof FormationSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Formation =
  models.Formation ??
  model("Formation", FormationSchema, FORMATION_MONGODB_COLLECTION);
