const dotenv = require("dotenv");
dotenv.config({
    path: ".env.test",
});

module.exports = {
    clearMocks: true,
    resetMocks: true,
    testEnvironment: "jsdom",
    // e2e specs are Playwright's, not jest's.
    testPathIgnorePatterns: ["/node_modules/", "/e2e/"],
};
