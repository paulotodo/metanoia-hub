import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/dialog";

describe("Dialog", () => {
  it("renders when open", () => {
    const { getByText } = render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dialog Title</DialogTitle>
            <DialogDescription>Dialog description</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );
    expect(getByText("Dialog Title")).toBeDefined();
  });

  it("passes accessibility checks when open", async () => {
    const { container } = render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accessible Dialog</DialogTitle>
            <DialogDescription>
              This dialog is accessible and has a title.
            </DialogDescription>
          </DialogHeader>
          <p>Dialog body content</p>
        </DialogContent>
      </Dialog>,
    );
    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  });
});
