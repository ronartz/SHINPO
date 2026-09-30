## SHINPO Pull Request Workflow

### Flow Checklist
- [ ] **Branch**: Created dedicated feature/fix branch (`feature/*` or `gsd/*`)
- [ ] **Code**: Implemented targeted changes aligned with GSD phase or Ralph Loop plan
- [ ] **Tests**: Verified local backpressure gates:
  - [ ] Backend: `./mvnw test-compile` & `./mvnw test`
  - [ ] Frontend: `npm run build` & `npm run lint`
- [ ] **Pull Request**: Opened PR against `main`
- [ ] **CodeRabbit Review**: Awaiting automated review by `@coderabbitai`
- [ ] **Fix Issues**: Addressed all CodeRabbit suggestions and findings
- [ ] **Re-test**: Passed final local/CI build and test sweep
- [ ] **Merge**: Ready for merge into `main`

---

### Description
<!-- Summarize the changes made in this pull request -->

### Related GSD Phase / Ralph Task
<!-- e.g., Phase 2.4 / Task 3 -->

@coderabbitai summary
