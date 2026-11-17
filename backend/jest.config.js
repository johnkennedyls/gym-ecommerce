module.exports = {
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }] },
  collectCoverageFrom: [
    'modules/**/*.service.ts',
    'modules/**/*rules.ts',
    'modules/**/cart-calculator.ts',
    'modules/**/sandbox-payment.gateway.ts',
    'common/**/*.ts',
    'config/**/*.ts',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
