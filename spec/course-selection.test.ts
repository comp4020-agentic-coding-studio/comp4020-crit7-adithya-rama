import { beforeAll, describe, expect, inject, it } from "vitest";

// This week's published spec (crit 7: "Build the ANU system you wish
// existed"), turned into checks. Mechanically checkable lines only —
// "models a slice of a real ANU system" and "you can account for how you
// directed, grounded and corrected the work" are judged by the tutor at the
// crit, not by a test.
//
// Starts red: there's no course-selection feature yet, only the starter's
// guestbook. Replace the guestbook plumbing (src/pages/api/messages.ts,
// spec/guestbook.test.ts) with a real course-selection endpoint that matches
// this contract, or adjust this file to match the contract you actually
// build — either is fine, as long as the contract stays asserted somewhere.
const baseUrl = inject("baseUrl");

describe("course selection", () => {
  let code: string;

  beforeAll(() => {
    code = `SPEC${process.hrtime.bigint()}`;
  });

  const post = (path: string, body: URLSearchParams) =>
    fetch(new URL(path, baseUrl), {
      method: "POST",
      headers: { origin: baseUrl },
      body,
      redirect: "manual",
    });

  it("accepts a course selection", async () => {
    const res = await post("/api/selections", new URLSearchParams({ code }));
    expect([200, 303]).toContain(res.status);
  });

  it("persists the selection: a fresh page load still shows it", async () => {
    const res = await fetch(baseUrl);
    expect(await res.text()).toContain(code);
  });
});
