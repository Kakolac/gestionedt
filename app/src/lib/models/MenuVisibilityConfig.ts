import mongoose, { Schema, model, models, type InferSchemaType } from "mongoose";

/** Document singleton : quels rôles métier peuvent voir quelles tuiles (affichage uniquement). */
const MenuVisibilityConfigSchema = new Schema(
  {
    singletonKey: {
      type: String,
      required: true,
      unique: true,
      default: "global",
    },
    /**
     * Clé = identifiant stable de tuile (voir `NAV_TILE_DEFINITIONS`).
     * Valeur = slugs `MetierRole` autorisés à voir la tuile.
     * Absence de clé ou liste vide pour une tuile ⇒ pas de visibilité au menu (système strict).
     */
    byTile: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

export type MenuVisibilityConfigDoc = InferSchemaType<
  typeof MenuVisibilityConfigSchema
> & {
  _id: mongoose.Types.ObjectId;
};

export const MENU_VISIBILITY_GLOBAL_KEY = "global" as const;

export const MenuVisibilityConfig =
  models.MenuVisibilityConfig ??
  model("MenuVisibilityConfig", MenuVisibilityConfigSchema);
