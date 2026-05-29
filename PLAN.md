# Shopware API Client Tool (Plan v2)

## Vision
Build a lightweight, browser-first API client for Shopware instances, similar to APIdog in usability, but specialized for Shopware Admin and Store APIs.

## Goals
- Fast setup for developers working with multiple Shopware instances.
- Endpoint discovery from Shopware OpenAPI schema.
- Interactive request/response workflow with automated authentication.
- Local-first data model (no backend user management for v1).

## Non-Goals (v1)
- Team collaboration and cloud sync.
- Role/permission management in this tool.
- Full OpenAPI editing or schema authoring.
- Full Postman feature parity (mock servers, monitors, test scripts).

## Product Scope (v1)

### 1) Instance Management
Provide a local overview of configured Shopware instances.

#### Core Actions
- Add instance
- Edit instance
- Delete instance
- Test connection
- Refresh schema manually

#### Instance Properties
- Display name
- Base URL
- API mode support: Admin API and Store API
- Auth Type: user credentials or integration credentials
- User name (if user credentials)
- User password (if user credentials)
- API key (if integration credentials)
- API secret (if integration credentials)

### 2) API Browser
Each instance has an API browser to inspect and execute requests.

#### Sidebar
- Endpoint tree grouped by API area and tags.
- Search/filter by path, operationId, and method.
- Load schema from `https://<domain>/api/_info/openapi3.json`.
- Show schema version timestamp and refresh status.

#### Main View
- Multiple tabs for opened endpoints.
- Per endpoint tab:
  - Method + URL
  - Description and parameter documentation
  - Query/path/header/body input
  - Send request action
  - Response viewer (status, headers, body, timing)

### 3) Request Workflow
- Automated auth flow before requests.
- Token caching and automatic refresh when needed.
- Persist latest request payload per endpoint tab.
- Request history in v1 (latest N requests per instance, e.g. 20).
- Copy response as JSON.

## UX and Behavior Requirements
- Persist open tabs and unsent inputs across page reloads.
- Clear and actionable error states:
  - Auth failed
  - Schema fetch failed
  - Validation/format errors
  - Network timeout/offline
  - 4xx/5xx API responses
- "Clear local data" action for the whole app.

## Architecture and Technology
- **Frontend stack:** Vue 3 + TypeScript.
- **Design system:** [Shopware Meteor Design System](https://shopware.design/) and [Meteor Components](https://meteor.shopware.com/).
- **Custom UI components:** allowed when no Meteor component exists, but styled consistently.
- **Runtime model:** browser-based app with minimal setup.
- **Storage:** native browser storage (IndexedDB preferred; localStorage only for tiny metadata).

## Data Model (Local)
Suggested entities:
- `instances`
- `schemas`
- `authSessions`
- `endpointTabs`
- `requestHistory`
- `settings`

Add a local storage schema version (e.g. `appDataVersion`) to support future migrations.

## Security and Privacy Baseline
- Credentials and tokens are stored only locally.
- Redact secrets in logs/history/UI previews.
- Never persist full secrets in request history.
- Provide explicit "Delete instance and all related local data" flow.
- Optional future enhancement: encrypt stored credentials with a local passphrase.

## Critical Risk: Browser CORS
Direct browser calls to arbitrary Shopware domains may be blocked by CORS.

### Decision (Locked for v1)
- **Pure browser mode:** v1 runs fully in the browser and supports instances that allow required CORS.
- No proxy service is included in v1.
- If CORS blocks a target instance, document this clearly in the UI error/help text.

## Testing Strategy (v1)
- Unit tests for:
  - Auth/token lifecycle
  - Request builder and response mapper
  - Local storage repositories
- Component tests for:
  - Instance CRUD forms
  - Endpoint request form rendering
- E2E smoke tests for:
  - Add instance -> fetch schema -> open endpoint -> send request -> inspect response

## Delivery Milestones

### Milestone 1: Foundation
- Project setup (Vue 3 + TS + Meteor components).
- App shell, routing, base state management.
- Local storage abstraction and schema versioning.

### Milestone 2: Instance Management
- CRUD UI and validation.
- Connection test.
- Schema fetch + save + refresh.

### Milestone 3: API Browser
- Sidebar endpoint tree + search.
- Endpoint tab management.
- Request editor + response viewer (JSON-first).

### Milestone 4: Auth + Execution
- Automated login/auth flow.
- Token cache + refresh lifecycle.
- End-to-end request execution with robust error handling.

### Milestone 5: Polish and Hardening
- Request history and persistence quality.
- Empty/error/loading state improvements.
- Test coverage and release checklist.

## Open Decisions
No blocking open decisions for v1.

Confirmed decisions:
- CORS strategy: pure browser mode for now (no proxy in v1).
- Browser support target: latest Chrome only.
- Request history: included in v1.
- Import/export: postponed to a later version (v2+).