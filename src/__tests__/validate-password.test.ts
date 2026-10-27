import { expect, it } from "vitest";
import { validatePassword } from "@/lib/registration-validation";
it("validatePassword case 0", () => { expect(validatePassword("", (key) => key)).toBe("passwordRequired"); });
it("validatePassword case 1", () => { expect(validatePassword("short", (key) => key)).toBe("passwordTooShort"); });
it("validatePassword case 2", () => { expect(validatePassword("  validPass ", (key) => key)).toBe("passwordWhitespace"); });
it("validatePassword case 3", () => { expect(validatePassword("validPass", (key) => key)).toBe(null); });
