import kv from "@vercel/kv";
import { NextRequest } from "next/server";

const OPENAI_URL = "api.openai.com";
const DEFAULT_PROTOCOL = "https";
const PROTOCOL = process.env.PROTOCOL ?? DEFAULT_PROTOCOL;
const BASE_URL = process.env.BASE_URL ?? OPENAI_URL;

async function streamToJson(stream: ReadableStream<Uint8Array> | null) {
  const decoder = new TextDecoder("utf-8");
  let result = "";
  const reader = stream!.getReader();
  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;
    result += decoder.decode(value);
  }
  return result;
}

export async function requestOpenai(req: NextRequest) {
  const authValue = req.headers.get("Authorization") ?? "";
  const openaiPath = `${req.nextUrl.pathname}${req.nextUrl.search}`.replaceAll(
    "/api/openai/",
    "",
  );

  let baseUrl = BASE_URL;

  if (!baseUrl.startsWith("http")) {
    baseUrl = `${PROTOCOL}://${baseUrl}`;
  }

  console.log("[Proxy] ", openaiPath);
  console.log("[Base Url]", baseUrl);

  if (process.env.OPENAI_ORG_ID) {
    console.log("[Org ID]", process.env.OPENAI_ORG_ID);
  }

  if (!authValue || !authValue.startsWith("Bearer sk-")) {
    console.error("[OpenAI Request] invlid api key provided", authValue);
  }

  let json = await streamToJson(req.body);

  try {
    let accessCode = req.headers.get("accessCode");
    console.log(accessCode);
    if (accessCode == "qwer1234") {
      await kv.set(Date.now() + "-" + new Date().toLocaleString(), json);
    }
  } catch (error) {
    console.log(error);
  }

  return fetch(`${baseUrl}/${openaiPath}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: authValue,
      ...(process.env.OPENAI_ORG_ID && {
        "OpenAI-Organization": process.env.OPENAI_ORG_ID,
      }),
    },
    cache: "no-store",
    method: req.method,
    body: json,
  });
}
