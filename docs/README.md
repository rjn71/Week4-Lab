# COBOL Student Account Documentation

## Overview
This project implements a simple menu-driven student account balance system in COBOL.
The program supports three actions:
- View current balance
- Credit (add funds)
- Debit (subtract funds)

The runtime is split into three COBOL programs that communicate using `CALL ... USING` parameters.

## File Purposes and Key Functions

### `src/cobol/main.cob` (`PROGRAM-ID. MainProgram`)
Purpose:
- Acts as the user-facing entry point and menu controller.

Key logic:
- Displays a looped menu until the user chooses Exit.
- Accepts a numeric choice from 1-4.
- Routes user actions by calling `Operations` with one of these operation codes:
  - `TOTAL ` for balance inquiry
  - `CREDIT` for deposit
  - `DEBIT ` for withdrawal
- Ends the program when choice `4` is selected.

### `src/cobol/operations.cob` (`PROGRAM-ID. Operations`)
Purpose:
- Implements account transaction behavior.

Key logic:
- Receives an operation code from `MainProgram`.
- For `TOTAL `:
  - Calls `DataProgram` with `READ` to fetch current balance.
  - Displays the balance.
- For `CREDIT`:
  - Accepts a credit amount.
  - Reads current balance from `DataProgram`.
  - Adds amount to balance.
  - Writes updated balance back through `DataProgram` using `WRITE`.
- For `DEBIT `:
  - Accepts a debit amount.
  - Reads current balance from `DataProgram`.
  - Checks funds before subtraction.
  - Writes updated balance only when sufficient funds are available.

### `src/cobol/data.cob` (`PROGRAM-ID. DataProgram`)
Purpose:
- Provides a centralized in-memory balance store and read/write interface.

Key logic:
- Maintains `STORAGE-BALANCE` in working storage.
- Receives operation requests via linkage fields:
  - `READ` returns `STORAGE-BALANCE` to caller.
  - `WRITE` updates `STORAGE-BALANCE` from caller input.

## Student Account Business Rules

1. Single account model:
- The system tracks one shared student account balance (no student ID or multi-account support).

2. Starting balance:
- The account begins at `1000.00` when the program starts.

3. Debit protection:
- A debit is allowed only if `balance >= debit amount`.
- If not, the transaction is rejected with an "Insufficient funds" message.

4. Inter-program operation codes are fixed-width:
- `TOTAL ` and `DEBIT ` include a trailing space to fit 6 characters.
- `CREDIT`, `READ`, and `WRITE` are also handled as 6-character control values.

5. Balance lifetime:
- Balance is maintained in memory during execution.
- Balance resets to the initial value when the application restarts.

## Current Constraints / Validation Notes

- No account-level authorization or student identity checks.
- No transaction history/audit log.
- No explicit validation to reject zero-value transactions.
- Amount fields are numeric (`PIC 9(6)V99`), so non-numeric input is constrained by COBOL numeric handling but business validation remains minimal.

## Sequence Diagram (Data Flow)

~~~mermaid
sequenceDiagram
  autonumber
  actor User as Student/User
  participant Main as MainProgram
  participant Ops as Operations
  participant Data as DataProgram

  loop Until user selects Exit (choice 4)
    User->>Main: Enter menu choice (1-4)
    alt Choice 1: View Balance
      Main->>Ops: CALL Operations("TOTAL ")
      Ops->>Data: CALL DataProgram("READ", FINAL-BALANCE)
      Data-->>Ops: Return STORAGE-BALANCE
      Ops-->>Main: Display current balance
      Main-->>User: Current balance shown
    else Choice 2: Credit Account
      Main->>Ops: CALL Operations("CREDIT")
      Ops-->>User: Prompt for credit amount
      User->>Ops: Enter amount
      Ops->>Data: CALL DataProgram("READ", FINAL-BALANCE)
      Data-->>Ops: Return STORAGE-BALANCE
      Ops->>Ops: ADD amount to FINAL-BALANCE
      Ops->>Data: CALL DataProgram("WRITE", FINAL-BALANCE)
      Data-->>Ops: Persist updated balance
      Ops-->>Main: Display new balance
      Main-->>User: Credit confirmation shown
    else Choice 3: Debit Account
      Main->>Ops: CALL Operations("DEBIT ")
      Ops-->>User: Prompt for debit amount
      User->>Ops: Enter amount
      Ops->>Data: CALL DataProgram("READ", FINAL-BALANCE)
      Data-->>Ops: Return STORAGE-BALANCE
      alt Sufficient funds
        Ops->>Ops: SUBTRACT amount
        Ops->>Data: CALL DataProgram("WRITE", FINAL-BALANCE)
        Data-->>Ops: Persist updated balance
        Ops-->>Main: Display new balance
        Main-->>User: Debit confirmation shown
      else Insufficient funds
        Ops-->>Main: Display insufficient funds
        Main-->>User: Debit rejected
      end
    else Choice 4: Exit
      Main-->>User: End session message
    else Invalid choice
      Main-->>User: Invalid choice message
    end
  end
~~~
