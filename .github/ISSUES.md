# Documentation Issues Tracker

This file documents issues identified through a comprehensive review of the documentation (via `llms-full.txt`). Each section below represents an issue to be created on GitHub.

---

## Critical Issues

### Issue 1: Schema Drift - Incompatible Location Attestation Representations

**Priority:** Critical
**Labels:** `documentation`, `schema`, `breaking`

#### Description

There are at least three incompatible representations of the "location attestation schema" within the documentation:

1. **`/api/v0/config` response** shows schema_fields as:
   ```
   uint256 eventTimestamp, string srs, string locationType, string location,
   string[] recipeType, bytes[] recipePayload, string[] mediaType,
   string[] mediaData, string memo
   ```

2. **Location Protocol v0.2 documentation** lists fields like:
   - `lp_version`
   - `location_type`
   - `location` as bytes
   - `srs` as OGC URI

3. **Records API examples** show:
   - `event_timestamp`
   - `location_type` (e.g., `geojson-point`)
   - `location` as stringified GeoJSON
   - extracted `longitude`/`latitude` fields

This inconsistency undercuts trust and makes it impossible for developers (or LLMs) to know which representation is authoritative.

#### Fix Direction

- [ ] Pick a single "canonical schema shape" for v0.2 in the documentation
- [ ] Create an explicit mapping table showing: spec version → deployed schema → API response format
- [ ] Cross-link to the authoritative spec at https://github.com/DecentralizedGeo/location-protocol-spec/tree/v0.2-draft
- [ ] Deploy version 0.2 conformant schemas for internal consistency across the architecture

#### Related

- References Location Protocol v0.2 spec

---

### Issue 2: Verification Playbook - Make Trust Model Inspectable

**Priority:** Critical
**Labels:** `documentation`, `security`, `verification`

#### Description

The documentation asserts the trust model but doesn't demonstrate it. Claims include:

- "Determinism Guarantees" (precision rounding, stateless, pinned PostGIS)
- "TEE-held key" - only code running inside the TEE can produce valid signatures
- "EigenCompute provides hardware attestation of execution"

However, the documentation doesn't explain what a verifier (developer, user, auditor) can actually check:

- What evidence do they receive about the TEE measurement/attestation?
- What is the verification procedure (inputs, outputs, signatures, attestation report)?
- What parts are roadmap vs shipping?

Without this, you're asking people to trust marketing statements.

#### Fix Direction

Add a concrete **"Verification Playbook"** section with:

- [ ] What is signed (exact bytes / struct encoding)
- [ ] How to verify `attestation.attester` and the delegated signature path
- [ ] What a TEE attestation artifact looks like in EigenCompute
- [ ] Where to fetch the attestation artifact
- [ ] How it binds to the signing key
- [ ] Clear "MVP limitations" (e.g., if TEE attestation is not exposed yet, say so bluntly)

The story is plausible but not inspectable.

---

### Issue 3: Stability Rubric - Endpoint-Level Stability Indicators

**Priority:** Critical
**Labels:** `documentation`, `developer-experience`

#### Description

"Research Preview" and "code snippets need testing" warnings repeat frequently throughout the documentation, but this doesn't triage risk effectively. Readers cannot tell what is safe to build on today.

#### Fix Direction

- [ ] Introduce a simple stability rubric applied consistently:
  - **Stable** - API + behavior committed
  - **Beta** - minor breaking changes possible
  - **Research** - expect breakage

- [ ] Apply the rubric at the endpoint/method level, not just as a banner
- [ ] If keeping "code snippets need testing," add a link to:
  - A tested example repo, OR
  - An integration test suite status page

---

### Issue 4: Threat Model Section - What Is and Isn't Proven

**Priority:** Critical
**Labels:** `documentation`, `security`, `threat-model`

#### Description

The documentation correctly notes that policy attestations prove "Astral computed the relationship between inputs A and B," but not who signed the raw GeoJSON inputs. However, the implications need to be spelled out more explicitly because this is where systems get exploited.

**Concrete risk surfaces not clearly treated:**

1. **Garbage-in attestation**: User attests their own location → policy says "within" → resolver mints NFT → attacker spoofs GPS. GPS spoofability is mentioned once but not carried into threat modeling.

2. **Boundary conditions**: The docs note `ST_Contains` boundary behavior and suggest `intersects` for boundary cases, but don't connect this to resolver implementation to prevent accidental rejection of legitimate edge cases.

3. **Replay & freshness**: Timestamp checks and `usedAttestations` are recommended, but the example `usedAttestations` hashing is inconsistent (sometimes keyed by UID, sometimes by keccak of encoded attestation).

#### Fix Direction

Add a compact **Threat Model** section covering:

- [ ] What Astral guarantees:
  - Computation integrity
  - Input binding
  - Signer identity

- [ ] What Astral does NOT guarantee:
  - Input truth
  - GPS honesty
  - Identity binding

