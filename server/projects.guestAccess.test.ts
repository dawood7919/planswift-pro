import { canLoadProjects, getProjectsAccessState } from "@/lib/projectsAccess";
import { describe, expect, it } from "vitest";

describe("وصول الزائر إلى صفحة المشاريع", () => {
  it("لا يشغّل استعلام المشاريع المحمي أثناء التحقق من الجلسة أو عند غيابها", () => {
    const loading = getProjectsAccessState({ isAuthLoading: true, userId: null });
    const guest = getProjectsAccessState({ isAuthLoading: false, userId: null });

    expect(loading).toBe("auth-loading");
    expect(guest).toBe("guest");
    expect(canLoadProjects(loading)).toBe(false);
    expect(canLoadProjects(guest)).toBe(false);
  });

  it("يشغّل الاستعلام المحمي فقط بعد إثبات هوية المستخدم", () => {
    const authenticated = getProjectsAccessState({
      isAuthLoading: false,
      userId: "user_123",
    });

    expect(authenticated).toBe("authenticated");
    expect(canLoadProjects(authenticated)).toBe(true);
  });
});
