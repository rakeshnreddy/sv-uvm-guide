#!/usr/bin/env python3
import json
from pathlib import Path
import subprocess
import sys

WORKSPACE = Path("/workspace")
RESULT = Path("/results/result.json")
# Keep each trusted diagnostic within the API schema's 2,000-character limit.
MAX_DIAGNOSTIC_CHARS = 1_800


def run(command):
    return subprocess.run(
        command,
        cwd=WORKSPACE,
        capture_output=True,
        check=False,
        text=True,
        timeout=15,
    )


def combined_output(result):
    return (result.stdout + result.stderr)[:MAX_DIAGNOSTIC_CHARS]


def main():
    sources = sorted(
        str(path.relative_to(WORKSPACE))
        for path in WORKSPACE.rglob("*")
        if path.is_file() and path.suffix.lower() in {".sv", ".v"}
    )
    if not sources:
        raise ValueError("Submission does not contain a SystemVerilog or Verilog source file")

    backend = Path(sys.argv[0]).name
    if backend == "run-iverilog":
        compile_result = run(["iverilog", "-g2012", "-o", "/tmp/simulation.out", *sources])
        run_result = run(["vvp", "/tmp/simulation.out"]) if compile_result.returncode == 0 else None
    elif backend == "run-verilator":
        compile_result = run([
            "verilator", "--binary", "--timing", "-Wno-fatal",
            "--Mdir", "/tmp/obj", "-o", "simulation.out", *sources,
        ])
        run_result = run(["/tmp/obj/simulation.out"]) if compile_result.returncode == 0 else None
    else:
        raise ValueError("Unknown trusted simulator entry point")

    output = combined_output(compile_result)
    if run_result is not None:
        output = (output + combined_output(run_result))[:MAX_DIAGNOSTIC_CHARS]
    passed = compile_result.returncode == 0 and run_result is not None and run_result.returncode == 0
    RESULT.write_text(json.dumps({
        "passed": passed,
        "coverage": 0,
        "waveformKey": None,
        "diagnostics": [] if passed and not output else [{
            "severity": "info" if passed else "error",
            "code": "SIMULATION_OUTPUT" if passed else "SIMULATION_FAILED",
            "message": output or ("Simulation completed." if passed else "Simulation failed."),
        }],
    }))
    # The container command succeeded when it produced this trusted result.
    # Compilation/simulation failure is represented by `passed`, not process exit.
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        RESULT.write_text(json.dumps({
            "passed": False,
            "coverage": 0,
            "waveformKey": None,
            "diagnostics": [{
                "severity": "error",
                "code": "RUNNER_ERROR",
                "message": str(error)[:MAX_DIAGNOSTIC_CHARS],
            }],
        }))
        sys.exit(0)
