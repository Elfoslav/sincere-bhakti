import { expect, it } from "vitest";
import { validateEmail } from "@/lib/registration-validation";
it("validateEmail case 0", () => { expect(validateEmail("", (key) => key)).toBe("emailRequired"); });
it("validateEmail case 1", () => { expect(validateEmail("bad", (key) => key)).toBe("emailInvalid"); });
it("validateEmail case 2", () => { expect(validateEmail(" devotee@example.com ", (key) => key)).toBe(null); });
