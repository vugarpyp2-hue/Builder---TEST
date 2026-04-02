# Webflow Export Gap Analysis

## Current Architecture (before fixes)
- Builder generates full HTML documents with Gemini and stores selected result as `Artifact.html` in `sessions[].artifacts[]`.
- Export button calls `exportToWebflow(artifact)` from `ArtifactCard`.
- Export parser used HTML as input but emitted non-canonical schema (`nodes` top-level, `components` object).

## Gaps Identified
1. **Schema mismatch**
   - Missing required keys: `pages`, `unsupported`, `customCodePolicy`, `importHints`.
   - Invalid top-level `nodes` key.
2. **Validation mismatch**
   - Validator checked `pages` but exporter never generated `pages`.
   - Export always returned `{ valid: true }`, allowing bad output.
3. **Low fidelity mapping**
   - Node `kind` set directly to raw tag names.
   - No robust semantics (heading/link/list checks).
4. **No deterministic IDs**
   - Random IDs caused unstable exports and impossible diffing.
5. **Weak style/token extraction**
   - Minimal style props only; no meaningful check for empty style bodies.
6. **Unsupported handling absent**
   - `script/embed/iframe` were not truthfully reported.
7. **Assets/components underdeveloped**
   - No reliable asset linking and no reusable component detection.

## Fixed Direction
- Canonical native-first schema centered on `pages[].rootNode`.
- Deterministic transform pipeline from selected artifact snapshot.
- Strict validator enforcing structure, semantics, responsive shape, and unsupported transparency.
