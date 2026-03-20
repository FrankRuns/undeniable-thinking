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
const RESOURCE_URI = "ui://aa-course/course-app-v3.html";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "Affective Analytics Course",
    version: "0.1.0",
  });

  registerAppTool(
    server,
    "open_course",
    {
      title: "Open Affective Analytics Course",
      description:
        "Open the Affective Analytics course. Shows your progress and continues from where you left off. Each lesson teaches a concept through a surprising interactive exercise.",
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
            text: "The course is open. Do not add any commentary — the learner will interact entirely within the course panel.",
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
                domain: "aa-course",
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