- [ ] Recommended plugin/proof path (even if "in development") and interim mitigations
- [ ] Consistent guidance on `usedAttestations` implementation

---

## Medium-Severity Issues

### Issue 5: Operation Encoding Improvements - Split Operation/Params

**Priority:** Medium
**Labels:** `documentation`, `api-design`, `breaking-change-candidate`

#### Description

The `within` operation returns `operation: "within:50000"` and resolvers are told to use prefix matching. This is a footgun:

- Easy to implement incorrectly
- Makes schema evolution brittle
- Requires string parsing in smart contracts

#### Fix Direction

Consider splitting fields in the attested payload:

```
operation = "within"
params = { radius_cm: 50000 }
```

Or add `radiusCm` as a separate numeric field.

- [ ] Document the rationale for current encoding
- [ ] If changing, create migration guide
- [ ] Update resolver examples to handle edge cases robustly

#### Related

- Issue #7 (closed) touched on this with the `_startsWith()` helper

---

### Issue 6: HTTPS Content-Addressing Clarity

**Priority:** Medium
**Labels:** `documentation`, `security`

#### Description

The documentation notes that HTTPS is not content-addressed, and that fetched attestations are verified to reproduce the expected UID (mismatch rejected). This is meaningful but incomplete.

Missing clarifications:

- What prevents a server from swapping content AND swapping the UID reference (if the caller supplies both)?
- What does the SDK treat as authoritative: UID, URI, or both?

#### Fix Direction

- [ ] Clarify the trust boundary between caller-supplied UIDs and URIs
- [ ] Document SDK behavior for UID vs URI authority
- [ ] Add examples showing correct usage patterns

---

### Issue 7: SRS/CRS Identifier Consistency

**Priority:** Medium
**Labels:** `documentation`, `schema`

#### Description

Records API returns `srs: "EPSG:4326"` in examples, while elsewhere the documentation recommends OGC CRS URIs and defaults to CRS84.

This is another schema drift symptom and creates practical integration headaches (clients must normalize CRS identifiers).

#### Fix Direction

- [ ] Standardize on one CRS identifier format across all documentation
- [ ] Document the canonical format (recommend OGC URIs: `http://www.opengis.net/def/crs/OGC/1.3/CRS84`)
- [ ] Note EPSG:4326 vs CRS84 axis order differences if relevant
- [ ] Update all examples to use consistent identifiers

---

## LLM Optimization Issues

### Issue 8: LLM Anchor Section for llms-full.txt

**Priority:** Medium
**Labels:** `documentation`, `llm-optimization`

#### Description

If the purpose of `llms-full.txt` is to help models answer accurately, the current structure causes predictable failure modes:

1. **Repetition without hierarchy**: Same concepts appear in multiple places; models blend them
2. **Conflicting definitions**: Schema shapes differ; models hallucinate hybrids
3. **Too many `...` placeholders**: In code and UIDs; LLMs treat these as literal patterns
4. **Links as authority**: References GitHub issues/specs, but models can't follow links

#### Fix Direction

Add an **"Authoritative Canonical Summary"** section (1-2 pages) at the top of `llms-full.txt` defining:

- [ ] **Entities**: Location Attestation, Policy Attestation, InputRef, Delegated Attestation
- [ ] **Canonical schemas**: Or explicit per-chain variants
- [ ] **Canonical SDK method signatures and return types**
- [ ] **Key terminology and precise definitions**

Then append the detailed reference dump. The dump is useful, but it needs an anchor.

---

## Existing Issues to Update

### Issue #9: Investigate revocable flag behavior for policy attestations

**Status:** Open
**Action:** Add comment linking to related concerns

The revocable flag issue (#9) is related to the broader verification and threat model concerns. Consider linking these issues together and addressing them as part of a unified security documentation effort.

**Suggested comment:**

> This issue is related to the broader verification and threat model documentation gaps identified in a comprehensive review:
>
> - The rationale for `revocable: true` should be documented in the Verification Playbook (see issue on Trust Model)
> - The revocation mechanism and who holds authority should be part of the Threat Model section
> - This connects to the question of what attestation artifacts verifiers can inspect
>
> Consider addressing this as part of a unified security documentation effort.

---

## Summary and Priority Order

1. **Schema drift** - Spec vs deployed vs API responses need explicit mapping table
2. **Verification Playbook** - Make the trust model inspectable with concrete verification procedures
3. **Threat model** - Spell out what is/isn't proven with mitigations
4. **Stability rubric** - Endpoint-level stability indicators
5. **Operation encoding** - Consider splitting `within:radius_cm` to avoid footguns
6. **LLM anchor section** - Prevent models from blending inconsistent parts
7. **HTTPS/content-addressing** - Clarify trust boundaries
8. **SRS/CRS consistency** - Standardize identifier format

---

*Generated from documentation review on 2026-02-01*
