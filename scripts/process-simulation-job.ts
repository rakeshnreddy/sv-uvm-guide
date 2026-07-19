import process from "node:process";

import { DockerSimulationSandbox } from "../src/server/simulation/docker-sandbox";
import { processQueuedSimulationJob } from "../src/server/simulation";

const jobId = process.argv[2];
if (!jobId || !/^[a-zA-Z0-9_-]{8,80}$/.test(jobId)) {
  console.error("Usage: npm run simulation:worker -- <job-id>");
  process.exit(2);
}

processQueuedSimulationJob(jobId, new DockerSimulationSandbox())
  .then((claimed) => {
    console.log(claimed ? `Processed simulation job ${jobId}` : `Job ${jobId} was already claimed`);
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Simulation worker failed");
    process.exitCode = 1;
  });
