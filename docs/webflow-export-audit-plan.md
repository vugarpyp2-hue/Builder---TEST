# Webflow Export Audit Plan

## Scope
- Trace end-to-end flow from generation prompt to selected artifact to export action.
- Verify exporter contract against native-first Webflow schema requirements.
- Harden validation to reject low-fidelity/skeleton exports.
- Add smoke checks and implementation report artifacts.

## Investigation Steps
1. Identify where selected design state is stored and mutated.
2. Trace export button wiring and payload used for export.
3. Inspect exporter schema, node mapping, style extraction, asset extraction, and unsupported handling.
4. Validate importer-facing contract shape and strict key set.
5. Implement deterministic ID and repeatable component detection.
6. Add strict validation checks for responsive and semantic correctness.
7. Run type/build smoke checks.

## Quality Gates
- Export must include canonical top-level keys.
- Export must contain pages[0].rootNode with non-empty children.
- sections/styles must be meaningful.
- assets must be non-empty when image nodes exist.
- unsupported/script/embed must be surfaced.
- duplicate node IDs must fail validation.
