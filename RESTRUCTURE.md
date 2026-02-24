# Documentation restructure plan

_Context: The v0 product works. The docs need to present it to a wider audience than Ethereum developers — anyone who needs verifiable spatial computation, including agent developers, logistics platforms, insurance, compliance. The blockchain integration is one path, not the identity._

_Source: Claude Code session `b7e7e54d-1e4a-4825-b342-abf678f74fe8` in `~/tmp-astral`._

_Canonical terminology: see `concept-map.md` in the docs-plan repo (`~/Code/astral/docs-plan/concept-map.md`). All docs pages should use the definitions established there. Key discipline: never say "attestation" when you mean "stamp" or "proof" — reserve "attestation" for EAS-specific contexts._

---

## Principles

1. **Lead with the capability, not the delivery mechanism.** "Verifiable geospatial computation" is the headline. Blockchain is an integration path introduced after the reader understands what the system does.

2. **Separate the concept from the quickstart.** The landing page sells the idea. The quickstart is for people who've already decided to try it. Don't mix them.

3. **Task-oriented guides, not feature-oriented.** "How do I verify a delivery?" not "The contains endpoint." Each guide answers a question and is self-contained.

4. **Trust is the product — make the trust model prominent.** If you're selling verifiability, be transparent about what's verified and what's assumed. Elevating this signals confidence; burying it signals doubt.

5. **Blockchain and agent integration are peer paths.** Neither is privileged. A dapp developer goes to the blockchain guide. An agent developer goes to the agent guide. Both are first-class.

6. **Examples are complete stories, not snippets.** Each example is a scenario: who you are, what you need, what you call, what you get back, what you do with it.

## Audiences

- **Any developer** who needs a spatial answer they can trust (the widest aperture)
- **Agent/AI developers** building autonomous systems with spatial reasoning needs
- **Blockchain developers** who want verifiable spatial results onchain
- **Enterprise evaluators** (insurance, logistics, compliance) assessing the product
- **Researchers** who want to understand the trust model and contribute

## Proposed structure

See `mint.proposed.json` for the Mintlify navigation config.

### Getting Started
- **Introduction** — What is Astral. The problem (untrusted location data), the solution (verifiable spatial computation), who it's for. No jargon. No chain IDs.
- **Quickstart** — Zero to first API call. curl examples against the hosted service. Under 5 minutes. Include the "aha" moment: you sent two points, you got back a signed distance with a cryptographic receipt.
- **How it works** — Architecture in 60 seconds. Geometry in → PostGIS computes in TEE → signed result out. Diagram. Then: "the result can go anywhere — an agent, a smart contract, a database, a compliance report."

### Core Concepts
Reference material for when people need to understand the underlying model. Terminology follows the concept map (`docs-plan/concept-map.md`) exactly — one canonical definition per term.

- **Geographic features** — What the system operates on. GeoJSON geometries (points, polygons, lines), verified locations from location proofs, or references to previously computed results. The provenance of a feature matters: a raw coordinate and a verified location are both valid inputs to geocomputation, but they carry different trust properties. This is the most fundamental concept — every API call starts with geographic features.
- **Geocomputation** — The six spatial operations (distance, area, length, contains, within, intersects), what they compute, when to use which. Results are signed with proof of correct execution. Geocomputation can take verified locations as input, bridging the two halves of the system.
- **Verifiable computation** — What "verifiable" means: TEE execution, signed results, input hashing. What the signature covers. What you're trusting. Applies to both geocomputation and the evaluation function.
- **Location proofs** — The full lifecycle from the concept map: location claims → PoL systems → signals → location stamps → location evidence → location proofs → evaluation function → credibility scores → weighting schemes → decisions. This is the deeper conceptual contribution. Each term has a precise definition; the page should walk through the dependency graph.
- **Result format** — How signed results are structured, what the signature covers, how to decode and verify independently. This is the universal format — not EAS-specific. Any integrator (agent, backend, smart contract) needs to understand how to consume and verify a result.
- **Privacy model** — Encrypted inputs, what the TEE operator can and can't see, current guarantees. The TEE accepts encrypted inputs, decrypts inside the enclave, computes, and returns only the result — the operator never sees raw location data.

### Guides
Task-oriented walkthroughs.
- **Local development setup** — Clone, Docker, env config, health check, first local API call. Thorough. Covers port conflicts, env file loading, platform notes.
- **Calling the API** — Request format (from/to/chainId), geographic feature inputs (raw GeoJSON, verified locations, UID references), authentication, interpreting responses, error handling. The "I want to integrate this into my backend" guide.
- **Verifying location proofs** — Submitting location proofs to the verify API, understanding credibility scores, applying weighting schemes, using plugins.
- **Blockchain integration** — EAS attestations, delegated signing, onchain submission via SDK, chain configuration, schema UIDs. Everything Ethereum lives here.
- **Agent integration** — Using Astral as a spatial oracle in agent workflows. How to call it from an agent framework, how to use the result in decision-making.
- **Building verification plugins** — Writing a new PoL system adapter for the verify module. Plugin interface, registration, testing.

