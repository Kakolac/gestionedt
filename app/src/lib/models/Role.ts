import mongoose, { Schema, model, models, type InferSchemaType } from "mongoose";

const RoleSchema = new Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    label: { type: String, required: true, trim: true },
    permissions: { type: [String], default: [] },
  },
  { timestamps: true }
);

export type RoleDoc = InferSchemaType<typeof RoleSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Role = models.Role ?? model("Role", RoleSchema);
