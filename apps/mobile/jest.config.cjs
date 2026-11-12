module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts'],
  clearMocks: true,
  moduleNameMapper: { '^@nivvi/contracts$': '<rootDir>/../../packages/contracts/src/index.ts' },
};
