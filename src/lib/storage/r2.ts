import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let client: S3Client | undefined;

function config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Configuration R2 incomplète.");
  }

  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function r2() {
  const values = config();
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${values.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: values.accessKeyId,
      secretAccessKey: values.secretAccessKey,
    },
  });
  return { client, bucket: values.bucket };
}

export function buildShopObjectKey(shopId: string, fileName: string) {
  const safeFileName = fileName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-120);
  return `shops/${shopId}/${crypto.randomUUID()}-${safeFileName || "asset"}`;
}

export async function createR2UploadUrl({
  key,
  contentType,
  expiresIn = 10 * 60,
}: {
  key: string;
  contentType: string;
  expiresIn?: number;
}) {
  const { client: r2Client, bucket } = r2();
  return getSignedUrl(
    r2Client,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
    { expiresIn },
  );
}

export async function createR2DownloadUrl(key: string, expiresIn = 5 * 60) {
  const { client: r2Client, bucket } = r2();
  return getSignedUrl(
    r2Client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn },
  );
}

export async function deleteR2Object(key: string) {
  const { client: r2Client, bucket } = r2();
  await r2Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export function getR2PublicUrl(key: string) {
  const publicBaseUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  if (!publicBaseUrl) throw new Error("R2_PUBLIC_URL n'est pas configurée.");
  return `${publicBaseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Dépose un objet depuis le serveur (route d'upload). Les images de boutique
 * sont publiques par construction : elles s'affichent sur la page du vendeur.
 */
export async function putR2Object({
  key,
  body,
  contentType,
}: {
  key: string;
  body: Uint8Array;
  contentType: string;
}) {
  const { client: r2Client, bucket } = r2();
  await r2Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}
