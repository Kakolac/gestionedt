import { loadEnv } from "./load-env.js";
loadEnv();

import { connectDB } from "../../src/lib/mongodb.js";
import { User } from "../../src/lib/models/User.js";

async function main() {
  await connectDB();

  const users = await User.find({
    $or: [{ roleSlugs: { $exists: false } }, { roleSlugs: { $size: 0 } }],
  });

  let updated = 0;
  for (const u of users) {
    const role = u.role === "admin" || u.role === "user" ? u.role : "user";
    await User.updateOne(
      { _id: u._id },
      { $set: { roleSlugs: [role] } }
    );
    updated += 1;
  }

  console.log(`migrate-user-role-slugs : ${updated} utilisateur(s) mis à jour.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
