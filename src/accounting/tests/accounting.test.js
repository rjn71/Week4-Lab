"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  OP_CODES,
  dataProgram,
  operations,
  resetBalance,
  normalizeOperation,
} = require("../index");

const APP_PATH = path.join(__dirname, "..", "index.js");

function runAppWithInput(input) {
  const result = spawnSync(process.execPath, [APP_PATH], {
    encoding: "utf8",
    input,
  });

  if (result.error) {
    throw result.error;
  }

  return result;
}

function joinedLogs(logSpy) {
  return logSpy.mock.calls.map((args) => args.join(" ")).join("\n");
}

describe("COBOL parity test cases", () => {
  beforeEach(() => {
    resetBalance();
  });

  test("TC-001: startup displays menu options", () => {
    const result = runAppWithInput("4\n");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Account Management System");
    expect(result.stdout).toContain("1. View Balance");
    expect(result.stdout).toContain("2. Credit Account");
    expect(result.stdout).toContain("3. Debit Account");
    expect(result.stdout).toContain("4. Exit");
    expect(result.stdout).toContain("Enter your choice (1-4):");
  });

  test("TC-002: view balance returns initial starting balance", () => {
    const result = runAppWithInput("1\n4\n");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Current balance: 001000.00");
  });

  test("TC-003: credit increases balance", () => {
    const result = runAppWithInput("2\n200\n1\n4\n");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Amount credited. New balance: 001200.00");
    expect(result.stdout).toContain("Current balance: 001200.00");
  });

  test("TC-004: multiple credits are cumulative", () => {
    const result = runAppWithInput("2\n100\n2\n50\n1\n4\n");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Current balance: 001150.00");
  });

  test("TC-005: debit decreases balance when funds are sufficient", () => {
    const result = runAppWithInput("3\n150\n1\n4\n");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Amount debited. New balance: 000850.00");
    expect(result.stdout).toContain("Current balance: 000850.00");
  });

  test("TC-006: debit exactly equal to current balance is allowed", () => {
    const result = runAppWithInput("3\n1000\n1\n4\n");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Amount debited. New balance: 000000.00");
    expect(result.stdout).toContain("Current balance: 000000.00");
  });

  test("TC-007: debit larger than current balance is rejected", () => {
    const result = runAppWithInput("3\n2000\n1\n4\n");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Insufficient funds for this debit.");
    expect(result.stdout).toContain("Current balance: 001000.00");
  });

  test("TC-008: invalid menu choice shows message and keeps app running", () => {
    const result = runAppWithInput("9\n4\n");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Invalid choice, please select 1-4.");

    const menuCount = (result.stdout.match(/Account Management System/g) || []).length;
    expect(menuCount).toBeGreaterThanOrEqual(2);
  });

  test("TC-009: exit option terminates session", () => {
    const result = runAppWithInput("4\n");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Exiting the program. Goodbye!");
  });

  test("TC-010: balance persists across multiple operations in one run", () => {
    const result = runAppWithInput("2\n300\n3\n125\n1\n4\n");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Current balance: 001175.00");
  });

  test("TC-011: balance resets to initial value after restart", () => {
    const firstRun = runAppWithInput("2\n200\n4\n");
    const secondRun = runAppWithInput("1\n4\n");

    expect(firstRun.status).toBe(0);
    expect(firstRun.stdout).toContain("Amount credited. New balance: 001200.00");

    expect(secondRun.status).toBe(0);
    expect(secondRun.stdout).toContain("Current balance: 001000.00");
  });

  test("TC-012: zero-value credit is accepted", () => {
    const result = runAppWithInput("2\n0\n1\n4\n");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Amount credited. New balance: 001000.00");
    expect(result.stdout).toContain("Current balance: 001000.00");
  });

  test("TC-013: zero-value debit is accepted", () => {
    const result = runAppWithInput("3\n0\n1\n4\n");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Amount debited. New balance: 001000.00");
    expect(result.stdout).toContain("Current balance: 001000.00");
  });

  test("TC-014: system runs as a single shared account", () => {
    const result = runAppWithInput("2\n50\n3\n25\n1\n4\n");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Enter credit amount:");
    expect(result.stdout).toContain("Enter debit amount:");
    expect(result.stdout).toContain("Current balance: 001025.00");
    expect(result.stdout).not.toMatch(/student\s*id|account\s*(id|number)/i);
  });

  test("TC-015: DataProgram READ/WRITE contract updates and returns stored value", () => {
    dataProgram("WRITE", 123456);

    const readBack = dataProgram("READ", 0);

    expect(readBack).toBe(123456);
  });

  test("TC-016: operation code mapping and fixed-width values route correctly", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const creditAsk = jest.fn().mockResolvedValue("20");
    const debitAsk = jest.fn().mockResolvedValue("5");

    expect(OP_CODES.TOTAL).toBe("TOTAL ");
    expect(OP_CODES.CREDIT).toBe("CREDIT");
    expect(OP_CODES.DEBIT).toBe("DEBIT ");
    expect(OP_CODES.READ).toBe("READ  ");
    expect(OP_CODES.WRITE).toBe("WRITE ");

    expect(normalizeOperation("TOTAL")).toBe(OP_CODES.TOTAL);
    expect(normalizeOperation("DEBIT")).toBe(OP_CODES.DEBIT);

    await operations("TOTAL");
    await operations("CREDIT", creditAsk);
    await operations("DEBIT", debitAsk);

    expect(creditAsk).toHaveBeenCalledTimes(1);
    expect(debitAsk).toHaveBeenCalledTimes(1);
    expect(dataProgram("READ", 0)).toBe(101500);

    const logOutput = joinedLogs(logSpy);
    expect(logOutput).toContain("Current balance: 001000.00");
    expect(logOutput).toContain("Amount credited. New balance: 001020.00");
    expect(logOutput).toContain("Amount debited. New balance: 001015.00");

    logSpy.mockRestore();
  });

  test("TC-017: Operations ignores unknown operation code without mutating balance", async () => {
    const ask = jest.fn().mockResolvedValue("999");
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    dataProgram("WRITE", 100000);
    await operations("XXXXXX", ask);

    expect(ask).not.toHaveBeenCalled();
    expect(dataProgram("READ", 0)).toBe(100000);
    expect(logSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  test("TC-018: DataProgram ignores unknown operation code and keeps stored balance", () => {
    dataProgram("WRITE", 100000);
    dataProgram("XXXXXX", 999999);

    expect(dataProgram("READ", 0)).toBe(100000);
  });
});
