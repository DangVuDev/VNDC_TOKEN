// Type augmentation for @nomicfoundation/hardhat-chai-matchers
// This makes TypeScript recognize Hardhat/Ethereum-specific Chai matchers

import { Assertion } from "chai";

declare module "chai" {
  interface Assertion {
    /// reverted matcher for checking if transaction reverted
    reverted: Assertion;

    /// revertedWith matcher for checking revert reason string
    revertedWith(reason: string | RegExp): Assertion;

    /// revertedWithCustomError matcher for checking custom errors
    revertedWithCustomError(
      contract: { interface: { errors?: Record<string, any> } },
      errorName: string
    ): Assertion & { withArgs(...args: any[]): Assertion };

    /// revertedWithPanic matcher for checking panic codes
    revertedWithPanic(code: string | number): Assertion;

    /// revertedWithoutReason matcher
    revertedWithoutReason(): Assertion;

    /// changeEtherBalance matcher
    changeEtherBalance(account: string, delta: any): Assertion;

    /// changeEtherBalances matcher
    changeEtherBalances(accounts: string[], deltas: any[]): Assertion;

    /// changeTokenBalance matcher
    changeTokenBalance(token: any, account: string, delta: any): Assertion;

    /// changeTokenBalances matcher
    changeTokenBalances(token: any, accounts: string[], deltas: any[]): Assertion;

    /// emit matcher for events
    emit(contract: any, eventName: string): Assertion & { withArgs(...args: any[]): Assertion };

    /// properAddress matcher
    properAddress: Assertion;

    /// properPrivateKey matcher
    properPrivateKey: Assertion;

    /// properHex matcher
    properHex(length: number): Assertion;
  }
}
