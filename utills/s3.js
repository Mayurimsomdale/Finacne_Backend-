// utills/s3.js
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

// ── Client singleton ──────────────────────────────────────────────────────────
let _s3Client = null;

function getS3Client() {
  if (_s3Client) return _s3Client;
  _s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  return _s3Client;
}

const BUCKET = () => process.env.AWS_BUCKET_NAME;
const REGION = () => process.env.AWS_REGION;

// ── Build the public URL from a stored key ────────────────────────────────────
export function getS3Url(key) {
  if (!key) return null;
  const cleanKey = key.replace(/^\//, "");
  return `https://${BUCKET()}.s3.${REGION()}.amazonaws.com/${cleanKey}`;
}

// ── Generate a presigned URL (temporary, works even for private buckets) ──────
/**
 * Returns a time-limited signed URL that lets the browser load a private S3 object.
 *
 * @param {string|null} key        — S3 object key as stored in the DB
 * @param {number}      expiresIn  — seconds until the URL expires (default: 1 hour)
 * @returns {Promise<string|null>}
 */
export async function getPresignedUrl(key, expiresIn = 3600) {
  if (!key) return null;
  const cleanKey = key.replace(/^\//, "");
  const command = new GetObjectCommand({
    Bucket: BUCKET(),
    Key: cleanKey,
  });
  return await getSignedUrl(getS3Client(), command, { expiresIn });
}

// ── Upload a single multer file (buffer) to S3 ────────────────────────────────
export const uploadFileToS3 = async (file, folder = "uploads") => {
  if (!file) throw new Error("File is required");
  const extension = file.originalname.split(".").pop();
  const key = `${folder}/${uuidv4()}.${extension}`;
  const command = new PutObjectCommand({
    Bucket: BUCKET(),
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  });
  await getS3Client().send(command);
  return { key, url: getS3Url(key) };
};

// ── Upload multiple multer files to S3 in parallel ────────────────────────────
export const uploadMultipleFilesToS3 = async (files, folder = "uploads") => {
  if (!files?.length) throw new Error("No files provided");
  return Promise.all(files.map((file) => uploadFileToS3(file, folder)));
};

// ── Delete a single file from S3 by its stored key ───────────────────────────
export const deleteFileFromS3 = async (key) => {
  if (!key) return;
  try {
    const cleanKey = key.replace(/^\//, "");
    const command = new DeleteObjectCommand({
      Bucket: BUCKET(),
      Key: cleanKey,
    });
    await getS3Client().send(command);
  } catch (err) {
    console.warn(`[S3] deleteFileFromS3 failed for key "${key}":`, err.message);
  }
};

// ── Delete multiple files from S3 in parallel ────────────────────────────────
export const deleteMultipleFilesFromS3 = async (keys = []) => {
  await Promise.all(keys.map((key) => deleteFileFromS3(key)));
};

export default {
  uploadFileToS3,
  uploadMultipleFilesToS3,
  deleteFileFromS3,
  deleteMultipleFilesFromS3,
  getS3Url,
  getPresignedUrl,
};
