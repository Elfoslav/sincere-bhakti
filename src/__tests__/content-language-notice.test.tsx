import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
vi.mock("next-intl", () => ({ useLocale: () => "cs", useTranslations: () => (_key: string, values: { language: string }) => `Publishing in ${values.language}` }));
import ContentLanguageNotice from "@/components/ContentLanguageNotice";
it("makes the actual publication language explicit", () => {
  render(<ContentLanguageNotice />);
  expect(screen.getByText("Publishing in Čeština")).toBeInTheDocument();
});
