import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";

const HASH_LEN = 32;

// Full implementation at https://github.com/jprichardson/node-fs-extra/blob/master/lib/copy-sync/copy-sync.js
export function copySync(src: string, dest: string) {
  function copyItem(p: string) {
    const sourcePath = path.resolve(src, p);
    const stat = fs.statSync(sourcePath);
    if (stat.isFile()) {
      fs.copyFileSync(sourcePath, path.resolve(dest, p));
    }
    if (stat.isDirectory()) {
      walkSubfolder(p);
    }
  }

  function walkSubfolder(p: string) {
    const sourceDir = path.resolve(src, p);
    fs.mkdirSync(path.resolve(dest, p), { recursive: true });
    fs.readdirSync(sourceDir).forEach((item) => copyItem(path.join(p, item)));
  }

  walkSubfolder(".");
}

export function archiveSync(src: string, dest: string) {
  if (os.platform() === "win32") {
    try {
      execSync("where tar.exe");  
    } catch {
      console.error(`Unable to find "tar.exe".`);
      process.exit(1);
    }
    
    execSync(`tar.exe -a -c -f ${dest} ${src}`);
  } else {
    try {
      execSync("which zip");
    } catch {
      console.error(`Unable to find "zip".`);
      process.exit(1);
    }

    execSync(`zip -r ${dest} ${src}`);
  }
}

export function hashPath(src: string) {
  const hash = crypto.createHash("md5");

  function hashRecursion(p: string) {
    const stat = fs.statSync(p);
    if (stat.isFile()) {
      hash.update(fs.readFileSync(p));
    } else if (stat.isDirectory()) {
      fs.readdirSync(p).forEach((filename) =>
        hashRecursion(path.resolve(p, filename))
      );
    }
  }

  hashRecursion(src);
  return hash
    .digest("hex")
    .slice(0, HASH_LEN)
    .toUpperCase();
}
