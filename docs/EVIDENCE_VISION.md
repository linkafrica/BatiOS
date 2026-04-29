# Evidence Vision

`@batios/evidence-vision` defines the first computer vision boundary for BatiOS
evidence workflows. The package is provider-neutral: it describes auditable
requests, provider adapters, policy checks, observations, provenance, and audit
events without binding production to a specific AI vendor.

## First Use Cases

- Site progress verification from field photos and videos.
- Defect and safety risk screening.
- Quantity assistance for counts and approximate measurements.
- Geo-time and duplicate evidence integrity signals.
- Before/after comparison across inspection dates.

## Operating Rule

Vision output is an observation, not the evidence itself. It must never overwrite
the source artifact and must not become final payment, compliance, or rejection
authority by itself. Every observation is traceable to source artifacts and can
be routed for human review.

## Request Contract

Every analysis request requires:

- `requestId`, `organisationId`, `projectId`, and `actorUserId`.
- A purpose such as `site-progress-verification` or `defect-detection`.
- A custody scope and policy tags.
- One or more image/video artifacts with stable artifact IDs.
- A provider and model name.

## Observation Contract

Each observation includes:

- Source `artifactId`.
- Observation kind and label.
- Human-readable summary.
- Confidence from `0` to `1`.
- Optional severity, bounding box, and measured value.
- `reviewRequired`, which should be true for safety, payment, low-confidence, or
  compliance-sensitive outcomes.

## Provider Path

The first production adapter should be added behind the package interfaces and
routed through policy and audit sinks. Provider responses should be retained as
case records only when the request metadata allows it, and artifacts must not be
used for model training unless a future tenant policy explicitly permits it.
