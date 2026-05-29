# Shopware API Client Tool - MVP Tasks

This document breaks the v1 plan into meaningful, implementation-ready iterations.
Each iteration has a clear objective, task list, and exit criteria.

## Working Principles
- Keep increments shippable at the end of every iteration.
- Prioritize user-visible value first, then hardening.
- Validate assumptions early (especially CORS and auth flow).
- Track scope drift explicitly; non-v1 items go to backlog.

## Iteration 0 - Project Foundation and Technical Baseline

### Objective
Create the technical base so feature work can progress quickly and safely.

### Tasks
- Initialize Vue 3 + TypeScript app scaffolding.
- Add and configure Shopware Meteor components.
- Set up linting, formatting, and test tooling.
- Create app shell layout (header, navigation, main content area).
- Add router structure for:
  - Instance overview
  - API browser view
- Define shared TypeScript domain types:
  - Instance
  - Schema
  - Auth session
  - Endpoint tab
  - Request history entry
- Build storage abstraction layer (IndexedDB-first).
- Add app data versioning (`appDataVersion`) and migration entry point.
- Add basic error boundary/global error handling strategy.

### Exit Criteria
- App runs locally in latest Chrome.
- CI/lint/test scripts run successfully.
- Storage layer can persist and read a sample object.
- Basic routed screens render without runtime errors.

---

## Iteration 1 - Instance Management MVP

### Objective
Enable users to manage Shopware instances locally with validation and persistence.

### Tasks
- Build instance list view with empty state.
- Build add/edit instance form with validation:
  - Required fields by auth type
  - URL normalization and validity checks
- Implement delete flow with confirmation modal.
- Persist instance CRUD operations via storage layer.
- Add "Test connection" action for each instance.
- Add user-friendly error messages for invalid config/network failures.
- Ensure instance data updates propagate consistently to UI state.

### Exit Criteria
- User can add, edit, and delete instances reliably.
- Data persists across page refresh.
- Validation prevents invalid submissions.
- Connection test returns clear success/failure feedback.

---

## Iteration 2 - Schema Fetching and Endpoint Discovery

### Objective
Fetch Shopware OpenAPI schema per instance and render discoverable endpoints.

### Tasks
- Implement schema fetch from `/api/_info/openapi3.json`.
- Save schema in local storage with fetch timestamp.
- Add manual "Refresh schema" action.
- Parse schema into a UI-friendly endpoint index.
- Build sidebar tree grouped by API area/tags.
- Add endpoint search/filter by:
  - Path
  - Method
  - operationId
- Add schema error handling states:
  - Fetch failure
  - Parse failure
  - Missing/invalid schema content
- Add CORS-specific error guidance text.

### Exit Criteria
- Schema can be fetched and persisted for a valid instance.
- Sidebar renders endpoint tree and supports search.
- Refresh updates schema timestamp and endpoint list.
- Failures are visible and actionable.

---

## Iteration 3 - Endpoint Tabs and Request Composer

### Objective
Provide a productive endpoint interaction surface before full auth automation.

### Tasks
- Implement endpoint tab open/close/switch behavior.
- Persist open tabs and active tab across reload.
- Build endpoint detail view:
  - Method
  - URL
  - Description
  - Parameters summary
- Implement request composer sections:
  - Path params
  - Query params
  - Headers
  - JSON body editor
- Persist unsent request input per tab.
- Add "Reset request form" action.
- Add response panel scaffold:
  - Status
  - Headers
  - Body
  - Duration
- Add copy-response-as-JSON action.

### Exit Criteria
- User can open multiple endpoints in tabs.
- Request forms are usable and persist inputs.
- Response panel can display mocked/test payloads without layout issues.

---

## Iteration 4 - Automated Auth and Real Request Execution

### Objective
Execute real API requests with automated Shopware auth lifecycle.

### Tasks
- Implement auth flow for user credentials.
- Implement auth flow for integration credentials.
- Build token cache per instance/auth profile.
- Add token refresh handling before expiry and on auth failure retry path.
- Inject auth headers automatically for requests.
- Execute real requests from endpoint tabs.
- Render response details:
  - Status code
  - Response headers
  - Parsed JSON/raw body fallback
  - Timing metrics
- Add robust error mapping:
  - Network/CORS
  - Auth failed
  - Timeout
  - 4xx/5xx API response

### Exit Criteria
- User can send authenticated requests to supported instances.
- Tokens are reused and refreshed automatically.
- Common error scenarios are handled without breaking UI state.

---

## Iteration 5 - Request History, Quality, and UX Hardening

### Objective
Complete v1 quality expectations and add the agreed request history feature.

### Tasks
- Implement request history (latest N per instance, configurable constant).
- Show history list with quick re-open/reuse in endpoint context.
- Redact secrets/tokens from persisted history.
- Add loading/empty/error polish across all major screens.
- Add "Clear all local data" and scoped "Delete instance data" actions.
- Improve performance for large schemas:
  - Lazy rendering in tree
  - Indexed lookup for search
- Add accessibility passes for key interactions.
- Finalize copy and help text for CORS limitations in pure-browser mode.

### Exit Criteria
- Request history is functional and safe (no secret leakage).
- Core UX states feel complete and consistent.
- Large schema navigation remains responsive.
- v1 meets usability expectations for daily developer use.

---

## Iteration 6 - Test Coverage and Release Readiness

### Objective
Establish confidence for v1 release.

### Tasks
- Unit tests:
  - Auth lifecycle
  - Storage repositories
  - Schema parser/indexer
  - Request/response mapping
- Component tests:
  - Instance form and validation
  - Sidebar discovery/search
  - Endpoint request composer
- E2E smoke tests:
  - Add instance -> fetch schema -> open endpoint -> send request -> inspect response
- Cross-check latest Chrome compatibility.
- Create release checklist and known limitations section.
- Final bug bash and issue triage.

### Exit Criteria
- Automated tests pass in CI.
- Critical user journeys are covered by E2E smoke tests.
- Release checklist completed.
- Known limitations documented (including CORS constraints).

---

## Backlog (Post-v1)
- Import/export of local data.
- Optional local proxy mode for broader CORS compatibility.
- Additional browser support.
- Advanced request helpers (variables, environments, scripts).
- Team collaboration features.

## Suggested Delivery Cadence
- Iterations 0-2: core foundation and discovery.
- Iterations 3-4: primary product value (send real API requests).
- Iterations 5-6: quality, reliability, release readiness.

If needed, iterations can be shortened by splitting each into:
- Build tasks
- Stabilization tasks
- Demo/feedback checkpoint
