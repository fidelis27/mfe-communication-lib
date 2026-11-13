# Functional specification: school secretariat

This document records expected product behavior. It is not a claim that every
listed workflow is implemented, deployed, or covered by automated tests; see
the evidence links in the [documentation index](../README.md#demonstrated-competencies).

## 1. Purpose and outcome

Allow a school-secretariat operator to consult institutions and register
students linked to them. Changes should produce domain events that Activity
and Dashboard can consume without direct coupling between their screens.

## 2. Actors and permissions

- **Super administrator:** can read and change any institution and administer
  groups and users.
- **Institution administrator:** can read and change data for assigned
  institutions, students, and enrollments, and manage permissions within the
  authorized scope.
- **Authorized member:** can register and consult students within the delegated
  scope but cannot administer users, groups, or policies.
- **Inactive or unauthenticated user:** cannot access protected operations.

Authentication uses Supabase Auth. Only provisioned accounts linked to active
local database users should access protected operations.

## 3. Product scope

### Included behavior

1. A navigable shell with entry points for Institutions, Students, Activity,
   Dashboard, and Administration, composed through the module manifest runtime.
2. Institution listing and registration, with editing and deactivation.
3. Student listing and registration by institution.
4. Enrollment suspension, reopening, and transfer, while preserving history.
5. Read and write authorization for administrators and delegated members.
6. Publication of institution, student, and enrollment domain events.
7. An activity feed derived from events.
8. Dashboard indicators updated from relevant changes.
9. Realtime updates between the host and remotes, including correlated modal
   interactions where required.

### Operational limits

These are functional requirements for the prototype, not proof of operational
readiness. High availability, exactly-once delivery, production identity, bulk
imports, and external integrations require separate validation before use with
real data.

## 4. Business rules

- The environment supports multiple institutions and campuses, identified by
  name, acronym, type, city, state, campus, and status.
- An active institution may receive new students.
- An inactive institution remains available for historical consultation but
  cannot receive new students.
- A student has one canonical record and may have multiple historical
  enrollments; simultaneous active enrollments require an explicit rule.
- An enrollment refers to an institution, campus, course, status, and dates.
- A transfer ends the source enrollment and creates a destination enrollment
  as one traceable operation.
- Suspension preserves the enrollment and allows an authorized user to reopen
  it.
- Each successful authorized write should publish one corresponding event.
- Event consumers update Activity and Dashboard without importing another
  remote's internal implementation.

## 5. Interface states

Every read or write screen should represent:

- `idle`: ready for an action.
- `loading`: a request is in progress; relevant controls prevent duplicate
  submission.
- `success`: the operation completed and feedback is visible.
- `empty`: the query succeeded and returned no records.
- `error`: the operation failed with an actionable message and a retry path
  where appropriate.

## 6. Main workflows

### Register an institution

1. An authorized user opens Institutions.
2. The system shows the list or an empty state.
3. The user enters required fields and confirms.
4. The system validates and persists the change, publishes
   `INSTITUTION_CREATED`, and updates the list.

### Register a student

1. The user selects an active institution.
2. The system shows students and the registration action allowed by the user's
   permissions.
3. The user enters required fields and confirms.
4. The system validates and persists the enrollment, publishes
   `STUDENT_CREATED`, and updates the list.

### Transfer, suspend, or reopen an enrollment

1. An authorized user selects the student's enrollment.
2. For suspension, the user supplies a reason and date; the enrollment becomes
   `suspended`.
3. For reopening, the user confirms the operation; the enrollment returns to
   `active`.
4. For transfer, the user selects a destination institution and course; the
   system ends the source enrollment and creates the destination enrollment,
   preserving history.
5. The system publishes the corresponding event with the operation's
   `correlationId`.

### Consume an event

1. Activity records a readable entry for each supported event.
2. Dashboard refreshes a related aggregation after consuming the event.
3. A consumption failure does not erase authoritative data or block future
   writes and is observable as an error.

## 7. Functional event contracts

The product requirements include these event types:

- `INSTITUTION_CREATED`, `INSTITUTION_UPDATED`, and
  `INSTITUTION_INACTIVATED`.
- `STUDENT_CREATED` and `STUDENT_UPDATED`.
- `ENROLLMENT_SUSPENDED`, `ENROLLMENT_REOPENED`, and `STUDENT_TRANSFERRED`.
- `STUDENT_CREATED_SUCCESS` and `STUDENT_CREATED_ERROR` for communication
  between a remote and a modal consumer.

Domain events carry `eventId`, `type`, `version`, `source`, `correlationId`,
`occurredAt`, and `payload`. Success and error interaction events should be
consumed in realtime so the consumer can react without importing another
remote's code. The implemented event set and payloads must be verified against
the shared schemas and backend contract before use.

## 8. Acceptance criteria

- Authorized users can list, create, edit, and deactivate institutions.
- Authorized users can list and register students within an active
  institution.
- A user without permission receives `401` or `403`, and no data changes.
- A missing or inactive institution prevents student registration.
- A transferred student retains the source history and destination enrollment.
- Suspension and reopening change the enrollment status without deleting
  history.
- Each successful write publishes one valid corresponding event.
- A consuming modal closes only after receiving its correlated success event;
  on error, it remains open and shows the failure.
- Activity displays consumed events in descending occurrence order.
- Dashboard refreshes a related indicator after event consumption.
- Empty, loading, success, and error states are distinguishable.
- Automated tests cover the principal workflow and authorization behavior.

## 9. Product decisions

- The product serves multiple institutions in one shared installation.
- The priority workflow is institution → student → enrollment → event.
- A student has one canonical record and, under the MVP rule, at most one
  active enrollment at a time.
- Administrators manage configuration and permissions; members perform
  delegated student and enrollment operations within their scope.
- Institution, Student, and Host are priority capabilities; Activity and
  Dashboard consume the principal workflow events; Administration supports
  the role-management use case.
