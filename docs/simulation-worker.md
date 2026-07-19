# Isolated simulation worker

Simulation is a batch job, not an in-browser debugger. The lab page submits the learner's editable SystemVerilog workspace, polls the owned job, and renders the trusted runner result. Pause and single-cycle stepping are intentionally not exposed.

## Deployment modes

- **Queued production worker:** set `SIMULATION_QUEUE_URL` and optionally `SIMULATION_QUEUE_TOKEN`. The dispatcher receives `{ "jobId": "..." }`; its consumer runs `npm run simulation:worker -- <job-id>` with the same database connection and Docker access.
- **Explicit local Docker mode:** build the pinned runner images with `npm run simulation:runner:build`, then set `SIMULATION_LOCAL_DOCKER=true`. The request processes synchronously through the same isolated worker contract.

If neither mode is configured, `/api/simulate` returns `SIMULATION_EXECUTION_NOT_CONFIGURED` before creating a job. It never leaves a submission queued without an executor.

The Docker adapter runs with no network, a read-only root filesystem, dropped Linux capabilities, `no-new-privileges`, fixed simulator entry points, and bounded CPU, memory, process count, filesystem, output, and wall time. User source is mounted read-only; only `result.json` from the trusted runner is accepted as authoritative.
