import * as fs from "fs";
import path from "path";
import { createEnvironment, createFilesystemLoader } from "twing";

export default async function cmdExplain(args: { measureOutDir: string }) {
  const loader = createFilesystemLoader(fs);
  const env = createEnvironment(loader);

  const stats = JSON.parse(
    fs.readFileSync(path.join(args.measureOutDir, "report.json"), "utf8")
  );

  const output = await env.render("explain.twig", {
    stats,
  });
  fs.writeFileSync(path.join(args.measureOutDir, "report.md"), output);

  process.exit(0);
}
