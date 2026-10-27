import { expect, it } from "vitest";
import { validateName } from "@/lib/registration-validation";
it("validateName case 0", () => { expect(validateName("  ", (key) => key)).toBe("nameRequired"); });
it("validateName case 1", () => { expect(validateName("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", (key) => key)).toBe("nameTooLong"); });
it("validateName case 2", () => { expect(validateName(" Tulsi ", (key) => key)).toBe(null); });
