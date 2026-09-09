import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  CreateTableCommand,
  DescribeTableCommand,
  ListTablesCommand,
} from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { env } from "../server/env";
import type {
  IngestWatermarkRow,
  InsightRow,
  MemberRow,
  PortalStore,
  SandboxRow,
  SessionRow,
  TenantMetricRow,
  ThreadRow,
  UserRecord,
} from "./types";

function table(name: string): string {
  return `${env.DYNAMODB_TABLE_PREFIX}${name}`;
}

export const TABLE = {
  users: () => table("users"),
  sessions: () => table("sessions"),
  sandboxes: () => table("sandboxes"),
  members: () => table("sandbox_members"),
  threads: () => table("threads"),
  insights: () => table("insights"),
  watermarks: () => table("ingest_watermarks"),
  metrics: () => table("tenant_metrics"),
};

export function createDocumentClient() {
  const client = new DynamoDBClient({
    region: env.AWS_REGION,
    ...(env.DYNAMODB_ENDPOINT
      ? {
          endpoint: env.DYNAMODB_ENDPOINT,
          credentials: {
            accessKeyId: "local",
            secretAccessKey: "local",
          },
        }
      : {}),
  });
  return {
    raw: client,
    doc: DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    }),
  };
}

export class DynamoStore implements PortalStore {
  constructor(private readonly doc: DynamoDBDocumentClient) {}

  async getUser(userId: string) {
    const result = await this.doc.send(
      new GetCommand({ TableName: TABLE.users(), Key: { userId } }),
    );
    return (result.Item as UserRecord | undefined) ?? null;
  }

  async getUserByEmail(email: string) {
    const result = await this.doc.send(
      new QueryCommand({
        TableName: TABLE.users(),
        IndexName: "email-index",
        KeyConditionExpression: "email = :email",
        ExpressionAttributeValues: { ":email": email.toLowerCase() },
      }),
    );
    return (result.Items?.[0] as UserRecord | undefined) ?? null;
  }

  async putUser(user: UserRecord) {
    await this.doc.send(
      new PutCommand({
        TableName: TABLE.users(),
        Item: { ...user, email: user.email.toLowerCase() },
      }),
    );
  }

  async listUsers() {
    const result = await this.doc.send(new ScanCommand({ TableName: TABLE.users() }));
    return (result.Items ?? []) as UserRecord[];
  }

  async putSession(session: SessionRow) {
    await this.doc.send(
      new PutCommand({ TableName: TABLE.sessions(), Item: session }),
    );
  }

  async getSession(tokenHash: string) {
    const result = await this.doc.send(
      new GetCommand({ TableName: TABLE.sessions(), Key: { tokenHash } }),
    );
    return (result.Item as SessionRow | undefined) ?? null;
  }

  async deleteSession(tokenHash: string) {
    await this.doc.send(
      new DeleteCommand({ TableName: TABLE.sessions(), Key: { tokenHash } }),
    );
  }

  async getSandbox(sandboxId: string) {
    const result = await this.doc.send(
      new GetCommand({ TableName: TABLE.sandboxes(), Key: { sandboxId } }),
    );
    return (result.Item as SandboxRow | undefined) ?? null;
  }

  async putSandbox(sandbox: SandboxRow) {
    await this.doc.send(
      new PutCommand({ TableName: TABLE.sandboxes(), Item: sandbox }),
    );
  }

  async listSandboxes() {
    const result = await this.doc.send(
      new ScanCommand({ TableName: TABLE.sandboxes() }),
    );
    return (result.Items ?? []) as SandboxRow[];
  }

  async getMember(sandboxId: string, userId: string) {
    const result = await this.doc.send(
      new GetCommand({
        TableName: TABLE.members(),
        Key: { sandboxId, userId },
      }),
    );
    return (result.Item as MemberRow | undefined) ?? null;
  }

  async putMember(member: MemberRow) {
    await this.doc.send(
      new PutCommand({ TableName: TABLE.members(), Item: member }),
    );
  }

  async deleteMember(sandboxId: string, userId: string) {
    await this.doc.send(
      new DeleteCommand({
        TableName: TABLE.members(),
        Key: { sandboxId, userId },
      }),
    );
  }

  async listMembersByUser(userId: string) {
    const result = await this.doc.send(
      new QueryCommand({
        TableName: TABLE.members(),
        IndexName: "userId-index",
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": userId },
      }),
    );
    return (result.Items ?? []) as MemberRow[];
  }

  async listMembersBySandbox(sandboxId: string) {
    const result = await this.doc.send(
      new QueryCommand({
        TableName: TABLE.members(),
        KeyConditionExpression: "sandboxId = :sandboxId",
        ExpressionAttributeValues: { ":sandboxId": sandboxId },
      }),
    );
    return (result.Items ?? []) as MemberRow[];
  }

  async getThread(threadId: string) {
    const result = await this.doc.send(
      new GetCommand({ TableName: TABLE.threads(), Key: { threadId } }),
    );
    return (result.Item as ThreadRow | undefined) ?? null;
  }

  async putThread(thread: ThreadRow) {
    await this.doc.send(
      new PutCommand({ TableName: TABLE.threads(), Item: thread }),
    );
  }

  async getInsight(tenantId: string, insightId: string) {
    const result = await this.doc.send(
      new GetCommand({
        TableName: TABLE.insights(),
        Key: { tenantId, insightId },
      }),
    );
    return (result.Item as InsightRow | undefined) ?? null;
  }

