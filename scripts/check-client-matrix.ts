#!/usr/bin/env tsx

import { resolve } from "node:path";
import {
  checkClientMatrix,
  defaultClientMatrixPath,
  loadClientMatrix
} from "../src/registry/clientMatrix.js";

const matrixPath = process.argv[2] ? resolve(process.argv[2]) : defaultClientMatrixPath();

try {
  const matrix = loadClientMatrix(matrixPath);
  const result = checkClientMatrix(matrix);

  console.log(`client compatibility matrix check: ${matrixPath}`);
  console.log(`fork: ${matrix.fork}`);
  console.log(`lastUpdated: ${matrix.lastUpdated}`);
  console.log(`clients: ${matrix.clients.length}`);
  console.log(`devnets: ${matrix.devnets.length}`);

  if (result.warnings.length > 0) {
    console.log("");
    console.log("warnings:");
    for (const warning of result.warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (result.errors.length > 0) {
    console.log("");
    console.log("errors:");
    for (const error of result.errors) {
      console.log(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("");
  console.log("client compatibility matrix is ready.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
