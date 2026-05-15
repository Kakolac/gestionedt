import mongoose, { Schema, model, models, type InferSchemaType } from "mongoose";

export const PERIODE_VACANCES_MONGODB_COLLECTION = "periodesvacances" as const;

const PeriodeVacancesSchema = new Schema(
  {
    nom: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
    },
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
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

PeriodeVacancesSchema.index({ slug: 1 });
PeriodeVacancesSchema.index({ debut: 1, fin: 1 });

PeriodeVacancesSchema.pre("validate", function () {
  if (this.debut && this.fin && this.debut > this.fin) {
    throw new Error("La date de fin doit être postérieure ou égale à la date de début");
  }
});

export type PeriodeVacancesDoc = InferSchemaType<typeof PeriodeVacancesSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PeriodeVacances =
  models.PeriodeVacances ??
  model("PeriodeVacances", PeriodeVacancesSchema, PERIODE_VACANCES_MONGODB_COLLECTION);
