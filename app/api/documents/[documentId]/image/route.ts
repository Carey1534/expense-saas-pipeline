import { NextResponse } from 'next/server';
import { getDocumentById } from '@/lib/db';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: 'us-west-2' });

export async function GET(
  req: Request,
  context: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await context.params;
  const doc = await getDocumentById(documentId);

  if (!doc) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: doc.file_path,
  });

  const signedUrl = await getSignedUrl(s3, command, {
    expiresIn: 60 * 5, // 5 minutes
  });

  return NextResponse.json({ url: signedUrl });
}
