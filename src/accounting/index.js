"use strict";

const fs = require("node:fs");
const readline = require("node:readline");

const OP_CODES = Object.freeze({
  TOTAL: "TOTAL ",
  CREDIT: "CREDIT",
  DEBIT: "DEBIT ",
  READ: "READ  ",
  WRITE: "WRITE ",
});

const INITIAL_BALANCE_CENTS = 100000;
let storageBalanceCents = INITIAL_BALANCE_CENTS;

function normalizeOperation(operation) {
  return String(operation ?? "").padEnd(6, " ").slice(0, 6);
}

function parseAmountToCents(rawValue) {
  const value = String(rawValue ?? "").trim();

  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    return null;
  }

  const parts = value.split(".");
  const whole = Number.parseInt(parts[0], 10);
  const fraction = Number.parseInt((parts[1] ?? "").padEnd(2, "0").slice(0, 2), 10);

  if (!Number.isFinite(whole) || !Number.isFinite(fraction)) {
    return null;
  }

  return whole * 100 + fraction;
}

function formatBalance(cents) {
  const safeCents = Math.max(0, Math.trunc(cents));
  const whole = Math.floor(safeCents / 100)
    .toString()
    .padStart(6, "0");
  const fraction = (safeCents % 100).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

function dataProgram(passedOperation, balanceCents) {
  const operationType = normalizeOperation(passedOperation);

  if (operationType === OP_CODES.READ) {
    return storageBalanceCents;
  }

  if (operationType === OP_CODES.WRITE && Number.isInteger(balanceCents)) {
    storageBalanceCents = balanceCents;
  }

  return storageBalanceCents;
}

function createPrompter() {
  if (!process.stdin.isTTY) {
    const queuedInput = fs.readFileSync(0, "utf8").split(/\r?\n/);
    let currentIndex = 0;

    return {
      ask: async (question) => {
        if (question) {
          process.stdout.write(question);
        }

        const answer = queuedInput[currentIndex] ?? "";
        currentIndex += 1;

        if (answer) {
          process.stdout.write(`${answer}\n`);
        }

        return answer;
      },
      close: () => {},
    };
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question) =>
    new Promise((resolve) => {
      rl.question(question, (answer) => resolve(answer));
    });

  return {
    ask,
    close: () => rl.close(),
  };
}

async function readAmount(label, ask) {
  console.log(label);
  const amountInput = await ask("");
  const amountCents = parseAmountToCents(amountInput);

  if (amountCents === null) {
    console.log("Invalid amount. Please enter a numeric value with up to 2 decimals.");
    return null;
  }

  return amountCents;
}

async function operations(passedOperation, ask = async () => "") {
  const operationType = normalizeOperation(passedOperation);
  let finalBalanceCents = INITIAL_BALANCE_CENTS;

  if (operationType === OP_CODES.TOTAL) {
    finalBalanceCents = dataProgram(OP_CODES.READ, finalBalanceCents);
    console.log(`Current balance: ${formatBalance(finalBalanceCents)}`);
    return;
  }

  if (operationType === OP_CODES.CREDIT) {
    const amountCents = await readAmount("Enter credit amount: ", ask);
    if (amountCents === null) {
      return;
    }

    finalBalanceCents = dataProgram(OP_CODES.READ, finalBalanceCents);
    finalBalanceCents += amountCents;
    dataProgram(OP_CODES.WRITE, finalBalanceCents);
    console.log(`Amount credited. New balance: ${formatBalance(finalBalanceCents)}`);
    return;
  }

  if (operationType === OP_CODES.DEBIT) {
    const amountCents = await readAmount("Enter debit amount: ", ask);
    if (amountCents === null) {
      return;
    }

    finalBalanceCents = dataProgram(OP_CODES.READ, finalBalanceCents);

    if (finalBalanceCents >= amountCents) {
      finalBalanceCents -= amountCents;
      dataProgram(OP_CODES.WRITE, finalBalanceCents);
      console.log(`Amount debited. New balance: ${formatBalance(finalBalanceCents)}`);
    } else {
      console.log("Insufficient funds for this debit.");
    }
  }
}

function showMenu() {
  console.log("--------------------------------");
  console.log("Account Management System");
  console.log("1. View Balance");
  console.log("2. Credit Account");
  console.log("3. Debit Account");
  console.log("4. Exit");
  console.log("--------------------------------");
}

async function mainProgram() {
  const prompter = createPrompter();
  let continueFlag = "YES";

  try {
    while (continueFlag !== "NO") {
      showMenu();
      const userChoice = Number.parseInt(await prompter.ask("Enter your choice (1-4): "), 10);

      switch (userChoice) {
        case 1:
          await operations(OP_CODES.TOTAL, prompter.ask);
          break;
        case 2:
          await operations(OP_CODES.CREDIT, prompter.ask);
          break;
        case 3:
          await operations(OP_CODES.DEBIT, prompter.ask);
          break;
        case 4:
          continueFlag = "NO";
          break;
        default:
          console.log("Invalid choice, please select 1-4.");
      }
    }
  } finally {
    prompter.close();
  }

  console.log("Exiting the program. Goodbye!");
}

function resetBalance() {
  storageBalanceCents = INITIAL_BALANCE_CENTS;
}

if (require.main === module) {
  mainProgram().catch((error) => {
    console.error("Unexpected application error:", error);
    process.exitCode = 1;
  });
}

module.exports = {
  OP_CODES,
  dataProgram,
  operations,
  mainProgram,
  resetBalance,
  parseAmountToCents,
  formatBalance,
  normalizeOperation,
};
