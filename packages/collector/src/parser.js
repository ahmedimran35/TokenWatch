"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLine = parseLine;
const zod_1 = require("zod");
const uuid_1 = require("uuid");
const path = __importStar(require("path"));
const pricing_1 = require("./pricing");
const contentBlockSchema = zod_1.z.object({
    type: zod_1.z.string(),
    name: zod_1.z.string().optional(),
    input: zod_1.z.unknown().optional(),
});
const usageSchema = zod_1.z.object({
    input_tokens: zod_1.z.number().optional(),
    output_tokens: zod_1.z.number().optional(),
    cache_creation_input_tokens: zod_1.z.number().optional(),
    cache_read_input_tokens: zod_1.z.number().optional(),
});
const messageSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    model: zod_1.z.string().optional(),
    usage: usageSchema.optional(),
    content: zod_1.z.array(contentBlockSchema).optional(),
});
const lineSchema = zod_1.z.object({
    type: zod_1.z.string(),
    message: messageSchema.optional(),
    timestamp: zod_1.z.string().optional(),
    sessionId: zod_1.z.string().optional(),
    costUSD: zod_1.z.number().optional(),
    durationMs: zod_1.z.number().optional(),
});
function parseLine(line, filePath) {
    let parsed;
    try {
        parsed = JSON.parse(line);
    }
    catch {
        return null;
    }
    const result = lineSchema.safeParse(parsed);
    if (!result.success) {
        return null;
    }
    const data = result.data;
    if (data.type !== 'assistant') {
        return null;
    }
    const message = data.message;
    if (!message) {
        return null;
    }
    const rawMessageId = message.id ?? (0, uuid_1.v4)();
    const model = message.model ?? 'unknown';
    const usage = message.usage ?? {};
    const inputTokens = usage.input_tokens ?? 0;
    const outputTokens = usage.output_tokens ?? 0;
    const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
    const cacheWriteTokens = usage.cache_creation_input_tokens ?? 0;
    const totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens;
    // Extract tool info
    let toolName;
    let toolInput;
    if (message.content && message.content.length > 0) {
        const toolBlock = message.content.find((b) => b.type === 'tool_use');
        if (toolBlock) {
            toolName = toolBlock.name;
            toolInput = JSON.stringify(toolBlock.input);
        }
    }
    // Derive project path from file path
    // ~/.claude/projects/<encoded-path>/<session>.jsonl
    const relativePath = path.relative(path.join(require('os').homedir(), '.claude', 'projects'), filePath);
    const pathParts = relativePath.split(path.sep);
    const encodedProjectPath = pathParts[0] ?? 'unknown';
    const projectPath = decodeProjectPath(encodedProjectPath);
    const projectName = path.basename(projectPath) || encodedProjectPath;
    const costUsd = data.costUSD ?? (0, pricing_1.calculateCost)(model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens);
    return {
        id: (0, uuid_1.v4)(),
        sessionId: data.sessionId ?? pathParts[pathParts.length - 1]?.replace('.jsonl', '') ?? (0, uuid_1.v4)(),
        projectPath,
        projectName,
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        model,
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheWriteTokens,
        totalTokens,
        costUsd,
        toolName,
        toolInput,
        durationMs: data.durationMs,
        provider: 'claude',
    };
}
function decodeProjectPath(encoded) {
    // The encoded path uses '-' as path separator, but this is ambiguous.
    // For now we replace all '-' with '/' which matches the build plan spec.
    return encoded.replace(/-/g, '/');
}
//# sourceMappingURL=parser.js.map