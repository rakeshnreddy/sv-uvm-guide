FROM debian:bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends iverilog python3 verilator \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --uid 65532 --create-home runner

COPY run-simulator.py /opt/sv-runner/run-simulator.py
RUN chmod 0555 /opt/sv-runner/run-simulator.py \
  && mkdir -p /opt/sv-runner/bin \
  && ln -s ../run-simulator.py /opt/sv-runner/bin/run-iverilog \
  && ln -s ../run-simulator.py /opt/sv-runner/bin/run-verilator

USER 65532:65532
WORKDIR /workspace