### Use Cases
Complete, runnable scenarios. Each one is a story with a protagonist, a problem, and a solution.
- **Delivery verification** — "Was the courier within the delivery geofence?" (within/contains)
- **Parametric insurance** — "Was the weather event close enough to trigger the policy?" (distance)
- **Geofence compliance** — "Did the drone stay within the approved corridor?" (contains)
- **Onchain attestation** — End-to-end: compute → sign → submit onchain (the full blockchain flow)

### API Reference
Exhaustive, mechanical, one page per endpoint.
- **Overview** — Base URL, authentication, rate limits, error format, common request fields
- **Compute API** — distance, area, length, contains, within, intersects (one page each)
- **Verify API** — stamp, proof, plugins
- **Records API** — overview, list, get, stats, config (existing)

### SDK Reference
Mirrors the SDK's module structure.
- **Overview** — What the SDK does, when to use it vs. raw API
- **Installation** — pnpm install, configuration, initialization
- **Location module** — Location format handling, extensions
- **Compute module** — SDK compute methods (wraps the API)
- **Verify module** — SDK verify methods
- **EAS module** — Onchain submission, chain config, schema management
- **Types** — TypeScript type reference
- **Migration** — Upgrading from previous versions

### Trust Model
Dedicated section because trust is the product.
- **Architecture** — TEE, PostGIS, stateless model, container design, what runs where
- **What is verified** — What the signature covers, input hashing, computation reproducibility
- **What you are trusting** — Honest accounting of assumptions. TEE hardware trust, current state vs. target state with full remote attestation. The gap between "signed by a key" and "signed by an attested enclave."
- **Security considerations** — Threat model, known limitations, responsible disclosure

### Resources
- **Playground** — Interactive tool
- **Staging environment** — Testing against hosted service
- **Schema registry** — EAS schema UIDs by chain
- **Research** — Links to papers, research agenda, location proofs framework
- **FAQ**
- **Changelog**

## Concept map → docs page mapping

How each term from `concept-map.md` maps to a docs page:

| Concept map term | Docs page | Notes |
|---|---|---|
| Geographic feature (new) | `concepts/geographic-features` | Not in concept map yet — should be added. The input type for all operations. |
| Geocomputation | `concepts/geocomputation` | The six operations + proof of correct execution |
| TEE | `concepts/verifiable-computation` | Implementation detail, not a core concept (per concept map) |
| Location claim | `concepts/location-proofs` | First half of the lifecycle |
| PoL system, signals, location stamp | `concepts/location-proofs` | Evidence production chain |
| Location evidence, location proof | `concepts/location-proofs` | Composition and bundling |
| Evaluation function, credibility scores | `concepts/location-proofs` | Assessment pipeline |
| Weighting scheme | `concepts/location-proofs` | Application-specific decision logic |
| Location proof plugin | `guides/building-plugins` | How to connect a new PoL system |
| EAS, resolver | `guides/blockchain-integration` | Blockchain-specific delivery mechanism |
| Result format (signed output) | `concepts/result-format` | Universal — how any integrator consumes results |

### Terminology discipline

- **"Credibility scores"** (casual) / **"credibility vector"** (formal). Use "scores" in guides and use cases, define "vector" on first use in the concepts page.
- **"Attestation"** only in EAS/blockchain contexts. Never use it when you mean stamp, proof, or signed result.
- **"Location stamp"** not "location attestation." Stamps come from PoL systems. Attestations are EAS artifacts.
- **"Geographic feature"** for inputs. Covers raw GeoJSON, verified locations, and UID references.

## What changes from current structure

| Current | Proposed | Why |
|---|---|---|
| Name: "Astral Location Services" | Name: "Astral" (or "Astral Docs") | The service is one component, not the whole product |
| Introduction leads with EAS/attestations | Introduction leads with verifiable spatial computation | Wider audience |
| Concepts: location-attestations, policy-attestations, eas-resolvers | These move into guides/blockchain-integration | Blockchain-specific concepts don't belong in universal concepts section |
| Concepts: geospatial-operations | Renamed to "geocomputation," promoted to second concept (after geographic features) | Aligns with concept map terminology |
| No geographic features concept | `concepts/geographic-features` | Foundation concept — what the system operates on, including provenance |
| Concepts: attestation-format | Renamed to "result-format" | The signed result is universal; EAS encoding is blockchain-specific |
| Guides: location-gated-nft, geofenced-token | Move to use-cases (blockchain-specific examples) or fold into blockchain guide | These are blockchain use cases, not general guides |
| No trust model section | Dedicated trust-model section | Trust is the product |
| No agent integration | guides/agent-integration | Peer path with blockchain |
| No privacy docs | concepts/privacy-model | Key differentiator |
| No local setup guide | guides/local-development | The #1 onboarding issue from v0 review |

## What to preserve

- All existing API reference content (restructure, don't rewrite)
- All existing SDK reference content
- The playground and staging resources
- The schema registry
- Any existing content that's accurate — just relocate it

## Migration approach

1. Add "geographic feature" definition to `concept-map.md` in docs-plan
2. Write the new `mint.json` navigation (done — see `mint.proposed.json`)
3. Create stub files for new pages (title + one-line description)
4. Relocate existing content into the new structure
5. Fill in new pages (introduction rewrite, trust model, guides)
6. Review pass for terminology discipline (attestation→stamp/proof, credibility vector→scores)
7. Review pass for Ethereum jargon above the fold
