import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button, buttonVariants } from "@/components/ui/Button";

/*
 * Button variants (DESIGN.md section 2, rule 2): one filled accent action per
 * view; outline takes its container's surface with a 3:1 control boundary;
 * secondary is the raised surface with a hairline.
 */
describe("Button variants", () => {
  it("draws outline transparent with the control boundary, so it sits on cards and pages alike", () => {
    render(<Button variant="outline">Open the outline</Button>);
    const button = screen.getByRole("button", { name: "Open the outline" });
    expect(button).toHaveClass("bg-transparent", "border-input", "text-foreground", "hover:bg-muted");
    expect(button).not.toHaveClass("bg-background", "border-border");
  });

  it("keeps secondary on the raised surface with a hairline", () => {
    expect(buttonVariants({ variant: "secondary" }).split(" ")).toEqual(
      expect.arrayContaining(["bg-secondary", "border-border", "text-secondary-foreground"]),
    );
  });

  it("fills only the default variant with the accent", () => {
    for (const variant of ["outline", "secondary", "ghost", "link", "destructive"] as const) {
      expect(buttonVariants({ variant }), variant).not.toMatch(/\bbg-primary\b/);
    }
    expect(buttonVariants({ variant: "default" })).toMatch(/\bbg-primary\b/);
  });

  it("lets a caller override the size token beside a colour class", () => {
    render(
      <Button variant="ghost" className="text-label text-subtle">
        Copy
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Copy" })).toHaveClass("text-label", "text-subtle");
  });

  it("gives the primary action the sheen over the accent fill, keeping the focus ring and the disabled state", () => {
    const recipe = buttonVariants({ variant: "default" }).split(" ");
    expect(recipe).toEqual(
      expect.arrayContaining(["sheen-primary", "bg-primary", "text-primary-foreground", "focus-visible:ring-2", "focus-visible:ring-ring", "disabled:opacity-50"]),
    );
    // Hover is the sheen's own veil (globals.css); a translucent fill would show the page through the button.
    expect(recipe).not.toContain("hover:bg-primary/90");
    for (const variant of ["outline", "secondary", "ghost", "link", "destructive"] as const) {
      expect(buttonVariants({ variant }), variant).not.toMatch(/sheen-primary/);
    }
  });
});

