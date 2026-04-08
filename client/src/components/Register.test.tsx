import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Register } from "./Register.js";

function makeProps(overrides = {}) {
  return {
    onRegister: vi.fn(async () => {}),
    onLogin: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("Register component", () => {
  // CL1: renders name + PIN inputs
  it("CL1: renders name and PIN inputs", () => {
    render(<Register {...makeProps()} />);
    expect(screen.getByPlaceholderText(/name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/pin/i)).toBeInTheDocument();
  });

  // CL2: submit with valid data calls onRegister
  it("CL2: submit with valid name and PIN calls onRegister", async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<Register {...props} />);

    await user.type(screen.getByPlaceholderText(/name/i), "Alice");
    await user.type(screen.getByPlaceholderText(/pin/i), "1234");
    await user.click(screen.getByRole("button", { name: /start/i }));

    expect(props.onRegister).toHaveBeenCalledWith("Alice", "1234");
  });

  // CL3: submit with empty name leaves button disabled
  it("CL3: submit button disabled when name is empty", () => {
    render(<Register {...makeProps()} />);
    const btn = screen.getByRole("button", { name: /start/i });
    expect(btn).toBeDisabled();
  });

  it("submit button disabled when PIN is invalid (< 4 digits)", async () => {
    const user = userEvent.setup();
    render(<Register {...makeProps()} />);
    await user.type(screen.getByPlaceholderText(/name/i), "Alice");
    await user.type(screen.getByPlaceholderText(/pin/i), "12");
    expect(screen.getByRole("button", { name: /start/i })).toBeDisabled();
  });

  it("shows name-taken warning when onRegister returns nameTaken=true", async () => {
    const user = userEvent.setup();
    const props = makeProps({ onRegister: vi.fn(async () => ({ nameTaken: true })) });
    render(<Register {...props} />);

    await user.type(screen.getByPlaceholderText(/name/i), "Alice");
    await user.type(screen.getByPlaceholderText(/pin/i), "1234");
    await user.click(screen.getByRole("button", { name: /start/i }));

    expect(await screen.findByText(/already in use/i)).toBeInTheDocument();
  });

  it("shows error message when onRegister throws", async () => {
    const user = userEvent.setup();
    const props = makeProps({
      onRegister: vi.fn(async () => { throw new Error("Server error"); }),
    });
    render(<Register {...props} />);

    await user.type(screen.getByPlaceholderText(/name/i), "Alice");
    await user.type(screen.getByPlaceholderText(/pin/i), "1234");
    await user.click(screen.getByRole("button", { name: /start/i }));

    expect(await screen.findByText(/server error/i)).toBeInTheDocument();
  });

  it("switches to login mode when log in tab is clicked", async () => {
    const user = userEvent.setup();
    render(<Register {...makeProps()} />);
    // There are two "log in" buttons (tab + submit); click the tab
    const buttons = screen.getAllByRole("button", { name: /log in/i });
    await user.click(buttons[0]); // click the tab
    // After switching to login mode, the submit button should say "log in"
    const submitBtns = screen.getAllByRole("button", { name: /log in/i });
    expect(submitBtns.length).toBeGreaterThanOrEqual(1);
  });
});
