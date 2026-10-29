import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// Let phones on the same Wi-Fi load the dev server (npm run dev:lan).
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((a) => a && a.family === "IPv4" && !a.internal)
  .map((a) => a!.address);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: lanAddresses,
};

export default nextConfig;
