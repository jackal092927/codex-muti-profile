#!/usr/bin/env node
import path from "node:path";
import { promises as fsp } from "node:fs";

import { wrappedFs as fs } from "./asar_vendor/wrapped-fs.js";
import { Filesystem } from "./asar_vendor/filesystem.js";
import { writeFilesystem } from "./asar_vendor/disk.js";

function usage() {
  console.error("usage: pack_asar.mjs <source-dir> <archive.asar>");
  process.exit(2);
}

async function walk(dir, acc = []) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const stat = await fs.lstat(full);
    if (entry.isDirectory()) {
      acc.push([full, { type: "directory", stat }]);
      await walk(full, acc);
    } else if (entry.isSymbolicLink()) {
      acc.push([full, { type: "link", stat }]);
    } else if (entry.isFile()) {
      acc.push([full, { type: "file", stat }]);
    }
  }
  return acc;
}

async function main() {
  if (process.argv.length !== 4) {
    usage();
  }

  const src = path.resolve(process.argv[2]);
  const dest = path.resolve(process.argv[3]);
  const entries = await walk(src);
  const metadata = Object.fromEntries(entries);
  const filenames = entries.map(([filename]) => filename);

  const filesystem = new Filesystem(src);
  const files = [];
  const links = [];

  for (const filename of filenames) {
    const file = metadata[filename];
    switch (file.type) {
      case "directory":
        filesystem.insertDirectory(filename, false);
        break;
      case "file":
        files.push({ filename, unpack: false });
        await filesystem.insertFile(filename, () => fs.createReadStream(filename), false, file, {});
        break;
      case "link":
        links.push({ filename, unpack: false });
        filesystem.insertLink(filename, false);
        break;
      default:
        throw new Error(`unsupported entry type for ${filename}`);
    }
  }

  await fs.mkdirp(path.dirname(dest));
  await writeFilesystem(dest, filesystem, { files, links }, metadata);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
