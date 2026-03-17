import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, "dist");
const RESOURCE_URI = "ui://prob-thinking/course-app.html";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "Probabilistic Thinking Course",
    version: "0.1.0",
  });

  registerAppTool(
    server,
    "open_course",
    {
      title: "Open Probabilistic Thinking Course",
      description:
        "Open the Probabilistic Thinking course. Shows your progress and continues from where you left off. Each lesson teaches a concept and includes an interactive exercise.",
      inputSchema: {},
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: false,
      },
      _meta: {
        ui: {
          resourceUri: RESOURCE_URI,
        },
        "openai/toolInvocation/invoking": "Opening your course…",
        "openai/toolInvocation/invoked": "Course ready.",
      },
    },
    async () => {
      return {
        structuredContent: {},
        content: [
          {
            type: "text",
            text: "The Probabilistic Thinking course is now open. Sign in with your access token to continue.",
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
      const html = await fs.readFile(
        path.join(DIST_DIR, "course-app.html"),
        "utf-8",
      );
      return {
        contents: [
          {
            uri: RESOURCE_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            _meta: {
              ui: {
                prefersBorder: true,
                domain: "prob-thinking",
                csp: {
                  connectDomains: ["https://undeniable-thinking.onrender.com"],
                  resourceDomains: [],
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
