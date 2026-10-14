import { describe, it, expect, beforeEach } from "vitest";
import {
  startGuestSession,
  endGuestSession,
  cleanUpAbandonedGuestSession,
  isGuestSessionActive,
} from "@/lib/guest-mode";

describe("guest preview keeps device data safe", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("userProfile", JSON.stringify({ name: "Real person" }));
    localStorage.setItem("nouri:streak", "12");
  });

  it("starts with a clean slate and hides the real data", () => {
    expect(startGuestSession()).toBe(true);
    expect(isGuestSessionActive()).toBe(true);
    expect(localStorage.getItem("userProfile")).toBeNull();
    expect(localStorage.getItem("nouri:streak")).toBeNull();
  });

  it("restores the real data and drops guest data when the preview ends", () => {
    startGuestSession();
    localStorage.setItem("nouri:streak", "1"); // something the guest did
    localStorage.setItem("guestOnly", "x");
    endGuestSession();
    expect(isGuestSessionActive()).toBe(false);
    expect(localStorage.getItem("nouri:streak")).toBe("12");
    expect(JSON.parse(localStorage.getItem("userProfile")!).name).toBe("Real person");
    expect(localStorage.getItem("guestOnly")).toBeNull();
  });

  it("restores the real data if the guest tab was closed without exiting", () => {
    startGuestSession();
    sessionStorage.clear(); // closing the tab clears sessionStorage
    cleanUpAbandonedGuestSession();
    expect(localStorage.getItem("nouri:streak")).toBe("12");
  });

  it("does not touch anything while the preview is still open", () => {
    startGuestSession();
    localStorage.setItem("guestOnly", "x");
    cleanUpAbandonedGuestSession();
    expect(localStorage.getItem("guestOnly")).toBe("x");
  });
});
