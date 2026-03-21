import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, "dist");
const RESOURCE_URI = "ui://probabilistic-thinking/mcp-app-v1.html";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "Probabilistic Thinking",
    version: "1.0.0",
  });

  const courseInputSchema = {
    lessonIndex: z.number().min(0).max(3).default(0).optional(),
    role: z.string().optional(),
    domain: z.string().optional(),
    challenge: z.string().optional(),
  };

  registerAppTool(
    server,
    "open-probabilistic-thinking",
    {
      title: "Open Probabilistic Thinking",
      description:
        "Launch the Probabilistic Thinking course — an interactive, personalized learning experience that teaches learners to reason under uncertainty. The course opens with a compelling hook, gathers context through a short conversation, then delivers 4 visually interactive lessons adapted to the learner's role, domain, and key decisions.",
      inputSchema: courseInputSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
      _meta: {
        ui: {
          resourceUri: RESOURCE_URI,
        },
        "openai/toolInvocation/invoking": "Opening Probabilistic Thinking…",
        "openai/toolInvocation/invoked": "Probabilistic Thinking ready.",
      },
    },
    async (args: z.infer<z.ZodObject<typeof courseInputSchema>>) => {
      return {
        structuredContent: {
          phase: args.lessonIndex != null && args.lessonIndex > 0 ? "lesson" : "hook",
          lessonIndex: args.lessonIndex ?? 0,
          role: args.role ?? "",
          domain: args.domain ?? "",
          challenge: args.challenge ?? "",
        },
        content: [
          {
            type: "text",
            text: "Probabilistic Thinking course launched. The learner will see the intro, share their context, then work through 4 personalized interactive lessons.",
          },
        ],
      };
    },
  );

  registerAppResource(
    server,
    RESOURCE_URI,
    RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => {
      const html = await fs.readFile(path.join(DIST_DIR, "mcp-app.html"), "utf-8");
      return {
        contents: [
          {
            uri: RESOURCE_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            _meta: {
              ui: {
                prefersBorder: true,
                domain: "probabilistic-thinking",
                csp: {
                  connectDomains: [],
                  resourceDomains: ["https://cdn.plot.ly"],
                },
              },
            },
          },
        ],
      };
    },
  );

  return server;
}
