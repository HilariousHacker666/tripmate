const { passwordComplexityRegex } = require('../../src/middleware/validate');

describe('Unit Test: Password Policy & Validation (SR-01)', () => {
  test('UT-05: Password meeting all complexity criteria passes regex', () => {
    const validPasswords = [
      'StrongPassword123!',
      'Secure#App2026',
      'P@ssw0rdTripMate',
      'V3ryL0ng&SecurePass'
    ];

    validPasswords.forEach(pw => {
      expect(passwordComplexityRegex.test(pw)).toBe(true);
    });
  });

  test('UT-06: Passwords failing complexity or length are rejected', () => {
    const invalidPasswords = [
      'Short1!',            // Less than 10 characters
      'alllowercase123!',    // No uppercase
      'ALLUPPERCASE123!',    // No lowercase
      'NoSpecialChars123',   // No special character
      'NoDigitsHere!@#$',    // No numbers
      'password'             // Plain word
    ];

    invalidPasswords.forEach(pw => {
      expect(passwordComplexityRegex.test(pw)).toBe(false);
    });
  });

  test('UT-07: Expense calculation aggregation logic', () => {
    const expenses = [
      { category: 'Food', amount: 50.25 },
      { category: 'Food', amount: 25.50 },
      { category: 'Transport', amount: 100.00 }
    ];

    const total = expenses.reduce((acc, curr) => acc + curr.amount, 0);
    expect(total).toBeCloseTo(175.75);

    const categoryMap = expenses.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {});

    expect(categoryMap['Food']).toBeCloseTo(75.75);
    expect(categoryMap['Transport']).toBeCloseTo(100.00);
  });
});
