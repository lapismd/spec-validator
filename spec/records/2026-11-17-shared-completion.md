# Shared completion adoption

SV-ARCH-010 retains the existing Node-only Check workflow and tag/OIDC publisher.
There are no Lapis npm dependency inputs in the public root or private workspace
manifest. No synthetic Core pin, Changesets job, package bump or publication is
introduced. The functional no-input contract test blocks an unqualified future
Lapis dependency addition even when bot specification checks are exempted.

The completion caller pins implementation/policy92e3e55d174498916c134f950850e1d572656cab,
registered in coordinator74. Only successful Check workflow399280612, PR/push,
can provide a hint; source permissions are contents/actions/PR-read and only the
existing explicit App key is passed. No candidate checkout, artifact/cache,
source execution or self-trigger occurs. The existing publisher notifier still
follows actual provenance verification. Existing secret/variable names were
verified without key retrieval, copying or rotation. Hosted read probe and
post-merge completion/no-update reconciliation remain pending.

The new callback test first failed once because the caller was absent; both
focused cases pass after adding it. All normal checks, architecture/runtime
boundaries, Node/workspace tests, canonical specification, build and publint
pass. Two initial canonical-form diagnostics and a wrapped-bullet diagnostic
were corrected without changing enforcement. Source/runtime exports and the
registry dependency graph are unchanged.

Fresh full audit separately records13 pre-existing development-tool findings
(2LOW/4MODERATE/7HIGH), including unfixed picomatch; production audit is clean.
These were not introduced by this workflow slice and are not suppressed. A
compatible tooling-refresh trial did not resolve them; it was discarded,
retaining the original lockfile and declared dependencies. Remediation belongs
to the tracked repository follow-up; this source grants no exception. The
existing required Check workflow has no audit lane, and that gate is unchanged.

The operator requests a final merge pass and gives standing post-merge
activation approval after passing source acceptance. An eligible repository
with no Lapis inputs must report an honest no-op; this does not prove a new
release branch or authorize a fabricated update. Any actual future dependency
intake still needs source qualification and every applicable gate.
