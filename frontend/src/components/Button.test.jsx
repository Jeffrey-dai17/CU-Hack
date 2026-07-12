import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Button from "./Button.jsx";

describe("Button", () => {
  it("renders a real button with primary/medium defaults and its label", () => {
    render(<Button>Start swiping</Button>);

    const button = screen.getByRole("button", { name: "Start swiping" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("ui-btn", "ui-btn--primary", "ui-btn--md");
    expect(button).not.toBeDisabled();
    expect(button).not.toHaveAttribute("aria-busy");
  });

  it("maps variant and size props onto modifier classes", () => {
    render(
      <Button variant="danger" size="lg">
        Delete
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toHaveClass("ui-btn--danger", "ui-btn--lg");
  });

  it("forwards click handlers, type, and arbitrary props", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button type="submit" onClick={onClick} data-testid="cta" className="extra">
        Go
      </Button>,
    );

    const button = screen.getByTestId("cta");
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveClass("extra");

    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders a decorative left icon that is hidden from assistive tech", () => {
    render(
      <Button leftIcon={<svg data-testid="icon" />}>Liked</Button>,
    );

    const button = screen.getByRole("button", { name: "Liked" });
    const iconWrap = button.querySelector(".ui-btn__icon");
    expect(iconWrap).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("blocks interaction and announces status while busy", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button busy onClick={onClick}>
        Saving
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Saving" });
    expect(button).toBeDisabled();
    expect(button).toHaveClass("is-busy");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector(".ui-btn__spinner")).toBeInTheDocument();

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("respects an explicit disabled prop", () => {
    render(<Button disabled>Nope</Button>);
    expect(screen.getByRole("button", { name: "Nope" })).toBeDisabled();
  });

  it("renders an icon-only button with no label span when there are no children", () => {
    render(<Button size="icon" aria-label="Skip" leftIcon={<span>x</span>} />);

    const button = screen.getByRole("button", { name: "Skip" });
    expect(button).toHaveClass("ui-btn--icon");
    expect(button.querySelector(".ui-btn__label")).toBeNull();
  });
});
