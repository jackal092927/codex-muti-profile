#!/usr/bin/env node
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import { readArchiveHeaderSync, readFileWithFd } from "./asar_vendor/disk.js";
import { Filesystem } from "./asar_vendor/filesystem.js";

function usage() {
  console.error("usage: extract_asar.mjs <archive.asar> <output-dir>");
  process.exit(2);
}

function walk(node, prefix = "") {
  const entries = [];
  const files = node.files || {};
  for (const [name, child] of Object.entries(files)) {
    const rel = prefix ? `${prefix}/${name}` : name;
    if (child.files) {
      entries.push({ type: "directory", rel, node: child });
      entries.push(...walk(child, rel));
    } else if (child.link) {
      entries.push({ type: "link", rel, node: child });
    } else {
      entries.push({ type: "file", rel, node: child });
    }
  }
  return entries;
}

async function main() {
  if (process.argv.length !== 4) {
    usage();
  }

  const archive = path.resolve(process.argv[2]);
  const outDir = path.resolve(process.argv[3]);
  const unpackedRoot = `${archive}.unpacked`;

  await fsp.rm(outDir, { recursive: true, force: true });
  await fsp.mkdir(outDir, { recursive: true });

  const { header, headerSize } = readArchiveHeaderSync(archive);
  const filesystem = new Filesystem(archive);
  filesystem.setHeader(header, headerSize);

  const fd = fs.openSync(archive, "r");
  try {
    for (const entry of walk(header)) {
      const target = path.join(outDir, entry.rel);
      if (entry.type === "directory") {
        await fsp.mkdir(target, { recursive: true });
        continue;
      }

      if (entry.type === "link") {
        await fsp.mkdir(path.dirname(target), { recursive: true });
        await fsp.symlink(entry.node.link, target);
        continue;
      }

      const info = filesystem.getFile(entry.rel);
      await fsp.mkdir(path.dirname(target), { recursive: true });
      if (info.unpacked) {
        await fsp.copyFile(path.join(unpackedRoot, entry.rel), target);
      } else {
        const buffer = readFileWithFd(fd, filesystem, entry.rel, info);
        await fsp.writeFile(target, buffer);
      }
      if (info.executable) {
        await fsp.chmod(target, 0o755);
      }
    }
  } finally {
    fs.closeSync(fd);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
