"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateCost = calculateCost;
const PRICING = {
    'claude-opus-4-5': { input: 15, output: 75, cacheRead: 1.50, cacheWrite: 18.75 },
    'claude-sonnet-4-5': { input: 3, output: 15, cacheRead: 0.30, cacheWrite: 3.75 },
    'claude-haiku-4-5': { input: 0.80, output: 4, cacheRead: 0.08, cacheWrite: 1 },
    'claude-opus-4-6': { input: 15, output: 75, cacheRead: 1.50, cacheWrite: 18.75 },
    'claude-sonnet-4-6': { input: 3, output: 15, cacheRead: 0.30, cacheWrite: 3.75 },
};
function calculateCost(model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens) {
    let pricing = PRICING[model];
    if (!pricing) {
        // Try prefix matching
        const prefix = Object.keys(PRICING).find((key) => model.startsWith(key));
        if (prefix) {
            pricing = PRICING[prefix];
        }
    }
    if (!pricing) {
        // Fallback to sonnet pricing
        pricing = PRICING['claude-sonnet-4-6'];
    }
    const inputCost = (inputTokens * pricing.input) / 1_000_000;
    const outputCost = (outputTokens * pricing.output) / 1_000_000;
    const cacheReadCost = (cacheReadTokens * pricing.cacheRead) / 1_000_000;
    const cacheWriteCost = (cacheWriteTokens * pricing.cacheWrite) / 1_000_000;
    return inputCost + outputCost + cacheReadCost + cacheWriteCost;
}
//# sourceMappingURL=pricing.js.map