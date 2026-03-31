import jwt from "jsonwebtoken";
import type { Config } from "../config.js";
import { DocumentServerError } from "../lib/errors.js";

interface CommandRequest {
  c: "info" | "drop" | "forcesave" | "meta" | "version" | "license";
  key?: string;
  users?: string[];
  meta?: { title: string };
  userdata?: string;
}

interface ConversionRequest {
  filetype: string;
  key: string;
  outputtype: string;
  url: string;
  async?: boolean;
  title?: string;
}

interface BuilderRequest {
  url: string;
  async?: boolean;
  key?: string;
  argument?: Record<string, unknown>;
}

interface ConversionResponse {
  endConvert: boolean;
  fileType?: string;
  fileUrl?: string;
  percent: number;
  error?: number;
}

interface BuilderResponse {
  key: string;
  end: boolean;
  urls?: Record<string, string>;
  error?: number;
}

export class DocumentServerClient {
  private readonly baseUrl: string;
  private readonly secret: string;

  constructor(config: Config) {
    this.baseUrl = config.documentServerUrl.replace(/\/$/, "");
    this.secret = config.jwtSecret;
  }

  private signPayload(payload: Record<string, unknown>): string {
    return jwt.sign(payload, this.secret, { algorithm: "HS256", expiresIn: "5m" });
  }

  private async post<T>(endpoint: string, body: object): Promise<T> {
    const bodyRecord = body as Record<string, unknown>;
    const token = this.signPayload(bodyRecord);
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${this.signPayload({ payload: bodyRecord })}`,
      },
      body: JSON.stringify({ ...bodyRecord, token }),
    });

    if (!response.ok) {
      throw new Error(
        `Document Server returned HTTP ${response.status}: ${response.statusText}`,
      );
    }

    return response.json() as Promise<T>;
  }

  async command(request: CommandRequest): Promise<Record<string, unknown>> {
    const result = await this.post<Record<string, unknown>>("/command", request);
    const error = result.error as number | undefined;
    if (error !== undefined && error !== 0) {
      throw new DocumentServerError(error, `command:${request.c}`);
    }
    return result;
  }

  async convert(request: ConversionRequest): Promise<ConversionResponse> {
    const result = await this.post<ConversionResponse>("/converter", request);
    if (result.error !== undefined && result.error !== 0) {
      throw new DocumentServerError(result.error, "conversion");
    }
    return result;
  }

  async convertAndPoll(
    request: ConversionRequest,
    maxAttempts = 30,
    intervalMs = 1000,
  ): Promise<ConversionResponse> {
    const asyncRequest = { ...request, async: true };
    let result = await this.convert(asyncRequest);

    let attempts = 0;
    while (!result.endConvert && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      result = await this.convert(asyncRequest);
      attempts++;
    }

    if (!result.endConvert) {
      throw new Error("Conversion timed out after polling");
    }

    return result;
  }

  async build(request: BuilderRequest): Promise<BuilderResponse> {
    const result = await this.post<BuilderResponse>("/docbuilder", request);
    if (result.error !== undefined && result.error !== 0) {
      throw new DocumentServerError(result.error, "docbuilder");
    }
    return result;
  }

  async buildAndPoll(
    request: BuilderRequest,
    maxAttempts = 60,
    intervalMs = 1000,
  ): Promise<BuilderResponse> {
    const key = request.key ?? crypto.randomUUID();
    const asyncRequest = { ...request, async: true, key };
    let result = await this.build(asyncRequest);

    let attempts = 0;
    while (!result.end && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      result = await this.build({ ...asyncRequest, key });
      attempts++;
    }

    if (!result.end) {
      throw new Error("Document generation timed out after polling");
    }

    return result;
  }
}
