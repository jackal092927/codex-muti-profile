#!/usr/bin/env node
import crypto from "node:crypto";

import { readArchiveHeaderSync } from "./asar_vendor/disk.js";

if (process.argv.length !== 3) {
  console.error("usage: hash_asar_header.mjs <archive.asar>");
  process.exit(2);
}

const archive = process.argv[2];
const { headerString } = readArchiveHeaderSync(archive);
const hash = crypto.createHash("sha256").update(headerString).digest("hex");
console.log(hash);
