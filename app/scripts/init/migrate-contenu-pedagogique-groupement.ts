/**
 * Migre les documents **formation** (collection `contenupedagogiques`) vers le schéma **`lignes`** (chaque ligne :
 * matiereId + professeurIds pour ce bloc).
 *
 * À partir de données :
 * - **`matiereId`** seul (héritage),
 * - ou **`matiereIds`** + **`professeurIds`** à la racine (intermédiaire),
 *
 * vers `lignes` puis suppression des anciens champs racine si nécessaire.
 * Recrée aussi l’index unique sur **`lignes.matiereId`** au lieu des anciens index.
 *
 * Usage : depuis **`app/`** — `npx tsx scripts/init/migrate-contenu-pedagogique-groupement.ts`
 */
import { loadEnv } from "./load-env.js";

loadEnv();

import mongoose from "mongoose";
import { connectDB } from "../../src/lib/mongodb.js";
import { Formation } from "../../src/lib/models/Formation.js";

function toOidList(raw: unknown): mongoose.Types.ObjectId[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: mongoose.Types.ObjectId[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    const id = typeof x === "object" && x != null ? String(x) : String(x);
    if (!mongoose.isValidObjectId(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(new mongoose.Types.ObjectId(id));
  }
  return out;
}

function lignesDejaValides(raw: unknown): boolean {
  if (!Array.isArray(raw) || raw.length === 0) {
    return false;
  }
  for (const ligne of raw) {
    if (typeof ligne !== "object" || ligne == null) {
      return false;
    }
    const o = ligne as { matiereId?: unknown; professeurIds?: unknown };
    const mid =
      typeof o.matiereId === "object" && o.matiereId != null
        ? String(o.matiereId)
        : typeof o.matiereId === "string"
          ? o.matiereId
          : "";
    if (!mongoose.isValidObjectId(mid)) {
      return false;
    }
  }
  return true;
}

async function main(): Promise<void> {
  await connectDB();
  const col = Formation.collection;

  console.info(`Collection Mongoose : ${col.collectionName}`);

  let updated = 0;
  let alreadyOk = 0;
  let skipped = 0;

  const cursor = Formation.find({}).cursor();

  for await (const doc of cursor) {
    const d = doc as mongoose.Document &
      Partial<{
        matiereId: mongoose.Types.ObjectId;
        matiereIds: mongoose.Types.ObjectId[];
        lignes: Array<{
          matiereId?: mongoose.Types.ObjectId;
          professeurIds?: mongoose.Types.ObjectId[];
        }>;
        professeurIds: mongoose.Types.ObjectId[];
      }> & {
        _id: mongoose.Types.ObjectId;
      };

    if (lignesDejaValides(d.lignes)) {
      alreadyOk += 1;
      await col.updateOne(
        { _id: d._id },
        {
          $unset: { matiereId: "", matiereIds: "", professeurIds: "" },
        }
      ).catch(() => {
        /* champs peut-être déjà absents */
      });
      continue;
    }

    const profsRoot = toOidList(d.professeurIds);

    const midsFromArr = toOidList(d.matiereIds);
    const singleLegacy =
      d.matiereId != null &&
      mongoose.isValidObjectId(String(d.matiereId)) &&
      String(d.matiereId);

    let matiereOidList: mongoose.Types.ObjectId[] = [];
    if (midsFromArr.length > 0) {
      matiereOidList = midsFromArr;
    } else if (singleLegacy) {
      matiereOidList = [
        typeof d.matiereId === "object" && d.matiereId != null
          ? d.matiereId
          : new mongoose.Types.ObjectId(String(d.matiereId)),
      ];
    }

    if (matiereOidList.length === 0) {
      skipped += 1;
      console.warn(
        `Sans lignes exploitables (${String(d._id)}) — skip (vérif manuelle).`
      );
      continue;
    }

    const lignesMongo = matiereOidList.map((mid) => ({
      matiereId: mid,
      professeurIds: profsRoot.slice(),
      nombreHeuresPrevues: 0,
    }));

    await col.updateOne(
      { _id: d._id },
      {
        $set: {
          lignes: lignesMongo,
        },
        $unset: { matiereId: "", matiereIds: "", professeurIds: "" },
      }
    );
    updated += 1;
  }

  for (const name of ["matiereId_1", "matiereIds_1"]) {
    try {
      await col.dropIndex(name);
      console.info(`Index ${name} supprimé (s’il existait).`);
    } catch (e: unknown) {
      const code =
        typeof e === "object" && e != null ? (e as { code?: number }).code : undefined;
      if (code !== 27) {
        console.warn(`dropIndex ${name}:`, e);
      }
    }
  }

  try {
    await col.createIndex({ "lignes.matiereId": 1 }, { unique: true });
    console.info("Index unique créé ou déjà présent sur lignes.matiereId.");
  } catch (e: unknown) {
    console.warn("createIndex lignes.matiereId:", e);
  }

  console.info(
    `Migration terminée — mis à jour : ${updated}, déjà lignes valides : ${alreadyOk}, ignorés : ${skipped}`
  );
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