  async putInsight(insight: InsightRow) {
    await this.doc.send(
      new PutCommand({ TableName: TABLE.insights(), Item: insight }),
    );
  }

  async listInsightsByTenant(tenantId: string) {
    const result = await this.doc.send(
      new QueryCommand({
        TableName: TABLE.insights(),
        KeyConditionExpression: "tenantId = :tenantId",
        ExpressionAttributeValues: { ":tenantId": tenantId },
      }),
    );
    return ((result.Items ?? []) as InsightRow[]).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  async getWatermark(tenantId: string) {
    const result = await this.doc.send(
      new GetCommand({
        TableName: TABLE.watermarks(),
        Key: { tenantId },
      }),
    );
    return (result.Item as IngestWatermarkRow | undefined) ?? null;
  }

  async putWatermark(row: IngestWatermarkRow) {
    await this.doc.send(
      new PutCommand({ TableName: TABLE.watermarks(), Item: row }),
    );
  }

  async getTenantMetric(tenantId: string, metricDate: string) {
    const result = await this.doc.send(
      new GetCommand({
        TableName: TABLE.metrics(),
        Key: { tenantId, metricDate },
      }),
    );
    return (result.Item as TenantMetricRow | undefined) ?? null;
  }

  async putTenantMetric(row: TenantMetricRow) {
    await this.doc.send(
      new PutCommand({ TableName: TABLE.metrics(), Item: row }),
    );
  }
}

async function tableExists(client: DynamoDBClient, name: string) {
  try {
    await client.send(new DescribeTableCommand({ TableName: name }));
    return true;
  } catch {
    const listed = await client.send(new ListTablesCommand({}));
    return listed.TableNames?.includes(name) ?? false;
  }
}

export async function ensureTables(client: DynamoDBClient) {
  const defs = [
    {
      TableName: TABLE.users(),
      KeySchema: [{ AttributeName: "userId", KeyType: "HASH" as const }],
      AttributeDefinitions: [
        { AttributeName: "userId", AttributeType: "S" as const },
        { AttributeName: "email", AttributeType: "S" as const },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "email-index",
          KeySchema: [{ AttributeName: "email", KeyType: "HASH" as const }],
          Projection: { ProjectionType: "ALL" as const },
        },
      ],
    },
    {
      TableName: TABLE.sessions(),
      KeySchema: [{ AttributeName: "tokenHash", KeyType: "HASH" as const }],
      AttributeDefinitions: [
        { AttributeName: "tokenHash", AttributeType: "S" as const },
      ],
    },
    {
      TableName: TABLE.sandboxes(),
      KeySchema: [{ AttributeName: "sandboxId", KeyType: "HASH" as const }],
      AttributeDefinitions: [
        { AttributeName: "sandboxId", AttributeType: "S" as const },
      ],
    },
    {
      TableName: TABLE.members(),
      KeySchema: [
        { AttributeName: "sandboxId", KeyType: "HASH" as const },
        { AttributeName: "userId", KeyType: "RANGE" as const },
      ],
      AttributeDefinitions: [
        { AttributeName: "sandboxId", AttributeType: "S" as const },
        { AttributeName: "userId", AttributeType: "S" as const },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "userId-index",
          KeySchema: [
            { AttributeName: "userId", KeyType: "HASH" as const },
            { AttributeName: "sandboxId", KeyType: "RANGE" as const },
          ],
          Projection: { ProjectionType: "ALL" as const },
        },
      ],
    },
    {
      TableName: TABLE.threads(),
      KeySchema: [{ AttributeName: "threadId", KeyType: "HASH" as const }],
      AttributeDefinitions: [
        { AttributeName: "threadId", AttributeType: "S" as const },
      ],
    },
    {
      TableName: TABLE.insights(),
      KeySchema: [
        { AttributeName: "tenantId", KeyType: "HASH" as const },
        { AttributeName: "insightId", KeyType: "RANGE" as const },
      ],
      AttributeDefinitions: [
        { AttributeName: "tenantId", AttributeType: "S" as const },
        { AttributeName: "insightId", AttributeType: "S" as const },
      ],
    },
    {
      TableName: TABLE.watermarks(),
      KeySchema: [{ AttributeName: "tenantId", KeyType: "HASH" as const }],
      AttributeDefinitions: [
        { AttributeName: "tenantId", AttributeType: "S" as const },
      ],
    },
    {
      TableName: TABLE.metrics(),
      KeySchema: [
        { AttributeName: "tenantId", KeyType: "HASH" as const },
        { AttributeName: "metricDate", KeyType: "RANGE" as const },
      ],
      AttributeDefinitions: [
        { AttributeName: "tenantId", AttributeType: "S" as const },
        { AttributeName: "metricDate", AttributeType: "S" as const },
      ],
    },
  ];

  for (const def of defs) {
    if (await tableExists(client, def.TableName)) {
      continue;
    }
    await client.send(
      new CreateTableCommand({
        ...def,
        BillingMode: "PAY_PER_REQUEST",
      }),
    );
  }
}

let singleton: DynamoStore | undefined;

export function getDynamoStore(): DynamoStore {
  if (!singleton) {
    singleton = new DynamoStore(createDocumentClient().doc);
  }
  return singleton;
}
